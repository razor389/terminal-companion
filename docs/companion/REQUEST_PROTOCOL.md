# Proposed interruption contract

**Draft for human protocol/security review; no runtime implementation.** This document belongs to **tc-ach.2**, with independent trust review in **tc-ach.7**. It extends the request semantics in [SPEC.md](SPEC.md), consumes the [provider evidence](COMPATIBILITY.md), and does not replace their acceptance gates. The coordinator owns this shared contract; adapters and mobile consumers must not create competing versions.

Source basis: `6dfbc20a8e5d740a6b70a6fd5ed74c7efdfeac3e` on the pinned fork baseline. No supported fork release or deployed mixed-version frontier has been established. Names below marked proposed are design choices, not existing APIs.

## Existing owners and the gap

| Responsibility | Current owner and observed behavior | Proposed use |
|---|---|---|
| RPC names and transport | [rpc.ts](../../packages/protocol/src/rpc.ts), [socketRpc.ts](../../packages/protocol/src/socketRpc.ts) | Add the reviewed versioned operation here; retain transport correlation separately from decision identity |
| Permission entry point | [sessionPermissionRpcRouter.ts](../../apps/cli/src/agent/permissions/sessionPermissionRpcRouter.ts) dispatches `permission` and the structured-question V1 method to registered consumers | Validate the new schema and trusted sender context once, then route to the actual pending owner |
| Shared request lifecycle | [permissionRequestCoordinator.ts](../../apps/cli/src/agent/permissions/permissionRequestCoordinator.ts) owns waiters, compatible decision caching, cancellation and `completionInProgress` | Extend the existing owner with complete binding and native-result semantics; do not add a relay permission coordinator |
| Pending/completed projection | [agentStateRequestStore.ts](../../apps/cli/src/agent/permissions/agentStateRequestStore.ts) publishes requests and waits for optional state-write acknowledgement | Preserve one projection owner; a successful state write is not evidence of provider application |
| Mobile commands | [sessions.ts](../../apps/ui/sources/sync/ops/sessions.ts) builds permission decisions and routes structured answers | Consume the shared schema, bind exactly what was displayed, and show unsupported/stale/indeterminate results |
| Existing payload duplication | UI `SessionPermissionRequest` and CLI [SessionPermissionRpcPayload](../../apps/cli/src/agent/permissions/sessionPermissionRpc.ts) each describe the legacy shape | Keep legacy translation at the boundary; place the new shared schema/types in `packages/protocol`, not another UI or adapter declaration |

Observed: the legacy payload contains a request ID and decision/policy/answer fields. It does not carry the required machine/backend/run/revision/action/device binding. Structured-question V1 validates answer shape and requires a live owner, but does not by itself add that complete binding. The coordinator's acknowledged completion awaits the agent-state write and then releases waiters; it does not wait for a native agent to consume the reply.

`permissionResponseClaimV1` is an existing opaque presence fence: current store/coordinator code preserves or refuses claimed entries without interpreting that value. It is not an implemented device-authentication or complete single-use response protocol. Preserve its existing behavior; do not silently repurpose it as proof of the proposed contract.

## Caller-visible contract

The phone first receives a request projection, opens its current detail, and submits one allowed response against that exact detail. An expired notification only opens the inbox. It never carries an approval credential or directly performs an action.

Proposed shared schema placement: `packages/protocol/src/permissions/sessionInterruptionV1.ts`, exported through the package's existing public boundary. Proposed mutation name: `session.interruption.respond.v1`, registered through `SESSION_RPC_METHODS` and the existing session RPC router. These are new names for review, not source paths or methods that currently exist.

| Field | Authority and meaning |
|---|---|
| `v` | Explicit version 1; unknown versions cannot authorize an action |
| `machineId`, `backendInstanceId`, `sessionId`, `runId` | Bound by the local executing owner to the actual native backend and session incarnation, independently checked against the addressed session and authenticated connection scope |
| `requestId` | Native pending identity, or an adapter identity proven to address one particular native callback; never recovered from terminal display position |
| `revision`, `actionDigest` | Owner-issued freshness and canonical operation/choice binding; the response echoes the values for the displayed detail |
| `kind`, `allowedResponses` | Typed operation and provider-proven response capabilities; an ordinary message or answer cannot change permission policy |
| `operationId` | Client-generated identity for this decision attempt, bound to the complete request reference, response content and authenticated sender |
| authenticated device identity | Derived by the executing owner from an enrolled key and verified response proof, not accepted from an untrusted `deviceId` string or relay assertion; this mechanism awaits human approval below |

