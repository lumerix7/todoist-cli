#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createCommand, TodoistApi } from "@doist/todoist-api-typescript";
import {
  addTasks,
  completeTasks,
  findProjects,
  findTasksByDate,
  getOverview,
  userInfo,
} from "@doist/todoist-ai";

const TOOL_MAP = {
  "add-tasks": addTasks,
  "complete-tasks": completeTasks,
  "find-projects": findProjects,
  "find-tasks-by-date": findTasksByDate,
  "get-overview": getOverview,
  "user-info": userInfo,
};

const DEFAULT_CONFIG_PATH = path.join(
  process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"),
  "todoist-cli",
  "config.json",
);

const HELP_TEXT = `todoist-cli

Light CLI wrapper around Todoist.

Setup:
  mkdir -p ~/.config/todoist-cli
  cp config.example.json ~/.config/todoist-cli/config.json
  edit ~/.config/todoist-cli/config.json

Usage:
  todoist-cli <command> [options]
  todoist-cli help [command]
  todoist-cli <command> -h

Read:
  whoami
  overview
  list
  find
  show
  comment
  activity
  today
  completed-list
  projects
  sections
  labels

Write:
  add
  comment
  quick
  modify
  move
  done
  close
  reopen
  delete

Advanced:
  doctor
  tools
  run

Global options:
  --config <path>    Override config path
  --compact          Print a lightweight human-readable summary for common read commands
  --markdown         Print Markdown tables for common read commands

Common examples:
  todoist-cli doctor
  todoist-cli list --project inbox
  todoist-cli find "registry gateway"
  todoist-cli quick "Pay rent tomorrow 9am #Inbox"
  todoist-cli modify 123abc --priority p1 --due "tomorrow"
  todoist-cli move 123abc --project inbox

Details:
  todoist-cli help list
  todoist-cli modify --help
`;

