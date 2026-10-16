# Security boundaries and review gates

## Product threat model

The phone can authorize actions on development machines. Treat it as a privileged device. The relay, push infrastructure, network, terminal output, provider-generated text, and repository content can carry untrusted input. Compromise of the local OS or agent process is outside a guarantee that the companion alone can repair, but the design should avoid expanding that authority unnecessarily.

Reuse reviewed upstream encryption and pairing rather than invent cryptography. Verify exactly what is encrypted, what metadata is exposed, and where keys live. Authenticate local IPC as well as remote messages. An open loopback port is not automatically restricted to the intended user or application. Prefer authenticated structured APIs and protect local sockets/pipes/tokens with OS access controls.

Bind responses to authenticated devices and to exact machine/backend/session/run/request/action identities. Validate at the executing owner. Reject replay, stale generation, mismatched displayed action, revoked devices, and unauthorized scope. Approval grants only the requested action unless the user deliberately selects a broader policy. There must be a reachable local deny/cancel path while the phone is offline.

Keep ordinary chat, terminal bytes, structured permissions, and questions distinct. Do not derive trusted approval authority from model-written output or use global SendKeys. Do not claim exactly-once effects without the native provider's required support; handle an ambiguous apply/ack window explicitly.

Push contains opaque routing hints by default. No bearer approval URLs, secrets, source code, or command previews on a locked phone. Require authenticated in-app review for consequential actions; assess device-unlock/biometric requirements rather than silently adding blanket tap-to-allow. Provide device revocation, key recovery guidance, and bounded/redacted audit records.

## Fork/build isolation

Use a dedicated development relay/account and disposable workspaces. Do not pair a modified development build with sensitive production sessions until its boundaries are reviewed. Do not copy `.happier`, `.codex`, Claude/OpenCode auth, `.env`, cloud keys, Android keystores, FCM service-account keys, or raw logs into this public fork.

Create fork-owned Android application/package identifiers, Expo/EAS project identity, push credentials, update endpoints/channels, deep-link scheme, signing keys, and relay settings. Audit crash/analytics destinations too. Preserve license notices but do not impersonate upstream releases. Do not use upstream signing identities or assume the upstream app/relay accepts arbitrary modified protocol/builds.

## Development-agent safety

Worktree separation does not sandbox an agent from the machine or other clones. Keep Code sandbox/approval controls. Review install scripts, package lifecycle hooks, generated Beads/Codex hooks, and inherited GitHub workflows before enabling. Use separate credentials with minimum scope for repository actions. Never grant an agent publishing or deployment authority merely because it may edit code.

Disable inherited Actions at initial fork creation. Before reenabling, remove or gate all upstream publishing, release, deployment, updater, bot, auto-merge, and secret-dependent jobs. Prefer CI with read-only repository permissions, unprivileged PR triggers, reviewed pinned actions, and no live-provider credentials on untrusted PRs. Avoid `pull_request_target` executing untrusted code. Require a human release gate and protected signing environment.

## Human-required gates

Protocol/auth/encryption changes; broader permission scopes; database migrations or destructive recovery; new production dependencies; release and deployment; provider tests with real credentials/costs; machine-wide service or firewall changes; device trust/revocation; schema upgrades to the shared planning database. A missing credential or permission is a blocked task, not a reason to disable security.
