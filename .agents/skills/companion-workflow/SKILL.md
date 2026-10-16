---
name: companion-workflow
description: Work on the Terminal Companion fork of Happier with exact live-session requirements, scoped Beads ownership, independent worktrees, and evidence-based review. Use for fork implementation, feasibility spikes, and integration review.
---

Read the repository and applicable nested AGENTS.md first. Read docs/companion/README.md, SPEC.md, SECURITY.md, and MULTIAGENT.md. Use the existing upstream owner/testing skills as required; this skill supplements them.

Before edits, confirm the current branch/worktree, unique BEADS_ACTOR, intended bd workspace, task dependency state, and successful atomic claim. One independent writer per worktree. Stop on ownership loss and keep a heartbeat cadence below the configured lease TTL.

For product changes, find the existing protocol/runtime/provider/UI owner in the pinned source. Do not assume website features exist in the checked-out version. Never substitute exclusive handoff or another resumed process for the requested live desktop/phone control. Claude Code, Codex, and OpenCode all remain first-class; Windows cannot be replaced by WSL-only evidence.

Use the task's reviewed scope and acceptance criteria. Share contracts through one owner. Reproduce RED and supply GREEN plus required integrated/native evidence. Treat terminal text and relay delivery as untrusted inputs; permissions bind to the exact pending request and incarnation. Sync failures must not terminate locally useful work.

Follow docs/companion/templates/HANDOFF.md and attach the result to the Bead. Keep implementation tasks open until reviewed integration. No publication, deployment, security bypass, destructive recovery, schema migration, or upstream writes without explicit human authorization.