The request's canonical action includes the actual structured operation/input or question/choices and the one-action scope being granted. Cosmetic notification text is not part of its authority. The digest must cover the canonical action that the owner will apply, including material choices and scope. The implementation must define one serialization/digest owner and provenance-backed vectors before adapter writers consume it; no secret, credential or arbitrary environment snapshot belongs in that action.

`runId` identifies the native execution incarnation, not a socket connection, transcript, PID alone or a second process resuming history. A relay or phone reconnect must not invent a new run. If a restarted connector cannot establish the native instance and its current pending inventory, it exposes unknown/unavailable state and accepts no earlier response until reconciliation succeeds. The local native terminal remains usable. The runtime identity producer belongs with the existing session/terminal host; this proposal does not mandate another process, database or persistent lease.

A permission response grants or denies only one pending action. Explicit broader policy changes stay a separate deliberate operation and are outside the initial companion response. Questions reuse `StructuredQuestionAnswersV1`; plan review and input-required errors need explicit provider mappings before becoming actionable. Ordinary messages use the existing message/input owner and its draft-safe queue, never a permission decision or unbound terminal key.

## Validation and arbitration

At the executing owner, before any native effect:

1. Validate the versioned shape and trusted sender authorization for the addressed machine/session. Check revocation through the approved authentication owner.
2. Find the locally owned live pending request. A persisted relay projection or historical cached decision is insufficient to create native authority.
3. Compare every binding field, revision, action digest, response kind and allowed choice with the owner's current request. Reject a mismatch without falling back to legacy RPC or keystrokes.
4. Reuse the request coordinator's admission point for competing remote attempts. A repeated operation with identical sender and canonical content observes its prior result; reusing its identity with different content is rejected. Do not dispatch twice after an uncertain result.
5. Submit to the same native callback/API and observe the provider's authoritative outcome. Local and remote competitors must be arbitrated by that native authority, or by a host proven to observe both paths. A phone lock or CLI-only flag cannot fence a local terminal response.

Operation memory lives with the current request/run owner and its existing lifecycle, not in a new account-wide relay ledger. After that authority is gone, old operations are stale or unverifiable; they are not automatically replayed. Retention, expiry and storage bounds must follow the real owner/provider contract, not a guessed timeout or TTL introduced by this proposal.

Changing an operation or choices invalidates its earlier display binding. Native resolution/cancellation removes that pending authority and updates the existing projection. If an adapter cannot reliably observe local deny/cancel or distinguish repeated identical requests, its remote decision capability remains unavailable. It must not compensate with terminal-text parsing or automatic approval.

## Results and recovery

| Result | What may be shown or done |
|---|---|
| `received` | The executing owner admitted this operation; it is not yet a successful native response |
| `applied` | The native authority confirmed this response for this pending request; a tool's later success/failure is a separate event |
| `resolved` | The request is no longer pending according to native evidence; do not attribute the winning response unless that evidence identifies it |
| `rejected` | Typed unsupported, unauthorized, stale, mismatched, expired or already-resolved result; no new native effect from this operation |
| `indeterminate` | Delivery may have reached the provider but acknowledgement/reconciliation cannot establish the result; disable automatic retries and show the uncertainty |

The proposed public lifecycle is `pending` → `resolving` → a native-supported terminal outcome, with cancellation, expiry, supersession and indeterminate states distinguished. A relay receipt, socket write, completed-state record or `serverRequest/resolved` notification alone must not be promoted into proof that this particular answer was applied.

Reopening the app refreshes the existing pending projection and reconciles against the reachable native owner before enabling a response. Keep delivery deduplication separate from native decision deduplication. Offline decisions are not queued for later automatic execution. When reconciliation is unavailable, retain visible unknown/disconnected state and local terminal control.

## Provider and terminal obligations

| Adapter | Deciding evidence still needed before advertising response capability |
|---|---|
| Native Codex | Actual Windows TUI plus response client on the same backend/thread; native local-first/concurrent arbitration, stale replies and acknowledgement semantics. Two-client transport alone is insufficient |
| Native Claude | A local deny/cancel path while the hook waits; reliable hook invalidation/identity despite missing PermissionRequest tool IDs; response consumption evidence. The corrected lifecycle wrapper does not resolve these gaps |
| Native OpenCode | Pinned server/attached-TUI dialect, exact permission/question identity, native competing decisions and Windows continuity; no version is certified yet |
| Custom adapter | The same explicit capabilities and conformance checks; unsupported structured decisions remain unavailable |

