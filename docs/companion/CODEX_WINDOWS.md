# Codex shared control on native Windows

Research basis: **2026-10-17**, **tc-ach.5**, native **codex-cli 0.160.0**.
**Native two-client transport passed; same-TUI shared live control remains
BLOCKED / UNVERIFIED.** Two WebSocket clients used native proxy pipes to reach
one disposable backend; the second remained usable after the first proxy was
terminated. That transport probe exercised no native TUI, thread creation, model
turn, permission race, phone, draft, or incarnation behavior. The coordinator's
focused test
rerun exited 1: **9 passed, 1 failed, 4 Windows skips**. The failure is a
pre-existing POSIX fixture assumption. CLI typecheck passed. Node socket `stat`
still returned `EACCES` outside the worker sandbox; native proxy access succeeded.

A later account-free native permission experiment on **2026-10-19** reached the
original TUI/thread, then failed at the synthetic model boundary: the first
request did not advertise the exact custom `apply_patch` shape required by the
fixture. All HTTP attempts were rejected; no patch response or permission
decision was sent. The marker stayed absent and all retained direct children
closed. This is a fixture compatibility finding, not negative permission
feasibility or a passing response gate.

The subsequent no-credential TUI-fixture attempt stopped at **PTY lifecycle
admission**: native `--version` printed through ConPTY, but the repository relay
did not close, including after stdin EOF. A later direct-backend diagnostic
observed native exit **0** and the PTY exit event, with the ConPTY output worker
still alive after supported cleanup. A harmless Node child reproduced that
retained-worker behavior. This isolates a backend resource-lifetime problem.
The corrected production relay subsequently completed native exit-7 and Codex
`--version` fixtures with exact final bytes and matching native/PTY/relay status.
Those relay fixtures ran no model or TUI session, and historical descendant
cleanup is not certified.

The **tc-ach.5.2** disposable-relay mitigation is **verified for the four bounded
native Windows fixtures below**, independently reviewed and integrated in
`dd5881d3a24a9910c818e4157dad3fbfdf283c10`. The coordinator captured meaningful RED
(**6 failed, 13 passed**) and then GREEN
(**19 passed**). Review exposed a Windows signal-cleanup regression missed by
that suite. Its separate asserting boundary fixture and the expanded **21-test**
canonical slice now pass; CLI typecheck passed. Adjacent tests exited 1 with
**46 passed, 3 pre-existing packaged-path fixture failures, 2 skipped**.
Native exit-7, Codex version, drainage after a finite reader pause, and active-child
EOF all passed. The original slow-reader experiment failed while requiring
native exit before releasing its paused reader; that failed run and its historical
cleanup uncertainty remain explicit. This verifies a disposable-relay mitigation,
not dependency repair or native TUI shared control. **tc-ach.5.2.1** remains open.

On **2026-10-19**, the second and third no-prompt runs displayed the original
native TUI on the owned backend/socket and observed a new thread. The second
rejected a turn-list read with **-32600**; the third passed metadata identity
checks, then rejected hydration with **-32601**. Both stopped with **0 validated
samples, 0 model requests and no draft input**, then recorded local TUI exit and
all retained sidecar closes. The -32601 remains unexplained. The coordinator
removed complete-history enumeration from the bounded metadata/draft experiment.
The fourth run then passed successful metadata observation while the coordinator
typed, edited and cleared an unsent draft in the original TUI. The TUI exited 0
and all retained children closed. Complete history and all shared-response gates
remain unverified; this is not product acceptance.

This is a development feasibility record, not a supported-version announcement
or a negative proof about Codex. [SPEC.md](SPEC.md), [SECURITY.md](SECURITY.md), and
[ACCEPTANCE.md](ACCEPTANCE.md) remain authoritative. Beads owns operational status
and the handoff. **tc-ach.26** holds the coordinator's transport evidence.

## Exact basis and scope

| Evidence | Observed value |
|---|---|
| Worker source | Initial research `740cef4994300368a05d19f00919955483b9925f`; resumed at research-doc commit `e6eeaa4191d43be7dcc8849f01cf3f6a1839e1b9`, branch `agent/codex-spike` |
| Worktree | `C:/Users/Raziel/projects/terminal-companion-wt/codex`; clean before research |
| Upstream / audited source | `cb5f427183391e8f65b8ffa7f1682e10d3a045f7`; audit commit `88a8ddbbb388106a798209a3c3003b074896678c` |
| Windows / shell | Windows `10.0.26200.0`, PowerShell `5.1.26100.9711`; native Windows, not WSL |
| Installed CLI | npm `@openai/codex` **0.160.0**, Windows x64 native executable under its `@openai/codex-win32-x64` dependency |
| PTY diagnostic | Installed `node-pty` **1.1.0**, Node **22.14.0**, `useConpty: true`, `useConptyDll: true` as in the repository relay |
| Native contract | Local version/help, `app-server generate-json-schema --experimental`, and the `rust-v0.160.0` proxy source; schemas do not establish arbitration |
| Product runtime | Actual production PTY relay in disposable fixtures below; no launched Companion app/daemon, Android build, or second desktop |

The initial research changed only this document. The later, explicitly granted
relay correction changes the relay script/provider and their existing tests;
its expanded 21-test slice and all four bounded native relay fixtures passed.
The later evidence reconciliation changes only documentation. No permission, authentication,
dependency, shared protocol, or configuration was changed. The Windows support
guard remains intact. Disposable probe code, generated schemas,
and logs live under ignored evidence directories; they are not shipped fixtures.
Evidence paths below use **worker** for this worktree and **coordinator** for
`C:/Users/Raziel/projects/terminal-companion`. Worker evidence is under
`.companion-local/tc-ach.5/`; coordinator evidence is under
`.companion-local/tc-ach.26/` for transport, or `.companion-local/tc-ach.5/` where
named for relay review/baseline logs. No provider credentials were read or copied, and no
existing daemon or session was contacted. The earlier doc reconciliation read
saved evidence only. The later PTY admission and lifecycle diagnosis below ran
native `--version` and a harmless owned child in fresh terminal fixtures; they
reran no package tests or transport probe.

## Existing owners and the two candidates

The audit's paths were rechecked against current source:

- [resolveCodexSharedControlSupport.ts](../../apps/cli/src/backends/codex/localControl/resolveCodexSharedControlSupport.ts)
  rejects `win32` for every version. The result is called `unsupported-version`,
  but this branch is a platform restriction, not an observed 0.160.0 failure.
- [createCodexSharedAppServer.ts](../../apps/cli/src/backends/codex/appServer/createCodexSharedAppServer.ts)
  owns one native process and a private socket, waits using Node `stat`, and
  initializes the response client before returning it.
- [createCodexAppServerClient.ts](../../apps/cli/src/backends/codex/appServer/client/createCodexAppServerClient.ts)
  owns JSON-RPC over stdio, the default daemon proxy, or Unix WebSocket. The
  stdio/default-proxy path uses JSONL, and its proxy invocation has no explicit
  socket argument. Its Unix transport delegates to
  [createCodexUnixWebSocket.ts](../../apps/cli/src/backends/codex/appServer/client/createCodexUnixWebSocket.ts),
  which uses Node `net.createConnection(socketPath)`.
- [createCodexSharedAttachArgs.ts](../../apps/cli/src/backends/codex/localControl/createCodexSharedAttachArgs.ts)
  gives the native TUI `--remote ENDPOINT --cd DIRECTORY resume THREAD_ID`.
  This is intended to attach to a thread on the same backend. Actual process,
  endpoint, thread, and terminal continuity still require live proof.
- [runCodex.ts](../../apps/cli/src/backends/codex/runCodex.ts) selects shared control
  only when App Server is selected and the daemon-proxy mode is not selected.
  The existing ambient daemon route is therefore not a shared-control substitute.
- [runtime.ts](../../apps/cli/src/backends/codex/appServer/runtime.ts) handles
  `serverRequest/resolved` using thread and client-generation checks, then cancels
  the matching local pending permission. This useful path does not establish the
  complete machine/backend/incarnation/action/device contract from SPEC.

