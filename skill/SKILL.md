---
name: todoist-cli
description: |
  Use the local todoist-cli command to read and update Todoist tasks and projects on this host. Use when listing tasks, filtering by project or label, checking today's tasks, finding tasks by text, adding tasks, modifying tasks, moving tasks, completing tasks, reopening tasks, commenting, checking activity, or deleting tasks.
---

# Todoist CLI

Use the host-local `todoist-cli` command.

## Workflow

```bash
todoist-cli --help
todoist-cli <command> --help
```

- Start with `todoist-cli --help` for the command groups.
- Then use `todoist-cli <command> --help` for exact flags and examples.
- Prefer read commands first, then perform writes after identifying the exact task or project reference.
- Install or refresh the host CLI with `./install.sh --yes` when the local package has changed.

## Common commands

```bash
todoist-cli whoami
todoist-cli whoami --markdown
todoist-cli overview --markdown
todoist-cli list --project inbox
todoist-cli list --label cli-test
todoist-cli list --today
todoist-cli projects
todoist-cli sections --project inbox
todoist-cli find "search text"
todoist-cli show "Task title"
todoist-cli today
todoist-cli comment "Task title"
todoist-cli activity --project inbox
todoist-cli doctor --markdown
todoist-cli add "Task title" "tomorrow 9am"
todoist-cli quick "Task title #Inbox tomorrow 9am"
todoist-cli modify "Task title" --priority p1
todoist-cli move "Task title" --project inbox
todoist-cli done "Task title"
todoist-cli reopen id:123abc
todoist-cli delete "Task title"
```

## Notes

- Config defaults to `~/.config/todoist-cli/config.json`.
- Refs accept names, `id:...`, raw IDs, and Todoist URLs where applicable.
- `list` is the explicit filter surface. Use `--project`, `--label`, `--today`, and `--overdue` there.
- `find` is text-only local matching over active tasks.
- `whoami`, `overview`, `list`, `show`, `comment`, `activity`, and `doctor` support `--markdown` and `--compact`.
- For state-changing actions, resolve the exact task/project first with `list`, `find`, `show`, `projects`, or `sections`.
