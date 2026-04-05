#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

const DEFAULT_CONFIG_PATH = path.join(
  process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"),
  "todoist-cli",
  "config.json",
);
const TODOIST_API_BASE_URL = "https://api.todoist.com/api/v1/";
const RETRYABLE_HTTP_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
const IDEMPOTENT_RETRY_METHODS = new Set(["GET"]);
const MAX_API_RETRY_ATTEMPTS = 3;
const BASE_API_RETRY_DELAY_MS = 500;
const API_REQUEST_TIMEOUT_MS = 15000;

const HELP_TEXT = `todoist-cli - CLI wrapper around Todoist.

Usage:
  todoist-cli <command> [options]
  todoist-cli <command> -h|--help

Commands:
  whoami, overview, list, find, show, activity, today, completed-list, projects, sections, labels
  add, comment, quick, modify, move, done, close, reopen, delete
  doctor

Global options:
  --json             Print structured JSON output
  --compact          Print a lightweight summary for common read commands
  --config <path>    Override config path

Examples:
  todoist-cli today
  todoist-cli add "Pay rent tomorrow 9am #Inbox"
`;

const HELP_BY_COMMAND = {
  list: `todoist-cli list [options] - list active tasks

Options:
  --project <id|name>   Filter by project
  --label <name>        Filter by label
  --today               Only today's tasks
  --overdue             Only overdue tasks
  --limit <n>           Limit results (default: 20)

Examples:
  todoist-cli list --project inbox
  todoist-cli list --today
  todoist-cli list --project 0 --label 0`,

  find: `todoist-cli find <text> [options] - local text search over active tasks

Options:
  --limit <n>   Limit results (default: 20)

Examples:
  todoist-cli find "registry"
  todoist-cli find "gateway nginx"`,

  add: `todoist-cli add <title> [due] [options] - create a task

Options:
  --project <id|name>   Project
  --section <id|name>   Section
  --parent <task-ref>   Parent task
  --description <text>  Description
  --label <a,b>         Labels (comma-separated)
  --priority <p1-p4>    Priority

Examples:
  todoist-cli add "Pay rent" "tomorrow 9am"
  todoist-cli add "Fix gateway" --project 0 --priority p1
  todoist-cli add "Write tests" --parent "Release prep"`,

  quick: `todoist-cli quick <text> - quick-add with natural language parsing

Examples:
  todoist-cli quick "Pay rent tomorrow 9am #Inbox"
  todoist-cli quick "Review PR @0 tomorrow"`,

  modify: `todoist-cli modify <task-ref> [options] - update a task

Options:
  --content <text>      New title
  --description <text>  New description
  --priority <p1-p4>    New priority
  --due <text>          New due date (natural language)
  --label <a,b>         Replace labels
  --uncompletable       Mark as uncompletable
  --completable         Mark as completable

Examples:
  todoist-cli modify "Pay rent" --priority p1
  todoist-cli modify "Pay rent" --due "tomorrow"`,

  move: `todoist-cli move <task-ref> [options] - move a task

Options:
  --project <id|name>   Destination project
  --section <id|name>   Destination section
  --parent <task-ref>   New parent task
  --no-parent           Move to project root
  --no-section          Remove section placement

Examples:
  todoist-cli move "Pay rent" --project inbox
  todoist-cli move "Pay rent" --project 0 --section "3.0"`,

  show: `todoist-cli show <task-ref> - show one task

Examples:
  todoist-cli show "Pay rent"
  todoist-cli show id:<task-id>`,

  comment: `todoist-cli comment <ref> [options] - list or add comments

Options:
  --project         Treat ref as a project
  --add <text>      Add a comment
  --limit <n>       Limit listed comments (default: 20)

Examples:
  todoist-cli comment "Pay rent"
  todoist-cli comment "Pay rent" --add "Looks good"`,

  activity: `todoist-cli activity [options] - list recent activity

Options:
  --project <id|name>   Filter by project
  --object <type>       task | comment | project
  --event <type>        added | updated | deleted | completed | uncompleted
  --since <date>        Start date (YYYY-MM-DD)
  --until <date>        End date (YYYY-MM-DD)
  --limit <n>           Limit results (default: 20)

Examples:
  todoist-cli activity --event completed --since 2026-03-01 --until 2026-03-14
  todoist-cli activity --object task --event added --limit 10`,

  doctor: `todoist-cli doctor - check config, token, and API reachability`,

  done: `todoist-cli done <task-ref...> [options] - complete tasks

Options:
  --forever   Permanently complete a recurring task

Examples:
  todoist-cli done "Pay rent"
  todoist-cli done "Task A" "Task B"`,

  close: `todoist-cli close - alias of: todoist-cli done`,

  reopen: `todoist-cli reopen <task-ref...> - reopen completed tasks

Examples:
  todoist-cli reopen "Pay rent"`,

  delete: `todoist-cli delete <task-ref...> - delete tasks

Examples:
  todoist-cli delete "Pay rent"
  todoist-cli delete "Task A" "Task B"`,

  projects: `todoist-cli projects [query] [options] - list or search projects

Options:
  --limit <n>   Limit results (default: 20)

Examples:
  todoist-cli projects
  todoist-cli projects inbox`,

  labels: `todoist-cli labels [options] - list labels

Options:
  --limit <n>   Limit results (default: 100)`,

  sections: `todoist-cli sections [options] - list sections

Options:
  --project <id|name>   Filter by project
  --limit <n>           Limit results (default: 100)

Examples:
  todoist-cli sections --project inbox`,

  today: `todoist-cli today [options] - list today's tasks

Options:
  --days <n>        Number of days (default: 1)
  --start <date>    Start date (default: today)
  --overdue <mode>  include-overdue | overdue-only | exclude-overdue
  --limit <n>       Limit results (default: 50)

Examples:
  todoist-cli today
  todoist-cli today --days 3 --overdue overdue-only`,

  "completed-list": `todoist-cli completed-list [options] - list recently completed tasks

Options:
  --days <n>    Look back this many days (default: 7)
  --limit <n>   Limit results (default: 50)

Examples:
  todoist-cli completed-list --days 7
  todoist-cli completed-list --days 30 --limit 100`,

  whoami: `todoist-cli whoami - show account identity and plan`,

  overview: `todoist-cli overview - show account overview (projects, sections, inbox)`,
};

const HELP_SHARED_OPTIONS = `  --json                Output as JSON
  --compact             Lightweight summary
  -h, --help            Show this help`;

for (const [key, text] of Object.entries(HELP_BY_COMMAND)) {
  const hasOptions = text.includes('\nOptions:\n');
  const hasExamples = text.includes('\nExamples:\n');
  let updated = text;
  if (hasOptions && hasExamples) {
    updated = updated.replace('\n\nExamples:', `\n${HELP_SHARED_OPTIONS}\n\nExamples:`);
  } else if (hasOptions) {
    updated = updated.trimEnd() + '\n' + HELP_SHARED_OPTIONS;
  } else if (hasExamples) {
    updated = updated.replace('\n\nExamples:', `\n\nOptions:\n${HELP_SHARED_OPTIONS}\n\nExamples:`);
  } else {
    updated = updated.trimEnd() + `\n\nOptions:\n${HELP_SHARED_OPTIONS}`;
  }
  HELP_BY_COMMAND[key] = updated;
}

function mapPremiumStatus(status) {
  switch (status) {
    case "current_personal_plan": return "Todoist Pro";
    case "legacy_personal_plan": return "Todoist Pro (Legacy)";
    case "teams_business_member": return "Todoist Business";
    default: return "Todoist Free";
  }
}

function exitWithError(message) {
  console.error(message);
  process.exit(1);
}

function printHelp(command) {
  if (!command) {
    console.log(HELP_TEXT);
    return;
  }
  const key = String(command).trim().toLowerCase();
  const text = HELP_BY_COMMAND[key];
  if (!text) {
    exitWithError(`Unknown help topic: ${command}`);
  }
  console.log(text);
}

function wantsCommandHelp(args, options) {
  return args.includes("-h") || args.includes("--help") || Boolean(options.help);
}

function normalizePriority(priority) {
  if (typeof priority === "string") {
    const lowered = priority.trim().toLowerCase();
    if (/^p[1-4]$/.test(lowered)) {
      return lowered;
    }
  }
  const value = Number(priority);
  if (!Number.isFinite(value)) {
    return "p4";
  }
  const mapped = Math.min(4, Math.max(1, 5 - value));
  return `p${mapped}`;
}

function normalizeTaskContentForCompletableToggle(content, isUncompletable) {
  if (typeof content !== "string") {
    return content;
  }
  if (isUncompletable) {
    return content;
  }
  return content.replace(/^\*\s*/, "");
}

function toApiPriority(priority) {
  const normalized = normalizePriority(priority);
  return 5 - Number(normalized.slice(1));
}

function dueToString(task) {
  if (!task?.due) {
    return undefined;
  }
  return task.due.dateTime || task.due.date || task.due.string || undefined;
}

