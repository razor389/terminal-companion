# Claude native Windows characterization

Research for **tc-ach.6**, begun 2026-10-17 and updated 2026-10-19. **The native desktop/phone contract remains blocked, not disproved.** The CLI typecheck and four disposable Windows hook-transport checks passed. The coordinator later reran the assigned Vitest slice with scoped permission: **68 tests passed in three files**, closing **tc-ach.27**. The earlier worker attempt failed before collection because esbuild could not read an ancestor directory. The subsequent development correction for **tc-ach.28**, described below, passed three regression cases, 133 adjacent tests and the CLI typecheck. Seven preload/parameter checks, six real-owner composition checks and eleven corrected Windows process-observer checks pass. The preserved observer baseline has **six passes and five failures**, dispositioned below. **Ross deferred credentialed Claude testing on 2026-10-19.** The prepared attended runner remains unrun. No native Claude turn, credentialed session, phone, or development relay was exercised.

This is the canonical Claude-specific research record for the development fork. [SPEC.md](SPEC.md) and [ACCEPTANCE.md](ACCEPTANCE.md) retain the product requirements; [REPO_AUDIT.md](REPO_AUDIT.md) remains the starting architecture audit. Beads owns operational status. These observations do not certify a released Happier version or a Claude support range.

## Evidence basis

| Item | Observation |
|---|---|
| Source | Fork `740cef4994300368a05d19f00919955483b9925f`; application source unchanged from upstream `cb5f427183391e8f65b8ffa7f1682e10d3a045f7`; audit `88a8ddbbb388106a798209a3c3003b074896678c` |
| Preparation source, 2026-10-19 | Reviewed integration `7e2fbf2b2dddf32a7ef8925e69f28aef57de9083`, now on the worker branch; includes `handlePermissionHookWithLifecycle`. Node/HTTP composition and Windows observer checks used disposable owned processes; no provider execution |
| Worker | `agent/claude-spike`, `C:/Users/Raziel/projects/terminal-companion-wt/claude`; actor `raziel-desktop1-codex-tc-ach6` |
| Native executable | `C:/Users/Raziel/.local/bin/claude.exe`; `claude --version` returned `2.1.299 (Claude Code)`; `--help` returned exit 0 |
| Host | Native Windows `10.0.26200.0`, x64, Windows PowerShell `5.1.26100.9711`, Node `v22.14.0`; no WSL |
| Package tooling | Routed Corepack/Yarn `1.22.22`; coordinator-provided dependencies; no install or dependency changes |
| Runtime evidence | Actual CJS forwarder children, real source-owned hook server and Session/permission/lifecycle composition with a relay boundary fixture; no native Claude TUI, Android build, development relay, or second desktop |

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

The cheapest deciding experiment is to hold one real native PermissionRequest hook, attempt local deny/cancel, and observe the hook process/socket and pending item. The first experiment ends after an unsent local draft and local TUI exit; a second identical action requires separate follow-on approval. If native Claude cancels the hook, the existing server-to-bridge cancellation seam needs the shared lifecycle owner's decision. If local interaction is unavailable during the wait, record that exact version/host limitation and stop the provider gate. Do not infer either outcome from the missing live run.

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

The coordinator's 2026-10-17 rerun is recorded in `.companion-local/tc-ach.6/coordinator-focused-tests.log` and the Beads handoff. **tc-ach.27 is closed** on that scoped execution evidence. It does not change worker sandbox policy or cover adjacent suites. The earlier documentation-only reconciliation did not rerun tests or probes; subsequent fixture checks are recorded separately below.

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

## Preparation boundary, 2026-10-19

**Harmless Windows observation checks passed; the native Claude run remains deferred.** The coordinator adjudicated **tc-ach.33**: use a fixture-only Node preload inside the unchanged forwarder and retain verified Windows process handles. This is an approved development observation boundary, not a new production authority. The restored frozen Corepack/cache environment executes the real-owner composition. Windows initially refused the observer before loading it: all execution-policy scopes were Undefined, with an effective Restricted default. After independent review, an explicit process-only `RemoteSigned` grant permitted the exact harmless observer/launcher scripts and owned Node children. No machine/user policy, dependency or product source changed. The initial policy refusal remains recorded and is not behavior RED.