const HELP_BY_COMMAND = {
  list: `todoist-cli list

List active tasks with explicit filters.

Usage:
  todoist-cli list
  todoist-cli list --project inbox
  todoist-cli list --label 0
  todoist-cli list --today
  todoist-cli list --overdue
  todoist-cli list --project 0 --label 0 --today

Options:
  --project <id|name>   Filter by project
  --label <name>        Filter by label
  --today               Only today's tasks
  --overdue             Only overdue tasks
  --limit <n>           Limit results (default: 20)
`,
  find: `todoist-cli find

Text-only local matching over active tasks.

Usage:
  todoist-cli find "registry"
  todoist-cli find "gateway nginx"

Notes:
  - Searches task content, description, and project name
  - Does not infer project filters; use 'list --project ...' for that
  - Scans active tasks only
  - Supports --limit <n> (default: 20)
`,
  add: `todoist-cli add

Create one task with optional due text.

Usage:
  todoist-cli add "Pay rent"
  todoist-cli add "Pay rent" "tomorrow 9am"
  todoist-cli add "Fix gateway" --project 0 --priority p1
  todoist-cli add "Fix gateway" --project inbox --section backlog
  todoist-cli add "Write tests" --parent "Release prep"

Options:
  --project <id|name>   Project id or name
  --section <id|name>   Section id or name
  --parent <task-ref>   Parent task reference
  --description <text>  Task description
  --label <a,b>         Comma-separated labels
  --priority <p1-p4>    Priority
`,
  quick: `todoist-cli quick

Quick add using Todoist natural language parsing.

Usage:
  todoist-cli quick "Pay rent tomorrow 9am #Inbox"
  todoist-cli quick "Review PR @0 tomorrow"
`,
  modify: `todoist-cli modify

Update one task.

Usage:
  todoist-cli modify <task-ref> --content "New title"
  todoist-cli modify <task-ref> --priority p1
  todoist-cli modify <task-ref> --due "tomorrow"
  todoist-cli modify <task-ref> --label foo,bar
  todoist-cli modify <task-ref> --uncompletable

Options:
  --content <text>         Update content
  --description <text>     Update description
  --priority <p1-p4>       Update priority
  --due <text>             Update due via natural language
  --label <a,b>            Replace labels with comma-separated names
  --uncompletable          Mark task as uncompletable
  --completable            Mark task as completable
`,
  move: `todoist-cli move

Move one task to a different project, section, or parent.

Usage:
  todoist-cli move <task-ref> --project inbox
  todoist-cli move <task-ref> --section "Backlog"
  todoist-cli move <task-ref> --project 0 --section "3.0"
  todoist-cli move <task-ref> --parent <task-ref>
  todoist-cli move <task-ref> --no-parent
  todoist-cli move <task-ref> --project inbox --no-section

Options:
  --project <id|name>      Destination project id or name
  --section <id|name>      Destination section id or name
  --parent <task-ref>      Destination parent task reference
  --no-parent              Move task to the project root
  --no-section             Remove section placement

Notes:
  - Use one move target: --project, --section, --parent, --no-parent, or --no-section
  - You may combine --project with --section to narrow section lookup
`,
  show: `todoist-cli show

Show one task by reference.

Usage:
  todoist-cli show <task-ref>
`,
  comment: `todoist-cli comment

List comments on a task by default, or add one with --add.

Usage:
  todoist-cli comment <task-ref>
  todoist-cli comment <task-ref> --add "Looks good"
  todoist-cli comment <project-ref> --project
  todoist-cli comment <project-ref> --project --add "Kickoff notes"

Options:
  --project             Treat the reference as a project
  --add <text>          Add a comment instead of listing comments
  --limit <n>           Limit listed comments (default: 20)
`,
  activity: `todoist-cli activity

List recent Todoist activity with a small filter surface.

Usage:
  todoist-cli activity
  todoist-cli activity --project inbox
  todoist-cli activity --object task --event completed
  todoist-cli activity --since 2026-03-01 --until 2026-03-14

Options:
  --project <id|name>   Filter by project
  --object <type>       task | comment | project
  --event <type>        added | updated | deleted | completed | uncompleted
  --since <date>        Start date (YYYY-MM-DD)
  --until <date>        End date (YYYY-MM-DD)
  --limit <n>           Limit results (default: 20)
`,
  doctor: `todoist-cli doctor

Check local setup, config, token source, dependency versions, and API reachability.

Usage:
  todoist-cli doctor

Notes:
  - Compares installed Doist dependency versions with the latest npm versions
  - Checks whether config exists and whether a token is available
  - Calls Todoist only when a token is present
`,
  done: `todoist-cli done

Complete one or more tasks.

Usage:
  todoist-cli done <task-ref>
  todoist-cli done <task-ref> <task-ref>
  todoist-cli done <task-ref> --forever

Options:
  --forever             Permanently complete a recurring task

Notes:
  - On non-recurring tasks, --forever falls back to normal completion
`,
  close: `Alias of: todoist-cli done`,
  reopen: `todoist-cli reopen

Reopen one or more completed tasks.

Usage:
  todoist-cli reopen <task-ref>
  todoist-cli reopen <task-ref> <task-ref>
`,
  delete: `todoist-cli delete

Delete one or more tasks.

Usage:
  todoist-cli delete <task-ref>
  todoist-cli delete <task-ref> <task-ref>
`,
  projects: `todoist-cli projects

List projects or search by text.

Usage:
  todoist-cli projects
  todoist-cli projects inbox
  todoist-cli projects work

Options:
  --limit <n>           Limit results (default: 20)
`,
  labels: `todoist-cli labels

List labels.

Usage:
  todoist-cli labels

Options:
  --limit <n>           Limit results (default: 100)
`,
  sections: `todoist-cli sections

List sections, optionally filtered by project.

Usage:
  todoist-cli sections
  todoist-cli sections --project inbox
  todoist-cli sections --project 0

Options:
  --project <id|name>   Filter by project
  --limit <n>           Limit results (default: 100)
`,
  today: `todoist-cli today

List today's tasks using the official Doist helper.

Usage:
  todoist-cli today
  todoist-cli today --days 3
  todoist-cli today --overdue overdue-only

Options:
  --days <n>              Number of days (default: 1)
  --start <date>          Start date text (default: today)
  --overdue <mode>        include-overdue | overdue-only | exclude-overdue
  --limit <n>             Limit results (default: 50)
`,
  "completed-list": `todoist-cli completed-list

List recently completed tasks.

Usage:
  todoist-cli completed-list
  todoist-cli completed-list --days 7
  todoist-cli completed-list --days 30 --limit 100

Options:
  --days <n>            Look back this many days (default: 7)
  --limit <n>           Limit results (default: 50)
`,
  whoami: `todoist-cli whoami

Show the current Todoist account identity and plan.

Usage:
  todoist-cli whoami
`,
  overview: `todoist-cli overview

Show the Doist overview summary.

Usage:
  todoist-cli overview
`,
  run: `todoist-cli run

Call one supported official Doist AI tool directly.

Usage:
  todoist-cli tools
  todoist-cli run find-tasks-by-date '{"startDate":"today","daysCount":1}'

Notes:
  - This follows official tool semantics, not the simplified CLI semantics
`,
  tools: `todoist-cli tools

List the directly wired official Doist AI tool names.

Usage:
  todoist-cli tools
`,
};