function formatTask(task, projectNameById) {
  return {
    id: task.id,
    content: task.content,
    description: task.description || "",
    dueDate: dueToString(task),
    recurring: Boolean(task.due?.isRecurring),
    priority: normalizePriority(task.priority),
    projectId: task.projectId,
    projectName: projectNameById.get(task.projectId) || undefined,
    sectionId: task.sectionId || undefined,
    parentId: task.parentId || undefined,
    labels: task.labels || [],
    checked: Boolean(task.checked),
    url: task.url,
  };
}

function formatLabel(label) {
  return {
    id: label.id,
    name: label.name,
    color: label.color,
    isFavorite: Boolean(label.isFavorite),
  };
}

function formatSection(section, projectNameById) {
  return {
    id: section.id,
    name: section.name,
    projectId: section.projectId,
    projectName: projectNameById.get(section.projectId) || undefined,
  };
}

function formatComment(comment) {
  return {
    id: comment.id,
    content: comment.content,
    postedAt: comment.postedAt,
    taskId: comment.taskId || undefined,
    projectId: comment.projectId || undefined,
    hasAttachment: Boolean(comment.fileAttachment),
  };
}

function formatActivityEvent(event) {
  return {
    id: event.id || undefined,
    objectType: event.objectType,
    objectId: event.objectId,
    eventType: event.eventType,
    eventDate: event.eventDate,
    parentProjectId: event.parentProjectId || undefined,
    parentItemId: event.parentItemId || undefined,
    initiatorId: event.initiatorId || undefined,
    extraData: event.extraData || undefined,
  };
}

function formatCompletedTaskAsActivityEvent(task, projectNameById) {
  return {
    id: task.id,
    objectType: "task",
    objectId: task.id,
    eventType: "completed",
    eventDate: task.completedAt || task.updatedAt || task.addedAt || undefined,
    parentProjectId: task.projectId || undefined,
    parentItemId: task.parentId || undefined,
    extraData: {
      content: task.content,
      projectName: projectNameById.get(task.projectId) || undefined,
      dueDate: task.due?.date || undefined,
      url: task.url || undefined,
    },
  };
}

function isCompletedTaskActivityRequest(options) {
  const eventIsCompleted = options.event === "completed";
  const objectIsTaskLike = options.object === undefined || options.object === "task";
  return eventIsCompleted
    && objectIsTaskLike
    && typeof options.since === "string"
    && typeof options.until === "string";
}

async function loadPrimaryCompletedTaskActivityEvents(client, options, parentProjectId, projectName) {
  const limit = Number(options.limit ?? 20);
  const response = await client.getCompletedTasksByCompletionDate({
    since: options.since,
    until: options.until,
    ...(parentProjectId ? { projectId: parentProjectId } : {}),
    limit,
  });
  const projects = await loadProjects(client);
  const projectNameById = new Map(projects.map((project) => [project.id, project.name]));
  const events = (response.items ?? []).map((task) => formatCompletedTaskAsActivityEvent(task, projectNameById));
  return {
    events,
    totalCount: events.length,
    hasMore: Boolean(response.nextCursor),
    appliedFilters: {
      ...(parentProjectId ? { projectId: parentProjectId, projectName } : {}),
      objectEventTypes: options.object === "task" ? "task:completed" : ":completed",
      since: options.since,
      until: options.until,
      limit,
      source: "completed-tasks-by-completion-date",
    },
  };
}

