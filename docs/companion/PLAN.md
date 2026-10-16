# Implementation plan and integration boundaries

This is a design/phase document, not a live status board. Beads owns task state. The JSON seed contains proposed tasks with stable external references, acceptance criteria, and dependencies.

## Phase 0 — establish a trustworthy base

Record the exact upstream commit and tool versions. Preserve the license and original engineering rules. Audit inherited automation before enabling it. Run the smallest real upstream build/test lanes, identify baseline failures, and locate actual protocol, daemon, terminal, provider, mobile, push, and test owners. Do not generate an invented repository map from memory.

Produce a reviewed `REPO_AUDIT.md` with discovered file paths, commands, runtime identities, dependency graph, and reusable implementations. Record a compatibility matrix. Reproduce the Windows stderr/launcher symptom in isolation; the user's report supports a hypothesis, not a proven root cause. This is also where Node, Yarn, native dependencies, and Windows build prerequisites are fixed.

## Phase 1 — resolve the highest-risk feasibility questions

Run small native-Windows spikes for OpenCode, Codex, and Claude. Each must attempt the same live terminal/remote-response contract and record limitations. OpenCode is the reference candidate, not permission to postpone Codex Windows until the end.

In parallel, one protocol owner defines the request lifecycle and a security owner reviews its trust boundaries. Approve one shared interface before multiple adapter writers edit it. No new mobile redesign until request identity and native control paths are credible.

## Phase 2 — implement a narrow reference path

Build or extend a provider-independent conformance harness using deterministic external provider/OS/transport boundaries. Demonstrate stale-answer rejection, input-draft preservation, duplicate decisions, acknowledgement loss, and disconnected sync with real internal logic.

Separate locally useful session lifetime from remote connection lifetime in the owning code. Implement the OpenCode reference adapter and an Android attention item with a phone response to an actual waiting request. This is the first integrated slice. Keep mobile review friction appropriate for consequential actions.

## Phase 3 — complete provider parity and multi-machine behavior

Integrate Codex and Claude through the same reviewed contract. Do not introduce provider-specific silent fallbacks that weaken the experience. Add accurate capability and compatibility reporting. Verify machine/backend/run scoping with multiple sessions on two desktops. Prove input races at the native authority, not only in UI tests.

## Phase 4 — harden and pilot

Validate physical-device push delivery, reconnection, duplicate taps, stale notifications, permissions, phone loss/revocation, and lock-screen privacy. Verify native Windows launcher behavior for warnings and real nonzero exit codes. Optional auto-start must report persistent health honestly. Add a custom-harness adapter contract after the three required providers are understood.

The pilot gate requires reviewed evidence, not every possible enhancement. Keep live provider tests opt-in with explicit credentials/budget; never run them on untrusted PRs. Do not publish until app identity, signing, relay settings, and push credentials belong to the fork.

## Work ownership

| Workstream | Owns | Must coordinate |
|---|---|---|
| Coordinator/integrator | Root setup, plan changes, lockfiles, merge queue, upstream updates | Every shared interface |
| Protocol/lifecycle | Canonical request schema, state transitions, conformance contract | Adapter and mobile consumers |
| Windows/session host | Native launch, terminal ownership, sync/process separation | Provider lifecycle owners |
| OpenCode | Existing OpenCode adapter and its tests | Protocol, session host |
| Codex | Existing Codex adapter and its tests | Protocol, native Windows |
| Claude | Existing Claude terminal/hooks adapter and its tests | Protocol, native Windows |
| Android | Inbox, response UX, push registration and reconciliation | Protocol, auth, notification owner |
| Security/reviewer | Trust model, abuse/race cases, independent verification | No unilateral cryptographic rewrite |

These are conceptual ownership boundaries. The audit must identify the real files. If two tasks touch the same shared owner, serialize them or explicitly consume the same reviewed change rather than having both redesign it.

## Upstream policy

Use a dedicated `companion/main` integration branch. Retain `upstream` as fetch-only and preserve upstream history. Record a baseline commit, then take upstream changes only through a reviewed `maintenance/upstream-*` branch. Do not automatically merge `upstream/dev` into active worker branches. Run affected compatibility/conformance tests after upgrades. General Windows fixes may be offered upstream separately; fork-specific product changes should remain separated for review.
