# Codex shared control on native Windows

Research basis: **2026-10-17**, **tc-ach.5**, native **codex-cli 0.160.0**.
**Native two-client transport passed; same-TUI shared live control remains
BLOCKED / UNVERIFIED.** Two WebSocket clients used native proxy pipes to reach
one disposable backend; the second remained usable after the first proxy was
terminated. No native TUI, thread creation, model turn, permission race, phone,
draft, or incarnation behavior was exercised. The coordinator's focused test
rerun exited 1: **9 passed, 1 failed, 4 Windows skips**. The failure is a
pre-existing POSIX fixture assumption. CLI typecheck passed. Node socket `stat`
still returned `EACCES` outside the worker sandbox; native proxy access succeeded.

This is a development feasibility record, not a supported-version announcement
or a negative proof about Codex. [SPEC.md](SPEC.md), [SECURITY.md](SECURITY.md), and
[ACCEPTANCE.md](ACCEPTANCE.md) remain authoritative. Beads owns operational status
and the handoff. **tc-ach.26** holds the coordinator's transport evidence.

## Exact basis and scope

| Evidence | Observed value |
|---|---|
| Worker source | `740cef4994300368a05d19f00919955483b9925f`, branch `agent/codex-spike` |
| Worktree | `C:/Users/Raziel/projects/terminal-companion-wt/codex`; clean before research |
| Upstream / audited source | `cb5f427183391e8f65b8ffa7f1682e10d3a045f7`; audit commit `88a8ddbbb388106a798209a3c3003b074896678c` |
| Windows / shell | Windows `10.0.26200.0`, PowerShell `5.1.26100.9711`; native Windows, not WSL |
| Installed CLI | npm `@openai/codex` **0.160.0**, Windows x64 native executable under its `@openai/codex-win32-x64` dependency |
| Native contract | Local version/help, `app-server generate-json-schema --experimental`, and the `rust-v0.160.0` proxy source; schemas do not establish arbitration |
| Product runtime | No loaded Companion runtime, Android build, relay, or second desktop |

Only this document is intended for commit. No production behavior, permission,
authentication, dependency, shared protocol, or configuration was changed. The
Windows support guard remains intact. Disposable probe code, generated schemas,
and logs live under ignored evidence directories; they are not shipped fixtures.
Evidence paths below use **worker** for this worktree and **coordinator** for
`C:/Users/Raziel/projects/terminal-companion`. Worker evidence is under
`.companion-local/tc-ach.5/`; coordinator evidence is under
`.companion-local/tc-ach.26/`. No provider credentials were read or copied, and no
existing daemon or session was contacted. This reconciliation reads saved
evidence; it reruns no tests, probes, or provider processes.

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
| `corepack.cmd yarn workspace @happier-dev/cli typecheck` | **Exit 0**: declaration preparation and repository TypeScript invocation completed. Reused for this doc-only update; not rerun. |
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
Adjacent tests were not attempted after the original config-loading failure and
were not rerun for this doc-only reconciliation. No behavior change was made,
so there is no RED/GREEN claim for this research.

## Bounded remaining experiment for approval

The no-credential two-client transport prerequisite **has passed** in the
coordinator fixture above. The focused tests were also rerun, with the failure
and four skips preserved. Remaining product work belongs in the existing
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
Use `thread/loaded/list` to identify the TUI's freshly created thread and
`thread/resume` with that exact `threadId` on **this same endpoint**. Do not import
history into a second backend. Prove unchanged backend PID/endpoint/thread before
and after attachment; if attachment changes them, the experiment fails.

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
| A01–A03 | **Blocked:** no native TUI/response-client shared thread, permission, or question observed. |
| A04–A06 | **Blocked:** no native local-first, competing, duplicate, or stale-response arbitration observed. |
| A07, A20 | **Blocked:** draft and complete launch/profile/plugin/policy preservation need the attended recipe. |
| A10, A13, A18 | **Blocked:** incarnation rejection, lost acknowledgement, and native cancellation need live evidence and the shared response contract. |
| A19 | Source restriction confirmed; end-to-end unsupported-state UX and production transport integration remain unverified. |
| A08–A09, A11–A12, A14–A17 | Separate composed/security/Android/multi-machine/launcher gates. This spike provides no passing result for them. |

The response contract/security work remains with **tc-ach.2/.7** and provider
implementation with **tc-ach.11**. The highest residual risks are a response
applied to a different request/incarnation, mistaking request cleanup for applied
approval, and losing desktop interactivity or draft state. The successful
transport probe, typecheck, and schema generation do not pass those live gates.