function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    exitWithError(
      `Failed to read config ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function resolveConfigPath(options) {
  return typeof options.config === "string" && options.config.trim().length > 0
    ? path.resolve(options.config)
    : DEFAULT_CONFIG_PATH;
}

function resolveTokenInfo(configPath) {
  const config = loadConfig(configPath);
  if (typeof process.env.TODOIST_API_KEY === "string" && process.env.TODOIST_API_KEY.trim()) {
    return { token: process.env.TODOIST_API_KEY.trim(), source: "env:TODOIST_API_KEY", config };
  }
  if (typeof process.env.TODOIST_API_TOKEN === "string" && process.env.TODOIST_API_TOKEN.trim()) {
    return { token: process.env.TODOIST_API_TOKEN.trim(), source: "env:TODOIST_API_TOKEN", config };
  }
  if (typeof config.token === "string" && config.token.trim()) {
    return { token: config.token.trim(), source: "config", config };
  }
  return { token: "", source: "missing", config };
}

function getClient(options) {
  const configPath = resolveConfigPath(options);
  const { token } = resolveTokenInfo(configPath);
  if (!token) {
    exitWithError(
      `Missing Todoist token. Set TODOIST_API_KEY/TODOIST_API_TOKEN or write {"token":"..."} to ${configPath}.`,
    );
  }
  return createTodoistClient(token);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function processTaskContent(content, isUncompletable) {
  if (typeof content !== "string") {
    return content;
  }
  if (isUncompletable === false) {
    return content.replace(/^\*\s*/, "");
  }
  if (content.startsWith("* ") || isUncompletable !== true) {
    return content;
  }
  return `* ${content}`;
}

function snakeToCamelKey(key) {
  return key.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
}

function camelToSnakeKey(key) {
  return key.replace(/[A-Z]/g, (ch) => `_${ch.toLowerCase()}`);
}

function camelizeDeep(value) {
  if (Array.isArray(value)) {
    return value.map(camelizeDeep);
  }
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, innerValue]) => [snakeToCamelKey(key), camelizeDeep(innerValue)]),
    );
  }
  return value;
}

function snakeCaseDeep(value) {
  if (Array.isArray(value)) {
    return value.map(snakeCaseDeep);
  }
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, innerValue]) => innerValue !== undefined)
        .map(([key, innerValue]) => [camelToSnakeKey(key), snakeCaseDeep(innerValue)]),
    );
  }
  return value;
}

function normalizeObjectTypeForApi(objectType) {
  if (objectType === "task") {
    return "item";
  }
  if (objectType === "comment") {
    return "note";
  }
  return objectType;
}

function denormalizeObjectTypeFromApi(objectType) {
  if (objectType === "item") {
    return "task";
  }
  if (objectType === "note") {
    return "comment";
  }
  return objectType;
}

function normalizeObjectEventTypeForApi(filter) {
  const colonIndex = String(filter).indexOf(":");
  if (colonIndex === -1) {
    return normalizeObjectTypeForApi(filter);
  }
  const objectPart = filter.slice(0, colonIndex);
  const eventPart = filter.slice(colonIndex);
  return `${normalizeObjectTypeForApi(objectPart) ?? objectPart}${eventPart}`;
}

function parseRetryAfterMs(headers) {
  const retryAfterHeader =
    typeof headers?.get === "function"
      ? headers.get("retry-after")
      : headers?.["retry-after"] || headers?.["Retry-After"];
  if (!retryAfterHeader) {
    return null;
  }
  const numericSeconds = Number(retryAfterHeader);
  if (Number.isFinite(numericSeconds) && numericSeconds >= 0) {
    return numericSeconds * 1000;
  }
  const retryAt = Date.parse(retryAfterHeader);
  if (Number.isFinite(retryAt)) {
    return Math.max(0, retryAt - Date.now());
  }
  return null;
}

function shouldRetryHttpResponse(method, status) {
  if (!RETRYABLE_HTTP_STATUS_CODES.has(status)) {
    return false;
  }
  if (status === 429) {
    return true;
  }
  return IDEMPOTENT_RETRY_METHODS.has(method);
}

function getRetryDelayMs(responseHeaders, attempt) {
  const retryAfterMs = parseRetryAfterMs(responseHeaders);
  if (retryAfterMs !== null) {
    return retryAfterMs;
  }
  return BASE_API_RETRY_DELAY_MS * (2 ** (attempt - 1));
}

function shouldRetryNetworkError(method, options, error) {
  const hasRequestId = Boolean(options?.headers?.["X-Request-Id"] || options?.headers?.["x-request-id"]);
  if (!(error instanceof Error)) {
    return false;
  }
  if (error.name === "TimeoutError") {
    return true;
  }
  return IDEMPOTENT_RETRY_METHODS.has(method) || hasRequestId;
}

async function fetchWithTimeout(url, fetchOptions) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    const timeoutError = new Error(`Request timed out after ${API_REQUEST_TIMEOUT_MS}ms`);
    timeoutError.name = "TimeoutError";
    controller.abort(timeoutError);
  }, API_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...fetchOptions, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted && controller.signal.reason instanceof Error) {
      throw controller.signal.reason;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function todoistRetryingFetch(url, options = {}) {
  const { timeout: _timeout, ...fetchOptions } = options;
  const method = String(fetchOptions.method || "GET").toUpperCase();
  for (let attempt = 1; attempt <= MAX_API_RETRY_ATTEMPTS; attempt += 1) {
    let response;
    try {
      response = await fetchWithTimeout(url, fetchOptions);
    } catch (error) {
      if (attempt === MAX_API_RETRY_ATTEMPTS || !shouldRetryNetworkError(method, fetchOptions, error)) {
        throw error;
      }
      await sleep(BASE_API_RETRY_DELAY_MS * (2 ** (attempt - 1)));
      continue;
    }
    if (!shouldRetryHttpResponse(method, response.status) || attempt === MAX_API_RETRY_ATTEMPTS) {
      return response;
    }
    await sleep(getRetryDelayMs(response.headers, attempt));
  }
  return fetchWithTimeout(url, fetchOptions);
}

async function parseResponseBody(response) {
  if (response.status === 204) {
    return undefined;
  }
  const text = await response.text();
  if (!text) {
    return undefined;
  }
  try {
    return camelizeDeep(JSON.parse(text));
  } catch {
    return text;
  }
}

function createApiError(message, status, responseData) {
  const error = new Error(message);
  error.httpStatusCode = status;
  error.responseData = responseData;
  return error;
}

function appendQueryParams(url, params = {}) {
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    if (Array.isArray(value) || (value && typeof value === "object" && !(value instanceof Date))) {
      url.searchParams.append(camelToSnakeKey(key), JSON.stringify(snakeCaseDeep(value)));
      return;
    }
    url.searchParams.append(camelToSnakeKey(key), String(value));
  });
}

async function todoistRequest(token, { method = "GET", path: relativePath, query, body, requestId }) {
  const url = new URL(relativePath, TODOIST_API_BASE_URL);
  appendQueryParams(url, query);
  const headers = {
    Authorization: `Bearer ${token}`,
    Connection: "close",
  };
  const normalizedMethod = method.toUpperCase();
  if (requestId) {
    headers["X-Request-Id"] = requestId;
  }
  const requestOptions = {
    method: normalizedMethod,
    headers,
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    requestOptions.body = JSON.stringify(snakeCaseDeep(body));
  }
  const response = await todoistRetryingFetch(url.toString(), requestOptions);
  const responseData = await parseResponseBody(response);
  if (!response.ok) {
    const detail =
      typeof responseData === "object" && responseData !== null && typeof responseData.error === "string"
        ? responseData.error
        : null;
    throw createApiError(
      detail ? `HTTP ${response.status}: ${response.statusText}\n${detail}` : `HTTP ${response.status}: ${response.statusText}`,
      response.status,
      responseData,
    );
  }
  return responseData;
}

function toPaginatedResults(data, limit) {
  if (Array.isArray(data)) {
    return {
      results: typeof limit === "number" ? data.slice(0, limit) : data,
      nextCursor: null,
    };
  }
  return {
    results: Array.isArray(data?.results) ? data.results : [],
    nextCursor: data?.nextCursor || null,
  };
}

function createTodoistClient(token) {
  return {
    async getUser() {
      return todoistRequest(token, { path: "user" });
    },
    async getProjects(args = {}) {
      const data = await todoistRequest(token, { path: "projects", query: args });
      return toPaginatedResults(data, args.limit);
    },
    async searchProjects(args = {}) {
      const data = await todoistRequest(token, { path: "projects/search", query: args });
      return toPaginatedResults(data, args.limit);
    },
    async getSections(args = {}) {
      const data = await todoistRequest(token, { path: "sections", query: args });
      return toPaginatedResults(data, args.limit);
    },
    async getLabels(args = {}) {
      const data = await todoistRequest(token, { path: "labels", query: args });
      return toPaginatedResults(data, args.limit);
    },
    async getTasks(args = {}) {
      const data = await todoistRequest(token, { path: "tasks", query: args });
      return toPaginatedResults(data, args.limit);
    },
    async getTasksByFilter(args = {}) {
      const data = await todoistRequest(token, { path: "tasks/filter", query: { query: args.query, limit: args.limit } });
      return toPaginatedResults(data, args.limit);
    },
    async getTask(id) {
      return todoistRequest(token, { path: `tasks/${id}` });
    },
    async addTask(args, requestId = randomUUID()) {
      return todoistRequest(token, {
        method: "POST",
        path: "tasks",
        body: {
          ...args,
          content: processTaskContent(args.content, args.isUncompletable),
        },
        requestId,
      });
    },
    async quickAddTask(args) {
      return todoistRequest(token, {
        method: "POST",
        path: "tasks/quick",
        body: {
          ...args,
          text: processTaskContent(args.text, args.isUncompletable),
        },
      });
    },
    async updateTask(id, args, requestId = randomUUID()) {
      const normalizedArgs = args.dueString === null ? { ...args, dueString: "no date" } : args;
      const processedArgs = normalizedArgs.content && normalizedArgs.isUncompletable !== undefined
        ? { ...normalizedArgs, content: processTaskContent(normalizedArgs.content, normalizedArgs.isUncompletable) }
        : normalizedArgs;
      const { order, ...rest } = processedArgs;
      return todoistRequest(token, {
        method: "POST",
        path: `tasks/${id}`,
        body: order !== undefined ? { ...rest, childOrder: order } : rest,
        requestId,
      });
    },
    async moveTask(id, args, requestId = randomUUID()) {
      return todoistRequest(token, {
        method: "POST",
        path: `tasks/${id}/move`,
        body: args,
        requestId,
      });
    },
    async closeTask(id, requestId = randomUUID()) {
      await todoistRequest(token, {
        method: "POST",
        path: `tasks/${id}/close`,
        requestId,
      });
      return true;
    },
    async reopenTask(id, requestId = randomUUID()) {
      await todoistRequest(token, {
        method: "POST",
        path: `tasks/${id}/reopen`,
        requestId,
      });
      return true;
    },
    async deleteTask(id, requestId = randomUUID()) {
      await todoistRequest(token, {
        method: "DELETE",
        path: `tasks/${id}`,
        requestId,
      });
      return true;
    },
    async getComments(args = {}) {
      const data = await todoistRequest(token, { path: "comments", query: args });
      return toPaginatedResults(data, args.limit);
    },
    async addComment(args, requestId = randomUUID()) {
      return todoistRequest(token, {
        method: "POST",
        path: "comments",
        body: args,
        requestId,
      });
    },
    async getCompletedTasksByCompletionDate(args) {
      const data = await todoistRequest(token, {
        path: "tasks/completed/by_completion_date",
        query: args,
      });
      return {
        items: Array.isArray(data?.items) ? data.items : [],
        nextCursor: data?.nextCursor || null,
      };
    },
    async getActivityLogs(args = {}) {
      const normalizedArgs = {
        ...args,
        ...(args.objectEventTypes !== undefined
          ? {
              objectEventTypes: (Array.isArray(args.objectEventTypes) ? args.objectEventTypes : [args.objectEventTypes])
                .map(normalizeObjectEventTypeForApi),
            }
          : {}),
      };
      const data = await todoistRequest(token, { path: "activities", query: normalizedArgs });
      const results = Array.isArray(data?.results)
        ? data.results.map((event) => ({
            ...event,
            objectType: denormalizeObjectTypeFromApi(event.objectType),
          }))
        : [];
      return {
        results,
        nextCursor: data?.nextCursor || null,
      };
    },
    async sync(syncRequest, requestId = randomUUID()) {
      const data = await todoistRequest(token, {
        method: "POST",
        path: "sync",
        body: {
          ...syncRequest,
          ...(Array.isArray(syncRequest.commands)
            ? {
                commands: syncRequest.commands.map((command) => ({
                  ...command,
                  args: snakeCaseDeep(command.args || {}),
                })),
              }
            : {}),
        },
        requestId,
      });
      if (data?.syncStatus && typeof data.syncStatus === "object") {
        for (const value of Object.values(data.syncStatus)) {
          if (value !== "ok") {
            throw createApiError(value.error || "Sync command failed", value.httpCode || 400, value.errorExtra || value);
          }
        }
      }
      return data;
    },
  };
}

function parseJsonArg(raw) {
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    exitWithError(`Invalid JSON args: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function parseArgs(argv) {
  const positionals = [];
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (!value.startsWith("--")) {
      positionals.push(value);
      continue;
    }
    const name = value.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      options[name] = true;
      continue;
    }
    options[name] = next;
    i += 1;
  }
  return { positionals, options };
}

function normalizeSelector(raw) {
  if (typeof raw !== "string") {
    return "";
  }
  return raw.trim().toLowerCase();
}

