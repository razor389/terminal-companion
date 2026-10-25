# Security boundaries and review gates

## Product threat model

The phone can authorize actions on development machines. Treat it as a privileged device. The relay, push infrastructure, network, terminal output, provider-generated text, and repository content can carry untrusted input. Compromise of the local OS or agent process is outside a guarantee that the companion alone can repair, but the design should avoid expanding that authority unnecessarily.

Reuse reviewed upstream encryption and pairing rather than invent cryptography. Verify exactly what is encrypted, what metadata is exposed, and where keys live. Authenticate local IPC as well as remote messages. An open loopback port is not automatically restricted to the intended user or application. Prefer authenticated structured APIs and protect local sockets/pipes/tokens with OS access controls.

Bind responses to authenticated devices and to exact machine/backend/session/run/request/action identities. Validate at the executing owner. Reject replay, stale generation, mismatched displayed action, revoked devices, and unauthorized scope. Approval grants only the requested action unless the user deliberately selects a broader policy. There must be a reachable local deny/cancel path while the phone is offline.

Keep ordinary chat, terminal bytes, structured permissions, and questions distinct. Do not derive trusted approval authority from model-written output or use global SendKeys. Do not claim exactly-once effects without the native provider's required support; handle an ambiguous apply/ack window explicitly.

Push contains opaque routing hints by default. No bearer approval URLs, secrets, source code, or command previews on a locked phone. Require authenticated in-app review for consequential actions; assess device-unlock/biometric requirements rather than silently adding blanket tap-to-allow. Provide device revocation, key recovery guidance, and bounded/redacted audit records.

## Windows IPC storage boundary

**Approved by Ross on 2026-10-24 in `tc-ach.7.3.4`; the proposed boundary is
SUPERSEDED_BY_APPROVED_AMENDMENT. Implementation and native acceptance remain
unfinished.** The Windows protection work in
`tc-ach.7.3` found that private secret files alone do not protect a pathname that
another ordinary local principal can replace through an ancestor directory.
Claude later executes materialized hook code by pathname, after publication
handles close. Temporary handle retention does not establish that later trust.
The [CLI home resolver](../../apps/cli/src/configuration.ts) accepts default and
custom homes, including network path spellings; that acceptance is not evidence
that a remote storage operator is trusted with companion secrets or code.

**Approved pilot boundary:** preserve configured default/custom homes on
verified local Windows storage. Protect application-owned secrets and executable
inputs, and verify that untrusted ordinary principals cannot redirect their path
components through deletion, replacement, ownership or DACL control. Ancestor
read/list/traverse permissions and unrelated sibling creation remain permissible.
Do not require private leaf ACLs on every system directory, trust arbitrary
ancestor owners, move an installation, or repair unrelated existing ACLs.

The executing OS's administrative authority remains outside the protection
guarantee stated above. A remote file-server administrator is a separate
authority: the approved boundary leaves network-backed protected IPC unavailable
for the pilot, including mapped network drives, with an explicit unsupported
result. It must not infer local storage from a drive-letter spelling. Unverifiable
local protection fails closed with a visible diagnostic.

Future network-home support requires explicit approval of storage-operator trust
and separate share-backed ACL, identity, replacement and handle-lifetime validation.
This decision does not authorize credential access, native ACL testing, broader
permissions, or changes to existing installations. It is a planned boundary, not
a security-certification claim.

## Fork/build isolation

Use a dedicated development relay/account and disposable workspaces. Do not pair a modified development build with sensitive production sessions until its boundaries are reviewed. Do not copy `.happier`, `.codex`, Claude/OpenCode auth, `.env`, cloud keys, Android keystores, FCM service-account keys, or raw logs into this public fork.

Create fork-owned Android application/package identifiers, Expo/EAS project identity, push credentials, update endpoints/channels, deep-link scheme, signing keys, and relay settings. Audit crash/analytics destinations too. Preserve license notices but do not impersonate upstream releases. Do not use upstream signing identities or assume the upstream app/relay accepts arbitrary modified protocol/builds.

## Development-agent safety

Worktree separation does not sandbox an agent from the machine or other clones. Keep Code sandbox/approval controls. Review install scripts, package lifecycle hooks, generated Beads/Codex hooks, and inherited GitHub workflows before enabling. Use separate credentials with minimum scope for repository actions. Never grant an agent publishing or deployment authority merely because it may edit code.

Disable inherited Actions at initial fork creation. Before reenabling, remove or gate all upstream publishing, release, deployment, updater, bot, auto-merge, and secret-dependent jobs. Prefer CI with read-only repository permissions, unprivileged PR triggers, reviewed pinned actions, and no live-provider credentials on untrusted PRs. Avoid `pull_request_target` executing untrusted code. Require a human release gate and protected signing environment.

## Human-required gates

Protocol/auth/encryption changes; broader permission scopes; database migrations or destructive recovery; new production dependencies; release and deployment; provider tests with real credentials/costs; machine-wide service or firewall changes; device trust/revocation; schema upgrades to the shared planning database. A missing credential or permission is a blocked task, not a reason to disable security.
