# todoist-cli

CLI-first Todoist wrapper built directly on [`@doist/todoist-sdk`](https://github.com/Doist/todoist-sdk-js).

This repo is intentionally lighter than an MCP-first integration. It keeps a small AI-friendly command surface for common Todoist operations.

## Why this repo

- single dependency, no AI layer required
- direct REST API usage, easy to audit and adapt
- easy to wire as a local script or OpenClaw skill

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

Install the bundled skill into the default OpenClaw workspaces on this host:

```bash
./install-skill.sh
./install-skill.sh --yes
```

The script resolves default targets from `openclaw agents list --json` and asks for confirmation before copying files.
Use `./install-skill.sh --help` to see installer options.

Or install into specific skill directories:

```bash
./install-skill.sh /path/to/workspace/skills /another/workspace/skills
```

## Quick start

```bash
todoist-cli --help
todoist-cli whoami
todoist-cli list
todoist-cli list --project inbox
todoist-cli list --project "CLI Test" --markdown
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

## Notes

- Use `todoist-cli <command> --help` for exact flags.
- Task/project/section refs accept names, `id:...`, raw IDs, and Todoist URLs where applicable.
- `list` is the explicit filter surface. Use `--project`, `--label`, `--today`, and `--overdue` there.
- `find` is text-only local matching over active tasks.
- `move` supports one move target: `--project`, `--section`, `--parent`, `--no-parent`, or `--no-section`.
- `done --forever` permanently completes a recurring task.
- `--compact` prints lightweight plain text on supported read commands.
- `--markdown` prints Markdown tables on supported read commands.
- The CLI adds lightweight retry/backoff on top of the Todoist SDK: `429` is retried for all methods, and transient `GET` failures (`408`, `500`, `502`, `503`, `504`) are retried with backoff.
- `delete` intentionally stays simple for AI-oriented workflows; no confirmation prompt for now.
- `install.sh` installs dependencies, optionally installs the CLI globally, and sets up config; `install-skill.sh` copies the bundled OpenClaw skill.
- See [`TESTING.md`](./TESTING.md) for the current verification checklist and recent test notes.