function parseTodoistUrl(raw) {
  if (typeof raw !== "string") {
    return null;
  }
  const match = raw.trim().match(/^https?:\/\/app\.todoist\.com\/app\/(task|project|section)\/([^?#/]+)/i);
  if (!match) {
    return null;
  }
  const entityType = match[1].toLowerCase();
  const slugAndId = match[2];
  const lastHyphenIndex = slugAndId.lastIndexOf("-");
  const id = lastHyphenIndex === -1 ? slugAndId : slugAndId.slice(lastHyphenIndex + 1);
  return { entityType, id };
}

function isExplicitIdRef(raw) {
  return typeof raw === "string" && raw.trim().startsWith("id:");
}

function looksLikeRawId(raw) {
  if (typeof raw !== "string") {
    return false;
  }
  const trimmed = raw.trim();
  if (!trimmed || /\s/.test(trimmed)) {
    return false;
  }
  return /^\d+$/.test(trimmed) || (/[a-zA-Z]/.test(trimmed) && /\d/.test(trimmed));
}

function toIdRef(raw) {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("id:")) {
    return trimmed.slice(3);
  }
  const parsedUrl = parseTodoistUrl(trimmed);
  if (parsedUrl) {
    return parsedUrl.id;
  }
  return trimmed;
}

function formatCandidateList(items, labelFormatter) {
  return items.slice(0, 5).map((item) => `- ${labelFormatter(item)}`).join("\n");
}

function selectFromList(items, rawSelector, getName, entityName, context) {
  const selector = normalizeSelector(rawSelector);
  if (!selector) {
    return null;
  }

  const directId = toIdRef(rawSelector);
  const byId = items.find((item) => item.id === directId);
  if (byId) {
    return byId;
  }

  const exact = items.filter((item) => getName(item).trim().toLowerCase() === selector);
  if (exact.length === 1) {
    return exact[0];
  }
  if (exact.length > 1) {
    exitWithError(
      `Multiple ${entityName}s match "${rawSelector}" exactly${context ? ` ${context}` : ""}:\n${formatCandidateList(
        exact,
        (item) => `${getName(item)} (id:${item.id})`,
      )}`,
    );
  }

  const partial = items.filter((item) => getName(item).trim().toLowerCase().includes(selector));
  if (partial.length === 1) {
    return partial[0];
  }
  if (partial.length > 1) {
    exitWithError(
      `Multiple ${entityName}s match "${rawSelector}"${context ? ` ${context}` : ""}:\n${formatCandidateList(
        partial,
        (item) => `${getName(item)} (id:${item.id})`,
      )}`,
    );
  }

  return null;
}

function selectProject(projects, rawSelector) {
  return selectFromList(projects, rawSelector, (project) => project.name, "project");
}

function selectSection(sections, rawSelector, context) {
  return selectFromList(sections, rawSelector, (section) => section.name, "section", context);
}

function printStructured(result) {
  if (result?.structuredContent) {
    console.log(JSON.stringify(result.structuredContent, null, 2));
    return;
  }
  if (result?.textContent) {
    console.log(result.textContent);
    return;
  }
  console.log(JSON.stringify(result, null, 2));
}

function formatCompactTask(task) {
  const parts = [task.id, task.content];
  if (task.projectName) {
    parts.push(`#${task.projectName}`);
  }
  if (task.dueDate) {
    parts.push(`due:${task.dueDate}`);
  }
  if (Array.isArray(task.labels) && task.labels.length > 0) {
    parts.push(`labels:${task.labels.join(",")}`);
  }
  return parts.join(" | ");
}

function formatCompactProject(project) {
  return [project.id, project.name, project.inboxProject ? "inbox" : null].filter(Boolean).join(" | ");
}

function formatCompactSection(section) {
  return [section.id, section.name, section.projectName ? `#${section.projectName}` : null].filter(Boolean).join(" | ");
}

function formatCompactLabel(label) {
  return [label.id, `@${label.name}`].join(" | ");
}

function formatCompactComment(comment) {
  return [comment.id, comment.content, comment.postedAt || null].filter(Boolean).join(" | ");
}

function formatCompactActivity(event) {
  const detail =
    typeof event.extraData?.content === "string"
      ? event.extraData.content
      : typeof event.extraData?.name === "string"
        ? event.extraData.name
        : event.objectId;
  return [event.eventDate, `${event.objectType}:${event.eventType}`, detail].filter(Boolean).join(" | ");
}

function escapeMarkdownCell(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, "<br>");
}

function printMarkdownTable(headers, rows) {
  console.log(`| ${headers.join(" | ")} |`);
  console.log(`| ${headers.map(() => "---").join(" | ")} |`);
  rows.forEach((row) => {
    console.log(`| ${row.map(escapeMarkdownCell).join(" | ")} |`);
  });
}

function printMarkdown(result) {
  if (Array.isArray(result?.reopened) && Array.isArray(result?.failures) && typeof result?.successCount === "number") {
    printMarkdownTable(
      ["Requested", "Succeeded", "Failed"],
      [[result.totalRequested || 0, result.successCount || 0, result.failureCount || 0]],
    );
    if (Array.isArray(result.reopened) && result.reopened.length > 0) {
      console.log("");
      printMarkdownTable(
        ["Reopened Task ID"],
        result.reopened.map((id) => [id]),
      );
    }
    if (Array.isArray(result.failures) && result.failures.length > 0) {
      console.log("");
      printMarkdownTable(
        ["Item", "Error"],
        result.failures.map((failure) => [failure.item || "", failure.error || ""]),
      );
    }
    return true;
  }
  if (Array.isArray(result?.deleted) && Array.isArray(result?.failures) && typeof result?.successCount === "number") {
    printMarkdownTable(
      ["Requested", "Succeeded", "Failed"],
      [[result.totalRequested || 0, result.successCount || 0, result.failureCount || 0]],
    );
    if (Array.isArray(result.deleted) && result.deleted.length > 0) {
      console.log("");
      printMarkdownTable(
        ["Deleted Task ID"],
        result.deleted.map((id) => [id]),
      );
    }
    if (Array.isArray(result.failures) && result.failures.length > 0) {
      console.log("");
      printMarkdownTable(
        ["Item", "Error"],
        result.failures.map((failure) => [failure.item || "", failure.error || ""]),
      );
    }
    return true;
  }
  if (result?.cli && result?.config && result?.auth && Array.isArray(result?.dependencies) && result?.api) {
    printMarkdownTable(
      ["CLI", "Version", "Config", "Token", "API", "User", "Plan"],
      [[
        result.cli.packageName || "",
        result.cli.version || "",
        result.config.path || "",
        result.auth.hasToken ? `yes (${result.auth.tokenSource || "unknown"})` : "no",
        result.api.ok ? "ok" : result.api.checked ? "error" : "not checked",
        result.api.user || "",
        result.api.plan || "",
      ]],
    );
    if (Array.isArray(result.dependencies) && result.dependencies.length > 0) {
      console.log("");
      printMarkdownTable(
        ["Package", "Declared", "Installed", "Latest", "Up To Date"],
        result.dependencies.map((dependency) => [
          dependency.packageName || "",
          dependency.declared || "",
          dependency.installed || "",
          dependency.latest || "",
          dependency.upToDate ? "yes" : "no",
        ]),
      );
    }
    return true;
  }
  if (result?.type === "user_info") {
    printMarkdownTable(
      ["Name", "Email", "Plan", "Timezone", "Week", "Completed Today", "Daily Goal", "Weekly Goal"],
      [[
        result.fullName || "",
        result.email || "",
        result.plan || "",
        result.timezone || "",
        result.weekStartDate && result.weekEndDate ? `${result.weekStartDate} to ${result.weekEndDate}` : "",
        result.completedToday || 0,
        result.dailyGoal || 0,
        result.weeklyGoal || 0,
      ]],
    );
    return true;
  }
  if (result?.type === "account_overview") {
    printMarkdownTable(
      ["Inbox", "Projects", "Sections", "Nested Projects"],
      [[
        result.inbox?.name || "",
        result.totalProjects || 0,
        result.totalSections || 0,
        result.hasNestedProjects ? "yes" : "",
      ]],
    );
    if (Array.isArray(result.projects) && result.projects.length > 0) {
      console.log("");
      printMarkdownTable(
        ["Project ID", "Project", "Parent ID", "Sections", "Children"],
        result.projects.map((project) => [
          project.id || "",
          project.name || "",
          project.parentId || "",
          Array.isArray(project.sections) ? project.sections.map((section) => section.name).join(", ") : "",
          Array.isArray(project.children) ? project.children.length : 0,
        ]),
      );
    }
    return true;
  }
  if (result?.task) {
    printMarkdownTable(
      ["ID", "Content", "Project", "Due", "Recurring", "Priority", "Labels", "URL"],
      [[
        result.task.id,
        result.task.content,
        result.task.projectName || "",
        result.task.dueDate || "",
        result.task.recurring ? "yes" : "",
        result.task.priority || "",
        Array.isArray(result.task.labels) ? result.task.labels.join(", ") : "",
        result.task.url || "",
      ]],
    );
    return true;
  }
  if (Array.isArray(result?.tasks)) {
    printMarkdownTable(
      ["ID", "Content", "Project", "Due", "Recurring", "Priority", "Labels"],
      result.tasks.map((task) => [
        task.id,
        task.content,
        task.projectName || "",
        task.dueDate || "",
        task.recurring ? "yes" : "",
        task.priority || "",
        Array.isArray(task.labels) ? task.labels.join(", ") : "",
      ]),
    );
    return true;
  }
  if (Array.isArray(result?.projects)) {
    printMarkdownTable(
      ["ID", "Name", "Inbox"],
      result.projects.map((project) => [project.id, project.name, project.inboxProject ? "yes" : ""]),
    );
    return true;
  }
  if (Array.isArray(result?.sections)) {
    printMarkdownTable(
      ["ID", "Name", "Project"],
      result.sections.map((section) => [section.id, section.name, section.projectName || ""]),
    );
    return true;
  }
  if (Array.isArray(result?.labels)) {
    printMarkdownTable(
      ["ID", "Name", "Color", "Favorite"],
      result.labels.map((label) => [label.id, label.name, label.color || "", label.isFavorite ? "yes" : ""]),
    );
    return true;
  }
  if (Array.isArray(result?.comments)) {
    printMarkdownTable(
      ["ID", "Content", "Posted At", "Task ID", "Project ID"],
      result.comments.map((comment) => [
        comment.id,
        comment.content,
        comment.postedAt || "",
        comment.taskId || "",
        comment.projectId || "",
      ]),
    );
    return true;
  }
  if (result?.comment) {
    printMarkdownTable(
      ["ID", "Content", "Posted At", "Task ID", "Project ID"],
      [[
        result.comment.id,
        result.comment.content,
        result.comment.postedAt || "",
        result.comment.taskId || "",
        result.comment.projectId || "",
      ]],
    );
    return true;
  }
  if (Array.isArray(result?.events)) {
    printMarkdownTable(
      ["When", "Object", "Event", "Object ID", "Detail"],
      result.events.map((event) => [
        event.eventDate || "",
        event.objectType || "",
        event.eventType || "",
        event.objectId || "",
        typeof event.extraData?.content === "string"
          ? event.extraData.content
          : typeof event.extraData?.name === "string"
            ? event.extraData.name
            : "",
      ]),
    );
    return true;
  }
  return false;
}

function printCompact(result) {
  if (Array.isArray(result?.reopened) && Array.isArray(result?.failures) && typeof result?.successCount === "number") {
    console.log([
      `requested:${result.totalRequested || 0}`,
      `reopened:${result.successCount || 0}`,
      `failed:${result.failureCount || 0}`,
    ].join(" | "));
    result.reopened.forEach((id) => console.log(id));
    result.failures.forEach((failure) => {
      console.log([failure.item || "", failure.error || ""].filter(Boolean).join(" | "));
    });
    return true;
  }
  if (Array.isArray(result?.deleted) && Array.isArray(result?.failures) && typeof result?.successCount === "number") {
    console.log([
      `requested:${result.totalRequested || 0}`,
      `deleted:${result.successCount || 0}`,
      `failed:${result.failureCount || 0}`,
    ].join(" | "));
    result.deleted.forEach((id) => console.log(id));
    result.failures.forEach((failure) => {
      console.log([failure.item || "", failure.error || ""].filter(Boolean).join(" | "));
    });
    return true;
  }
  if (result?.cli && result?.config && result?.auth && Array.isArray(result?.dependencies) && result?.api) {
    console.log([
      `${result.cli.packageName || "cli"}@${result.cli.version || ""}`,
      result.auth.hasToken ? `token:${result.auth.tokenSource || "yes"}` : "token:no",
      `api:${result.api.ok ? "ok" : result.api.checked ? "error" : "not-checked"}`,
      result.api.user ? `user:${result.api.user}` : null,
      result.dependencies.map((dependency) => `${dependency.packageName}:${dependency.installed || "missing"}${dependency.upToDate ? "" : `!=${dependency.latest || "unknown"}`}`).join(", "),
    ].filter(Boolean).join(" | "));
    return true;
  }
  if (result?.type === "user_info") {
    console.log([
      result.fullName || "",
      result.email || "",
      result.plan ? `plan:${result.plan}` : null,
      result.timezone ? `tz:${result.timezone}` : null,
      `today:${result.completedToday || 0}/${result.dailyGoal || 0}`,
      result.weeklyGoal ? `week-goal:${result.weeklyGoal}` : null,
    ].filter(Boolean).join(" | "));
    return true;
  }
  if (result?.type === "account_overview") {
    console.log([
      `inbox:${result.inbox?.name || ""}`,
      `projects:${result.totalProjects || 0}`,
      `sections:${result.totalSections || 0}`,
      `nested:${result.hasNestedProjects ? "yes" : "no"}`,
    ].join(" | "));
    if (Array.isArray(result.projects)) {
      result.projects.forEach((project) => {
        const sectionNames = Array.isArray(project.sections) ? project.sections.map((section) => section.name).join(", ") : "";
        console.log([
          project.id,
          project.name,
          project.parentId ? `parent:${project.parentId}` : null,
          sectionNames ? `sections:${sectionNames}` : null,
          Array.isArray(project.children) && project.children.length > 0 ? `children:${project.children.length}` : null,
        ].filter(Boolean).join(" | "));
      });
    }
    return true;
  }
  if (result?.task) {
    console.log(formatCompactTask(result.task));
    return true;
  }
  if (Array.isArray(result?.tasks)) {
    result.tasks.forEach((task) => console.log(formatCompactTask(task)));
    return true;
  }
  if (Array.isArray(result?.projects)) {
    result.projects.forEach((project) => console.log(formatCompactProject(project)));
    return true;
  }
  if (Array.isArray(result?.sections)) {
    result.sections.forEach((section) => console.log(formatCompactSection(section)));
    return true;
  }
  if (Array.isArray(result?.labels)) {
    result.labels.forEach((label) => console.log(formatCompactLabel(label)));
    return true;
  }
  if (Array.isArray(result?.comments)) {
    result.comments.forEach((comment) => console.log(formatCompactComment(comment)));
    return true;
  }
  if (result?.comment) {
    console.log(formatCompactComment(result.comment));
    return true;
  }
  if (Array.isArray(result?.events)) {
    result.events.forEach((event) => console.log(formatCompactActivity(event)));
    return true;
  }
  return false;
}

function printResult(result, options) {
  if (options?.json) {
    printStructured(result);
    return;
  }
  if (options?.compact && printCompact(result)) {
    return;
  }
  if (printMarkdown(result)) {
    return;
  }
  printStructured(result);
}

async function loadProjects(client) {
  const response = await client.getProjects({ limit: 200 });
  return response.results ?? [];
}

function readInstalledPackageVersion(packageName) {
  try {
    const scriptDir = path.dirname(new URL(import.meta.url).pathname);
    const packagePath = path.join(scriptDir, "..", "node_modules", ...packageName.split("/"), "package.json");
    return JSON.parse(fs.readFileSync(packagePath, "utf8")).version || null;
  } catch {
    return null;
  }
}

function readLatestPackageVersion(packageName) {
  try {
    return execFileSync("npm", ["view", packageName, "version"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

async function runDoctor(options) {
  const configPath = resolveConfigPath(options);
  const configExists = fs.existsSync(configPath);
  const { token, source, config } = resolveTokenInfo(configPath);
  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  const ownPkg = JSON.parse(fs.readFileSync(path.join(scriptDir, "..", "package.json"), "utf8"));
  const trackedDependencies = Object.keys(ownPkg.dependencies || {}).filter((packageName) => packageName.startsWith("@doist/"));
  const dependencies = trackedDependencies.map((packageName) => {
    const declared = ownPkg.dependencies?.[packageName];
    const installed = readInstalledPackageVersion(packageName);
    const latest = readLatestPackageVersion(packageName);
    return {
      packageName,
      declared: declared || null,
      installed,
      latest,
      upToDate: Boolean(installed && latest && installed === latest),
    };
  });

  const result = {
    cli: {
      packageName: ownPkg.name,
      version: ownPkg.version,
    },
    config: {
      path: configPath,
      exists: configExists,
      readable: configExists,
      hasTokenField: Boolean(config?.token),
    },
    auth: {
      tokenSource: source,
      hasToken: Boolean(token),
    },
    dependencies,
    api: {
      checked: false,
      ok: false,
    },
  };

  if (token) {
    try {
      const user = await createTodoistClient(token).getUser();
      result.api = {
        checked: true,
        ok: true,
        user: user.fullName || null,
        plan: mapPremiumStatus(user.premiumStatus),
      };
    } catch (error) {
      result.api = {
        checked: true,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  printResult(result, options);
}

async function completeTaskForever(client, taskId) {
  await client.sync({
    commands: [
      {
        type: "item_complete",
        uuid: randomUUID(),
        args: {
          id: taskId,
          dateCompleted: new Date().toISOString(),
        },
      },
    ],
  });
  try {
    await client.getTask(taskId);
    await client.deleteTask(taskId);
  } catch (error) {
    const status = typeof error === "object" && error !== null ? error.httpStatusCode : undefined;
    if (status !== 400 && status !== 404) {
      throw error;
    }
  }
}

async function resolveProject(client, rawRef) {
  const projects = await loadProjects(client);
  const project = selectProject(projects, rawRef);
  if (!project) {
    exitWithError(`Project not found: ${rawRef}`);
  }
  return project;
}

async function loadTaskSearchCandidates(client, rawRef) {
  const trimmed = String(rawRef ?? "").trim();
  if (!trimmed) {
    return [];
  }
  const response = await client.getTasksByFilter({
    query: `search: ${trimmed}`,
    limit: 20,
  });
  return response.results ?? [];
}

async function loadActiveTasks(client, limit = 200) {
  const response = await client.getTasks({ limit });
  return response.results ?? [];
}

async function resolveTask(client, rawRef) {
  const trimmed = String(rawRef ?? "").trim();
  if (!trimmed) {
    exitWithError("Task reference cannot be empty.");
  }

  const parsedUrl = parseTodoistUrl(trimmed);
  if ((parsedUrl && parsedUrl.entityType === "task") || isExplicitIdRef(trimmed) || looksLikeRawId(trimmed)) {
    const directId = toIdRef(trimmed);
    try {
      return await client.getTask(directId);
    } catch (error) {
      const status = typeof error === "object" && error !== null ? error.httpStatusCode : undefined;
      if (status !== 400 && status !== 404) {
        throw error;
      }
    }
  }

  const candidates = await loadTaskSearchCandidates(client, trimmed);
  const exact = selectFromList(candidates, trimmed, (task) => task.content, "task");
  if (exact) {
    return exact;
  }

  const activeTasks = await loadActiveTasks(client);
  const fallback = selectFromList(activeTasks, trimmed, (task) => task.content, "task");
  if (fallback) {
    return fallback;
  }

  exitWithError(`Task not found: ${rawRef}`);
}

async function resolveTaskIds(client, refs) {
  const resolved = [];
  for (const ref of refs) {
    const task = await resolveTask(client, ref);
    resolved.push(task.id);
  }
  return resolved;
}

async function listTasks(client, options, projectSelector) {
  const limit = Number(options.limit ?? 20);
  const projects = await loadProjects(client);
  const projectNameById = new Map(projects.map((project) => [project.id, project.name]));
  const selectedProject = selectProject(projects, projectSelector);
  const label = typeof options.label === "string" && options.label.trim().length > 0 ? options.label.trim() : null;
  const today = Boolean(options.today);
  const overdue = Boolean(options.overdue);

  let response;
  if (today || overdue) {
    const clauses = [];
    if (selectedProject) {
      clauses.push(`#${selectedProject.name}`);
    }
    if (label) {
      clauses.push(`@${label}`);
    }
    if (today && overdue) {
      clauses.push("(today | overdue)");
    } else if (today) {
      clauses.push("today");
    } else if (overdue) {
      clauses.push("overdue");
    }
    response = await client.getTasksByFilter({ query: clauses.join(" & "), limit });
  } else {
    response = await client.getTasks({
      ...(selectedProject ? { projectId: selectedProject.id } : {}),
      ...(label ? { label } : {}),
      limit,
    });
  }
  const tasks = (response.results ?? []).map((task) => formatTask(task, projectNameById));
  return {
    tasks,
    totalCount: tasks.length,
    hasMore: Boolean(response.nextCursor),
    appliedFilters: {
      ...(selectedProject
        ? { projectId: selectedProject.id, projectName: selectedProject.name }
        : {}),
      ...(label ? { label } : {}),
      ...(today ? { today: true } : {}),
      ...(overdue ? { overdue: true } : {}),
      limit,
    },
  };
}

async function closeTaskIds(client, ids) {
  const results = await Promise.allSettled(ids.map((id) => client.closeTask(id)));
  const completed = [];
  const failures = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      completed.push(ids[i]);
    } else {
      failures.push({ item: ids[i], error: r.reason instanceof Error ? r.reason.message : String(r.reason) });
    }
  });
  return {
    completed,
    failures,
    successCount: completed.length,
    failureCount: failures.length,
    totalRequested: ids.length,
  };
}

async function runFind(rest, options) {
  const client = getClient(options);
  const limit = Number(options.limit ?? 20);
  const searchText = rest.join(" ").trim();
  if (!searchText) {
    exitWithError('Usage: todoist-cli find "search text"');
  }
  const projects = await loadProjects(client);
  const projectNameById = new Map(projects.map((project) => [project.id, project.name]));
  const response = await client.getTasks({ limit: Math.max(limit, 200) });
  const lowered = searchText.toLowerCase();
  const filtered = (response.results ?? [])
    .filter((task) => {
      const haystacks = [
        task.content,
        task.description || "",
        projectNameById.get(task.projectId) || "",
      ];
      return haystacks.some((value) => value.toLowerCase().includes(lowered));
    })
    .slice(0, limit)
    .map((task) => formatTask(task, projectNameById));

  printResult({
    tasks: filtered,
    totalCount: filtered.length,
    hasMore: Boolean(response.nextCursor),
    appliedFilters: {
      searchText,
      limit,
      mode: "local-content-match",
    },
  }, options);
}

async function runLabels(options) {
  const client = getClient(options);
  const response = await client.getLabels({ limit: Number(options.limit ?? 100) });
  const labels = (response.results ?? []).map(formatLabel);
  printResult({
    labels,
    totalCount: labels.length,
    hasMore: Boolean(response.nextCursor),
    appliedFilters: {
      limit: Number(options.limit ?? 100),
    },
  }, options);
}

async function runSections(options) {
  const client = getClient(options);
  const projects = await loadProjects(client);
  const projectNameById = new Map(projects.map((project) => [project.id, project.name]));
  const selectedProject = selectProject(projects, options.project);
  if (options.project && !selectedProject) {
    exitWithError(`Project not found: ${options.project}`);
  }
  const response = await client.getSections({
    ...(selectedProject ? { projectId: selectedProject.id } : {}),
    limit: Number(options.limit ?? 100),
  });
  const sections = (response.results ?? []).map((section) => formatSection(section, projectNameById));
  printResult({
    sections,
    totalCount: sections.length,
    hasMore: Boolean(response.nextCursor),
    appliedFilters: {
      ...(selectedProject
        ? { projectId: selectedProject.id, projectName: selectedProject.name }
        : {}),
      limit: Number(options.limit ?? 100),
    },
  }, options);
}

async function runShow(rest, options) {
  const ref = rest[0];
  if (!ref) {
    exitWithError("Usage: todoist-cli show <task-ref>");
  }
  const client = getClient(options);
  const projects = await loadProjects(client);
  const projectNameById = new Map(projects.map((project) => [project.id, project.name]));
  const task = await resolveTask(client, ref);
  printResult({
    task: formatTask(task, projectNameById),
  }, options);
}

async function runComment(rest, options) {
  const ref = rest[0];
  if (!ref) {
    exitWithError("Usage: todoist-cli comment <task-ref|project-ref> [--project] [--add <text>]");
  }

  const client = getClient(options);
  const limit = Number(options.limit ?? 20);
  const addText = typeof options.add === "string" ? options.add.trim() : "";

  if (options.project) {
    const project = await resolveProject(client, ref);
    if (addText) {
      const comment = await client.addComment({
        projectId: project.id,
        content: addText,
      });
      printResult({
        comment: formatComment(comment),
      }, options);
      return;
    }
    const response = await client.getComments({
      projectId: project.id,
      limit,
    });
    const comments = (response.results ?? []).map(formatComment);
    printResult({
      comments,
      totalCount: comments.length,
      hasMore: Boolean(response.nextCursor),
      appliedFilters: {
        projectId: project.id,
        projectName: project.name,
        limit,
      },
    }, options);
    return;
  }

  const task = await resolveTask(client, ref);
  if (addText) {
    const comment = await client.addComment({
      taskId: task.id,
      content: addText,
    });
    printResult({
      comment: formatComment(comment),
    }, options);
    return;
  }
  const response = await client.getComments({
    taskId: task.id,
    limit,
  });
  const comments = (response.results ?? []).map(formatComment);
  printResult({
    comments,
    totalCount: comments.length,
    hasMore: Boolean(response.nextCursor),
    appliedFilters: {
      taskId: task.id,
      taskContent: task.content,
      limit,
    },
  }, options);
}

async function runActivity(options) {
  const client = getClient(options);
  const limit = Number(options.limit ?? 20);
  let parentProjectId;
  let projectName;
  if (typeof options.project === "string") {
    const project = await resolveProject(client, options.project);
    parentProjectId = project.id;
    projectName = project.name;
  }

  let objectEventTypes;
  if (options.object || options.event) {
    objectEventTypes = `${options.object ?? ""}:${options.event ?? ""}`;
  }

  if (isCompletedTaskActivityRequest(options)) {
    // Completed task activity with an explicit date window is backed by Todoist's
    // dedicated completed-tasks endpoint rather than the generic activities feed.
    const result = await loadPrimaryCompletedTaskActivityEvents(client, options, parentProjectId, projectName);
    printResult(result, options);
    return;
  }

  const response = await client.getActivityLogs({
    ...(parentProjectId ? { parentProjectId } : {}),
    ...(objectEventTypes ? { objectEventTypes } : {}),
    ...(typeof options.since === "string" ? { dateFrom: options.since } : {}),
    ...(typeof options.until === "string" ? { dateTo: options.until } : {}),
    limit,
  });

  const events = (response.results ?? []).map(formatActivityEvent);
  printResult({
    events,
    totalCount: events.length,
    hasMore: Boolean(response.nextCursor),
    appliedFilters: {
      ...(parentProjectId ? { projectId: parentProjectId, projectName } : {}),
      ...(objectEventTypes ? { objectEventTypes } : {}),
      ...(typeof options.since === "string" ? { since: options.since } : {}),
      ...(typeof options.until === "string" ? { until: options.until } : {}),
      limit,
    },
  }, options);
}

async function runList(options) {
  const client = getClient(options);
  if (options.project) {
    const projects = await loadProjects(client);
    const selectedProject = selectProject(projects, options.project);
    if (!selectedProject) {
      exitWithError(`Project not found: ${options.project}`);
    }
  }
  const result = await listTasks(client, options, options.project);
  printResult(result, options);
}

async function runQuick(rest, options) {
  const text = rest.join(" ").trim();
  if (!text) {
    exitWithError('Usage: todoist-cli quick "Task title tomorrow"');
  }
  const client = getClient(options);
  const task = await client.quickAddTask({ text });
  const projects = await loadProjects(client);
  const projectNameById = new Map(projects.map((project) => [project.id, project.name]));
  printResult({
    task: formatTask(task, projectNameById),
  }, options);
}

async function runModify(rest, options) {
  const ref = rest[0];
  if (!ref) {
    exitWithError("Usage: todoist-cli modify <task-ref> [--content ...] [--priority p1]");
  }
  const payload = {};
  if (typeof options.content === "string") {
    payload.content = options.content;
  }
  if (typeof options.description === "string") {
    payload.description = options.description;
  }
  if (typeof options.priority === "string") {
    payload.priority = toApiPriority(options.priority);
  }
  if (typeof options.due === "string") {
    payload.dueString = options.due;
  }
  if (typeof options.label === "string") {
    payload.labels = options.label
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (options.uncompletable && options.completable) {
    exitWithError("Cannot use --uncompletable and --completable together.");
  }
  if (options.uncompletable) {
    payload.isUncompletable = true;
  } else if (options.completable) {
    payload.isUncompletable = false;
  }
  if (Object.keys(payload).length === 0) {
    exitWithError(
      "No update fields provided. Use --content, --description, --priority, --due, --label, --uncompletable, or --completable.",
    );
  }
  const client = getClient(options);
  const resolvedTask = await resolveTask(client, ref);
  if (payload.isUncompletable !== undefined && payload.content === undefined) {
    payload.content = normalizeTaskContentForCompletableToggle(
      resolvedTask.content,
      payload.isUncompletable,
    );
  }
  const task = await client.updateTask(resolvedTask.id, payload);
  const projects = await loadProjects(client);
  const projectNameById = new Map(projects.map((project) => [project.id, project.name]));
  printResult({
    task: formatTask(task, projectNameById),
  }, options);
}

async function runMove(rest, options) {
  const ref = rest[0];
  if (!ref) {
    exitWithError(
      "Usage: todoist-cli move <task-ref> (--project <id|name> | --section <id|name> | --parent <task-ref> | --no-parent | --no-section)",
    );
  }

  const hasProject = typeof options.project === "string" && options.project.trim().length > 0;
  const hasSection = typeof options.section === "string" && options.section.trim().length > 0;
  const hasParent = typeof options.parent === "string" && options.parent.trim().length > 0;
  const hasNoParent = Boolean(options["no-parent"]);
  const hasNoSection = Boolean(options["no-section"]);

  if (!hasProject && !hasSection && !hasParent && !hasNoParent && !hasNoSection) {
    exitWithError("Provide a destination with --project, --section, --parent, --no-parent, or --no-section.");
  }
  if (hasParent && (hasProject || hasSection || hasNoParent || hasNoSection)) {
    exitWithError("--parent cannot be combined with --project, --section, --no-parent, or --no-section.");
  }
  if (hasSection && hasNoSection) {
    exitWithError("--section cannot be combined with --no-section.");
  }

  const client = getClient(options);
  const taskToMove = await resolveTask(client, ref);
  const projects = await loadProjects(client);
  const projectNameById = new Map(projects.map((project) => [project.id, project.name]));
  const selectedProject = hasProject ? selectProject(projects, options.project) : null;

  if (hasProject && !selectedProject) {
    exitWithError(`Project not found: ${options.project}`);
  }

  let payload;
  if (hasParent) {
    const parentTask = await resolveTask(client, options.parent);
    payload = { parentId: parentTask.id };
  } else if (hasNoParent || hasNoSection) {
    payload = { projectId: selectedProject ? selectedProject.id : taskToMove.projectId };
  } else if (hasSection) {
    const sectionResponse = await client.getSections({
      ...(selectedProject ? { projectId: selectedProject.id } : {}),
      limit: Number(options.limit ?? 200),
    });
    const sections = sectionResponse.results ?? [];
    const selectedSection = selectSection(
      sections,
      options.section,
      selectedProject ? `in project ${selectedProject.name}` : "",
    );
    if (!selectedSection) {
      exitWithError(
        selectedProject
          ? `Section not found in project ${selectedProject.name}: ${options.section}`
          : `Section not found: ${options.section}`,
      );
    }
    payload = { sectionId: selectedSection.id };
  } else {
    if (!selectedProject) {
      exitWithError(`Project not found: ${options.project}`);
    }
    payload = { projectId: selectedProject.id };
  }

  try {
    const task = await client.moveTask(taskToMove.id, payload);
    printResult({
      task: formatTask(task, projectNameById),
    }, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const destination = payload.projectId
      ? `project ${selectedProject?.name || payload.projectId}`
      : payload.sectionId
        ? `section ${options.section}`
        : `parent ${payload.parentId}`;
    exitWithError(`Failed to move task ${taskToMove.id} to ${destination}: ${message}`);
  }
}

async function runReopen(rest, options) {
  if (rest.length === 0) {
    exitWithError("Usage: todoist-cli reopen <task-ref> [task-ref...]");
  }
  const client = getClient(options);
  const ids = await resolveTaskIds(client, rest);
  const reopened = [];
  const failures = [];
  for (const id of ids) {
    try {
      const ok = await client.reopenTask(id);
      if (ok) {
        reopened.push(id);
      } else {
        failures.push({ item: id, error: "reopenTask returned false" });
      }
    } catch (error) {
      failures.push({ item: id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  printResult({
    reopened,
    failures,
    totalRequested: rest.length,
    successCount: reopened.length,
    failureCount: failures.length,
  }, options);
}

async function runCompletedList(options) {
  const client = getClient(options);
  const days = Number(options.days ?? 7);
  const until = new Date();
  const since = new Date(until.getTime() - days * 24 * 60 * 60 * 1000);
  const response = await client.getCompletedTasksByCompletionDate({
    since: since.toISOString(),
    until: until.toISOString(),
    limit: Number(options.limit ?? 50),
  });
  const projects = await loadProjects(client);
  const projectNameById = new Map(projects.map((project) => [project.id, project.name]));
  const tasks = (response.items ?? []).map((task) => formatTask(task, projectNameById));
  printResult({
    tasks,
    totalCount: tasks.length,
    hasMore: Boolean(response.nextCursor),
    appliedFilters: {
      days,
      limit: Number(options.limit ?? 50),
      mode: "completed-by-completion-date",
    },
  }, options);
}

async function runDelete(rest, options) {
  if (rest.length === 0) {
    exitWithError("Usage: todoist-cli delete <task-ref> [task-ref...]");
  }
  const client = getClient(options);
  const ids = await resolveTaskIds(client, rest);
  const deleted = [];
  const failures = [];
  for (const id of ids) {
    try {
      const ok = await client.deleteTask(id);
      if (ok) {
        deleted.push(id);
      } else {
        failures.push({ item: id, error: "deleteTask returned false" });
      }
    } catch (error) {
      failures.push({ item: id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  printResult({
    deleted,
    failures,
    totalRequested: rest.length,
    successCount: deleted.length,
    failureCount: failures.length,
  }, options);
}

async function main() {
  const { positionals, options } = parseArgs(process.argv.slice(2));
  const [command, ...rest] = positionals;

  if (options.version) {
    const pkgVersion = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
    console.log(pkgVersion);
    return;
  }

  const selectedOutputModes = [options.compact, options.json].filter(Boolean).length;
  if (selectedOutputModes > 1) {
    exitWithError("Choose at most one output mode: default markdown, --compact, or --json.");
  }

  switch (command) {
    case undefined:
    case "help":
    case "--help":
    case "-h":
      printHelp(rest[0]);
      return;
    case "-v": {
      const pkgVersion = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
      console.log(pkgVersion);
      return;
    }
    case "whoami":
      if (wantsCommandHelp(rest, options)) {
        printHelp("whoami");
        return;
      }
      {
        const client = getClient(options);
        const user = await client.getUser();
        const tz = user.tzInfo?.timezone ?? "UTC";
        const now = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
        const dayOfWeek = now.getDay();
        const startDay = user.startDay ?? 1;
        const daysBack = (dayOfWeek - startDay + 7) % 7;
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - daysBack);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const fmt = (d) => d.toISOString().slice(0, 10);
        const result = {
          type: "user_info",
          fullName: user.fullName,
          email: user.email,
          plan: mapPremiumStatus(user.premiumStatus),
          timezone: tz,
          weekStartDate: fmt(weekStart),
          weekEndDate: fmt(weekEnd),
          completedToday: user.completedToday,
          dailyGoal: user.dailyGoal,
          weeklyGoal: user.weeklyGoal,
        };
        printResult(result, options);
      }
      return;
    case "overview": {
      if (wantsCommandHelp(rest, options)) {
        printHelp("overview");
        return;
      }
      {
        const client = getClient(options);
        const [allProjectsResp, allSectionsResp] = await Promise.all([
          client.getProjects({ limit: 200 }),
          client.getSections({ limit: 200 }),
        ]);
        const projects = allProjectsResp.results ?? allProjectsResp;
        const sections = allSectionsResp.results ?? allSectionsResp;
        const sectionsByProjectId = {};
        for (const section of sections) {
          if (!sectionsByProjectId[section.projectId]) sectionsByProjectId[section.projectId] = [];
          sectionsByProjectId[section.projectId].push({ id: section.id, name: section.name });
        }
        const childrenByParentId = {};
        for (const project of projects) {
          if (project.parentId) {
            if (!childrenByParentId[project.parentId]) childrenByParentId[project.parentId] = [];
            childrenByParentId[project.parentId].push(project);
          }
        }
        const inboxProject = projects.find((p) => p.isInboxProject) ?? projects[0] ?? null;
        const result = {
          type: "account_overview",
          inbox: inboxProject ? { id: inboxProject.id, name: inboxProject.name } : null,
          totalProjects: projects.length,
          totalSections: sections.length,
          hasNestedProjects: projects.some((p) => p.parentId != null),
          projects: projects.map((p) => ({
            id: p.id,
            name: p.name,
            parentId: p.parentId ?? null,
            sections: sectionsByProjectId[p.id] ?? [],
            children: childrenByParentId[p.id] ?? [],
          })),
        };
        printResult(result, options);
      }
      return;
    }
    case "list":
      if (wantsCommandHelp(rest, options)) {
        printHelp("list");
        return;
      }
      await runList(options);
      return;
    case "projects": {
      if (wantsCommandHelp(rest, options)) {
        printHelp("projects");
        return;
      }
      {
        const client = getClient(options);
        const searchText = rest.join(" ").trim();
        const limit = Number(options.limit ?? 20);
        let projects;
        if (searchText.length > 0) {
          const response = await client.searchProjects({ query: searchText, limit });
          projects = response.results ?? response;
        } else {
          const response = await client.getProjects({ limit });
          projects = response.results ?? response;
        }
        printResult({ projects }, options);
      }
      return;
    }
    case "labels":
      if (wantsCommandHelp(rest, options)) {
        printHelp("labels");
        return;
      }
      await runLabels(options);
      return;
    case "sections":
      if (wantsCommandHelp(rest, options)) {
        printHelp("sections");
        return;
      }
      await runSections(options);
      return;
    case "show":
      if (wantsCommandHelp(rest, options)) {
        printHelp("show");
        return;
      }
      await runShow(rest, options);
      return;
    case "comment":
      if (wantsCommandHelp(rest, options)) {
        printHelp("comment");
        return;
      }
      await runComment(rest, options);
      return;
    case "activity":
      if (wantsCommandHelp(rest, options)) {
        printHelp("activity");
        return;
      }
      await runActivity(options);
      return;
    case "doctor":
      if (wantsCommandHelp(rest, options)) {
        printHelp("doctor");
        return;
      }
      await runDoctor(options);
      return;
    case "find": {
      if (wantsCommandHelp(rest, options)) {
        printHelp("find");
        return;
      }
      await runFind(rest, options);
      return;
    }
    case "today": {
      if (wantsCommandHelp(rest, options)) {
        printHelp("today");
        return;
      }
      {
        const client = getClient(options);
        const daysCount = Number(options.days ?? 1);
        const overdueOption = options.overdue ?? "include-overdue";
        const limit = Number(options.limit ?? 50);
        let query;
        if (overdueOption === "overdue-only") {
          query = "overdue";
        } else if (daysCount > 1) {
          const base = `due before: +${daysCount + 1}d`;
          query = overdueOption === "exclude-overdue" ? base : `(${base}) | overdue`;
        } else {
          query = overdueOption === "exclude-overdue" ? "today" : "today | overdue";
        }
        const response = await client.getTasksByFilter({ query, limit });
        const rawTasks = response.results ?? response;
        const projectsResp = await client.getProjects({ limit: 200 });
        const projectList = projectsResp.results ?? projectsResp;
        const projectMap = Object.fromEntries(projectList.map((p) => [p.id, p.name]));
        const tasks = rawTasks.map((task) => ({
          id: task.id,
          content: task.content,
          description: task.description ?? "",
          projectName: projectMap[task.projectId] ?? "",
          dueDate: task.due?.date ?? null,
          recurring: task.due?.isRecurring ?? false,
          priority: task.priority,
          labels: task.labels ?? [],
          url: task.url ?? "",
        }));
        printResult({ tasks }, options);
      }
      return;
    }
    case "add": {
      if (wantsCommandHelp(rest, options)) {
        printHelp("add");
        return;
      }
      const content = rest[0];
      if (!content) {
        exitWithError('Usage: todoist-cli add "Task title" [due string]');
      }
      const dueString = rest[1];
      const client = getClient(options);
      let projectId;
      let projectName;
      if (typeof options.project === "string") {
        const projects = await loadProjects(client);
        const selectedProject = selectProject(projects, options.project);
        if (!selectedProject) {
          exitWithError(`Project not found: ${options.project}`);
        }
        projectId = selectedProject.id;
        projectName = selectedProject.name;
      }
      let sectionId;
      if (typeof options.section === "string") {
        if (!projectId) {
          exitWithError("Using --section currently requires --project.");
        }
        const sectionResponse = await client.getSections({
          projectId,
          limit: Number(options.limit ?? 200),
        });
        const sections = sectionResponse.results ?? [];
        const selectedSection = selectSection(sections, options.section, `in project ${projectName}`);
        if (!selectedSection) {
          exitWithError(`Section not found in project ${projectName}: ${options.section}`);
        }
        sectionId = selectedSection.id;
      }
      let parentId;
      if (typeof options.parent === "string") {
        const parentTask = await resolveTask(client, options.parent);
        parentId = parentTask.id;
        if (!projectId) {
          projectId = parentTask.projectId;
        }
      }
      const payload = {
        content,
        ...(dueString ? { dueString } : {}),
        ...(projectId ? { projectId } : {}),
        ...(sectionId ? { sectionId } : {}),
        ...(parentId ? { parentId } : {}),
        ...(typeof options.description === "string" ? { description: options.description } : {}),
        ...(typeof options.label === "string"
          ? {
              labels: options.label
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
            }
          : {}),
        ...(typeof options.priority === "string" ? { priority: toApiPriority(options.priority) } : {}),
      };
      const task = await client.addTask(payload);
      const projects = await loadProjects(client);
      const projectNameById = new Map(projects.map((project) => [project.id, project.name]));
      printResult({
        task: formatTask(task, projectNameById),
      }, options);
      return;
    }
    case "quick":
      if (wantsCommandHelp(rest, options)) {
        printHelp("quick");
        return;
      }
      await runQuick(rest, options);
      return;
    case "modify":
      if (wantsCommandHelp(rest, options)) {
        printHelp("modify");
        return;
      }
      await runModify(rest, options);
      return;
    case "move":
      if (wantsCommandHelp(rest, options)) {
        printHelp("move");
        return;
      }
      await runMove(rest, options);
      return;
    case "done": {
      if (wantsCommandHelp(rest, options)) {
        printHelp("done");
        return;
      }
      if (rest.length === 0) {
        exitWithError("Usage: todoist-cli done <task-ref> [task-ref...]");
      }
      const client = getClient(options);
      if (options.forever) {
        if (rest.length !== 1) {
          exitWithError("--forever currently supports exactly one task reference.");
        }
        const task = await resolveTask(client, rest[0]);
        if (task.due?.isRecurring) {
          await completeTaskForever(client, task.id);
          printResult(
            {
              completed: [task.id],
              mode: "forever",
              recurring: true,
            },
            options,
          );
          return;
        }
        const result = await closeTaskIds(client, [task.id]);
        printResult(result, options);
        return;
      }
      const ids = await resolveTaskIds(client, rest);
      const result = await closeTaskIds(client, ids);
      printResult(result, options);
      return;
    }
    case "close": {
      if (wantsCommandHelp(rest, options)) {
        printHelp("close");
        return;
      }
      if (rest.length === 0) {
        exitWithError("Usage: todoist-cli close <task-ref> [task-ref...]");
      }
      const client = getClient(options);
      const ids = await resolveTaskIds(client, rest);
      const result = await closeTaskIds(client, ids);
      printResult(result, options);
      return;
    }
    case "reopen":
      if (wantsCommandHelp(rest, options)) {
        printHelp("reopen");
        return;
      }
      await runReopen(rest, options);
      return;
    case "completed-list":
      if (wantsCommandHelp(rest, options)) {
        printHelp("completed-list");
        return;
      }
      await runCompletedList(options);
      return;
    case "delete":
      if (wantsCommandHelp(rest, options)) {
        printHelp("delete");
        return;
      }
      await runDelete(rest, options);
      return;
    default:
      exitWithError(`Unknown command: ${command}\n\n${HELP_TEXT}`);
  }
}

main().catch((error) => {
  const responseError =
    typeof error === "object" && error !== null && typeof error.responseData?.error === "string"
      ? error.responseData.error
      : null;
  const status =
    typeof error === "object" && error !== null && typeof error.httpStatusCode === "number"
      ? error.httpStatusCode
      : null;
  const baseMessage = error instanceof Error ? error.message : String(error);
  const message =
    responseError && status ? `${baseMessage}\n${responseError} (HTTP ${status})` : baseMessage;
  exitWithError(message);
});