`startHookServer` exposes `onPermissionHook(data)` and returns only `{ port, stop(): void }`; it neither passes the request/socket to that callback nor exposes completion of `server.close()`. The generated Windows command runs the existing `permission_hook_forwarder.cjs` through encoded PowerShell. Neither that forwarder nor the callback reports its owning hook process handle or terminal exit. The PowerShell builder uses no execution-policy bypass.

The lack of a server handle in that API does not require a production change for this fixture. [Node 22.14 diagnostics channels](https://nodejs.org/download/release/v22.14.0/docs/api/diagnostics_channel.html#built-in-channels) supplied the real `startHookServer` server and request objects in the six composed checks. The filtered client subscription correlated the unchanged forwarder's local port with that server's remote port. The fixture awaited actual server/socket closure. Socket closure alone does not prove hook-process exit.

Ignored artifacts under `.companion-local/tc-ach.6/` include `fixture-preload.cjs`, `fixture-admission.cjs`, `fixture-checks.cjs`, `native-parameters.example.json`, and `windows-handles.ps1`. The preload records only a fresh invocation ID, PID/PPID, approved Node/script paths, timestamps, socket ports and JavaScript exit intent. It does not read streams or record payloads, headers, environment dumps or secrets. It creates no timer/socket and installs no signal/exception handler. A JavaScript exit marker is not OS exit evidence: an owned Node child exited abruptly with code 7 and no marker in the check.

The Windows observer requests query/synchronization access, retains handles, checks image/creation bounds and the exact Node-forwarder → PowerShell-launcher → owned-parent association, then waits on those handles. Independent review found that reporting exceptions could skip cleanup and that raw image comparison rejected mixed separators. The corrected script puts waits/disposal in an outer `finally`, contains reporting failures, continues across individual cleanup failures, preserves failing status, and normalizes absolute drive paths for case/separator comparison. The original is preserved as `windows-handles.before-review.ps1`. It does not enumerate processes or request termination rights. Unexpected intermediate launchers fail admission without a parent-chain search. [Windows process timing](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getprocesstimes) and [parent information](https://learn.microsoft.com/en-us/windows/win32/api/winternl/nf-winternl-ntqueryinformationprocess) support these checks. Both scripts loaded and compiled for the harmless Windows tests; **actual Claude hook ancestry remains unverified**. Unknown descendants remain outside their evidence.

A subsequent controller review found that releasing the harmless child immediately after a reporting marker could hide premature observer exit. The corrected ignored controller keeps the child's input open while observing actual closure against the explicit `--observation-ms 1000` window, identical for baseline and corrected runs. It records close ordering and terminal results, checks healthy completion output/channels, and leaves unrelated or unrecognized fault output inconclusive. Six pure JavaScript controller checks pass. The window is only an observation interval, never a process deadline or termination mechanism.

All commands below used the routed prefix above, on native Windows/Node 22.14.0:

| Command after the prefix | Terminal result |
|---|---|
| `node .companion-local/tc-ach.6/fixture-checks.cjs` | **Exit 0, seven passed.** Actual forwarder output/exit preservation; executable/script rejection; recording failure; failure during exit recording; fail-closed parameter shape; abrupt owned-child exit; held-response socket correlation and owned child/socket/server closure |
| `powershell.exe -NoProfile -NonInteractive -File .companion-local/tc-ach.6/windows-handles.ps1` | **Exit 1 before loading:** “running scripts is disabled on this system”, `UnauthorizedAccess`. No execution-policy bypass or alternate packaging was tried |
| `corepack.cmd yarn --cwd apps/cli tsx --version` | **Exit 1:** `EPERM` creating `C:\Users\Raziel\AppData\Local\node\corepack\v1\corepack-23856-6734d06b.e9269`. `COREPACK_HOME` and `YARN_CACHE_FOLDER` were absent in this resumed environment. No install/cache redirection followed |
| Same version command, after restoring the coordinator-provided frozen cache environment | **Exit 0:** Yarn 1.22.22, tsx 4.21.0, Node 22.14.0; no installation/network |
| `corepack.cmd yarn --cwd apps/cli tsx --tsconfig tsconfig.json ../../.companion-local/tc-ach.6/composed-checks.ts` | **RED: three wrong-identity requests reached the real bridge. GREEN: six checks passed, exit 0.** Session/cwd/transcript rejection; real generated-forwarder hold/denial with lifecycle/input blocking; disconnect with missing native ID remains pending until disposal; evidence-write failure remains failure after owned closure |
| `node scripts/workspaces/runTypeScriptCli.mjs --project .companion-local/tc-ach.6/tsconfig.fixture.json --noEmit` | **Exit 0.** Fixture source graph, including the prepared attended runner; an earlier unknown-result typing error was corrected, not counted as behavior RED |
| `node .companion-local/tc-ach.6/windows-controller-pure-checks.cjs` | **Controller RED:** immediate observation and accepted missing completion output. **Final exit 0, six pure checks passed.** In-memory clock/process boundaries only; no PowerShell, child process, listener or provider execution |
| `node .companion-local/tc-ach.6/windows-handle-checks.cjs --no-child` | **Exit 0:** actual PowerShell/C# load and finish |
| `node .companion-local/tc-ach.6/windows-handle-checks.cjs --baseline --observation-ms 1000` | **Exit 1, six passed / five failed.** Original observer; exact failure dispositions below |
| `node .companion-local/tc-ach.6/windows-handle-checks.cjs --observation-ms 1000` | **Exit 0, eleven passed.** Corrected observer; all independently owned harmless processes awaited |

The last three commands inherited the explicitly approved process-only `PSExecutionPolicyPreference=RemoteSigned`; no persistent execution policy changed. Raw evidence: integration `.companion-local/tc-ach.6/windows-handle-execution.json`; worker `windows-check-corrected-1792446762425.json` (no child), `windows-check-baseline-1792446769427.json`, and `windows-check-corrected-1792446779099.json`. The enclosing command exited 0 after the corrected run; that does not erase baseline exit 1.

Baseline failures and dispositions:

- `valid-mixed-path` and `verified root/PowerShell/Node chain and abrupt exit without JS marker`: valid identities were rejected by raw path comparison. Both pass after case/separator normalization.
- `healthy reporter with EOF awaits live admitted child`: the original observer **did wait** but omitted its final completion record. The corrected observer waits and reports failure explicitly. This is not evidence of cleanup abandonment.
- `reporting failure with finish awaits live admitted child` and `reporting failure with EOF awaits live admitted child`: the original observer closed after 85 ms and 177 ms while the independently controlled child was still held. Raw stderr identifies the exact injected `synthetic-console-write-failure`. PowerShell 5 attributed it to the check-host script rather than the observer location expected by the classifier, so the saved automated result remains **inconclusive**. Independent source/raw-evidence review accepted these as **manual RED → GREEN**: both corrected cases remained open through the one-second interval, closed only after child release, and retained observer exit 1 / child exit 0. No additional rerun was used to replace or hide the inconclusive classifier result.

The initial no-op preload produced three meaningful RED assertions; its minimal implementation passed them. Parameter admission then failed before its required checks were implemented. A later filesystem-boundary fault exposed that throwing from the JavaScript exit listener could retain `process.exit(0)`; setting `process.exitCode = 1` before reporting the recording failure produced GREEN. The test fault affects only its disposable child's OS write boundary. Logs are `observer-red.log`, `admission-red.log`, `exit-write-red.log` and `fixture-checks-green.log`; `handles-load.log` records the policy rejection.

The original seven checks use an HTTP boundary fixture and make no bridge claim. The additional `composed-fixture.ts` / `composed-checks.ts` consume the real generator, server, Session, permission bridge/shared coordinator, lifecycle helper and input arbiter. Fresh `HAPPIER_HOME_DIR` precedes source imports. Only relay and terminal OS boundaries are fixtures. The generated forwarder matches its actual source bytes; only the owned PermissionRequest command gains Node `--require fixture-preload.cjs` through the existing PowerShell builder. Other hooks, arguments and timeout remain unchanged. `composed-admission-red.log`, `composed-admission-green.log`, `composed-checks-green.log` and `composed-typecheck.log` preserve the results.

**Observed transport distinction:** after an owned HTTP client disconnected, the real bridge still had one pending request and an unsettled waiter. The fixture captured that state before disposal; disposal then settled it. This does not show what native local cancellation does. Evidence-write failure was exercised at the filesystem boundary while an actual forwarder waited; cleanup still awaited its terminal result and real server closure, and returned failure.

`windows-handle-checks.cjs` exercised load/finish, mixed-path admission and wrong image/time/parent/disappearance, a verified launcher chain with abrupt child exit, wrong-root rejection, and reporting/EOF regressions while harmless children remained alive until their own control channel released them. Its controllers retained their own process handles independently. This validates the bounded observation fixture, not native Claude behavior. `native-runner.ts` is prepared and typechecked, never invoked. It withholds the first expected permission, inherits the native TTY, records pre-disposal pending/file-presence facts, then waits for local exit before cleanup. It cannot establish native UI observations from transport logs. Its concrete profile, actual Claude launcher ancestry, cancellation behavior and closure still need independent review and live evidence.

The parameter example remains deliberately unapproved/incomplete. The pure validator rejects keyless Console auth, missing cap/admission facts, overlapping directories and extra arguments; the prepared runner supports only the separately provisioned Claude-account development profile route, without importing ambient API keys. Supplied attestations still require attended verification on the installed profile. These unrun gates are missing evidence, not negative feasibility.

Preparation requirements established from the existing owners and current primary sources:

- Set `HAPPIER_HOME_DIR` to fresh fixture state **before importing any CLI source**; `generateHookPluginDir` reads the singleton configuration. Use the real generator/server/forwarder and `handlePermissionHookWithLifecycle` with the real Session/bridge/coordinator for pending-state claims. The existing lifecycle regression test is the composition example.
- Set the native child's `CLAUDE_CONFIG_DIR` to the separately provisioned development profile; [resolveClaudeConfigDirOverride.ts](../../apps/cli/src/backends/claude/utils/resolveClaudeConfigDirOverride.ts) consumes that variable. The [official account-isolation documentation](https://code.claude.com/docs/en/authentication#log-in-with-multiple-accounts), checked on 2026-10-19, warns that keyless Console sign-ins are stored outside that directory. Therefore the variable alone is insufficient evidence of credential isolation. The later attended run must establish the approved auth source without reading or logging secrets; stop on an unexpected source. No account or configuration was inspected here.
- For the requested Write action, the [official permission rules](https://code.claude.com/docs/en/permissions#read-and-edit) use an `Edit` path rule; `Write(path)` is accepted but not consulted. The disposable project's `.claude/settings.local.json` should contain only `{"permissions":{"ask":["Edit(/companion-permission-probe.txt)"]}}`. This adds an ask rule, not an allow rule. Verify the resulting native prompt on the installed version; documentation is not that measurement.
- Use a fresh project, session UUID, explicit approved executable, inherited TTY and reviewed child-environment allowlist. Keep the project separate from existing project configuration, preserve managed policy, and reject unexpected auth/configuration instead of suppressing it. Validate hook session, exact cwd and real transcript containment inside the fresh profile before passing input to the bridge, which may read the transcript when a native ID is missing.
- Record native/connection/pending facts **before** fixture disposal. `ClaudeLocalPermissionBridge.dispose()` itself cancels pending requests; `handleSessionHook` reconciles successful PostToolUse only. Cleanup cannot count as native cancellation. After the observations and local TUI exit, settle held waiters, retain owned process/socket handles, await actual closure, and propagate evidence-write failures. `stop()` returning is not closure evidence; the old synthetic probe's watchdog/process kill is not a native cleanup recipe.

## Disposable live recipe for approval

**Not run; credentialed testing deferred by Ross on 2026-10-19.** [SECURITY.md](SECURITY.md) requires a human gate for “provider tests with real credentials/costs.” The recipe is retained for a future explicit resumption, not a current execution request. No credentials should be sent in an approval response.

First approve only the native hook arbitration experiment below, using a dedicated development Claude account with an externally enforced spending limit selected by the human. Approve at most one initial model turn; stop after its first permission observation. Do not approve the full matrix or assume an interactive CLI dollar cap exists.

Prerequisites:

- Reuse the unchanged, independently reviewed **tc-ach.33** harmless Windows boundary checks above. Review the prepared fixture/runner against concrete admission parameters before requesting a native run. Tooling and real-owner composition checks pass; they do not establish native profile isolation or hook behavior.
- A new disposable project and a separately provisioned development Claude configuration/profile, with the isolation checks above. No copied production auth, existing-session attachment, installed service, or global setting changes.
- Native Windows interactive terminal and the exact Claude executable/version above, rechecked before the run. Human workspace/plugin trust approval remains enabled.
- A source fixture using the existing `generateHookPluginDir` and `startHookServer` owners, a fresh secret, an ephemeral loopback port, and an explicitly recorded hook timeout. It must retain the real permission bridge/coordinator for bridge assertions. Preserve each request's callback/socket and log only synthetic correlation IDs and event types. Do not record the secret or raw auth/environment.
- The focused owner-test slice and the subsequent lifecycle regression/adjacent checks passed as recorded above. For a wrapper experiment, use the reviewed lifecycle correction, resolve the A20 launch-policy decision and provide an isolated development Happier account/relay; the existing wrapper must not be paired with production sessions.

The native-only command shape, from the disposable cwd, is:

```powershell
# After the human provisions the isolated development profile and hook fixture:
& $ApprovedClaudeExe --session-id $FreshSessionUuid --plugin-dir $GeneratedFixturePlugin
```

All three values must identify the approved disposable run. The generated plugin comes from the existing owner; do not supply an invented provider flag. This first run isolates native hook semantics and is not an A01 wrapper pass.

Use this exact benign prompt: “Use the Write tool to create companion-permission-probe.txt containing only fixture. Do not use another tool or retry after a denial.” Use the disposable project ask rule above, without adding an allow/bypass rule. Once the first expected hook arrives, withhold its response. The human attempts the displayed local deny or cancel operation. Record whether it was available, the native PID/session, hook process/socket facts and pending-state invalidation, then type only an **unsent** subsequent draft. Capture these facts before local TUI exit and fixture cleanup. Do not approve the file write, send a second turn, run the wrapper/relay/phone, or infer a full-matrix pass. If the expected hook is absent or auth/policy/identity/local control/cost differs from the approval, stop and classify the outcome.

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

The coordinator's scoped Vitest rerun closed **tc-ach.27**. **tc-ach.28** records the lifecycle correction and its remaining verification disposition; that correction is present at the preparation source above. **tc-ach.33** records the adjudicated observation boundary and reviewed harmless Windows evidence. Its bounded preparation outcome does not close **tc-ach.6** or a native acceptance gate. Launch-policy preservation and separate hook cancellation/authentication decisions belong to **tc-ach.7/.12**; the shared request/incarnation contract belongs to **tc-ach.2/.8**. Credentialed testing remains deferred until explicit resumption and a concrete run approval after fixture review. No 0.3 worktree was written; the [fork baseline policy](README.md#baseline-policy) makes that upstream port obligation inapplicable to this correction.

Residual risk: local-first cancellation, transcript ID reuse, false provider-application acknowledgement, capture/write races, actual Windows PTY behavior, unchanged launch policy, physical Android, and two-machine routing all remain unverified. A negative research result cannot pass the Claude product gate.