Remote ordinary input must not overwrite or submit a desktop draft. The native input owner either performs a provider-supported insertion with the required semantics or queues until it can prove delivery safe. Screen classification followed by an unrelated write is not atomic evidence. Connector failure must not close the locally useful terminal; terminal-host failure is a separate documented boundary.

## Compatibility and activation

This is a new capability, not a replacement of all upstream session modes. Existing upstream flows can remain where they cannot bypass the companion authority described below; a session-mode label alone does not establish that isolation. For a companion request, both the UI and executing owner must explicitly support this contract and the required native capabilities; missing/malformed support fails closed. Keep provider facts in the canonical agent catalog/provider leaves and feature decisions in their existing owners.

The new client must not silently retry the legacy permission method when the versioned method is missing. A new receiver must reject a legacy response against a companion-bound request, including the legacy structured-question route. Reader support cannot be inferred from a version string alone. A session listing or transcript may remain readable without permission capability.

Keep the new request schema in the existing agent-state/projection corridor; the exact carrier and old-reader behavior require compatibility fixtures before activation. Do not dual-write two independently actionable representations. A historical request read from storage cannot become a live request merely because a newer client can parse it. Unknown opaque fences retain their current fail-closed treatment.

Required directions before enabling the capability: new UI to older CLI safely reports unsupported; older UI to new companion runtime cannot bypass binding through legacy methods; current readers handle historical persisted requests as non-authoritative until reconciled. An older relay may already transport the new encrypted operation without understanding it; establish its actual routing and authorization behavior instead of rejecting it solely by version. Cross-account delegation has additional method authorization and needs its own disposition. Rollback into an older executing runtime is not certified by the current source. Resolve exact supported immutable component/artifact baselines and any reachable stored-data direction under [the compatibility policy](../compatibility.md) before implementation claims support. No database migration or deployed compatibility transition is authorized by this draft.

## Proposed trust boundary for human approval

**Observed gap:** [server socket authentication](../../apps/server/sources/app/api/socket.ts) retains the verified account ID. [RPC forwarding](../../apps/server/sources/app/api/socket/rpcHandler.ts) sends method, params and transport/operation authorization, without an authenticated phone principal. [UI session RPC](../../apps/ui/sources/sync/api/session/apiSocket.ts) and [CLI RPC handling](../../apps/cli/src/api/rpc/RpcHandlerManager.ts) support both encrypted and raw plain params. Neither account access nor possession of a content key identifies a particular phone. The inspected token-cache invalidation and machine-revocation paths do not establish phone revocation.

**Recommendation, not approved implementation:** add locally enrolled device proofs while retaining existing content encryption. The executing computer remains the authority for enrollment, authorization and revocation. A new device must be explicitly enrolled on each computer through an authenticated local pairing flow that binds the intended machine/request verification key and phone public key. A relay-supplied label, recovered account key or unauthenticated legacy pairing response cannot enroll a device.

The phone must verify the executing owner's authenticated request detail before showing an actionable control. Its device proof must bind the complete response, request reference, operation ID and one-action scope. The executing owner verifies that proof against its current enrolled-device authorization before native dispatch. Shared content-key possession alone does not prove request origin, particularly after a revoked phone retains old content keys. Define distinct typed proof purposes for request detail and response; do not reuse machine-registration signatures as approval signatures. This proposal adds authentication, not a new encryption cipher or a relay permission authority.

Initial companion control would require authenticated request details **and** the existing encrypted session transport/projection. Plain sessions would have no companion mutation capability, including approvals, structured answers and ordinary remote input. A signed response alone cannot protect a plain displayed action from relay substitution. Plain companion control requires a separate reviewed confidentiality/request-authentication decision; it is not silently enabled by adding a signature field.

**Activation prerequisite: close alternate remote authority.** [Session registration](../../apps/cli/src/api/session/sessionClient.ts) and [machine registration](../../apps/cli/src/api/apiMachine.ts) install [shared handlers](../../apps/cli/src/rpc/handlers/registerSessionHandlers.ts), including [generic command execution](../../apps/cli/src/rpc/handlers/bash.ts). The session default is OS-user access, and the current machine RPC authorizer does not apply device authentication to those methods. A revoked phone retaining account credentials/content keys could use that route to affect the native process or local trust material. This is a source-derived bypass, not an executed exploit; local file ACLs cannot isolate a process from commands running as its own user.

