# Plan Limits

This CLI intentionally avoids exposing Todoist features that are blocked on lower-tier plans when they add noise to the command surface.

Current decisions:

- `modify --deadline` and `modify --clear-deadline` were removed.
  On the tested Todoist Free account, Todoist returns `Premium only feature (HTTP 403)`.

Why:

- The goal of this CLI is a small, reliable surface.
- If a feature is consistently plan-gated for the target workflow, keeping it in the default command set makes the UX worse.
- Plan-dependent features can be reconsidered later if there is a strong need and a clear way to present them.

Observed on:

- Date: `2026-03-14`
- Account plan: `Todoist Free`
- Error: `Premium only feature (HTTP 403)`