| Candidate | Observed native interface | Companion gap / deciding gate |
|---|---|---|
| Private native socket plus WebSocket over native proxy pipes | `codex app-server --listen unix://PATH`; `codex app-server proxy --sock PATH`; TUI `--remote unix://PATH` | **Transport-only pass** with existing `ws-node` over both proxy pipes. Proxy forwards raw bytes; the Unix listener requires a WebSocket upgrade. Production client framing, explicit socket ownership, readiness and lifecycle integration remain absent. Adding `--sock` to the JSONL path is insufficient. |
| Authenticated loopback WebSocket | `--listen ws://IP:PORT`, `--ws-auth capability-token`, `--ws-token-file PATH` or `--ws-token-sha256 HEX`; TUI `--remote-auth-token-env NAME` | Current shared client/launcher has no TCP/auth transport. Token lifecycle and the security boundary require coordinator/human review before implementation. Not launched in this spike. |

The version-pinned [native proxy source](https://raw.githubusercontent.com/openai/codex/rust-v0.160.0/codex-rs/stdio-to-uds/src/lib.rs)
connects with `codex_uds::UnixStream` and uses `tokio::io::copy` in both directions.
It does not translate WebSocket frames into JSONL. The successful trace records
the HTTP WebSocket upgrade and JSON-RPC replies through that byte relay.

**Derived recommendation:** retain the private native proxy candidate and reuse
the existing `ws-node` library over its pipes in the existing client/server
owners. This transport has been demonstrated without a new dependency or TCP
credential boundary. Product readiness, proxy EOF/error/shutdown behavior, and
same-TUI control still need implementation and evidence. Directory enumeration
in the disposable probe is not a certified replacement for production readiness.
The existing JSONL route cannot be certified merely by adding `--sock`. No
Windows guard removal or `runCodex.ts` hunk is justified by this result.

Current [official App Server documentation](https://learn.chatgpt.com/docs/app-server)
documents remote TUI attachment and the two transports, but labels WebSocket
transport experimental and unsupported for production. The
[CLI reference](https://learn.chatgpt.com/docs/cli/reference) describes passing the
bearer token by environment-variable name. Installed help corroborates those
flags. These pages do not pin native multi-client arbitration for 0.160.0.
The earlier source-directory retrieval missed the cache; the exact pinned proxy
file above was subsequently retrieved and read. Its byte-copy contract does not
establish multi-client approval arbitration.

## Request identity and acknowledgement

Observed in schemas generated by the installed binary, rather than inferred
from a current documentation example:

| Native shape | Relevant contract |
|---|---|
| JSON-RPC request | Response echoes the native envelope `id`; do not substitute `itemId`, a terminal line, or a displayed label. |
| `CommandExecutionRequestApprovalParams` | Requires `threadId`, `turnId`, `itemId`, `startedAtMs`; may carry `approvalId`, `kind`, `availableDecisions`, command/cwd, and additional permissions. A callback-specific `approvalId` can distinguish requests sharing an item. |
| `CommandExecutionRequestApprovalResponse` | Requires `decision`. Single-action acceptance is distinct from session acceptance or a policy amendment. |
| `ToolRequestUserInputParams` | Requires `threadId`, `turnId`, `itemId`, `questions`, **`isBlocking`**. `autoResolutionMs` is deprecated in this version; do not invent expiry from it. |
| `ToolRequestUserInputResponse` | Requires `answers`, keyed by question ID. This is a question response, not a tool permission. |
| `ServerRequestResolvedNotification` | Requires `threadId` and `requestId` (string or integer); it does not carry the complete Companion incarnation/action/device binding. |

The official documentation describes `serverRequest/resolved` for both an answer
and a cleared request, including question cleanup on turn interruption. Therefore
**derived:** that notification alone cannot prove that an approval was accepted
or a command ran. Require the correlated final item status and the disposable
side effect for application evidence. A transport write callback or agent-state
acknowledgement is weaker still. Lost application evidence remains indeterminate;
do not blindly replay an approval.

The schemas do not decide first-writer behavior, duplicate-response errors,
request-ID reuse after restart, or draft preservation. These remain native live
questions and Companion integration obligations, not schema guarantees.

## Checks actually run

The routed checks below use this prefix from the named checkout root:

```powershell
& 'C:/Program Files/Git/bin/bash.exe' ./apps/stack/bin/hstack-exec -- <command>
```

| Command after that prefix | Terminal result |
|---|---|
| `codex.cmd --version`; `codex.cmd --help`; `codex.cmd app-server --help`; `codex.cmd app-server proxy --help`; `codex.cmd app-server daemon --help`; `codex.cmd app-server generate-json-schema --help` | Exit 0; advertised interfaces only. No daemon-management action was invoked. |
| `corepack.cmd yarn --cwd apps/cli vitest run --config vitest.config.ts src/backends/codex/localControl/resolveCodexSharedControlSupport.test.ts src/backends/codex/localControl/createCodexSharedLocalControl.test.ts src/backends/codex/appServer/createCodexSharedAppServer.test.ts` | **Exit 1 before collection.** esbuild: cannot read `../../../../..` (`Access is denied`) and cannot resolve the config. No passing/skipped test counts were produced. Raw output: `.companion-local/tc-ach.5/focused-tests.log`. |
| Same focused Vitest command, coordinator rerun from worker root with scoped filesystem permission | **Exit 1: 9 passed, 1 failed, 4 skipped.** `createCodexSharedAppServer.test.ts:174` expects a POSIX endpoint from a Windows path fixture. Worker `coordinator-focused-tests.log`; details below. |
| `corepack.cmd yarn workspace @happier-dev/cli typecheck` | **Exit 0** initially, for the prepared regressions, against the implementation, and after the signal correction/new tests on 2026-10-18. Current log: worker `relay-typecheck-review-fix.log`; this does not establish runtime completion. Earlier implementation/prepared-test logs remain retained. |
| `corepack.cmd yarn --cwd apps/cli vitest run --config vitest.config.ts src/integrations/pty/nodePtyRelayScript.test.ts src/integrations/pty/nodePtyRelayProvider.test.ts` | **Exit 1 before collection** on 2026-10-18: with the documented project caches, esbuild could not read an ancestor directory or load the config. Worker `relay-red-configured.log`; no meaningful RED or passing test counts. The preceding invocation lacked the cache environment and failed with Corepack `EPERM` (`relay-red.log`). |
| Same relay regression command, coordinator execution of `run-relay-red.ps1` with scoped filesystem permission | **Exit 1: 6 failed, 13 passed, no skips.** Both suites collected against unchanged production files. Five relay failures cover missing completion, cleanup ordering, and cleanup diagnostics; the provider failure records both a plain kill and `SIGKILL` during repeated cancellation/slow drainage. Worker `relay-red-coordinator.log`. This is meaningful RED. |
| Same relay regression command, worker GREEN attempt after implementation | **Exit 1 before collection:** the same esbuild ancestor-read/config denial. Worker `relay-green-worker.log`. No GREEN result, new runtime test count, or equivalent retry. Running the prepared PowerShell file also encountered the worker's script-execution policy; the direct canonical command above used the normal tool shell without changing that policy. |
| Same relay regression command, coordinator execution of `run-relay-green.ps1` | **Exit 0: 19 passed, no skips.** Worker `relay-green-coordinator.log`, before the review corrections below. The raw file retains its mixed UTF-8 header/UTF-16 body; it was decoded for reading, not rewritten. This does not cover the two subsequently added signal tests. |
| `node .companion-local/tc-ach.5/relay-signal-regression.cjs`, coordinator root | **Exit 1, meaningful review RED:** actual worker relay with a Windows-accurate external PTY boundary leaves `nativeAlive=true`, calls only `SIGINT`, destroys input, and never exits. Coordinator `relay-signal-red.log`. Earlier `relay-signal-path-error.log` is an ENOENT fixture-path failure, not RED; the reviewer's original observation-only exit 0 was not an assertion pass. |
| `node C:/Users/Raziel/projects/terminal-companion/.companion-local/tc-ach.5/relay-signal-regression.cjs`, worker root | **Exit 0 after correction:** the same asserted fixture reports signal-less cleanup, `nativeAlive=false`, one exit 1, and no diagnostics. Worker `relay-signal-green-worker.log`. No real native provider is launched by this fixture. |
| `node .companion-local/tc-ach.5/check-relay-process-admission.cjs` | **Exit 0:** 13 fabricated metadata cases exercise the actual PowerShell admission predicate. Executable/name/PID mismatch, out-of-window creation, absent metadata, and invalid windows reject; valid Windows paths and boundary timestamps accept. Worker `relay-process-admission-check.log`. No process lookup, kill, PTY or provider invocation. |
| Same relay regression command, coordinator execution of `run-relay-review-green.ps1` | **Exit 0: 21 passed, no skips.** Worker `relay-review-green-coordinator.log`; includes the two signal tests. Independent review accepted the signal and fixture process-authority corrections. Runtime/tests are unchanged through the later fixture and documentation work, so this result and CLI typecheck remain applicable. |
| `corepack.cmd yarn --cwd apps/cli vitest run --config vitest.config.ts src/integrations/pty/ptyProvider.test.ts src/integrations/pty/adapter.test.ts src/integrations/pty/terminalLaunchSpecRunner.test.ts src/integrations/pty/pythonPtyRelayProvider.test.ts` | **Exit 1: 46 passed, 3 failed, 2 skipped.** Worker `relay-adjacent-coordinator.log`. The three packaged-path failures are described below; the two Python-relay Windows skips are not passes. |
| `corepack.cmd yarn --cwd apps/cli vitest run --config vitest.config.ts src/integrations/pty/ptyProvider.test.ts -t tries.packaged`, coordinator clean integration `abc4506f8e` | **Exit 1: the same 3 failures, 14 filter-skips.** Coordinator `tc-ach.5/packaged-baseline-focused.log`; source/tests unchanged from pinned upstream. The earlier spaced-filter command failed before collection (`packaged-baseline.log`), not test evidence. Follow-up **tc-ach.30** owns these fixtures. |
| `node .companion-local/tc-ach.5/relay-native-validation.cjs exit7` | **Exit 0:** actual relay/native status 7, 86 exact PTY/relay bytes, final marker, observer/runner exit 0. Worker `relay-native-exit7-coordinator.log`, `relay-exit7-lmgag8/trace.json`. |
| Same native command with `codex-version` | **Exit 0:** native Codex **0.160.0**, native/PTY/relay status 0, 436 exact bytes, observer/runner exit 0. Worker `relay-native-codex-version-coordinator.log`, `relay-codex-version-JYkpSq/trace.json`. |
| Same native command with `slow-reader`, original ordering | **Exit 1:** invalid native-exit-before-reader-resume expectation hit the observation bound. Worker `relay-native-slow-reader-coordinator.log`, `relay-slow-reader-oi6LWv/trace.json`. Public PTY/relay exit 1 after EOF cleanup; later native OS exit is uncertified. This remains a failed experiment, not a product regression or a passing run. |
| Same native command with `slow-reader`, corrected finite pause | **Exit 0:** native/PTY/relay status 7, **1,808,077 exact bytes**, final marker and `output-produced` asserted, observer/runner 0. Worker `relay-native-slow-reader-replay-coordinator.log`, `relay-slow-reader-y9AtsB/trace.json`. Direct-relay drainage after reader resume; no provider-cancellation claim. |
| Same native command with `active-eof` | **Exit 0:** EOF to the owned relay while its child was active; native/PTY/relay status 1, **33 exact bytes**, observer/runner 0. Worker `relay-native-active-eof-replay-coordinator.log`, `relay-active-eof-8wPCWp/trace.json`. No forced observer/parent kill. |
| `node .companion-local/tc-ach.5/native-probe.cjs` | **Exit 1** at the experiment's 20-second watchdog. Schema generation exit 0; socket inspection did not become successful; owned server was terminated, with its exit recorded. No proxy client was launched. |
| Same worker probe, coordinator rerun outside the worker sandbox with scoped permission | **Exit 1:** explicit socket `stat` returned **EACCES**. Worker `coordinator-native-probe.log` and `native-probe-tc-ach5-native-9E6Gwc.json`. No ACL change. |
| `node .companion-local/tc-ach.26/native-proxy-probe.cjs`, coordinator root | **Exit 0, transport-only pass.** Both WebSocket clients initialized and asserted empty loaded-thread lists; proxy B queried again after owned proxy A was killed. Backend stayed alive; cleanup recorded all owned children exiting. Coordinator `native-proxy-drop.log` and `native-probe-tc-ach5-native-gPyQ9G.json`. |
| Focused `node -` inspection of the original probe's socket | `statSync` and `lstatSync` both returned **EACCES**; parent-directory enumeration saw `app-server.sock`. |
| `git diff --exit-code -- yarn.lock package.json` | Exit 0; no manifest/lockfile changes. |

Earlier direct PowerShell diagnostics included environment/setup inspection and
`Get-Item` (which identified the socket as `Archive, ReparsePoint`); some Git
inspection and the denied staging attempt were also direct. Those are not
claimed as routed checks.

The later failure is in `owns one socket app-server and gives Happier clients
WebSocket transports to that server`: expected
`unix:///tmp/happier-codex-private/private/app-server.sock`, received
`unix://\tmp\happier-codex-private\private\app-server.sock`.
`git diff --exit-code cb5f427183391e8f65b8ffa7f1682e10d3a045f7 --` over the
three test files and their production owners exited 0 during reconciliation.
Thus this fixture assumption predates the fork; neither the failure nor the
passing mocked cases proves production transport behavior. The bounded fixture
follow-up is **tc-ach.29**. All four Windows startup skips remain
unexecuted coverage.

The native probes create an empty disposable home/project, construct an OS-only
environment allowlist, use file-based credential stores, and send no
`thread/start` or `turn/start`. They use the installed npm package's native
executable. The original worker trace is `native-probe.json`; exact schemas are
in `schema-0.160.0-sanitized/` alongside it. Native startup warned that it refused to
create helper aliases under the temporary home. That diagnostic was retained;
no security control was disabled. An earlier PowerShell schema invocation emitted
an environment-clearing error, so the Node allowlist invocation supplies the
isolation evidence used here.

**Observed limitation:** `existsSync` hid the socket access error as `false`.
Directory enumeration falsified the initial suspicion that no socket existed;
explicit `stat` exposed the error. The watchdog result is not a native startup
deadline or proof of an unsupported transport. The source's Windows Node socket
wait needs scrutiny before enabling it. The scoped outside-sandbox rerun and
the successful transport probe both still recorded `EACCES`. The cause remains
unresolved, but it is not solely a worker-sandbox blocker. No socket ACL was
changed to obtain the native-proxy result.

The coordinator's corrected fixture wraps each native proxy's stdout/stdin with
`Duplex.from({ readable: child.stdout, writable: child.stdin })`, supplies that
stream to existing `ws-node` through `createConnection`, and disables compression
with `perMessageDeflate: false`. Its `ws://localhost/` URL supplies the handshake
authority; the connection uses the owned proxy pipes, not a TCP listener. Both
clients initialize, then the fixture asserts `result.data` is `[]` and there is
no next page. It kills only proxy A, asserts the same empty result from proxy B,
checks the backend is alive, and records cleanup exits. The reviewed initial
probe did not strictly assert emptiness; this corrected fixture does.

Earlier coordinator traces remain useful fixture history:
`native-probe-tc-ach5-native-25IMpJ.json` timed out while attempting JSONL over a
raw-byte proxy; `native-probe-tc-ach5-native-Qs0UCl.json` initialized both
WebSockets but timed out waiting for graceful proxy process exit. The corrected
fixture uses an explicit owned-process stop for the disconnect check. These
were framing/lifecycle fixture assumptions, not native transport-negative
findings. Graceful shutdown still needs production lifecycle treatment.

Existing coverage has limits: shared-server startup has four
`skipIf(win32)` cases; the client WebSocket test uses a **Windows named pipe** on
Windows; the proxy test uses a fake provider; local-control coverage substitutes
the terminal supervisor. The external-resolution runtime test substitutes the
permission handler. None proves a native Windows two-client approval race.
During the original App Server transport research, adjacent tests were not
attempted after the config-loading failure or rerun for its doc-only
reconciliation. That research made no runtime behavior change and has no
RED/GREEN claim. The later relay behavior change, regression tests and adjacent
PTY run are reported separately below.

## Loopback-model fixture admission

The proposed follow-on experiment replaces only the external model HTTP/SSE API
with a deterministic loopback fixture. Installed native Codex must still own the
TUI, thread, tools, permission engine, and arbitration. This is separate from
real-account, physical-phone, and product conformance evidence.

The repository inventory covered model-provider/Responses/SSE and PTY terms in
`apps`, `packages`, and `scripts`, then the CLI/testkit corridors. Relevant owners:

| Existing fixture or owner | Reuse / limit |
|---|---|
| `apps/cli/src/backends/claude/sdk/anthropicSseBoundary.testkit.ts` | Genuine loopback model boundary, but Anthropic Messages events; no Responses API fixture was found in the searched sources. |
| `packages/tests/src/testkit/codexAppServerRemoteHarness.ts` | Replaces the Codex App Server itself; unsuitable for proving native authority. |
| `apps/cli/src/backends/codex/localControl/createCodexSharedTuiSupervisor.ts` and `apps/cli/src/agent/localControl/createAttachedTerminalSupervisor.ts` | Existing native attachment/supervision owners; remain read-only. |
| `apps/cli/src/integrations/pty/ptyProvider.ts` and `apps/cli/scripts/node_pty_relay.cjs` | Existing Windows PTY backends and relay. Admission reused the relay with its `useConpty` / `useConptyDll` settings. |

Exact-version [model-provider source](https://raw.githubusercontent.com/openai/codex/rust-v0.160.0/codex-rs/model-provider-info/src/lib.rs)
defines `wire_api = "responses"` (not the removed `chat` variant), an explicit
`base_url`, and `requires_openai_auth` / `supports_websockets` defaulting to false.
Its documented no-auth path skips login; [official authentication guidance](https://learn.chatgpt.com/docs/auth)
also requires omitting `env_key` for a provider that needs no authentication.
No bearer token, auth command, gateway OAuth, AWS config, or credential-bearing
header belongs in this fixture. The candidate definition in the fresh fixture
home, **not yet exercised**, is:

```toml
model_provider = "tc_ach5_loopback"
model = "tc-ach5-fixture"

[model_providers.tc_ach5_loopback]
name = "tc-ach5 loopback fixture"
base_url = "http://127.0.0.1:<OS_ASSIGNED_PORT>/v1"
wire_api = "responses"
requires_openai_auth = false
supports_websockets = false
```

The actual admission fixture only launches the repository relay with native
`codex.exe --version`. It creates empty temporary home/project directories, uses
an OS-only environment allowlist, file credential stores, disabled analytics and
update checks, and read-only/on-request configuration. It starts no App Server,
HTTP listener, login, or native interactive session. From the worker root:

```powershell
& 'C:/Program Files/Git/bin/bash.exe' ./apps/stack/bin/hstack-exec -- node --check .companion-local/tc-ach.5/native-tui-pty-admission.cjs
& 'C:/Program Files/Git/bin/bash.exe' ./apps/stack/bin/hstack-exec -- node .companion-local/tc-ach.5/native-tui-pty-admission.cjs
```

Syntax check exited 0. Admission exited **1** after manual owned-relay cleanup;
worker evidence is `pty-admission.log` and
`pty-admission-tc-ach5-pty-s8tRDu.json`. The relay emitted terminal control bytes,
the retained temporary-home helper warning, and `codex-cli 0.160.0`. Its 15-second
experiment watchdog closed stdin; no relay close arrived. This is not a product
timeout or proof that Codex remained alive. Direct diagnostic
`Get-CimInstance Win32_Process -Filter 'ParentProcessId = 19388'` failed with
`Access denied` / `0x80041003`. No equivalent permission retry was attempted.
After matching relay PID **19388**, process name, and observed start time, the
worker stopped only that relay. The runner recorded close code **4294967295**
and terminated. Native/conhost PIDs were not exposed by the relay. The coordinator
subsequently ran a scoped read-only query for
`ProcessId = 19388 OR ParentProcessId = 19388`: **no rows, exit 0**, recorded in
Beads comment `d65b13dc-915f-56cb-b0ab-4500e7c1b1e8` on **tc-ach.5.1**. This removes
the current parent/direct-child concern at that observation time; it does not
certify historical grandchildren or PTY lifetime. No process was killed by that
query. The worker's denied query is not evidence that Codex stayed alive.

At that first admission boundary, native exit, relay exit, and terminal-query
handling were unresolved alternatives. The dependent TUI/model fixture stopped;
no Responses SSE/tool-call vector was implemented or exercised. The following
diagnostic separates those alternatives without starting a model endpoint.

### Native exit versus PTY and relay lifetime

**Observed, tc-ach.5.1:** the ignored `pty-exit-diagnostic.cjs` uses the installed
backend directly, with the relay's options. It observes the public `pty.pid`,
opens only that process with `Get-Process -Id`, captures its OS creation time,
and holds the process handle while waiting for exit. It also records the real
native callback's exit code, socket events, public `onExit`, and the output
worker's lifetime. Private backend fields are read-only diagnostic observations,
not a proposed production API. No native exit event is mocked.

The existing relay/provider tests were inspected: their fake PTY boundary cannot
establish native Windows handle cleanup. The process testkit's PID liveness
helper does not bind creation identity. The existing
[virtualTerminalScreen.ts](../../apps/cli/src/integrations/pty/virtualTerminalScreen.ts)
owns screen/cursor capture for the PTY adapter; its public interface supplies no
terminal-query response channel. The earlier search for a reusable headless
fixture found the generated UI xterm asset. No terminal emulator was added:
both processes exited without answers to the emitted terminal queries.

From the worker root, each command below exited **0**:

```powershell
& 'C:/Program Files/Git/bin/bash.exe' ./apps/stack/bin/hstack-exec -- node --check .companion-local/tc-ach.5/pty-exit-diagnostic.cjs
& 'C:/Program Files/Git/bin/bash.exe' ./apps/stack/bin/hstack-exec -- node .companion-local/tc-ach.5/pty-exit-diagnostic.cjs owned-child
& 'C:/Program Files/Git/bin/bash.exe' ./apps/stack/bin/hstack-exec -- node .companion-local/tc-ach.5/pty-exit-diagnostic.cjs codex-version
```

| Evidence under worker `.companion-local/tc-ach.5/` | Native process and deciding observations |
|---|---|
| `pty-exit-ggvgvP/trace.json` | Input-gated Node child PID **26868**, created `2026-10-17T23:10:57.2825636Z`. Its explicit exit **7** reached both the held OS handle and native callback; public PTY exit **7** followed output-socket closure. |
| `pty-exit-GBiJXG/trace.json` | Native Codex PID **2252**, created `2026-10-17T23:11:14.4784275Z`. Only `--version` ran: output `codex-cli 0.160.0`, held-handle/native callback exit **0**, then public PTY exit **0**. |

In both cases the input socket and output worker remained alive after native
and public PTY exit. Calling the supported `pty.kill()` closed the input socket,
but the worker still retained a `MessagePort` after the diagnostic observation
window. The runner exited after its diagnostic timers were cancelled **and only
that fixture's worker** was terminated. Runner exit alone does not isolate which
intervention removed the last live handle. This private cleanup is explicitly
marked in each trace; it is neither a
production fix nor a production-relay pass. The 3.5-second observation and
2.5-second cleanup windows are experiment bounds, not proposed product deadlines.
Both native children, observer children (PIDs **19152**, **25416**), and runners
(**34916**, **27924**) have recorded exits; each owned worker's forced termination
is recorded as code **1**. No descendant enumeration was retried, so unobserved
ConPTY descendants are not independently certified.

**Source mechanism, installed `node-pty` 1.1.0:** `lib/windowsPtyAgent.js` records
native exit but skips `_flushDataAndCleanUp` in DLL mode. Its DLL `kill` path
disposes the output worker only on a subsequent output `data` event.
`lib/worker/conoutSocketWorker.js` creates a named-pipe server without closing it
when the upstream output ends. `lib/windowsTerminal.js` emits public exit on
output-socket close, which does not terminate that worker. The repository
[relay](../../apps/cli/scripts/node_pty_relay.cjs), as it stood at the original
admission, set `process.exitCode` and closed stdin on PTY exit, leaving Node to
drain its handles. The retained
worker is a source-backed cause of retained backend handles, consistent with the
original relay hang. That original relay did not expose its internal exit
events, so its historical event sequence cannot be retroactively certified.

**Derived decision:** unanswered terminal queries did not prevent child or PTY
exit in these two observations. Native TUI query handling is still untested.
Coordinator review should scope a canonical PTY/relay lifetime correction with
meaningful RED/GREEN and real Windows relay completion evidence, including final
output and nonzero exit preservation. No shared runtime source changed during
that diagnostic stage, and the held-handle observations needed no broader
process permission.

The granted **tc-ach.5.2** correction compares the public system-ConPTY option
with explicit completion confined to the disposable relay. In installed 1.1.0,
non-DLL native exit destroys the output socket after its one-second flush timer;
it does not itself dispose the output worker. Non-DLL `kill` also invokes console
process enumeration. A flag change alone therefore does not establish the required
cleanup and final-output contract.

The relay patch awaits authoritative PTY exit, the return of supported
`pty.kill` cleanup, and completion of every queued stdout/stderr write callback
before explicitly completing this disposable relay. EOF, signals, input errors,
and output errors request that same owned cleanup. An error before native exit
does not authorize completion; errors retain a nonzero outcome and diagnostics
where stderr remains writable. Reentrant exit during cleanup cannot finish the
relay before cleanup returns. No private backend fields or product timers were
added. **tc-ach.5.2.1** tracks the dependency-owned worker-disposal correction;
remove this narrow mitigation only after the replacement passes actual Windows
lifecycle and drainage evidence.

Review found that both installed Windows backends reject every nonempty signal.
The first implementation set its cleanup guard before forwarding `SIGINT` or
`SIGTERM`, so rejection also prevented a later signal-less cleanup. The corrected
relay uses signal-less `pty.kill` on Windows and preserves the requested signal
on other platforms. Persistent tests now cover Windows signal/repeated
cancellation with final-output drainage and non-Windows signal preservation.
The unchanged output-error and cleanup-order machinery is not replaced by this
correction. Canonical GREEN including these new tests is **21 passed, exit 0**;
the known worker esbuild sandbox denial was not retried.

The [Node relay provider](../../apps/cli/src/integrations/pty/nodePtyRelayProvider.ts)
now requests cancellation once through stdin EOF. It removes immediate forced
termination on repeated cancellation and the two-second `SIGKILL` deadline,
which could interrupt child cleanup or final output. Public provider exit still
waits for relay stdio close. If native exit never arrives, the patch intentionally
does not manufacture success by killing the relay. The in-process PTY provider
and the separate POSIX Python relay remain unchanged; neither may inherit an
in-process `process.exit` workaround.

### Production-relay validation

Coordinator execution of `run-relay-review-green.ps1` passed all 21 tests.
The adjacent slice failed three `ptyProvider.test.ts` packaged-path cases at
lines 315, 345 and 374. Each fixture uses exact POSIX slash keys while the owner
constructs native paths, and each sets `fallbackProvider: null`, bypassing this
relay patch. The same failures reproduced on clean integration `abc4506f8e`;
the provider source/tests match pinned upstream `cb5f427`. They remain separate
under **tc-ach.30**, not an adjacent-suite pass or a reproduced product loader failure.

After independent fixture review, `run-relay-native.ps1` ran from the worker
root. Its executor session **46352** completed with **exit 1**, stopping on the
third case; no active executor handle remained. Individual cases used this
routed command with `exit7`, `codex-version`, or `slow-reader`:

```powershell
& 'C:/Program Files/Git/bin/bash.exe' ./apps/stack/bin/hstack-exec -- node .companion-local/tc-ach.5/relay-native-validation.cjs exit7
```

Each case launches the
actual production relay with a fixture-only preload observing public PTY
`spawn`/PID/data/exit, without changing backend options or exit signals. A separate
observer opens only PIDs obtained from those owned objects, then checks full
executable path, process name, PID, and creation time against the captured spawn
window **before** accepting a handle. Mismatched or unverifiable candidates are
disposed and admission fails. It does not enumerate processes or read command
lines/environments. A missing handle is failed admission.
The preload's captured PTY bytes must equal the relay's received bytes after
drainage; native, PTY, and relay statuses must agree. This slow-reader
case directly invokes the relay: it does **not** exercise provider cancellation
or its removed two-second timer. The focused provider regression is the current
evidence for that behavior. The active EOF
case first establishes a live owned child. Fresh home/project, minimal OS
environment, file credential stores, and disabled update/analytics isolate every
case. The sole Codex invocation is the installed **0.160.0 `--version`**.

The initial observer accepted a PID without checking creation identity and could
later kill that instance. Installed `conpty.cc` closes `hShell` immediately after
native exit, before the JavaScript callback, so a fast `--version` PID may already
be reusable. The corrected observer **never kills processes**, even after
metadata admission. On failed admission the runner requests cleanup through its
owned relay stdin pipe; it never kills the relay while a native child may remain
alive. If cleanup does not finish, the command remains pending with its owned
pipes/child handle and records the uncertainty. Observation bounds are fixture
controls and cannot establish a pass. No native run exercised the unsafe fixture.

The exit-7 trace records native **26604** and relay **35312** exiting 7, with
**86 identical PTY/relay bytes** and `TC_FINAL_BYTES`. The Codex version trace
records native **23812** and relay **22664** exiting 0, with **436 identical
bytes** including `codex-cli 0.160.0`. Both observers and runners exited 0, both
native/relay handles passed executable/creation-window admission, and neither
case used forced cleanup. These are actual production-relay prerequisite passes.

The original slow-reader trace held the reader at **13:21:24.119Z** on
2026-10-18, then waited for native exit before resuming. Its observer's 30-second
bound expired at **13:21:51.099Z**. The native-exit assertion failed; catch cleanup
resumed reading and requested EOF through the owned relay. Public PTY and relay
exited **1**, the observer exited **2**, and the runner exited **1**. Both raw byte
files contain **1,531,965 identical bytes**, with no relay stderr, final marker,
or `output-produced` file. Historical PIDs **22232/35272** are evidence only:
the observer had closed before cleanup, so later native OS exit is not certified.
No historical PID was queried or terminated during this reconciliation.

**Derived fixture defect:** its harmless child calls `process.exit(7)` only
after the stdout write callback. Requiring that exit while the consumer remains
paused assumes throughput the real terminal path does not guarantee. Installed
`node-pty` pipes ConPTY output through a worker socket; the preload also writes
each data event synchronously to disk. The trace does not isolate terminal
throughput, observer overhead, or downstream pressure as the deciding bottleneck.
No no-pause control ran, and this timeout is not a meaningful product RED.

The corrected ignored fixture removes the native-exit dependency from reader
release. It holds for the existing **2.5-second fixture interval**, resumes, then
requires authoritative native/PTY/relay status, exact final bytes, the final
marker and the child's write-completion file. The **16,000-record payload**,
process admission and observation bounds are unchanged. The hold and bounds are
experiment controls, not production deadlines. Production source/tests are
unchanged; provider cancellation remains covered by its focused regression,
not this direct-relay case.

After coordinator review, the corrected replay ran only `slow-reader` and
`active-eof` from this worktree root, with **terminal exit 0**:

```powershell
& ./.companion-local/tc-ach.5/run-relay-native-remaining.ps1
```

That runner used the routed native command above for each case and preserved the
original failed logs. In `relay-slow-reader-y9AtsB/trace.json`, the reader was held
at **2026-10-18T14:29:11.545Z** and resumed at **14:29:14.048Z**. Native **11044**
and relay **22920** exited **7**; public PTY status agreed. The fixture asserted
**1,808,077 identical PTY/relay bytes**, `TC_FINAL_BYTES`, and the `output-produced`
file; observer and runner exited **0**. The raw command result is in
`relay-native-slow-reader-replay-coordinator.log`. This measures drainage after a
finite pause, not native exit while paused or the provider cancellation path.

In `relay-active-eof-8wPCWp/trace.json`, EOF was requested at
**2026-10-18T14:29:17.892Z** with the owned child active. Native **17444** and relay
**23416** exited **1**; public PTY status agreed, **33 bytes** matched exactly,
and observer/runner exited **0**. The raw command result is in
`relay-native-active-eof-replay-coordinator.log`. Both runs admitted native and
relay handles and observed their exits without forced observer/parent kills.

All four bounded native relay prerequisites now pass on the stated Windows,
Node and `node-pty` versions. The dependency itself remains unrepaired under
**tc-ach.5.2.1**. No broader platform certification follows. Unobserved descendants
and the earlier failed slow-reader run's later native cleanup remain uncertified.
This final reconciliation ran no native or code tests; the unchanged 21-test and
CLI typecheck evidence remains applicable. No TUI/shared-session/device gate
passes from these results.

### Integrated verification

The coordinator committed the five reviewed files as `d2a6268defac4301b4f737cdf62fd37f44628f5a`
on `agent/codex-spike`, then integrated them individually on `companion/main` as
`dd5881d3a24a9910c818e4157dad3fbfdf283c10`. Independent review reconciled all four
native traces and byte buffers and accepted the bounded mitigation. Native
evidence remains applicable to the unchanged runtime files, dependency version
and Windows environment; no native run was repeated solely for integration.

From the integration checkout, the routed Vitest command above ran both relay
files together with the four adjacent files. It exited **1: 67 passed, 3 failed,
2 skipped**. All **21 relay tests passed**; the three failures are the same
packaged-path fixture failures tracked in **tc-ach.30**. CLI typecheck exited
**0**. Coordinator logs are `.companion-local/tc-ach.5/relay-integrated-tests.log`
and `relay-integrated-typecheck.log`; their runners record the exact commands
and integration HEAD. The broader test slice is not green. Dependency repair,
native provider cancellation and the TUI/phone gates retain the limits above.

### Smallest remaining no-credential TUI experiment

With the reviewed relay mitigation integrated, obtain the separate grant for
this TUI experiment; do not use the private worker termination above as product behavior. Reuse the isolated-home,
environment-allowlist, file-store, analytics/update, read-only/on-request contract
and the candidate custom provider above. Bind only an owned `127.0.0.1` port;
the initial fixture must reject and record model requests without forwarding.
Launch one owned native App Server and the original native TUI with
`--remote unix://<owned socket> --cd <owned project> --sandbox read-only --ask-for-approval on-request`,
with no initial prompt or submitted turn. Attach the existing native proxy plus
`ws-node` response client, identify the same native thread through structured
events, and type/edit an **unsent** local draft. Record PID/endpoint/thread,
terminal behavior and cleanup. If startup requires a trust/login decision that
cannot be safely serviced, stop. No paid account is needed for this proposed
admission experiment. The later attempts and their limits are recorded next.

Only after that gate is understood should the loopback fixture emit a pinned
minimal Responses SSE tool request for one harmless project marker. Assert the
effective provider/config/endpoint before that synthetic turn; stop on unexpected
traffic or actions. Native request IDs, final item state and marker effect must
decide approval results. Remote approval, local-first/stale responses, a
conflicting race, and draft preservation around remote input all remain unrun.

### No-prompt native admission and history reads (2026-10-19)

The first coordinator run, worker `tui-no-prompt-nQKjq8/events.jsonl`
(00:26:53–55Z), initialized the fresh backend/proxy and passed no-account admission,
then rejected `config/read` validation before launching a TUI. No sample or model
request occurred; both sidecars closed. The ignored validator was corrected for
the pinned provider serialization: omitted optional fields serialize as null,
and the standalone-search flag defaults false. Its source-derived RED/GREEN logs
remain `config-admission-{red,green,final-green}.log`; no strict policy was relaxed.

The second run, worker `tui-no-prompt-OJ9EuY/events.jsonl`, passed that corrected
configuration guard and empty loaded-thread admission. Windows Codex **0.160.0**
backend PID 33604 and proxy PID 25616 initialized at 14:35:43Z. Original TUI PID
21888 used the same
owned Unix endpoint. The coordinator separately trusted only the fresh
`tc-ach5-tui-uqf06m/project`; no existing installation/session was used. Thread
`01a154ae-855f-7693-9a05-61cb330feb34` appeared at 15:01:26Z. Metadata `thread/read`
succeeded, but `thread/turns/list` returned **-32600** before any validated sample
or draft input. Local CTRL+C exited the empty-composer TUI **0**; its disconnect
hint identified the same thread/socket and was not executed. The 15:11:30Z result
was `BLOCKED_OR_INCOMPLETE`, with 0 structured samples, 0 model requests and all
retained children closed; executor 79949 exited **2**. Coordinator
`.companion-local/tc-ach.5/native-terminal-OJ9EuY.json` retains terminal evidence.
These are historical process identities, not cleanup authority.

Pinned [thread read/list source](https://raw.githubusercontent.com/openai/codex/rust-v0.160.0/codex-rs/app-server/src/request_processors/thread_processor.rs)
and [native tests](https://raw.githubusercontent.com/openai/codex/rust-v0.160.0/codex-rs/app-server/tests/suite/v2/thread_read.rs)
establish that live metadata can precede persisted history and a fresh turn-list
read can reject before the first user message. The stored trace omits the error
message, so this is a supported explanation, not a proved cause of that -32600.
Even the named unmaterialized error collapses several
[rollout-resolution failures](https://raw.githubusercontent.com/openai/codex/rust-v0.160.0/codex-rs/thread-store/src/local/read_thread.rs);
it and metadata-only empty turns cannot certify no-turn state.

The then-proposed observer required a **paginated, non-ephemeral** thread,
`includeTurns:true` hydration and a separate empty turn page. Pinned
`apply_thread_read_store_fields` persists pending history before hydration; the
source-derived boundary vectors therefore modeled that path. Worker
`empty-thread-red.log` exited **1**, followed by **0** in
`empty-thread-green.log` and `empty-thread-final-green.log`. Those were harmless
checks, not native GREEN. The prior source, logs and failure evidence remain
preserved; that approach is superseded below.

The third run, worker `tui-no-prompt-ZIhTHi/events.jsonl`, initialized backend
33380 / proxy 17268 at 16:23:53Z. Original TUI 8400 reached the composer at the same
socket and created thread `01a154fd-c497-75a2-a6c1-3b0ea606db42`. Metadata
identity/mode validation succeeded. At **16:28:00.358Z**,
`thread/read(includeTurns:true)` returned **-32601**, which did not match the
unmaterialized-thread diagnostic. Its cause remains unknown; the full error
payload was deliberately not retained. No sample or draft input occurred.
Local CTRL+C exited TUI **0**, then the owned proxy/backend closed. At
**16:29:11.220Z**, the result was `BLOCKED_OR_INCOMPLETE`, with 0 structured samples,
0 model requests and all retained children closed; executor 88816 exited **2**.
Coordinator `.companion-local/tc-ach.5/native-terminal-ZIhTHi.json` retains the
terminal record. These identities confer no current process authority.

The coordinator explicitly removed complete-history enumeration as an invented
prerequisite for the first no-prompt terminal/draft observation. The narrower
experiment uses the existing loaded-thread inventory and successful
`thread/read(includeTurns:false)` identity checks. It measures neither complete
history nor shared responses; metadata `turns:[]` and RPC errors establish no
empty-history proof. Hydration/turn-list requests, their validators and exact-error
matching are removed from the active ignored fixture, without retries, mode
fallbacks or a second observer. Strict config, no-account, rejecting model
endpoint, identity, required-RPC and unexpected-event failures remain enforced.
No product contract, permission policy or Windows guard changes.

Worker `metadata-only-red.log` exited **1** on the hydration dependency, missing
partial-result fields and premature sidecar exit. `metadata-only-green.log`
exited **0**. A separate `metadata-only-events-red.log` exited **1** for an ignored
`turn/completed` notification; `metadata-only-final-green.log` exited **0** after
all `turn/*` events became failures. These use the real fixture observer/RPC logic
with external boundary vectors, including strict mismatch/error/privacy cases.
No native process or listener ran during this writer pass.

### Native metadata and unsent draft observation (2026-10-19)

After independent review and a fresh scoped grant, the coordinator ran the
unchanged wrapper from the Codex worktree with **tty:true**:

```powershell
& ./.companion-local/tc-ach.5/run-native-tui-no-prompt.ps1
```

The wrapper invokes the routed Node fixture with `--reviewed-run --observe-ms
60000 --system-config-dir <Windows ProgramData known-folder>/OpenAI/Codex`.
That bound covers startup and individual RPCs; attended observation follows
the original TUI lifetime. Run `tui-no-prompt-hcPKHD` admitted strict configuration,
no account and an empty initial loaded-thread inventory. Only its fresh
`tc-ach5-tui-DayWsS/project` received a native folder-trust decision. Backend
27392, proxy 13844 and original TUI 17416 used the same owned Unix endpoint;
thread `01a1553a-1ee6-78f0-9928-775da1b9d34f` appeared at 17:33:54.806Z.

The coordinator visibly typed **`tc-ach5-draft-A`** without Enter. After a matching
metadata sample, Backspace followed by `B` changed the final character. Another
sample at 18:05:58.271Z retained the same backend/TUI/thread and idle state.
Fifteen Backspaces restored the empty composer placeholder. Local CTRL+C then
exited the original TUI **0** at 18:18:59.779Z. Its reconnect hint was not used.
The fixture stopped only its retained proxy/backend handles after TUI closure;
both recorded exit/close by 18:18:59.803Z. This is Windows termination of owned
sidecars, not a graceful-provider-shutdown claim or descendant census.

Executor **40040 exited 0**. The final result at 18:18:59.804Z was
`PARTIAL_METADATA_OBSERVED_DRAFT_REVIEW_REQUIRED`, with **0 model requests**,
all owned direct children closed, `historyMeasured:false` and
`sharedResponsesMeasured:false`. There were no required RPC failures or recorded
unexpected model/server/turn events. The terminal returns and post-draft samples
are retained in coordinator `.companion-local/tc-ach.5/native-terminal-hcPKHD.json`;
the worker run directory contains `events.jsonl`. Process IDs are historical
evidence, not authority for later cleanup.

**Observed:** original native Windows TUI editing remained usable while a second
client read stable metadata from the same backend/thread. This does not measure
complete history, model continuation, remote input or draft preservation during
remote delivery. Permissions, questions, native arbitration, stale/incarnation
responses and physical-device gates remain unverified. Earlier failed attempts
retain their recorded dispositions.

### Native permission fixture rejected tool advertisement (2026-10-19)

After independent review, the coordinator ran the ignored finite denial fixture
under a separate scoped grant: one local prompt, two possible synthetic loopback
Responses exchanges and one exact structured decline. It retained read-only /
on-request policy, a fresh account-free home/project, the original TUI, and the
same pinned 0.160.0 App Server/proxy transport. It could not forward to a real
provider, substitute a shell tool, relax policy or retry a response decision.

From the Codex worktree, after resolving the known system configuration directory
as in the earlier recipe, the exact command was:

```powershell
& 'C:/Program Files/Git/bin/bash.exe' ./apps/stack/bin/hstack-exec -- node .companion-local/tc-ach.5/native-tui-no-prompt.cjs --reviewed-run --observe-ms 60000 --system-config-dir $systemConfigDirectory --permission-deny
```

The original composer submitted exactly once:

```text
Use apply_patch to add tc-ach5-denied-marker.txt containing tc-ach5-deny-fixture. Do nothing else.
```

Run `tui-permission-deny-5esMTn` admitted two fully checked metadata samples on
backend 8808, original TUI 34800 and thread
`01a1562c-a841-7103-9fde-d9b1f8e66eee`; proxy 6352 was the second client. These PIDs
are historical evidence, never authority to signal another process. At
22:17:02.476 UTC, the first model request failed `http.tool_advertised`: it did
not contain exactly one top-level custom `apply_patch` tool with a Lark grammar.
The body was not retained, so the trace does not distinguish absent capability
from a different advertisement shape. A synthetic-model capability mismatch is
a hypothesis requiring pinned-source evidence.

The trace also records a second `native-thread-started` identity,
`01a1563d-5512-7273-a0aa-e381cdd4add4`, at 22:17:02.520 UTC, immediately after the
first rejection. Its cause and relationship to the submitted turn are
unexplained; no permission turn/request was observed by the response client.
The earlier metadata identity does not establish the executing turn's binding.

The fixture rejected that request and eleven further HTTP attempts with HTTP 403;
the later rejections followed its failed-authority state. It emitted **zero** SSE
tool responses and **zero** structured permission decisions. The TUI displayed
the 403 failure and returned to its composer; the coordinator sent local Escape
and then Ctrl+C. TUI exit 0 preceded retained proxy/backend termination and
their close events. The final trace at 23:28:47.663 UTC records marker absence,
`allOwnedChildrenClosed: true`, `BLOCKED_OR_INCOMPLETE` and internal result code
2. The enclosing executor reported exit 1. Neither is a successful experiment.
No post-denial draft or native response/application claim follows.

Raw evidence is the worktree's
`.companion-local/tc-ach.5/tui-permission-deny-5esMTn/events.jsonl` and integration
`.companion-local/tc-ach.5/native-terminal-5esMTn.json`. Request bodies, headers
and credential values were not logged. The preceding preparation correction
has two meaningful RED/GREEN checks: a failed final config read or changed
policy cannot credit a metadata/post-denial sample. Both preparation checkers
and four syntax checks passed; this validates fixture admission only.

The next bounded step is to characterize the pinned model/tool advertisement
and review any fixture correction before another native run. Do not silently
fall back to a shell, normalize an unknown tool into authority, or interpret
this failed experiment as evidence about local/remote permission arbitration.

### Subscription and live-thread evidence (2026-10-20)

**Source findings, independently reviewed before the join attempt below.** In pinned
`rust-v0.160.0`, public [`thread/start`](https://github.com/openai/codex/blob/rust-v0.160.0/codex-rs/app-server/src/request_processors/thread_processor.rs#L1490)
attaches its creating connection and separately broadcasts `thread/started`.
Receiving that broadcast on an already initialized second client does not
subscribe it to turn, item or approval delivery. The fixture's earlier automatic
subscription assumption is refuted. Metadata polling remains valid evidence of
metadata access, not of shared response control.

The loaded-thread branch of `thread/resume` retains the existing native thread
and adds the connection, but the same RPC can fall through to cold history
reconstruction. `excludeTurns: true` suppresses returned history; it does not
disable that fallback. Native [`sessionId`](https://github.com/openai/codex/blob/rust-v0.160.0/codex-rs/core/src/session/session.rs#L857)
can be restored from metadata, so unchanged thread ID, session ID and backend PID
do not prove uninterrupted runtime incarnation. Even the warm branch reads
stored metadata, which may be absent for an untouched empty thread. An error must
stop the experiment rather than trigger hydration, retargeting or a retry.

Existing diagnostics offer a positive observation for a new disposable experiment:
the [`composing running thread resume response`](https://github.com/openai/codex/blob/rust-v0.160.0/codex-rs/app-server/src/request_processors/thread_lifecycle.rs#L591)
debug event identifies the live response path. It must be correlated with the
same connection/request's successful RPC response after attachment. The
[`resume_thread_with_history`](https://github.com/openai/codex/blob/rust-v0.160.0/codex-rs/core/src/thread_manager.rs#L1257)
trace span identifies a cold reconstruction attempt. Narrow JSON stderr logging
is supported by the existing App Server logger. These are post-execution
observations, not an atomic cold-path fence; the installed binary's diagnostic
availability on the successful branch and a successful live join remain unverified. Earlier fixtures only
counted stderr bytes and cannot supply this evidence retrospectively.

The unknown fixture model also lacks the bundled patch capability supplied by
`gpt-5.5`. Correcting that fixture configuration alone is insufficient: native
unnamed-thread title generation can create a separate tool-free thread. This is
a source-supported alternative explanation, not identification of the second
thread or the first rejected HTTP request in the failed run above. No unretained
request body has been reconstructed.

Ignored fixture preparation added redacted request provenance and requires a
matching observed native thread/turn before returning synthetic model output.
Both consumed preparation checkers recorded RED then GREEN; four syntax checks
passed. Exact artifacts are `topology-*.log` and `HANDOFF.md` under the Codex
worktree's `.companion-local/tc-ach.5/`. Permission replay remains blocked on
reviewed attachment and background-request scope. No acceptance gate passes.

### Empty-thread native join rejected (2026-10-20 local)

**Failed experiment; shared control remains unverified.** In the disposable
`tui-join-only-GBt4TX` run (2026-10-21 UTC), the original Codex 0.160.0 TUI
remained open with an empty composer. After two complete account/configuration
and same-thread metadata observations, the second client sent exactly one
`thread/resume` with that thread ID and `excludeTurns: true`. Native RPC returned
`-32600`; no successful resume or warm-path diagnostic was observed. No model
request, prompt or permission response occurred; no explicit history-hydration
request or retry was sent.

The exact invocation, with the frozen environment and resolved system-policy
directory from the existing recipe, was:

```powershell
& 'C:/Program Files/Git/bin/bash.exe' ./apps/stack/bin/hstack-exec -- node .companion-local/tc-ach.5/native-tui-no-prompt.cjs --reviewed-run --observe-ms 60000 --system-config-dir $systemConfigDirectory --join-only
```

Local CTRL+C exited the TUI with status 0. The runner then stopped only its
retained proxy/backend handles; all three direct children and the diagnostic
stream closed. Final fixture result: `2 / BLOCKED_OR_INCOMPLETE`; enclosing
executor: exit 1. Raw evidence is the Codex worktree's
`.companion-local/tc-ach.5/tui-join-only-GBt4TX/events.jsonl` and the integration
checkout's `native-terminal-GBt4TX.json` / `native-terminal-GBt4TX-exit.json`
under `.companion-local/tc-ach.5/`. Independent review checked these records.

Only the error code was retained, so this run does not establish missing stored
metadata as its cause or disprove live attachment feasibility. The result's
`responseReceived: false` means no successful join response; the failed RPC did
receive a response. Absence of a cold diagnostic does not prove that cold
execution was impossible. A useful next preparation is a narrowly classified native error
and an explicit same-thread naming-completion gate before one fresh join attempt.
Naming can write owned fixture SQLite metadata, name indexes and possible
rollout materialization, and needs its own reviewed native grant; it must not
be raced against the current automatic join or substituted
silently. This experiment passes no product acceptance gate.

## Remaining real-account experiment for approval

The no-credential two-client transport prerequisite **has passed** in the
coordinator fixture above. The focused tests were also rerun, with the failure
and four skips preserved. The bounded no-prompt metadata/draft experiment above
has passed; synthetic model/tool responses remain unrun. A separately prepared
and reviewed loopback tool-response experiment should precede a real-account
experiment. Complete history and native response control remain unverified.
Remaining product work belongs in the existing
client/shared-server owners: WebSocket framing over owned proxy pipes, readiness
that does not mistake Node `stat` denial for native connection failure, and
error/EOF/disposal behavior. That work requires its own authorized scope,
meaningful RED/GREEN and package checks; it has not been implemented here.

The following **live** recipe has not been authorized or run. Prerequisites are:
a human-observed native Windows terminal; an approved disposable project and
isolated development Codex home/account; the exact executable/version; a reviewed
response client targeting only the owned endpoint; and a grant naming the model
and numeric spend ceiling. No production credentials may be copied. Proposed
cost scope is at most **eight manually initiated short foreground turns**, with
no agent delegation or unrelated work. Turns may involve retries or several model
requests, so a turn count is not a dollar cap; the coordinator must specify the
cost-control mechanism before authorizing inference. The transport-only phase
requires no model request or provider credential.

Use variables supplied by that grant: `$NativeCodex`, `$FixtureProject`, and
`$SocketPath`. The process environment must already point to the approved
isolated development home/profile. In separate attended terminals:

```powershell
# One owned backend. Keep the socket parent absent for Codex's private-directory policy.
& $NativeCodex app-server --listen "unix://$SocketPath"

# The original interactive native terminal; this fixture intentionally uses read-only policy.
& $NativeCodex --remote "unix://$SocketPath" --cd $FixtureProject --sandbox read-only --ask-for-approval on-request
```

The reviewed response driver must launch exactly
`$NativeCodex app-server proxy --sock $SocketPath` with owned pipes and the same
isolated environment/cwd. As in coordinator `native-proxy-probe.cjs`, wrap those
pipes in `Duplex.from` and use existing `ws-node` to perform the WebSocket
upgrade. Send JSON-RPC as WebSocket text frames; do not send JSONL directly to
proxy stdin. A bare proxy shell command is not the response client. Production
integration and graceful lifecycle handling remain unverified.

After the upgrade, the response driver sends `initialize` with a unique
`clientInfo` and `capabilities.experimentalApi=true`, waits for success, then
sends `initialized`.
Use `thread/loaded/list` to identify the TUI's freshly created thread. The proposed
`thread/resume` attachment on **this same endpoint** is blocked by the live/cold
distinction described above until its exact fixture and evidence are reviewed.
Do not import history into a second backend. Compare backend/endpoint/thread
before and after, but do not treat matching IDs as an incarnation proof. Require
positive live-branch evidence and correlated successful attachment before any
permission experiment; missing evidence or cold reconstruction fails admission.

1. Request a harmless, approval-requiring write of a single marker in the
   disposable fixture. The provider must emit a structured request under the
   fixture's unchanged policy. If it only prints a question or does not prompt,
   record the missing case; do not synthesize approval from terminal text.
2. Capture envelope request ID, thread/turn/item/callback IDs, displayed action,
   and allowed decisions. Reply to that **same envelope ID** with
   `{"decision":"accept"}` only when offered. Require native resolution,
   correlated item outcome, one marker effect, and continued native editing.
3. Repeat with a local-first answer; deliver the old remote response after a
   second request exists. Then race opposite local/remote decisions and duplicate
   a remote response. Record the actual losing-path behavior and prove the next
   request and side-effect count are unaffected. Do not assume a particular error.
4. Ask for one native structured question with two choices. Respond by question
   ID through `item/tool/requestUserInput`; demonstrate the answer without a
   permission-policy change. A plain conversational question does not pass A03.
5. Type a recognizable unsent draft in the TUI. Send an ordinary message using
   `turn/start`, or `turn/steer` with the observed `expectedTurnId` when a turn is
   active. Verify the draft bytes/cursor and local editability remain intact.
6. Exercise local cancel/interruption and disconnect the response client around
   application/acknowledgement. Require native local recovery, explicit
   indeterminate handling when evidence is lost, and no blind replay. Closing
   this client is distinct from crashing a Companion sync process.
7. Restart only the owned backend, preserving the intended test thread where
   supported. Verify the Companion run binding rejects an earlier decision even
   if native IDs recur. This last assertion needs the coordinator-owned reviewed
   response contract; a raw native proxy alone cannot pass it.

Preservation proof must compare executable, cwd, arguments, selected profile,
synthetic plugin/config identity, environment-profile reference, and permission
policy across backend and TUI. Use non-secret fixture markers and human-attested
credential references; do not dump environment values or personal configuration.
Any native inability to preserve the launch contract needs an explicit scope
decision. Do not change that contract just to make the experiment succeed.

If the private proxy is ruled out by deciding native evidence, the alternative
experiment is an authenticated loopback listener:

```powershell
& $NativeCodex app-server --listen "ws://127.0.0.1:$Port" --ws-auth capability-token --ws-token-file $TokenFile
& $NativeCodex --remote "ws://127.0.0.1:$Port" --remote-auth-token-env TC_CODEX_TRANSPORT_TOKEN --cd $FixtureProject --sandbox read-only --ask-for-approval on-request
```

That separate decision must define a fresh transport token, user-only storage,
port ownership, and cleanup; never reuse provider auth. Test absent/wrong tokens
before accepting a client. This alternative has not been run or authorized and
remains subject to the documented experimental status. The proxy transport
success supplies no reason to introduce that credential boundary now.

## Acceptance boundary and remaining risk

| Gates | Disposition |
|---|---|
| Supporting no-credential transport prerequisite | **Passed:** two native proxy/WebSocket clients, empty-list assertions, and one proxy's termination without loss of the other client/backend. No native TUI or created thread; this passes none of A01 onward. |
| Supporting loopback-model/TUI fixture | **Relay prerequisites and bounded no-prompt metadata/draft observation passed:** integrated 21-test GREEN and CLI typecheck; combined slice 67 passed / 3 baseline failures / 2 skips (tc-ach.30). Four bounded native relay cases passed. The fourth no-prompt run observed original TUI edits with a second metadata client on the same backend/thread, then TUI0 and all retained direct child closes. Earlier history RPC failures remain recorded. History, model continuation and shared responses are unmeasured. Dependency repair is **tc-ach.5.2.1**; earlier cleanup limits remain explicit. |
| A01–A03 | **Blocked:** partial same-endpoint/TUI/thread evidence does not establish complete structured shared control, a permission response or a question response. |
| A04–A06 | **Blocked:** no native local-first, competing, duplicate, or stale-response arbitration observed. |
| A07, A20 | **Blocked:** unsent local editing was observed under concurrent metadata reads. Remote-input draft preservation and complete launch/profile/plugin/policy preservation still need their native recipes. |
| A10, A13, A18 | **Blocked:** incarnation rejection, lost acknowledgement, and native cancellation need live evidence and the shared response contract. |
| A19 | Source restriction confirmed; end-to-end unsupported-state UX and production transport integration remain unverified. |
| A08–A09, A11–A12, A14–A17 | Separate composed/security/Android/multi-machine/launcher gates. This spike provides no passing result for them. |

The response contract/security work remains with **tc-ach.2/.7** and provider
implementation with **tc-ach.11**. The highest residual risks are a response
applied to a different request/incarnation, mistaking request cleanup for applied
approval, and losing desktop interactivity or draft state. The successful
transport probe, typecheck, and schema generation do not pass those live gates.