const HELP_GLOBAL_OPTIONS = `
Global options:
  --config <path>       Override config path
  --compact             Print a lightweight human-readable summary when supported
  --markdown            Print Markdown tables when supported
`;

for (const [key, text] of Object.entries(HELP_BY_COMMAND)) {
  HELP_BY_COMMAND[key] = `${text.trimEnd()}\n${HELP_GLOBAL_OPTIONS}`;
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
  return new TodoistApi(token);
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
  if (options?.markdown && printMarkdown(result)) {
    return;
  }
  if (options?.compact && printCompact(result)) {
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
    const packagePath = path.join(process.cwd(), "node_modules", ...packageName.split("/"), "package.json");
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
  const dependencies = ["@doist/todoist-ai", "@doist/todoist-api-typescript"].map((packageName) => {
    const declared = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")).dependencies?.[packageName];
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
      packageName: JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")).name,
      version: JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")).version,
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
      const info = await userInfo.execute({}, new TodoistApi(token));
      result.api = {
        checked: true,
        ok: true,
        user: info?.structuredContent?.fullName || null,
        plan: info?.structuredContent?.plan || null,
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
      createCommand("item_complete", {
        id: taskId,
        completedAt: new Date().toISOString(),
      }),
    ],
  });
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

async function runTool(toolName, rawArgs, options) {
  const tool = TOOL_MAP[toolName];
  if (!tool) {
    exitWithError(`Unknown tool: ${toolName}`);
  }
  const args = parseJsonArg(rawArgs);
  const result = await tool.execute(args, getClient(options));
  printResult(result?.structuredContent ? result.structuredContent : result, options);
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

  if (options.compact && options.markdown) {
    exitWithError("Choose one output mode: --compact or --markdown.");
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
    case "tools":
      if (wantsCommandHelp(rest, options)) {
        printHelp("tools");
        return;
      }
      console.log(Object.keys(TOOL_MAP).sort().join("\n"));
      return;
    case "whoami":
      if (wantsCommandHelp(rest, options)) {
        printHelp("whoami");
        return;
      }
      await runTool("user-info", "{}", options);
      return;
    case "overview":
      if (wantsCommandHelp(rest, options)) {
        printHelp("overview");
        return;
      }
      await runTool("get-overview", "{}", options);
      return;
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
      const searchText = rest.join(" ").trim();
      const payload =
        searchText.length > 0 ? { searchText, limit: Number(options.limit ?? 20) } : { limit: Number(options.limit ?? 20) };
      const result = await findProjects.execute(payload, getClient(options));
      printResult(result?.structuredContent ? result.structuredContent : result, options);
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
      const payload = {
        startDate: options.start ?? "today",
        daysCount: Number(options.days ?? 1),
        limit: Number(options.limit ?? 50),
        overdueOption: options.overdue ?? "include-overdue",
      };
      await runTool("find-tasks-by-date", JSON.stringify(payload), options);
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
        const result = await completeTasks.execute({ ids: [task.id] }, client);
        printResult(result?.structuredContent ? result.structuredContent : result, options);
        return;
      }
      const ids = await resolveTaskIds(client, rest);
      const result = await completeTasks.execute({ ids }, client);
      printResult(result?.structuredContent ? result.structuredContent : result, options);
      return;
    }
    case "close":
      if (wantsCommandHelp(rest, options)) {
        printHelp("close");
        return;
      }
      if (rest.length === 0) {
        exitWithError("Usage: todoist-cli close <task-ref> [task-ref...]");
      }
      const client = getClient(options);
      const ids = await resolveTaskIds(client, rest);
      const result = await completeTasks.execute({ ids }, client);
      printResult(result?.structuredContent ? result.structuredContent : result, options);
      return;
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
    case "run": {
      if (wantsCommandHelp(rest, options)) {
        printHelp("run");
        return;
      }
      const toolName = rest[0];
      if (!toolName) {
        exitWithError("Usage: todoist-cli run <tool-name> '<json-args>'");
      }
      await runTool(toolName, rest[1] ?? "{}", options);
      return;
    }
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
