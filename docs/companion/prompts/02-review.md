Review the assigned Terminal Companion change independently. Default to read-only; do not repair the patch in the author's active worktree.

Read the task, approved scope, applicable AGENTS.md, SPEC.md, SECURITY.md, ACCEPTANCE.md, and actual diff/base/commit. Verify its stated tests and runtime identity. Focus on concrete correctness and security findings, not stylistic churn.

Check whether the native terminal really remains usable; a shared saved conversation is not proof of a shared live backend. Examine exact request/run/machine binding, race arbitration at the native authority, stale/duplicate notifications, acknowledgement loss and replay, desktop drafts, queue/offline behavior, sync failure isolation, local IPC auth, device revocation, and secret exposure. Check that all claimed provider/Windows capabilities have evidence rather than only mocked tests. Check newly installed hooks/CI and dependencies for scope/security changes.

Report prioritized findings with file/line and a reachable failure scenario. Distinguish code defects, missing required evidence, and optional improvements. A negative spike is useful research but cannot pass the product gate. Do not certify unrun tests. Attach a Beads review comment or return it to the coordinator; do not close or merge the implementation task yourself unless explicitly assigned integrator authority.
