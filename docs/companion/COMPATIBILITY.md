# Compatibility evidence

Bootstrap assessment dated **2026-10-16**, Beads **tc-ach.1**. Fork source: `eb943730622b4974eeb78d717290b7b4b914160e`; upstream pin: `cb5f427183391e8f65b8ffa7f1682e10d3a045f7`. See [REPO_AUDIT.md](REPO_AUDIT.md) for ownership, dependencies, commands and findings.

**No provider is certified for the Terminal Companion desktop/Android contract.** Version/help probes and source inspection are observations; none substitutes for same-live-session evidence. Package suites could not run without dependencies/Yarn; the executed dependency-free Windows baseline had two failures. The current Windows service renderer passed its isolated warning/exit-code experiment.

This document follows [templates/COMPATIBILITY.md](templates/COMPATIBILITY.md). It records a development source assessment, not a claim about shipped Happier or a supported provider-version range. Beads remains the live task tracker.

Integration review classified both baseline failures as inherited upstream POSIX-only test expectations, not fork regressions: the tests and compiler owner are unchanged from the pinned source. [Exact test names, assertions and provenance](REPO_AUDIT.md#exact-windows-failure-disposition) remain documented with open follow-up **tc-ach.24**. Audit acceptance does not require falsely certifying these tests or the unrun product gates.

## Provider matrix

| Provider | Native CLI version | Backend/transport observed in source | Host OS/shell/terminal | Fork commit | Native TUI + phone permission | Questions/messages | Desktop-first race | Status/evidence |
|---|---|---|---|---|---|---|---|---|
| Codex | **0.160.0**, `codex.cmd --version` | App Server; shared Unix WebSocket route; separate stdio and daemon-proxy routes | Windows 10.0.26200 / PowerShell 5.1.26100.9711; interactive terminal host unverified | `eb943730622b4974eeb78d717290b7b4b914160e` | Not run; source disables shared control on win32 | Not run; requestUserInput and ordinary input paths exist | Not run; source handles `serverRequest/resolved` with thread/client-generation checks | **BLOCKED for this pin's Windows shared path**. `apps/cli/src/backends/codex/localControl/resolveCodexSharedControlSupport.ts`; `appServer/runtime.ts`; tc-ach.5/.11 |
| Claude Code | **2.1.299**, `claude --version` | Opt-in unified native terminal, permission/question hooks, guarded terminal input; SDK/exclusive paths also exist | Same Windows/PowerShell host; required terminal adapter unverified | Same fork commit | Not run; a waiting hook's concurrent native answer/cancel path unverified | Not run; structured answers and draft guard exist | Not run | **UNVERIFIED**. `apps/cli/src/backends/claude/localPermissions/localPermissionBridge.ts`, `unifiedTerminal/`, `remote/claudeRemoteMetaState.ts`; tc-ach.6/.12 |
| OpenCode | **Unknown**, not found on PATH | Default server backend, attached native TUI; V1/V2 client/CLI dialects; ACP alternative | Native Windows required; executable/terminal unverified | Same fork commit | Not run | Not run; native permission/question/form client operations exist | Not run | **UNVERIFIED**, reference candidate only. `apps/cli/src/backends/opencode/runOpenCode.ts`, `server/client.ts`, `localControl/`; tc-ach.4/.10 |

The Codex source minimum for non-Windows shared control is 0.131.0; this is an implementation gate, **not** a tested support range. Its Windows rejection applies even to the installed 0.160.0. Official App Server documentation and installed help expose other transports, but none was exercised with a native terminal here. Do not call an authenticated handshake alone a compatibility pass.

OpenCode must be pinned independently for server API, attached CLI dialect and permissions/form semantics. V1 documentation is not proof of V2 behavior. Claude SDK package versions are separate from the native Claude executable version. No provider configuration, credential, plugin, process or existing session was inspected or changed beyond version/help commands.

## Component and environment identity

| Component | Observed version or state | Compatibility implication |
|---|---|---|
| CLI / server / UI source manifests | 0.2.16 / 0.2.16 / 0.2.17 | No loaded product build or deployed release established |
| Node / npm / Corepack | 22.14.0 / 10.9.2 / 0.31.0 | Native Windows dependency-free tests ran; Yarn is not cached |
| Yarn / dependencies | Pin 1.22.22; no root node_modules | Package test/typecheck/build evidence unavailable |
| Expo / React Native / notifications | Manifest ranges ^54.0.0 / 0.81.5 / ~0.32.11 | No Android build, SDK or notification delivery tested |
| Android app package/build | None loaded; source defaults remain `dev.happier.app*` and upstream Expo identity | Fork-owned development identity required before install/push QA |
| Android physical device/OS | Not supplied or examined | Doze, lock screen, denial, revocation and background recovery all unverified |
| Development relay | Not provisioned or contacted | No product authentication, encryption or RPC end-to-end test |
| Second desktop | Not supplied or examined | Cross-machine routing unverified |
| Beads / Dolt | Beads 1.3.1; PATH Dolt 1.86.1; actual loopback server 2.2.0 | Development tooling only; tc-ach.25 tracks data location, routing, backups and shared-worktree readiness |

No live acceptance trace exists. Sanitized baseline output is `.companion-local/tc-ach.1/baseline-tests.log`; native wrapper logs are `.companion-local/tc-ach.1/windows-warning-lyqKwi/`. These ignored files are machine-local supporting evidence, not release artifacts. Future live runs must record every runtime/device/relay identity required by [ACCEPTANCE.md](ACCEPTANCE.md).

## Product acceptance disposition

For rows marked BLOCKED, the blocker is missing authorized live fixtures/tooling or the specifically identified implementation gap. It is not evidence that the provider can never support the capability. Existing tests below were inspected, not executed, unless stated otherwise.

| Gate | Evidence available | Disposition and deciding next step |
|---|---|---|
| A01 Native launch and editable TUI | Codex/OpenCode shared controllers and Claude unified launcher exist | **BLOCKED**: tc-ach.4/.5/.6 must attest executable, endpoint/process, terminal, cwd and profile on Windows |
| A02 Phone permission to same request | Request coordinator, session RPC and native replies exist | **BLOCKED**: live provider + physical phone + reviewed contract, tc-ach.2/.16/.17 |
| A03 Question/text response | StructuredQuestionAnswersV1, UI answer renderer and provider adapters exist | **BLOCKED**: live question/text choices without permission-policy changes, tc-ach.4/.5/.6/.14 |
| A04 Local answer before stale phone tap | Codex handles native resolution; coordinator cancellation and coverage tests exist | **BLOCKED**: issue a second prompt and prove old response cannot answer it, tc-ach.8/.18 |
| A05 Concurrent local/remote answer | Local completion-in-progress guard and native request IDs exist | **BLOCKED**: race at the actual provider authority, not only an RPC mock, tc-ach.4/.5/.6/.18 |
| A06 Duplicate/reordered delivery | Cached decisions and waiter coordination exist | **BLOCKED**: versioned operation binding and real duplicate/no-extra-effect evidence, tc-ach.2/.8/.13 |
| A07 Desktop draft preserved | Claude ownComposerDraftGuard/injector tests exist | **BLOCKED**: user types while remote message arrives in each native TUI, tc-ach.4/.5/.6 |
| A08 Connector or relay failure | Offline stub/reconnect and shared terminal owners exist | **BLOCKED**: no connector crash or relay outage run; independent connector lifetime unproven, tc-ach.9 |
| A09 Phone reconnect | UI socket synchronization and pending projection exist | **BLOCKED**: reconcile current pending inventory; never auto-replay offline permission decisions, tc-ach.13/.19 |
| A10 Restart/reused native session ID | Codex has client-generation checks; wire lacks complete SPEC incarnation binding | **BLOCKED**: executing owner rejects earlier run's response, tc-ach.2/.8/.18 |
| A11 Multiple computers/same project names | Authenticated session/machine scope and managed OpenCode affinity exist | **BLOCKED**: two physical desktops with concurrent configurations, tc-ach.17 |
| A12 Deceptive terminal output | Structured hooks/APIs coexist with terminal screen/transcript processing | **BLOCKED**: adversarial provider output cannot manufacture trusted approval, tc-ach.7/.18 |
| A13 Lost native ACK | Store ACK and native reply are separate stages | **BLOCKED**: cut transport after apply; reconcile or display indeterminate without blind retry, tc-ach.2/.8/.13 |
| A14 Lock screen/Doze/restart | Expo channels/registration/routing exist | **SOURCE MISMATCH + LIVE BLOCKED**: previews default on; fork identity/opaque push then physical Android, tc-ach.14/.15/.19 |
| A15 Notification denied/lost | Notification permission and attention projections exist | **BLOCKED**: deny permission and verify authenticated inbox reconciliation, tc-ach.19 |
| A16 Revoked/wrong-account device | Relay account/session authorization and pairing exist | **BLOCKED**: per-device decision identity/revocation not proven, tc-ach.7/.18/.19 |
| A17 Windows stderr warning | Actual current renderer preserved warning + continuation and exits 0/3; strict control exited 1 early | **PASS, bounded renderer experiment only**. Installed-service reproduction and Task Scheduler health remain unverified in tc-ach.3/.21 |
| A18 Cancel/expiry/timeout | Coordinator cancellation and Claude hook expiry paths exist | **BLOCKED**: verify reachable local cancel and native late-response rejection, tc-ach.4/.5/.6/.18 |
| A19 Unsupported capability/version | Codex win32 guard, OpenCode backend/TTY checks, Claude opt-in state exist | **BLOCKED**: fork UI must explicitly report limitations and never silently downgrade to exclusive control, tc-ach.2/.10/.11/.12 |
| A20 Configuration boundaries | Existing invocation, environment, fingerprint and session-control owners exist | **BLOCKED**: verify arguments/plugins/credentials references/cwd/permission policy across concurrent setups; adapters currently compose policy/settings, tc-ach.4/.5/.6/.17 |

No all-provider or pilot gate has passed. Linux/macOS behavior was not exercised; native Windows was not replaced with WSL evidence.

## Wire, persistence and operational compatibility

| Seam | Producer / consumer | Observed or proposed disposition |
|---|---|---|
| Legacy permission RPC | UI `sync/ops/sessions.ts` to CLI `agent/permissions/sessionPermissionRpc.ts` | Current payload supplies request ID, decision, optional policy changes and answers. It lacks full SPEC backend/run/action/device binding. **Proposed:** one versioned shared contract in protocol, receiver validation at executing owner, explicit unsupported result for old receivers; no unsafe downgrade |
| Structured questions | `packages/protocol/src/tools/structuredQuestionAnswersV1.ts`, CLI questions owner, UI answer payload builder | Existing versioned question method and constrained legacy path are reusable. Preserve arrays/multiselect semantics; ordinary answers must not become blanket permission grants |
| Transport ACK / request application | Relay Socket.IO RPC, CLI request store, native provider | Preserve transport results separately from provider application. An agent-state write ACK cannot certify a native action. Design and test ambiguous application recovery before claiming single-use effects across reconnect |
| Agent state / pending projection | CLI AgentStateRequestStore to relay storage to UI pending/attention selectors | Reuse one state projection and its completed-request handling. Preserve opaque response-claim fences; do not mistake them for proof that a new protocol exists |
| Encryption / pairing | CLI/UI key owners, protocol crypto, relay authentication | Legacy/data-key and explicit plaintext modes exist. Keep mode-aware parsing and reviewed encryption. No crypto or persisted format changed in this audit |
| Session/backend identity | Provider native IDs, CLI machine/session metadata, managed backend affinity | Existing identities cover useful pieces; proposed run/backend/action binding must have one local authority and preserve independent profiles. Human review required before new protocol/auth implementation |
| Provider compatibility | Codex App Server; Claude hooks/native host; OpenCode V1/V2 APIs | Pin each actual version/schema and validate success, cancellation, stale response and recovery. A same-thread ID on a new process is insufficient |
| Windows service / installer | Shared cli-common renderer; stack reexport; separate installer capture helper | Current renderer passed bounded native check. Do not rewrite installed services or infer release status. Capture authorized installed-artifact provenance in tc-ach.3 |
| Android application / push | Expo project/app config and notification content to Expo/Android | Upstream identity and detailed notification defaults remain. Isolate fork identity and make content generic before physical-device QA |
| Upgrade / rollback | Future fork UI/CLI/relay and existing installed versions | **Not certified.** No historical artifact/deployment frontier was resolved, no migration proposed or run. Resolve reachable stable/preview directions before implementation changes; see [../compatibility.md](../compatibility.md) |

This audit introduces no persisted shape, wire version, package dependency or migration. The new-contract recommendations are for review in tc-ach.2/.7; they are not an approved amendment authorizing parallel protocol writers.

## Unsupported behavior and user-visible fallback

The fork must describe the current Windows Codex shared route as unavailable until the native spike passes. Claude unified mode and OpenCode attach capability remain unverified for this environment. Keep the locally usable native terminal and display an explicit limited/offline/unsupported companion state. An unverified or expired request must not send keystrokes, switch permission mode, start another executing process or enter a blind retry queue.

Transcript/status visibility can be offered only if independently proven and labeled. It is not a fallback certification for permissions, questions or ordinary remote messages. The same rule applies to custom ACP and terminal-only adapters.

## References and review limits

Primary local evidence is linked through [REPO_AUDIT.md](REPO_AUDIT.md). Current external documentation was consulted on 2026-10-16 only to characterize integration candidates:

- [Codex App Server](https://learn.chatgpt.com/docs/app-server): transports, request/response identities and native resolution events. Actual local help was from 0.160.0; documentation does not certify this fork on Windows.
- [Claude hooks](https://code.claude.com/docs/en/hooks#permissionrequest): hook decisions and native error/cancellation semantics. The concurrent terminal/phone behavior still requires a native run.
- [OpenCode server](https://docs.opencode.ai/docs/server/): client/server topology, authentication and API discovery. Pin installed V1/V2 behavior rather than treating this page as universal compatibility.

Residual risk: provider races, independent connector failure, authenticated device revocation, physical Android delivery/privacy and two-desktop routing remain unmeasured. Review these documents and the two scoped worker assignments before implementation; separate authorization is still required for live credentials/costs, dependency bootstrap where applicable, protected auth/protocol changes, app signing and any publication.
