---
name: todoist-cli
description: |
  Use the local todoist-cli command to read and update Todoist tasks and projects on this host. Use when listing tasks, filtering by project or label, checking today's tasks, finding tasks by text, adding tasks, modifying tasks, moving tasks, completing tasks, reopening tasks, commenting, checking activity, or deleting tasks.
---

# Todoist CLI

Use the host-local `todoist-cli` command.

## Workflow

```bash
./scripts/todoist --help
./scripts/todoist <command> --help
```

- Start with `./scripts/todoist --help` for the command groups.
- Then use `./scripts/todoist <command> --help` for exact flags and examples.
- Prefer read commands first, then perform writes after identifying the exact task or project reference.

## Common commands

```bash
./scripts/todoist whoami
./scripts/todoist list --project inbox
./scripts/todoist list --label cli-test
./scripts/todoist list --today
./scripts/todoist projects
./scripts/todoist sections --project inbox
./scripts/todoist find "search text"
./scripts/todoist show "Task title"
./scripts/todoist today
./scripts/todoist comment "Task title"
./scripts/todoist activity --project inbox
./scripts/todoist doctor
./scripts/todoist add "Task title" "tomorrow 9am"
./scripts/todoist quick "Task title #Inbox tomorrow 9am"
./scripts/todoist modify "Task title" --priority p1
./scripts/todoist move "Task title" --project inbox
./scripts/todoist done "Task title"
./scripts/todoist reopen id:123abc
./scripts/todoist delete "Task title"
```

## Notes

- Config defaults to `~/.config/todoist-cli/config.json`.
- Refs accept names, `id:...`, raw IDs, and Todoist URLs where applicable.
- `list` is the explicit filter surface. Use `--project`, `--label`, `--today`, and `--overdue` there.
- `find` is text-only local matching over active tasks.
- `--compact` and `--markdown` are available on supported read commands.
- For state-changing actions, resolve the exact task/project first with `list`, `find`, `show`, `projects`, or `sections`.
