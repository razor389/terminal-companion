# Claude native Windows characterization

Research for **tc-ach.6**, 2026-10-17. **The native desktop/phone contract remains blocked, not disproved.** The CLI typecheck and four disposable Windows hook-transport checks passed. The coordinator later reran the assigned Vitest slice with scoped permission: **68 tests passed in three files**, closing **tc-ach.27**. The earlier worker attempt failed before collection because esbuild could not read an ancestor directory. The subsequent development correction for **tc-ach.28**, described below, passed three regression cases, 133 adjacent tests and the CLI typecheck. No native Claude turn, credentialed session, phone, or relay was exercised.

This is the canonical Claude-specific research record for the development fork. [SPEC.md](SPEC.md) and [ACCEPTANCE.md](ACCEPTANCE.md) retain the product requirements; [REPO_AUDIT.md](REPO_AUDIT.md) remains the starting architecture audit. Beads owns operational status. These observations do not certify a released Happier version or a Claude support range.

## Evidence basis

| Item | Observation |
|---|---|
| Source | Fork `740cef4994300368a05d19f00919955483b9925f`; application source unchanged from upstream `cb5f427183391e8f65b8ffa7f1682e10d3a045f7`; audit `88a8ddbbb388106a798209a3c3003b074896678c` |
| Worker | `agent/claude-spike`, `C:/Users/Raziel/projects/terminal-companion-wt/claude`; actor `raziel-desktop1-codex-tc-ach6` |
| Native executable | `C:/Users/Raziel/.local/bin/claude.exe`; `claude --version` returned `2.1.299 (Claude Code)`; `--help` returned exit 0 |
| Host | Native Windows `10.0.26200.0`, x64, Windows PowerShell `5.1.26100.9711`, Node `v22.14.0`; no WSL |
| Package tooling | Routed Corepack/Yarn `1.22.22`; coordinator-provided dependencies; no install or dependency changes |
| Runtime evidence | Actual CJS forwarder children and owned loopback HTTP server only; no loaded Happier runtime, native Claude TUI, Android build, development relay, or second desktop |

The installed help advertises interactive operation by default, session-only `--plugin-dir`, `--settings`, `--setting-sources`, and `--session-id`. Its `--max-budget-usd` is limited to print mode, so it is not a cost control for the required interactive experiment. Help also states that `--allow-dangerously-skip-permissions` makes bypass available without enabling it immediately. None of these help observations establishes native hook concurrency. No installed hook schema was exposed by this help probe; `--json-schema` describes model-output validation, not hook validation.

