---
name: todoist-cli
description: |
  Use the local todoist-cli command to read and update Todoist tasks and projects. Use when listing tasks, filtering by project or label, checking today's tasks, finding tasks by text, adding tasks, modifying tasks, moving tasks, completing tasks, reopening tasks, commenting, checking activity, or deleting tasks.
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

## Common commands

```bash
todoist-cli whoami
todoist-cli overview
todoist-cli list --project inbox
todoist-cli projects
todoist-cli find "search text"
todoist-cli show "Task title"
todoist-cli today
todoist-cli activity
todoist-cli doctor
todoist-cli add "Task title" "tomorrow 9am"
todoist-cli done "Task title"
```

## Notes

- Refs accept names, `id:...`, raw IDs, and Todoist URLs where applicable.
- Markdown is the default output. Use `--json` when structured parsing is needed.
- Config defaults to `~/.config/todoist-cli/config.json`.
