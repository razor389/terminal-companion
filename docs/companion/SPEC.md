# Product contract: Terminal Companion

Status: approved user requirements plus a proposed design to validate. Owner: Ross. Date: 2026-10-14.

## Problem

Ross runs many terminal agents across multiple desktops, primarily Codex and Claude Code, and also requires OpenCode. Most interruptions need a small approval, a short answer, or a status inquiry. Substantial investigation belongs at the desk. Existing Happier installation failures and exclusive-control behavior are unacceptable as the foundation of that workflow.

The user is willing to launch future sessions through a wrapper or integrated CLI. Attaching to every arbitrary already-running process is not an initial requirement. The solution is an Android companion for existing local execution, not a new remote execution service.

## Required experience

The user launches the native agent interface from the intended working directory. It remains visible and interactive on the desktop. A permission or question produces a phone notification and an inbox item labeled with machine, project, provider, and session. A simple response reaches that same pending request. Returning to the terminal requires no handoff, restart, history import, or second agent process. A local response invalidates the phone request. Several machines can be active simultaneously.

The phone supports short ordinary messages, read-only status, permission decisions, and structured question choices/text where a provider exposes them. Ordinary conversation must never implicitly grant tool permission. Generic terminal fallback is secondary and explicitly distinguished from trusted structured approval.

### Required providers

| Provider | Initial integration hypothesis | Mandatory verification |
|---|---|---|
| OpenCode | Native server API plus the native attached terminal | Same live session, request identity, local/remote decisions, question API, Windows |
| Codex | App Server with native terminal attached where supported | Concurrent-client semantics and Windows feasibility; no history-resume substitute |
| Claude Code | Existing unified-terminal path plus supported hooks/bridge | Local prompt remains answerable; remote message safety; native Windows |
| Custom harness | Capability-declared adapter, optionally ACP | Explicit fallback capabilities; do not promise universal prompt parsing |

These are hypotheses, not instructions to copy obsolete flags from a website. Inspect the forked commit and installed provider versions first. Pin a compatibility matrix. If a required capability is unavailable, record a blocked gate and propose a bounded remedy; do not quietly switch products or operating systems.

## Local architecture and ownership

A local session host owns the native agent runtime and terminal attachment. A separately restartable sync connector exchanges structured events and responses through the existing authenticated/encrypted relay with the Android client. Reuse the existing UI, transport, and adapter owners wherever possible. No new package or process boundary is mandatory until the audit shows where the necessary separation belongs.

The local runtime/native provider is the authority for whether an action is still pending. The relay carries messages and may persist encrypted delivery state; it must not become an independent permission authority. The Android client is a view/controller, not the owner of agent execution.

A connector crash, relay outage, or phone disconnect must leave desktop work usable. A crash of the actual terminal/session host can still affect its child: document this limitation and test recovery honestly. Service installation is optional for explicit attended launches. Do not depend on the previously broken global Happier service to develop this fork.

Configuration identity includes provider executable/version, backend instance, working directory, launch arguments, environment profile, credentials/profile reference, and relevant harness configuration. Do not merge different setups just because they share a desktop or project name.

## Request and response contract

Use a versioned envelope mapped into the existing canonical protocol. Required semantic fields:

- `machineId`, `backendInstanceId`, `sessionId`, and `runId`/incarnation distinguish a restarted process from an older request.
- `requestId` is the provider's request identity or a provably bound adapter identity, never a terminal line number.
- `revision` or equivalent freshness token and `actionDigest` bind the displayed operation/choices to the decision.
- `kind` distinguishes permission, question, plan review, error requiring input, ordinary message, and informational event.
- `allowedResponses` is capability-checked. Default permission scope is one pending action, not a session-wide grant.
- Each client decision has an `operationId`/idempotency key and authenticated device identity. Device identity comes from verified credentials, not a caller-controlled label.

Suggested externally visible lifecycle:

`pending -> resolving -> resolved`

With distinct `cancelled`, `expired`, `superseded`, and `indeterminate` outcomes as applicable. A relay receipt is not successful provider application. Only a provider/native acknowledgement or authoritative state reconciliation resolves a decision. If the provider does not support deduplication and the acknowledgement is lost after applying a response, report indeterminate and reconcile; never blindly replay a dangerous action.

Competing desktop/phone responses must resolve at the authoritative owner. Use native arbitration where available; otherwise prove the session host sees and coordinates both paths. A phone-side lock cannot fence desktop input. A stale request must never degrade to sending Enter, `y`, or another unbound keystroke. Preserve any partially typed desktop draft.

Reconnect should replay or refresh bounded authoritative state, deduplicate delivery, and invalidate obsolete requests. A timed-out/expired remote item must not authorize anything. Keep a local response/cancel path available. Do not queue offline permission decisions for automatic later execution without revalidation.

## Notifications and status

Only declared events are actionable. Quiet output is not a permission request. Distinguish running, waiting-for-input, finished, failed, disconnected, and unknown. Rate-limit bursts and allow per-session notification settings.

Notifications default to generic content plus an opaque identifier. Fetch/decrypt sensitive detail after opening the authenticated app. Do not place commands, source, passwords, repository paths, or tokens on the lock screen by default. Notification delivery is a hint; opening the app reconciles the current inbox. Test permission denial, lock screen, Doze, app restart, and network change on a physical Android device.

## Non-goals for the first pilot

No universal attachment to arbitrary pre-existing terminals; no session migration; no new agent scheduler; no provider/model replacement; no autonomous approval bot; no rewrite of encryption; no public terminal service; no general-purpose mobile IDE. Preserve useful upstream functionality but do not expand scope to the whole orchestration platform.

## Definition of pilot success

All three native providers meet the same desktop/phone interaction contract on declared versions. Native Windows is tested. At least two desktops can run concurrent sessions with correct routing. Stale responses, duplicate deliveries, competing decisions, connector outages, and device revocation fail safely. The physical phone receives and resolves an interruption while the original desktop terminal remains useful. See `ACCEPTANCE.md` for the evidence format.
