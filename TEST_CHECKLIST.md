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
- On `2026-03-14`, the checklist was verified both against `node ./bin/todoist-cli.js` and the globally installed `todoist-cli` binary.
- On `2026-03-15`, important read-path checks were reverified against the globally installed `todoist-cli` binary after reinstall.

| Done | Verified On | Area | Command | Expected |
| --- | --- | --- | --- | --- |
| [x] | 2026-03-14 | help | `todoist-cli help` | Main help prints without error |
| [x] | 2026-03-14 | help | `todoist-cli help add` | Add help includes structured flags |
| [x] | 2026-03-14 | help | `todoist-cli help modify` | Modify help includes current structured flags |
| [x] | 2026-03-14 | help | `todoist-cli help move` | Move help includes `--no-parent` and `--no-section` |
| [x] | 2026-03-14 | help | `todoist-cli help done` | Done help includes `--forever` |
| [x] | 2026-03-14 | help | `todoist-cli help comment` | Comment help prints without error |
| [x] | 2026-03-14 | help | `todoist-cli help activity` | Activity help prints without error |
| [x] | 2026-03-14 | help | `todoist-cli help doctor` | Doctor help prints without error |
| [x] | 2026-03-14 | help | `todoist-cli help list` | Command help includes shared global options |
| [x] | 2026-03-14 | help | `todoist-cli help close` | Alias help prints without error and includes shared global options |
| [x] | 2026-03-14 | auth | `todoist-cli whoami` | Current account info prints |
| [x] | 2026-03-15 | auth | `todoist-cli whoami --markdown` | Markdown table prints for user info output |
| [x] | 2026-03-15 | auth | `todoist-cli whoami --compact` | Compact summary prints for user info output |
| [x] | 2026-03-14 | overview | `todoist-cli overview` | Overview prints structured output |
| [x] | 2026-03-15 | overview | `todoist-cli overview --markdown` | Markdown tables print for overview output |
| [x] | 2026-03-15 | overview | `todoist-cli overview --compact` | Compact summary prints for overview output |
| [x] | 2026-03-14 | projects | `todoist-cli projects` | Projects list prints |
| [x] | 2026-03-14 | projects | `todoist-cli projects "CLI Test"` | Project search returns the test project |
| [x] | 2026-03-14 | labels | `todoist-cli labels` | Labels list prints |
| [x] | 2026-03-14 | sections | `todoist-cli sections --project "CLI Test"` | `Backlog` section is listed |
| [x] | 2026-03-14 | list | `todoist-cli list --project "CLI Test"` | Test tasks are listed |
| [x] | 2026-03-14 | list | `todoist-cli list --project id:<project-id>` | Same result using explicit id ref |
| [x] | 2026-03-14 | list | `todoist-cli list --project "CLI Test" --markdown` | Markdown table prints for list output |
| [x] | 2026-03-14 | show | `todoist-cli show "CLI Smoke Task"` | Task details print using task name ref |
| [x] | 2026-03-14 | show | `todoist-cli show id:<task-id>` | Task details print using `id:` ref |
| [x] | 2026-03-14 | show | `todoist-cli show <task-url>` | Task details print using Todoist URL |
| [x] | 2026-03-14 | show | `todoist-cli show "CLI Smoke Task Updated" --markdown` | Markdown table prints for single-task output |
| [x] | 2026-03-14 | find | `todoist-cli find "CLI Smoke"` | Matching task is returned |
| [x] | 2026-03-14 | today | `todoist-cli today` | Today output prints without error |
| [x] | 2026-03-14 | completed | `todoist-cli completed-list --days 7` | Completed task list prints without error |
| [x] | 2026-03-14 | add | `todoist-cli add "CLI Added Task"` | Task is created |
| [x] | 2026-03-14 | add | `todoist-cli add "CLI Added Task 2" --project "CLI Test"` | Task is created in the test project |
| [x] | 2026-03-14 | add | `todoist-cli add "CLI Added Task 3" --project "CLI Test" --section "Backlog"` | Task is created in the target section |
| [x] | 2026-03-14 | add | `todoist-cli add "CLI Child Added" --parent "CLI Parent Task"` | Task is created as a child task |
| [x] | 2026-03-14 | add | `todoist-cli add "CLI Rich Task" --project "CLI Test" --description "desc" --label cli-test --priority p1` | Description, label, and priority are applied |
| [x] | 2026-03-14 | quick | `todoist-cli quick "CLI Quick Task 2 @cli-test tomorrow"` | Quick add creates task successfully with label and due date; project routing remains Todoist quick-add dependent |
| [x] | 2026-03-14 | modify | `todoist-cli modify "CLI Smoke Task" --content "CLI Smoke Task Updated"` | Task content updates |
| [x] | 2026-03-14 | modify | `todoist-cli modify "CLI Smoke Task Updated" --description "updated desc"` | Description updates |
| [x] | 2026-03-14 | modify | `todoist-cli modify "CLI Smoke Task Updated" --label cli-test --priority p2` | Labels and priority update |
| [x] | 2026-03-14 | modify | `todoist-cli modify "CLI Smoke Task Updated" --uncompletable` | Task becomes uncompletable |
| [x] | 2026-03-14 | modify | `todoist-cli modify "CLI Smoke Task Updated" --completable` | Task becomes completable again |
| [x] | 2026-03-14 | move | `todoist-cli move "CLI Smoke Task Updated" --section "Backlog" --project "CLI Test"` | Task moves to section |
| [x] | 2026-03-14 | move | `todoist-cli move "CLI Child Task" --parent "CLI Parent Task"` | Task becomes child of the parent |
| [x] | 2026-03-14 | move | `todoist-cli move "CLI Child Task" --no-parent` | Task is moved back to project root |
| [x] | 2026-03-14 | move | `todoist-cli move "CLI Smoke Task Updated" --project "CLI Test" --no-section` | Section placement is removed |
| [x] | 2026-03-14 | done | `todoist-cli done "CLI Smoke Task Updated"` | Task completes successfully |
| [x] | 2026-03-14 | done | `todoist-cli done <recurring-task-ref> --forever` | Recurring task is permanently completed and no longer appears in active list |
| [x] | 2026-03-14 | reopen | `todoist-cli reopen <completed-task-id>` | Completed task reopens |
| [x] | 2026-03-14 | comment | `todoist-cli comment "CLI Parent Task"` | Task comments list prints |
| [x] | 2026-03-14 | comment | `todoist-cli comment "CLI Parent Task" --add "CLI test comment"` | Comment is created on the task |
| [x] | 2026-03-14 | comment | `todoist-cli comment "CLI Test" --project` | Project comments list prints |
| [x] | 2026-03-14 | comment | `todoist-cli comment "CLI Test" --project --add "CLI project comment"` | Project comment is created |
| [x] | 2026-03-14 | comment | `todoist-cli comment "CLI Test" --project --markdown` | Markdown table prints for comment output |
| [x] | 2026-03-14 | activity | `todoist-cli activity --project "CLI Test" --limit 10` | Recent activity prints |
| [x] | 2026-03-14 | activity | `todoist-cli activity --object task --event added --limit 10` | Task-added activity prints |
| [x] | 2026-03-14 | doctor | `todoist-cli doctor` | Reports config/token status, dependency versions, and API reachability |
| [x] | 2026-03-14 | delete | `todoist-cli delete "CLI Added Task"` | Disposable task is deleted |
| [x] | 2026-03-14 | delete | `todoist-cli delete "CLI Added Task 2" "CLI Added Task 3"` | Multiple disposable tasks are deleted |
| [x] | 2026-03-14 | run | `todoist-cli tools` | Supported tool list prints |
| [x] | 2026-03-14 | run | `todoist-cli run find-projects '{"searchText":"CLI Test","limit":5}'` | Raw tool execution prints structured output |
| [x] | 2026-03-14 | errors | `todoist-cli show "definitely missing task"` | Clean not-found error, no stack trace |
| [x] | 2026-03-14 | errors | `todoist-cli add "Bad Section Test" --section Backlog` | Clean validation error requiring `--project` |
| [x] | 2026-03-14 | errors | `todoist-cli move "CLI Smoke Task Updated" --section Backlog --no-section` | Clean validation error for conflicting flags |
| [x] | 2026-03-14 | errors | `todoist-cli modify "CLI Smoke Task Updated" --uncompletable --completable` | Clean validation error for conflicting flags |
| [x] | 2026-03-14 | errors | `todoist-cli list --project "CLI Test" --compact --markdown` | Clean validation error requiring a single output mode |
