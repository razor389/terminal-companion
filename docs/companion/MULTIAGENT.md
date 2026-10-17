# Working with several Codex agents

## Start small

Begin with one bootstrap coordinator. After its audit is reviewed, use one coordinator and two implementation workers. Add workers only when there are independently owned, unblocked tasks and machine resources permit. Read-only exploration/review subagents can help without adding more simultaneous writers.

A separate chat is not filesystem isolation. Every independent writer gets one Git branch and one Git worktree. All same-clone worktrees intentionally share one Beads workspace. Git metadata, caches, credentials, and databases may still be shared; worktrees are not security sandboxes.

## Worktree creation (PowerShell)

From the clean integration checkout after the scaffold/audit is committed:

```powershell
$Repo = (Get-Location).Path
New-Item -ItemType Directory -Force "..\terminal-companion-wt" | Out-Null
git worktree add -b agent/opencode-spike "..\terminal-companion-wt\opencode" companion/main
git worktree add -b agent/codex-spike "..\terminal-companion-wt\codex" companion/main
```

Choose a branch for one task, not a permanent all-purpose agent branch. A new terminal for each worktree:

```powershell
Set-Location "$HOME\projects\terminal-companion-wt\opencode"
$env:BEADS_ACTOR = 'ross-desktop1-codex-opencode'
bd.cmd --sandbox where
bd.cmd --sandbox prime
codex.cmd --sandbox workspace-write --ask-for-approval on-request -c project_doc_max_bytes=131072
```

Paste `prompts/01-worker.md` with the actual Beads ID and approved path scope. The worker claims the task itself; the coordinator should not claim it under a different identity and then leave the worker unable to use it.

For a noninteractive worker, the installed Codex CLI supports an explicit working root. From its worktree, set the unique actor as above and provide a self-contained approved brief:

```powershell
$WorkerPath = (Get-Location).Path
Get-Content '.companion-local\worker-brief.md' -Raw | codex.cmd --ask-for-approval on-request exec -C $WorkerPath --sandbox workspace-write -c project_doc_max_bytes=131072 -
```

Keep the process/session handle and its output for review and resumption. Existing worktrees do not need `--worktree`; `--add-dir` grants access rather than choosing the working root. Built-in subagents that share the coordinator's directory are suitable for read-only review, not independent writing. If the execution frontend cannot service a permission request, return the exact blocked operation to the coordinator; do not bypass sandbox or hook-trust controls.

`BEADS_ACTOR` is a task-tracker actor, not your Git author identity or an authentication boundary. Keep real human Git identity. Do not copy personal authentication into the repo.

## Task loop

Read instructions and the task, inspect dependencies and current ownership, then claim atomically. Refresh the claim more frequently than its TTL. Recheck ownership before edits after long waits. Make one focused change, with the upstream RED/GREEN workflow, then run the touched owner checks. Record discovered work separately rather than expanding the patch indefinitely.

Use `bd comments add <id> -f <handoff-file>` to attach a durable handoff. Templates live in `templates/`; fill a handoff under ignored `.companion-local/` and submit it as a comment. An implementation task stays open/in-progress while review and integration remain outstanding. The coordinator manages the handoff/reassignment and any lease during review; it does not run an automatic reclaimer.

Only the coordinator closes the task after the change is reviewed, integrated, and its acceptance evidence is applicable to that integrated revision. A research spike can close with a reviewed negative result, but a provider implementation gate remains blocked until the product requirement is actually satisfied.

## Shared state and conflicts

Do not run repository-wide autoformatters or dependency upgrades in ordinary worker tasks. Protocol changes, lockfiles, schema migrations, generated files, root config, and shared test fixtures require one named owner. A consumer task should depend on the producing task's merged contract.

Never reset/stash/clean another worktree. Do not globally stop Node, Bun, Codex, Claude, OpenCode, or Dolt processes. Assign unique development ports and per-worktree runtime directories; verify upstream repo-local isolation rather than assume every subprocess inherits it. Dependency installs must not rewrite the lockfile outside a dedicated task.

Native Windows is a target. Linux/WSL can host coordination or general development, but do not use the same checkout through Windows and WSL tooling simultaneously. Keep a separate native Windows checkout for Windows validation and report its actual environment.

## Sandbox and external tools

Local Dolt TCP access and shared Git/Beads directories may require scoped permission. Grant only the needed command/path/connection, or have the coordinator run that operation. `--add-dir` grants filesystem access; it does not enable network access. Do not set global unrestricted access to avoid a local database prompt. Installing packages and running provider integrations can execute untrusted code or incur costs; use dedicated development credentials and explicit human approval.

## Multiple development desktops

The product must support multiple desktops from the beginning. Development coordination can initially stay on one desktop. For workers on another desktop, use another Git clone for code and a single reachable planning authority: preferably run the planning commands on the coordinator over authenticated SSH, or set up an authenticated/tunneled connection to the SAME Dolt database with validated project identity. Never copy live database directories or assume Git push synchronizes task claims.

Separate replicated Beads databases with pull/push are eventually synchronized; an atomic claim in one replica is not a global exclusive claim. Until a remote topology is validated, have the coordinator allocate disjoint tasks and own Beads mutations for remote workers. This is an explicit conservative operating model, not a distributed-lock implementation.

## Merge practice

Workers commit only their owned files and push/open draft PRs only when authorized, targeting the fork and `companion/main`. Review another worker's branch in a separate review worktree or through its diff; do not switch their active checkout. Integrate one PR at a time, rerun affected checks, and keep a rollback-sized change. Do not force-push shared branches. Remove a worktree only after its worker has stopped, its work is preserved, and the coordinator confirms it is no longer needed.
