# Test Checklist

Use a dedicated Todoist test project and a few disposable tasks/comments for write operations.

Recommended fixture setup:

- `Project`: `CLI Test`
- `Section`: `Backlog`
- `Tasks`:
  - `CLI Smoke Task`
  - `CLI Parent Task`
  - `CLI Child Task`
- `Labels`:
  - `cli-test`

Notes:

- Read-only commands can be tested against normal data.
- Write commands should use only disposable test data.
- For destructive commands, create fresh fixtures first.
- Mark each item after verifying both output shape and Todoist-side effect.
- `Last Verified` is per checklist row. It is the most recent date that specific command was verified, not a claim that the entire table was rerun on the same day.
- On `2026-03-14`, the checklist was verified both against `node ./bin/todoist-cli.js` and the globally installed `todoist-cli` binary.
- On `2026-03-15`, important read-path checks were reverified against the globally installed `todoist-cli` binary after reinstall.
- On `2026-03-16`, `@doist/todoist-ai` updated to `7.17.0`; `doctor` and core read commands reverified. `-v`/`--version` flags added and verified.
- On `2026-03-16`, `@doist/todoist-ai` dependency removed entirely; `whoami`, `overview`, `projects`, `today`, `done`, `close` replaced with direct Todoist SDK calls. `tools` and `run` commands removed.
- On `2026-03-16`, reinstalled globally after all refactors; `whoami`, `overview`, `projects`, `today`, `doctor` (all three output modes), version flags, error cases reverified against global binary.
- On `2026-03-25`, the Doist SDK dependency was updated and repo-level retry/backoff was added on top of the SDK's network retry: `429` is retried for all methods, and transient `GET` failures (`408`, `500`, `502`, `503`, `504`) are retried with exponential backoff.
- On `2026-03-25`, important read-path checks were reverified against `node ./bin/todoist-cli.js`: `help`, `whoami`, `overview --compact`, `projects "CLI Test"`, `sections --project "CLI Test"`, `list --project "CLI Test"`, `activity` reads, `doctor`, and the conflicting output-mode validation error.
- On `2026-03-29`, completed-activity reads with a date window were rerouted to Todoist's completed-tasks-by-completion-date endpoint because Todoist's `/api/v1/activities` endpoint was returning HTTP 500 for those queries. The affected installed-CLI variants were reverified after reinstall, including `--object task --event completed` and plain `--event completed`.
- On `2026-03-29`, important installed-CLI checks were reverified after the activity fallback change: `help`, `whoami`, `overview --compact`, `projects "CLI Test"`, `sections --project "CLI Test"`, `list --project "CLI Test"`, `doctor`, and the conflicting output-mode validation error.
- On `2026-04-04`, the CLI was reverified on direct Todoist `/api/v1` calls after removing the SDK dependency and adding `Connection: close` so short-lived commands exit promptly.
- On `2026-04-04`, supported read commands were changed to default to Markdown output; `--json` now forces structured output and `--compact` remains available for terse text.
- On `2026-04-04`, Markdown was documented as the preferred default for AI-agent use; `--json` is reserved for explicit structured parsing.
- On `2026-04-04`, the follow-up regression fixes were reverified against both `node ./bin/todoist-cli.js` and the installed `todoist-cli` binary:
  - `--completable` now removes the `* ` prefix again.
  - `done --forever` now removes the recurring task from the active list after completion.
  - single-task project adds such as `add "CLI Added Task 2" --project "CLI Test" --json` now exit promptly.