Before activating companion control, every reachable remote path able to execute code, control the native session, or read/change its trust material must enforce the same approved device authority or be proven unavailable/isolated. Reuse the existing RPC authorization boundary and inventory terminal, filesystem, transfer and metadata/control bypasses. The first pilot may leave unrelated privileged handlers unavailable in the companion runtime rather than implement their new authorization immediately. A legacy session/daemon reachable with the same retained credentials and OS-user authority cannot be waved through as unrelated. Preserving an existing upstream flow is conditional on this boundary holding; this draft does not authorize changes to existing user installations or a general upstream authentication rewrite.

Revocation is enforced by each executing computer before its next dispatch. A device revoked on one computer is not automatically proved revoked elsewhere: the UI must identify each enrolled computer and show an unreachable/unconfirmed revocation explicitly. Local terminal revocation must remain available without the relay or lost phone. Re-enrollment, recovery and any stronger cross-computer revocation promise require explicit semantics; account recovery must not silently restore a revoked device's approval authority.

| Reusable owner | Limit that the implementation must preserve or resolve |
|---|---|
| [UI Ed25519 wrappers](../../apps/ui/sources/encryption/libsodium.lib.ts) and [machine installation proof primitives](../../packages/protocol/src/machines/identity/installationIdentity.ts) | Existing TweetNaCl signing/verification and canonical-byte examples; not an existing phone trust protocol or evidence of an independent cryptographic audit |
| [Terminal provisioning verification](../../apps/cli/src/auth/terminalProvisioningResponse.ts) | Authenticated V3 exists, but default handling also accepts legacy responses marked `authenticated: false`; companion enrollment must not inherit that downgrade |
| [Native secure storage](../../apps/ui/sources/auth/storage/nativeSecureStoreWithDevFallback.ts) | Development fallback can use AsyncStorage; live approval keys cannot silently use that fallback. Hardware backing, non-exportability and biometric behavior remain unverified |
| [CLI installation identity store](../../apps/cli/src/daemon/identity/store.ts) | Existing local persistence owner; Windows skips Unix chmod, so file ACL protection must be established on the actual Windows path, not inferred from POSIX modes |

Reuse these owners where their contracts fit. Do not invent another global identity registry, copy recovery/content keys into a signing role, or introduce a production dependency without review. The exact proof bytes, enrollment exchange, protected local trust storage and revocation update path remain design/validation obligations before a consumed implementation. Ordinary input keeps its existing queue and separate semantics but must consume the same verified device authority; it cannot be an unsigned bypass.

Account-only or relay-asserted device identity does **not** satisfy the current SPEC. Choosing either would require an explicit change to the approved trust requirement. The recommendation above instead asks approval for new device authentication, authenticated local enrollment and per-computer revocation, with encrypted-only initial companion control and the alternate-authority activation prerequisite. No security-sensitive implementation is authorized by committing this draft.

## Human review and verification gates

**Blocked trust decision:** the recommendation above follows the independent tc-ach.7 source review and requires human approval under [SECURITY.md](SECURITY.md). The approved requirement remains device-bound responses; the proposed mechanism and initial encrypted-only control boundary have not been approved. The local enrollment/revocation authority is new behavior, not functionality already delivered by Happier.

Before the first consumed implementation, agree on the authentication source, schema/action canonicalization, native acknowledgement meanings and compatibility activation. Then implement one real provider-to-phone vertical through the owners above. Do not land a dormant protocol framework or let an adapter/mobile worker invent another contract.

Existing regression owners to extend include `permissionRequestCoordinator.test.ts`, `agentStateRequestStore.test.ts`, provider-local permission/response tests, the session RPC transport tests and UI answer-builder tests. Required discriminating cases are a changed run or action, a repeated identical native prompt with an old response, local-first and concurrent decisions, duplicate/conflicting operation IDs, revoked/wrong-device identity, legacy-method bypass, reply loss after native application, provider disconnect and draft preservation. Use real internal owners and mock only the external transport/provider/OS boundaries; native Windows and physical Android remain separate required live gates.

Validation of this draft is source/diff/link review only. No new protocol test, native run, authenticated device test or compatibility matrix has passed. The next implementation must record meaningful RED/GREEN, package gates and the exact loaded native/Android/relay identities in Beads. No product acceptance item is closed by this proposal.
