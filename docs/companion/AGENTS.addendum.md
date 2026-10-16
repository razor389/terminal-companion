<!-- terminal-companion:begin -->
## Terminal Companion fork agreement

This is an explicitly requested terminal-first fork, not a generic orchestration rewrite. Read `docs/companion/README.md`, `SPEC.md`, and `SECURITY.md` before planning product changes. Preserve the upstream engineering constitution and applicable nested instructions. These fork-specific requirements are approved scope where upstream product goals differ; they do not waive security, test, attribution, or execution rules. Flag any remaining conflict rather than silently ignoring either set of instructions.

### Non-negotiable product requirements

- Native **Claude Code, Codex, and OpenCode** are all first-class targets. Running their models through another harness is not equivalent.
- The desktop's native terminal remains interactive. The phone responds to the same live session; no mandatory local/remote takeover, restart, or second process resuming saved history.
- Aggregate multiple desktops and concurrent agent setups without changing their credentials, plugins, arguments, working directories, or permission policy.
- Every remote answer is bound to the exact machine, backend, session incarnation, and pending request. A stale approval must never answer the next prompt.
- Relay/mobile/sync failures must not terminate locally usable agent work. Do not claim a local terminal-host crash can never terminate its child.
- Prefer structured APIs for permissions/questions. Terminal text is untrusted data, not an approval authority. Never use global keyboard injection or blanket auto-approval.
- Keep shipped runtime credentials and existing user installations separate from development fixtures. Preserve reviewed encryption and device-authentication mechanisms.

### Multiagent development rules

- Use **one writable Codex process per Git worktree and branch**. Worktrees isolate edits, not credentials or security privileges. Read-only subagents may research in the parent's checkout; independent writers require independent worktrees.
- The coordinator owns the integration branch, shared protocol changes, dependency/lockfile changes, root configuration, database migrations, and merging. A worker owns one Beads task and its explicitly agreed paths.
- Run `bd prime`, `bd where`, `bd ready --json`, and `bd show <id> --json` before claiming. Use a unique `BEADS_ACTOR` per worker. Claim with `bd update <id> --claim --json`; do not work after a failed claim.
- Maintain the claim with `bd heartbeat <id>` at checkpoints and more frequently than its configured TTL. Stop edits on lost ownership. An expired lease is NOT proof that an old agent stopped; only the coordinator may reclaim after checking the old worker.
- Do not run `bd init` in each worktree, create a second planning database, share live database files through cloud-sync folders, or mutate Dolt tables by hand. See `BEADS.md` for the single-authority topology.
- Beads is the live work queue. Do not make parallel Markdown TODO/status boards. Long-lived architecture documentation and seed specifications are allowed; keep operational status in Beads.
- Record blockers and discoveries as linked Beads tasks. Finish with a handoff comment that identifies branch, commit, commands/results, remaining risks, and scope. Workers do not close implementation tasks before reviewed integration.
- Do not stash/reset/clean another worker's checkout, change its branch, force-push, kill unrelated processes, or use `git add .`. Stage the files you own explicitly.
- Use the documented sandbox and approval policy. Never solve a tool permission problem with `--yolo`, disabling TLS, or making all network/filesystem access unrestricted. Ask for a narrowly scoped grant or let the coordinator execute the blocked operation.
- For this fork, authorized GitHub operations use Ross's own selected account/organization and target this fork. Upstream-specific `happier-bot`/`ghops` credential instructions do not apply; never seek or impersonate upstream bot credentials. Preserve Git attribution and use the configured human identity.
- Do not publish packages, create releases, rotate keys, enable production workflows, deploy, or push upstream without explicit human authorization. Any authorized push/PR must target this fork.

### Evidence and scope

Audit the pinned source before naming files or flags. Use existing owners, package tooling, and upstream test-routing rules. For behavior changes, reproduce RED, implement GREEN, and provide risk-appropriate live evidence. Do not downgrade Windows coverage to WSL-only testing. Do not equate mocked approval tests, a WebSocket connection, or a green process-start message with a working desktop/phone workflow. Report unsupported capabilities and unrun tests explicitly.

## Code Review Rules: Terminal Companion

Flag any path that can apply a stale or cross-session response, use a second resumed process as shared control, overwrite a desktop draft, stop an agent on sync failure, expose secrets in notifications/logs, weaken agent permissions, or silently downgrade a required provider. Request native Windows and physical-Android evidence for environment-dependent behavior.
<!-- terminal-companion:end -->