Current [official hook documentation](https://code.claude.com/docs/en/hooks#permissionrequest), read on 2026-10-17, says PermissionRequest lacks `tool_use_id`; PreToolUse has tool identity. PermissionRequest uses `decision.behavior`; no-decision output leaves native permission handling in charge. The documented first-decision-wins statement covers a permission host/SDK callback, not an attestation of this native TUI. PostToolUse follows successful execution; it is not a manual-denial notification. [Question answers](https://code.claude.com/docs/en/hooks#tools-that-require-user-interaction) use PreToolUse allow plus complete updated input containing questions and answers. These moving vendor docs guide the experiment; they are not version-pinned execution evidence.

## Permission authority and request identity

The consumed path is `runClaude.ts` → generated session plugin → `scripts/permission_hook_forwarder.cjs` → `startHookServer` → `ClaudeLocalPermissionBridge` → shared `PermissionRequestCoordinator` / `AgentStateRequestStore`. The remote permission RPC comes back through the same shared coordinator. Both startup paths in `runClaude.ts` feed permission and session hooks to the bridge.

**Observed in source:**

- [generateHookSettings.ts](../../apps/cli/src/backends/claude/utils/generateHookSettings.ts) registers PermissionRequest for all tools and PreToolUse for AskUserQuestion. It registers PostToolUse, but not PostToolUseFailure. Windows command hooks use the existing encoded PowerShell command builder and the managed JavaScript runtime. The plugin carries a per-session hook secret through a file.
- [startHookServer.ts](../../apps/cli/src/backends/claude/utils/startHookServer.ts) binds `127.0.0.1`, checks the configured secret, then awaits `onPermissionHook(data)`. That callback has no cancellation signal. The permission route does not notify the bridge when the response socket closes or when its HTTP response timer fires.
- [localPermissionBridge.ts](../../apps/cli/src/backends/claude/localPermissions/localPermissionBridge.ts), `handleSessionHook`, only reconciles PostToolUse. It marks a matched pending item approved after success. It does not consume a native local-denial, failed-tool, or local-cancel event. Disposal and its own timeout are different cancellation paths.
- Request identity prefers the supplied tool-use ID; otherwise `resolveRequestIdFromTranscript` scans a bounded transcript tail backwards for matching tool name/input; otherwise it generates `perm_<uuid>`. Transcript matching does not establish that the matching call is still unanswered. Multiple matching calls in one content array are not disambiguated by a hook invocation identity.
- Generated-ID PostToolUse reconciliation accepts a unique pending tool-name/input match, and refuses multiple matches. This method does not compare hook session/incarnation fields. A random adapter ID separates waiters, but alone does not prove that the later native event refers to that waiter.
- The shared [permissionRequestCoordinator.ts](../../apps/cli/src/agent/permissions/permissionRequestCoordinator.ts) joins compatible waiters with the same ID and caches compatible decisions. Consequently, an incorrectly recovered/reused ID can join a new hook to an old decision. This is a **derived risk**, not an observed native replay.
- **Lifecycle defect at the research source above, subsequently corrected in development:** both async `onPermissionHook` callbacks in [runClaude.ts](../../apps/cli/src/backends/claude/runClaude.ts) returned the bridge promise inside `try/finally` without awaiting it. The `finally` published `PermissionRequestCompleted` before a pending hook promise settled. Its consumer, [createClaudeUnifiedHookLifecycleBridge.ts](../../apps/cli/src/backends/claude/unifiedTerminal/createClaudeUnifiedHookLifecycleBridge.ts), removes the matching pending permission or anonymous block and, when no block remains, clears the arbiter's `permissionBlocked` state and calls `drainWhenSafe`. This established premature input eligibility, **not a demonstrated unsafe native write**: other screen/readiness/draft guards remain. Both callbacks now use [handlePermissionHookWithLifecycle.ts](../../apps/cli/src/backends/claude/localPermissions/handlePermissionHookWithLifecycle.ts), which awaits the existing bridge promise before publishing completion. The three real-owner regression cases below reproduce the original bug and pass with the correction. HTTP cancellation is a separate unresolved seam.
- RPC completion awaits the agent-state acknowledgement before releasing the hook waiter. It does not await a Claude acknowledgement of consuming the returned JSON. `approved` in the state store is therefore not proof of provider application.

**Conclusion:** Claude must arbitrate the live native action. The shared coordinator arbitrates the callbacks it actually receives; the bridge currently observes remote responses and a subset of local outcomes. Neither source inspection nor a successful HTTP reply proves that an authority observes *both* local and remote response paths at decision time.

The cheapest deciding experiment is to hold one real native PermissionRequest hook, attempt local deny/cancel, and observe the hook process/socket and pending item before issuing a second identical action. If native Claude cancels the hook, the existing server-to-bridge cancellation seam needs the shared lifecycle owner's decision. If local interaction is unavailable during the wait, record that exact version/host limitation and stop the provider gate. Do not infer either outcome from the missing live run.

## Expiry, questions, and configuration

The [timeout owner](../../apps/cli/src/backends/claude/utils/permissionHookTimeout.ts) sets a seven-day provider ceiling by default, with an environment override. The remote metadata defaults enable the local bridge and wait-indefinitely mode; unified terminal itself defaults off. A finite non-interactive bridge waiter can time out to no-decision output. Interactive questions have no bridge waiter timer, while late RPC responses are checked against the provider ceiling. The expiry comparison is strictly later than the deadline. These are source semantics, not measured native hook lifetime.

The source can accept a permission response from outstanding agent state after the in-memory entry is lost; an existing response-state test explicitly expects its policy side effects. Structured question answers are stricter: they require a locally owned live coordinator waiter and an AskUserQuestion request. No HTTP-disconnect evidence currently invalidates that waiter. Before claiming A04/A10/A13/A18, test these distinctions against actual native cancellation, restart, timeout and lost acknowledgement.

Question replies preserve the questions and add normalized answers. Explicit RPC fields can also request mode/allowlist changes. A question answer or ordinary chat must not accidentally populate those fields. The disposable forwarder test verifies only that transport adds no policy update; native question behavior and the full UI request builder were not exercised.

[buildClaudeUnifiedTerminalSpawn.ts](../../apps/cli/src/backends/claude/unifiedTerminal/buildClaudeUnifiedTerminalSpawn.ts) preserves the requested cwd in the terminal launch spec and appends the hook plugin, but is not transparent argument forwarding:

- It rejects a user-supplied `--settings`, composes its own settings/statusline/MCP/system prompt inputs, and normalizes model/effort/permission arguments.
- It always appends `--allow-dangerously-skip-permissions`. This exposes a bypass option; it does **not** itself enable bypass. That still conflicts with claiming an unchanged permission capability set for a launch that did not request it.
- It disables updates and prompt suggestions in the child environment. [buildClaudeSubprocessEnv.ts](../../apps/cli/src/backends/claude/spawn/buildClaudeSubprocessEnv.ts) filters environment keys and uses existing configuration/auth-isolation owners. An arbitrary profile variable is not automatically preserved.

These are concrete A20 differences for coordinator/security disposition under **tc-ach.12 / tc-ach.7**, not authority for this worker to change permission policy or shared launch ownership. No user credentials, settings, plugins, sessions, or daemons were inspected to compare real profiles.

## Draft-safe input on Windows

[runClaudeUnifiedTerminalSession.ts](../../apps/cli/src/backends/claude/unifiedTerminal/runClaudeUnifiedTerminalSession.ts), `resolveDefaultHostAdapter`, constructs the existing PTY adapter on win32. The shared [resolveTerminalHost.ts](../../apps/cli/src/integrations/terminalHost/resolveTerminalHost.ts) chooses `windows_console` for auto when that adapter exists. Explicit tmux/herdr/zellij selections have separate Windows restrictions. Lack of those executables is not evidence that the automatic Windows route is unsupported.

The consumed input path uses `createClaudeUnifiedInputArbiter`, `createClaudeUnifiedPromptInjector`, and `clearOwnLeftoverComposerDraft`. The Windows [PTY adapter](../../apps/cli/src/integrations/pty/adapter.ts) owns session-scoped writes and screen capture; it is not global keyboard injection.

The [draft guard](../../apps/cli/src/backends/claude/unifiedTerminal/ownComposerDraftGuard.ts) returns `foreign_draft` for a recognized user draft and only clears text classified as its own leftover. The injector defers recognized foreign/ambiguous drafts. Its guard relies on screen parsing and ownership classification; the PTY's stability capture and subsequent write are separate operations. Therefore fixture expectations and source wiring cannot certify a native draft survives concurrent typing. A draft matching earlier injected text, capture failure, slash-command residue, multiline/Unicode input, and typing between capture and write are material neighboring cases.

The later lifecycle correction consolidates the two existing callback wrappers. It adds no draft guard, approval parser, global keys, SDK substitution or second resumed process. Shared terminal, request-coordinator and protocol behavior remains unchanged.

## Checks actually run

The test and static-check commands in this table ran from this worktree root using this prefix. Direct read-only Git inspection is listed separately below.

```powershell
& 'C:/Program Files/Git/bin/bash.exe' ./apps/stack/bin/hstack-exec -- <command>
```

| Command after the prefix | Terminal result |
|---|---|
| `corepack.cmd yarn --cwd apps/cli vitest run --config vitest.config.ts src/backends/claude/localPermissions/localPermissionBridge.responseState.test.ts src/backends/claude/unifiedTerminal/createClaudeUnifiedInputArbiter.test.ts src/backends/claude/unifiedTerminal/ownComposerDraftGuard.test.ts` | **Original worker attempt: exit 1 before collection.** esbuild: `Cannot read directory "../../../../..": Access is denied`; then cannot resolve absolute `apps/cli/vitest.config.ts`. That attempt ran no contract tests; it was not RED evidence |
| `corepack.cmd yarn --cwd apps/cli vitest run --config vitest.config.ts src/backends/claude/localPermissions/localPermissionBridge.responseState.test.ts src/backends/claude/unifiedTerminal/createClaudeUnifiedInputArbiter.test.ts src/backends/claude/unifiedTerminal/ownComposerDraftGuard.test.ts` | **Later coordinator rerun: exit 0, 68 passed in three files.** responseState: 20; inputArbiter: 21; ownComposerDraft: 27. Native Windows, Node 22.14.0, Vitest 3.2.4; Yarn completed in 28.99s |
| `corepack.cmd yarn workspace @happier-dev/cli typecheck` | **Exit 0.** Declaration preparation and repository-owned TypeScript `--noEmit` completed |
| `node .companion-local/tc-ach.6/hook-probe.mjs` | **Exit 0, four transport cases passed** on native Windows/Node 22.14.0 |

The coordinator's 2026-10-17 rerun is recorded in `.companion-local/tc-ach.6/coordinator-focused-tests.log` and the Beads handoff. **tc-ach.27 is closed** on that scoped execution evidence. It does not change worker sandbox policy or cover adjacent suites. This documentation-only reconciliation did not rerun tests or probes.

Direct read-only Git check: `git diff --exit-code -- yarn.lock package.json` returned **exit 0**, with no dependency manifest/lockfile delta.

The disposable probe is ignored machine-local evidence attached to the Beads handoff. It executes the actual `apps/cli/scripts/permission_hook_forwarder.cjs` against its own ephemeral loopback server with a synthetic secret file, minimal child environment, and synthetic payloads. It never starts Claude or loads a product account.

1. Two identical PermissionRequest payloads without native IDs retain separate HTTP response channels. Releasing the second before the first returns each denial to the correct child; a held channel has not emitted a decision.
2. HTTP 403 returns default no-decision output, exit 0, empty stderr.
3. A dropped HTTP connection returns default no-decision output, exit 0, empty stderr.
4. A PreToolUse AskUserQuestion payload and structured answer round-trip unchanged apart from the expected event-name annotation; transport adds no mode/allowlist update.

These checks do not exercise the bridge, native prompt UI, or phone. In particular, two independent transport sockets do not repair transcript-based ID aliasing in the bridge. The observed fallback is silent at the forwarder boundary; how native Claude presents/reconciles it remains unrun. There was no behavior change and no RED/GREEN claim.

### Development lifecycle correction: tc-ach.28

The coordinator applied the correction after integration revision `b5ec854a22418a0526a5e9c930974c7761b54561`. Both normal and local-fast-start callbacks consume the same owner. The regression composes the real Session, permission bridge/coordinator, hook lifecycle, prompt injector and input arbiter; only the relay API, terminal write and clock boundaries are fixtures.

With the original unawaited return, all three cases failed because the arbiter was already unblocked while the request remained published and its promise unsettled. With `return await`, queued input remains blocked until remote denial, bridge disposal or provider timeout, then drains. Disposal and timeout resolve fallback responses; a distinct rejected-promise case is not measured. Rejection cleanup follows the owner's `await`/`finally` semantics, not a separate test result.

Commands below ran through the same routed prefix from the integration checkout on native Windows:

| Command after the prefix | Terminal result |
|---|---|
| `corepack.cmd yarn --cwd apps/cli vitest run --config vitest.config.ts src/backends/claude/localPermissions/handlePermissionHookWithLifecycle.test.ts` | **RED: 3 failed** at the pending-block assertion; **GREEN: 3 passed**, exit 0 |
| `corepack.cmd yarn --cwd apps/cli vitest run --config vitest.config.ts src/backends/claude/localPermissions/localPermissionBridge.test.ts src/backends/claude/localPermissions/localPermissionBridge.responseState.test.ts src/backends/claude/unifiedTerminal/createClaudeUnifiedHookLifecycleBridge.test.ts src/backends/claude/unifiedTerminal/createClaudeUnifiedInputArbiter.test.ts src/backends/claude/runClaude.startupMetadataOrdering.test.ts src/backends/claude/utils/startHookServer.permission.test.ts` | **133 passed in six files**, exit 0 |
| `corepack.cmd yarn workspace @happier-dev/cli typecheck` | **Exit 0**, declaration preparation and repository TypeScript `--noEmit` |

Evidence is in integration `.companion-local/tc-ach.28/{red-prepared,green,adjacent-scoped,typecheck-green}.log` and Beads. Earlier attempts failed before test collection due to sandbox ancestor access and missing workspace declarations; initial typechecking also exposed two fixture typing errors that were corrected. None of those failures is counted as RED. Independent source/test review found no blocking defect. This is a development correction with composed host evidence, **IMPLEMENTED_NOT_VERIFIED** at the native TUI/phone boundary. No native gate is closed by it.

`generateHookSettings.test.ts`, `createClaudeUnifiedPromptInjector.test.ts`, `buildClaudeUnifiedTerminalSpawn.test.ts`, and shared PTY suites remain **unrun** in this characterization; their owners and native gates retain those obligations.

## Disposable live recipe for approval

**Not run.** [SECURITY.md](SECURITY.md) requires a human gate for “provider tests with real credentials/costs.” The worker authorization explicitly excludes that gate. No credentials should be sent in the approval response.

First approve only the native hook arbitration experiment below, using a dedicated development Claude account with an externally enforced spending limit selected by the human. Approve at most one initial model turn; stop after its first permission observation. Do not approve the full matrix or assume an interactive CLI dollar cap exists.

Prerequisites:

- A new disposable project and a separately provisioned development Claude configuration/profile. No copied production auth, existing-session attachment, installed service, or global setting changes.
- Native Windows interactive terminal and the exact Claude executable/version above, rechecked before the run. Human workspace/plugin trust approval remains enabled.
- A source fixture using the existing `generateHookPluginDir` and `startHookServer` owners, a fresh secret, an ephemeral loopback port, and an explicitly recorded hook timeout. It must retain the real permission bridge/coordinator for bridge assertions. Preserve each request's callback/socket and log only synthetic correlation IDs and event types. Do not record the secret or raw auth/environment.
- The focused owner-test slice and the subsequent lifecycle regression/adjacent checks passed as recorded above. For a wrapper experiment, use the reviewed lifecycle correction, resolve the A20 launch-policy decision and provide an isolated development Happier account/relay; the existing wrapper must not be paired with production sessions.

The native-only command shape, from the disposable cwd, is:

```powershell
# After the human provisions the isolated development profile and hook fixture:
& $ApprovedClaudeExe --session-id $FreshSessionUuid --plugin-dir $GeneratedFixturePlugin
```

All three values must identify the approved disposable run. The generated plugin comes from the existing owner; do not supply an invented provider flag. This first run isolates native hook semantics and is not an A01 wrapper pass.

Use this exact benign prompt: “Use the Write tool to create companion-permission-probe.txt containing only fixture. Do not use another tool or retry after a denial.” Configure an explicit ask rule for that fixture action in the disposable profile, without adding any allow/bypass rule. Once the hook arrives, withhold its response. The human attempts the displayed local deny or cancel operation. Record whether it was available, the native PID/session, hook PID/socket termination, pending-state invalidation, and whether the original terminal accepts a subsequent local draft. If a requested Write does not produce the expected hook, stop and classify that outcome; do not manufacture a passing permission request.

Only after reviewing that result, authorize bounded follow-on turns:

| Experiment | Deciding observation |
|---|---|
| Local first, then late remote reply and a second identical action | Old item is rejected/stale; second action remains pending; evidence identifies both native hook invocations |
| Remote first and concurrent local/remote decisions | Exactly one native outcome; record native execution/cancel evidence separately from store/HTTP ACK |
| Hook disconnect/timeout, dropped reply after decision, process restart with reused session ID | No late approval reaches a new request; uncertainty stays explicit; local recovery remains available |
| AskUserQuestion through PreToolUse | Answer reaches that question; compare permission mode/rules before and after using only the disposable configuration |
| Actual wrapper, `--happy-starting-mode unified`, auto Windows host | The loaded source uses the same native PID/session and the existing PTY path; do not silently select local/SDK exclusive mode |
| Type `desktop-draft-α\nsecond-line` without submitting, then send `remote-fixture-message` | Desktop draft remains byte-for-byte intact and unsubmitted; remote input stays pending until safe; repeat with typing during delivery and owned-leftover text |
| Disconnect only the disposable relay/connector | Original terminal remains usable and reconnect does not restart Claude; terminal-host crash is a separate limitation |
| Two disposable configurations with distinct cwd, benign plugin, arguments and sentinel environment key | Each keeps its intended configuration; inspect references/allowlisted sentinels, never credential values |

Stop on any unexpected auth source, permission broadening, lost local control, stale application, draft mutation, or spending boundary. Preserve the owned process for human inspection; never kill unrelated sessions. Native denial/cancellation that succeeds while the hook is held would falsify the hypothesis that hooks necessarily force exclusive control. A failure on this version does not prove impossibility for every native interface.

For each authorized run, record the source revision, loaded entry point, adapter version, Claude version, OS/terminal/shell, native PID/session/incarnation, hook event/request IDs, pre/post action facts and native ACK or uncertainty. Android and two-machine identity fields remain explicitly absent until their later gates run.

## Acceptance disposition and next owners

| Gate | Disposition |
|---|---|
| A01–A07 | **BLOCKED:** no native TUI/phone run, no native question/pending invalidation/race/draft evidence |
| A08 | **BLOCKED:** no actual connector/relay outage; forwarder disconnect is a narrower check |
| A10 | **BLOCKED:** no native restart/incarnation experiment; shared binding belongs to tc-ach.2/.8 |
| A12 | **BLOCKED:** no composed deceptive-output test; screen parsing is used for draft/readiness, not proof of trusted approval |
| A13 | **BLOCKED:** no native apply/ACK-loss experiment; store ACK is insufficient |
| A18 | **BLOCKED:** transport fallback measured; native local cancel, timeout recovery and stale reply rejection unrun |
| A19 | **BLOCKED:** Windows host route found in source, but no verified native capability/unsupported UX |
| A20 | **SOURCE DIFFERENCES + LIVE BLOCKED:** settings, arguments, bypass availability and environment need disposition and measurement |
| A09/A11/A14–A17 | **UNVERIFIED:** outside this provider spike's executed evidence; remain later shared, two-machine, Android/security and launcher gates |

The coordinator's scoped Vitest rerun closed **tc-ach.27**. **tc-ach.28** records the lifecycle correction and its remaining integration/verification disposition. Launch-policy preservation and separate hook cancellation/authentication decisions belong to **tc-ach.7/.12**; the shared request/incarnation contract belongs to **tc-ach.2/.8**. The disposable credentialed experiment still requires human approval. No 0.3 worktree was written; the [fork baseline policy](README.md#baseline-policy) makes that upstream port obligation inapplicable to this correction.

Residual risk: local-first cancellation, transcript ID reuse, false provider-application acknowledgement, capture/write races, actual Windows PTY behavior, unchanged launch policy, physical Android, and two-machine routing all remain unverified. A negative research result cannot pass the Claude product gate.