| ✅ | Last Verified | Area | Command | Expected |
| --- | --- | --- | --- | --- |
| ✅ | 2026-04-04 | help | `todoist-cli help` | Main help prints without error |
| ✅ | 2026-04-04 | help | `todoist-cli whoami --help` | Help shows `--json` and default markdown behavior via shared options |
| ✅ | 2026-04-04 | version | `todoist-cli -v` | Prints version number (e.g. `0.1.0`) |
| ✅ | 2026-04-04 | version | `todoist-cli --version` | Prints version number (e.g. `0.1.0`) |
| ✅ | 2026-04-04 | help | `todoist-cli help add` | Add help includes structured flags |
| ✅ | 2026-04-04 | help | `todoist-cli help modify` | Modify help includes current structured flags |
| ✅ | 2026-04-04 | help | `todoist-cli help move` | Move help includes `--no-parent` and `--no-section` |
| ✅ | 2026-04-04 | help | `todoist-cli help done` | Done help includes `--forever` |
| ✅ | 2026-04-04 | help | `todoist-cli help comment` | Comment help prints without error |
| ✅ | 2026-04-04 | help | `todoist-cli help activity` | Activity help prints without error |
| ✅ | 2026-04-04 | help | `todoist-cli help doctor` | Doctor help prints without error |
| ✅ | 2026-04-04 | help | `todoist-cli help list` | Command help includes shared global options |
| ✅ | 2026-04-04 | help | `todoist-cli help close` | Alias help prints without error and includes shared global options |
| ✅ | 2026-04-04 | auth | `todoist-cli whoami` | Current account info prints as a Markdown table by default |
| ✅ | 2026-04-04 | auth | `todoist-cli whoami --compact` | Compact summary prints for user info output |
| ✅ | 2026-04-04 | auth | `todoist-cli whoami --json` | Structured JSON prints for user info output |
| ✅ | 2026-04-04 | overview | `todoist-cli overview` | Overview prints Markdown output by default |
| ✅ | 2026-04-04 | overview | `todoist-cli overview --compact` | Compact summary prints for overview output |
| ✅ | 2026-04-04 | projects | `todoist-cli projects` | Projects list prints |
| ✅ | 2026-04-04 | projects | `todoist-cli projects "CLI Test"` | Project search returns the test project |
| ✅ | 2026-04-04 | labels | `todoist-cli labels` | Labels list prints |
| ✅ | 2026-04-04 | sections | `todoist-cli sections --project "CLI Test"` | `Backlog` section is listed |
| ✅ | 2026-04-04 | list | `todoist-cli list --project "CLI Test"` | Test tasks are listed in a Markdown table by default |
| ✅ | 2026-04-04 | list | `todoist-cli list --project id:<project-id>` | Same result using explicit id ref |
| ✅ | 2026-04-04 | show | `todoist-cli show "CLI Smoke Task"` | Task details print using task name ref |
| ✅ | 2026-04-04 | show | `todoist-cli show id:<task-id>` | Task details print using `id:` ref |
| ✅ | 2026-04-04 | show | `todoist-cli show <task-url>` | Task details print using Todoist URL |
| ✅ | 2026-04-04 | find | `todoist-cli find "CLI Smoke"` | Matching task is returned |
| ✅ | 2026-04-04 | today | `todoist-cli today --compact` | Today output prints without error |
| ✅ | 2026-04-04 | completed | `todoist-cli completed-list --days 7 --compact` | Completed task list prints without error |
| ✅ | 2026-04-04 | add | `todoist-cli add "CLI Added Task"` | Task is created |
| ✅ | 2026-04-04 | add | `todoist-cli add "CLI Added Task 2" --project "CLI Test"` | Task is created in the test project |
| ✅ | 2026-04-04 | add | `todoist-cli add "CLI Added Task 3" --project "CLI Test" --section "Backlog"` | Task is created in the target section |
| ✅ | 2026-04-04 | add | `todoist-cli add "CLI Child Added" --parent "CLI Parent Task"` | Task is created as a child task |
| ✅ | 2026-04-04 | add | `todoist-cli add "CLI Rich Task" --project "CLI Test" --description "desc" --label cli-test --priority p1` | Description, label, and priority are applied |
| ✅ | 2026-04-04 | quick | `todoist-cli quick "CLI Quick Task 2 @cli-test tomorrow"` | Quick add creates task successfully with label and due date; project routing remains Todoist quick-add dependent |
| ✅ | 2026-04-04 | modify | `todoist-cli modify "CLI Smoke Task" --content "CLI Smoke Task Updated"` | Task content updates |
| ✅ | 2026-04-04 | modify | `todoist-cli modify "CLI Smoke Task Updated" --description "updated desc"` | Description updates |
| ✅ | 2026-04-04 | modify | `todoist-cli modify "CLI Smoke Task Updated" --label cli-test --priority p2` | Labels and priority update |
| ✅ | 2026-04-04 | modify | `todoist-cli modify "CLI Smoke Task Updated" --uncompletable` | Task becomes uncompletable |
| ✅ | 2026-04-04 | modify | `todoist-cli modify "CLI Smoke Task Updated" --completable` | Task becomes completable again |
| ✅ | 2026-04-04 | move | `todoist-cli move "CLI Smoke Task Updated" --section "Backlog" --project "CLI Test"` | Task moves to section |
| ✅ | 2026-04-04 | move | `todoist-cli move "CLI Child Task" --parent "CLI Parent Task"` | Task becomes child of the parent |
| ✅ | 2026-04-04 | move | `todoist-cli move "CLI Child Task" --no-parent` | Task is moved back to project root |
| ✅ | 2026-04-04 | move | `todoist-cli move "CLI Smoke Task Updated" --project "CLI Test" --no-section` | Section placement is removed |
| ✅ | 2026-04-04 | done | `todoist-cli done "CLI Smoke Task Updated"` | Task completes successfully |
| ✅ | 2026-04-04 | done | `todoist-cli done <recurring-task-ref> --forever` | Recurring task is permanently completed and no longer appears in active list |
| ✅ | 2026-04-04 | reopen | `todoist-cli reopen <completed-task-id>` | Completed task reopens |
| ✅ | 2026-04-04 | comment | `todoist-cli comment "CLI Parent Task"` | Task comments list prints |
| ✅ | 2026-04-04 | comment | `todoist-cli comment "CLI Parent Task" --add "CLI test comment"` | Comment is created on the task |
| ✅ | 2026-04-04 | comment | `todoist-cli comment "CLI Test" --project --limit 2` | Project comments list prints |
| ✅ | 2026-04-04 | comment | `todoist-cli comment "CLI Test" --project --add "CLI project comment"` | Project comment is created |
| ✅ | 2026-04-04 | activity | `todoist-cli activity --project "CLI Test" --limit 10` | Recent activity prints |
| ✅ | 2026-04-04 | activity | `todoist-cli activity --object task --event added --limit 10` | Task-added activity prints |
| ✅ | 2026-04-04 | activity | `todoist-cli activity --object task --event completed --since 2026-03-26 --until 2026-03-29 --limit 50 --compact` | Completed task activity prints via the completed-tasks primary path without HTTP 500 |
| ✅ | 2026-04-04 | activity | `todoist-cli activity --event completed --since 2026-03-26 --until 2026-04-02 --limit 10 --compact` | Completed activity prints via the completed-tasks primary path without HTTP 500 |
| ✅ | 2026-04-04 | activity | `todoist-cli activity --limit 10 --compact` | Unfiltered recent activity still prints through the standard activity endpoint |
| ✅ | 2026-04-04 | activity | `todoist-cli activity --object task --event added --limit 10 --compact` | Task-added activity still prints through the standard activity endpoint |
| ✅ | 2026-04-04 | activity | `todoist-cli activity --project "CLI Test" --limit 10 --compact` | Project-scoped activity returns cleanly in compact output |
| ✅ | 2026-04-04 | activity | `todoist-cli activity --project "CLI Test" --object task --event completed --since 2026-03-26 --until 2026-03-29 --limit 20 --compact` | Project-scoped completed activity returns cleanly via the completed-tasks primary path when no matching rows are returned |
| ✅ | 2026-04-04 | doctor | `todoist-cli doctor` | Default output reports config/token status and API reachability in Markdown output |
| ✅ | 2026-04-04 | doctor | `todoist-cli doctor --json` | Reports structured JSON output when requested |
| ✅ | 2026-04-04 | delete | `todoist-cli delete "CLI Delete One"` | Disposable task is deleted |
| ✅ | 2026-04-04 | delete | `todoist-cli delete "CLI Delete Two" "CLI Delete Three"` | Multiple disposable tasks are deleted |
| ✅ | 2026-04-04 | errors | `todoist-cli show "definitely missing task"` | Clean not-found error, no stack trace |
| ✅ | 2026-04-04 | errors | `todoist-cli add "Bad Section Test" --section Backlog` | Clean validation error requiring `--project` |
| ✅ | 2026-04-04 | errors | `todoist-cli move "CLI Smoke Task Updated" --section Backlog --no-section` | Clean validation error for conflicting flags |
| ✅ | 2026-04-04 | errors | `todoist-cli modify "CLI Smoke Task Updated" --uncompletable --completable` | Clean validation error for conflicting flags |
| ✅ | 2026-04-04 | errors | `todoist-cli list --project "CLI Test" --compact --json` | Clean validation error requiring a single output mode |
