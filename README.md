# todoist-cli

CLI-first Todoist wrapper built directly on Todoist's HTTP API.

This repo is intentionally lighter than an MCP-first integration. It keeps a small AI-friendly command surface for common Todoist operations.

## Why this repo

- single dependency, no AI layer required
- direct REST API usage, easy to audit and adapt
- easy to wire as a local script or bundled skill

## Setup

```bash
./install.sh
./install.sh --yes
```

The npm package name is `@efficiency/todoist-cli`. The installed command remains `todoist-cli`.
`./install.sh` asks before running the global install step and performs a tarball-based global install so npm copies the package instead of linking the repo.
Use `./install.sh --help` to see installer options.

Then set your Todoist token in `~/.config/todoist-cli/config.json`:

```json
{
  "token": "your-todoist-token"
}
```

You can still use `TODOIST_API_KEY` or `TODOIST_API_TOKEN` as an override.

## Skill Install

Install the bundled skill into one or more explicit skill directories:

```bash
./install-skill.sh /path/to/workspace/skills
./install-skill.sh --yes /path/to/workspace/skills
```

The script requires explicit targets and asks for confirmation before copying files.
Use `./install-skill.sh --help` to see installer options.

## Quick start

```bash
todoist-cli --help
todoist-cli whoami
todoist-cli list
todoist-cli list --project inbox
todoist-cli list --project "CLI Test"
todoist-cli show "Buy milk"
todoist-cli find "gateway"
todoist-cli projects
todoist-cli sections --project inbox
todoist-cli labels
todoist-cli comment "Buy milk"
todoist-cli activity --project inbox
todoist-cli today
todoist-cli quick "Pay rent tomorrow 9am #Inbox"
todoist-cli add "Pay rent" "tomorrow 9am" --project inbox
todoist-cli modify "Buy milk" --priority p1
todoist-cli move "Buy milk" --project inbox
todoist-cli done "Buy milk"
todoist-cli reopen id:123abc
todoist-cli completed-list --days 7
todoist-cli doctor
todoist-cli delete "Buy milk"
todoist-cli --config /path/to/config.json whoami
```

## Official API Docs

- Unified Todoist API v1: https://developer.todoist.com/api/v1/
- Developer guides overview: https://developer.todoist.com/guides/
- Legacy Sync API reference for `/sync` command details: https://developer.todoist.com/sync/v9/

## Notes

- Use `todoist-cli <command> --help` for exact flags.
- Task/project/section refs accept names, `id:...`, raw IDs, and Todoist URLs where applicable.
- `list` is the explicit filter surface. Use `--project`, `--label`, `--today`, and `--overdue` there.
- `find` is text-only local matching over active tasks.
- `move` supports one move target: `--project`, `--section`, `--parent`, `--no-parent`, or `--no-section`.
- `done --forever` permanently completes a recurring task.
- Markdown is the default output on supported read commands and is the preferred mode for AI-agent use.
- `--compact` prints lightweight plain text on supported read commands.
- `--json` prints structured JSON output.
- The CLI uses direct Todoist API calls with lightweight retry/backoff: `429` is retried for all methods, and transient `GET` failures (`408`, `500`, `502`, `503`, `504`) are retried with backoff.
- `delete` intentionally stays simple for AI-oriented workflows; no confirmation prompt for now.
- `install.sh` installs dependencies, optionally installs the CLI globally, and sets up config; `install-skill.sh` copies the bundled skill.
- See [`TESTING.md`](./TESTING.md) for the current verification checklist and recent test notes.
