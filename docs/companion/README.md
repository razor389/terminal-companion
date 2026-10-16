# Terminal Companion fork: development entry point

Prepared 2026-10-14. Working name: **Terminal Companion**. Integration branch: `companion/main`.

This folder records Ross's requested product and the proposed implementation strategy. It is not a claim that the features work in any Happier release. The bootstrap audit must replace assumptions about upstream internals with evidence from the exact checked-out commit.

## Read in this order

1. The repository's existing `AGENTS.md`, its Terminal Companion addendum, and applicable nested instructions.
2. `SPEC.md` for the product contract; `SECURITY.md` for trust boundaries.
3. `PLAN.md` for phases, integration boundaries, and ownership.
4. `MULTIAGENT.md` and `BEADS.md` for the development workflow.
5. `ACCEPTANCE.md` for the evidence required before declaring success.
6. `prompts/00-bootstrap.md` to start the first Codex session.

Use Beads for live task status, claims, blockers, and handoffs. `bootstrap-beads.json` is a one-time starting backlog, not a second tracker. Design decisions belong in reviewed documentation or ADRs. Code and tests belong in their existing upstream owners, not in this documentation folder.

## Pack contents and boundaries

The starter adds a scoped agent skill, prompts, templates, bootstrap tasks, and development utilities. It does **not** replace the upstream agent constitution, install a daemon, change authentication, launch providers, deploy a relay, enable GitHub Actions, or create an Android build. The installer requires explicit `--apply` and refuses conflicting existing files.

`SOURCES.md` records the primary sources checked. `UPSTREAM_BASELINE.json` is generated on your machine; no upstream commit or installed tool version is invented in this pack.

The product's agent sessions are independent of the Codex agents used to build this repository. Beads is development coordination only; it must not become a runtime dependency of the app.
