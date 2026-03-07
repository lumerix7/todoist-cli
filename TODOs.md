# TODOs

- [x] Improve reference resolution across commands.
  Accept names, `id:...`, raw IDs, and Todoist URLs where applicable.
- [x] Add better ambiguity handling for project/section/task selectors.
  Show a small candidate list instead of failing with a generic not-found message.
- [x] Expand `add` and `modify` with the most useful structured flags from the official CLI.
  Prioritize `--section`, `--parent`, `--labels`, and `--description`.
- [x] Improve `move` semantics using official CLI behavior as reference.
  Covered clearer parent/section/project combinations and added unset flows that fit the simpler CLI.
- [x] Add a simple first-class `comment` command.
  Keep it flat and AI-friendly rather than mirroring the official nested command tree.
- [x] Add a simple first-class `activity` command.
  Kept a narrow filter surface instead of chasing full parity.
- [x] Add a `doctor` command for local setup and dependency health checks.
  Covers config/token presence, dependency version comparison, and API reachability.
- [x] Expand Todoist URL input support beyond the current task/project resolver paths.
  Added section URL support so section-targeting flows accept Todoist section URLs too.
- [x] Review recurring-task completion behavior.
  Added `done --forever` for recurring tasks and verified it against a real recurring fixture.
- [x] Improve output ergonomics without adopting the official CLI's heavier output model.
  Added a lightweight `--compact` mode for the common read/list commands while keeping JSON as the default.
- [x] Keep `delete` intentionally simple for now.
  No confirmation prompts were added; the simpler AI-oriented behavior remains the chosen default unless real workflow evidence suggests otherwise.
