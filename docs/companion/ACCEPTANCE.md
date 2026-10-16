# Acceptance and verification matrix

The same contract applies to native Claude Code, Codex, and OpenCode. Passing a fake-provider test does not establish real provider compatibility. A provider spike can demonstrate a limitation; the product gate stays blocked until the requirement is met.

## Required cases

| ID | Scenario | Observable result |
|---|---|---|
| A01 | Start through the fork wrapper | Native desktop TUI remains visible and editable; executable/profile/cwd preserved |
| A02 | Native permission request, respond from phone | Exactly the intended pending request resolves; original terminal continues |
| A03 | Native question, respond from phone | Text/choice reaches that question; no permission-policy change |
| A04 | Answer locally before tapping old phone item | Phone returns already resolved/stale; next request unaffected |
| A05 | Phone and terminal answer concurrently | One authoritative outcome; other path observes resolution, no double side effect |
| A06 | Duplicate/reordered response delivery | Idempotent acknowledgement or safe rejection; no extra execution |
| A07 | Desktop has partially typed input | Remote message does not overwrite, submit, or splice into the draft |
| A08 | Sync connector crashes or relay disappears | Local interaction continues; restart reconnects without agent restart |
| A09 | Phone offline, then online | Current inbox reconciles; obsolete approvals are not replayed |
| A10 | Agent restarts/reuses a provider session ID | New run/incarnation rejects responses from the earlier run |
| A11 | Two desktops with multiple same-named projects | Decisions route by authenticated machine/backend/session identity, not labels |
| A12 | Agent emits deceptive terminal text | Output cannot create or authorize a trusted structured action |
| A13 | Lost provider acknowledgement | UI reports unresolved/indeterminate until reconciled; no blind retry |
| A14 | Phone locked/Doze/background/app restart | Actual delivery and recovery recorded on physical Android; no sensitive preview |
| A15 | Notification permission denied or delivery lost | Desktop unaffected; opening app exposes current pending request |
| A16 | Device revoked / invalid signature / wrong account | Remote decisions rejected; unrelated sessions unaffected |
| A17 | Native Windows launcher receives stderr warning | Warning stays diagnostic; healthy process survives; real exit failures still propagate |
| A18 | Local/remote cancel, expiration, provider timeout | No silent allow; local user has a recovery path |
| A19 | Unsupported provider version/capability | Explicit unsupported/limited status; no false shared-control claim |
| A20 | Working directory, arguments, env and credentials differ | Each harness keeps its own configuration boundaries |

## Evidence for every live run

Record fork commit, loaded source/build identity, adapter version, provider CLI/backend version, OS/build, terminal host, shell version, Android app build/package ID, Android OS/device, relay identity, and steps. Record expected/actual outcome and a sanitized event trace showing correlation IDs and native acknowledgement. Redact credentials, source content, device tokens, and sensitive paths. Test from a disposable project, not a production repository.

Unit/contract tests cover real internal state logic with external boundaries controlled. Integration tests cover the actual local process and adapter boundary. Physical-device tests cover Android delivery and interaction. Each missing layer is explicitly `not run`/`blocked`, never implied by another layer's green result.

## Pilot gate

At least two desktops, at least one native Windows machine, all three required providers, and a physical Android phone. Run multiple concurrent sessions and competing/stale-response cases. The coordinator selects and records a bounded reliability/soak recipe and allowed costs; do not invent latency/SLA claims from one run. Pilot approval requires reviewed evidence at the integrated revision and no unresolved unsafe-approval or local-session-loss defects.
