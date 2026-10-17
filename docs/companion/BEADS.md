# Beads setup and operating policy

Beads is a DEVELOPMENT tracker, not part of the mobile product runtime. This pack targets **Beads 1.3.1** and the **Dolt 2.2.0** pin documented with that release. Sources: `SOURCES.md`. Defaults and newer releases can differ; use explicit server-mode flags and inspect installed `--help`. Do not upgrade a shared database opportunistically from a worker.

## Initial topology

One development desktop runs one loopback-only Dolt server for this project. The integration checkout contains one `.beads` workspace. All same-clone Git worktrees resolve that workspace. Use a new database name (`terminal_companion`) and prefix (`tc`), not an unrelated existing project.

Dolt persistence is outside the Git worktree. Never put the live database in OneDrive, Dropbox, a network share, a ZIP for another worker, or ordinary Git commits. A public fork also makes pushed planning data public; do not push confidential Beads history to it.

## Install and verify

These are initial setup commands, not a session-start checklist. Reuse an existing verified workspace/server; do not reinstall or initialize it when resuming. On native PowerShell use `bd.cmd` (and `npm.cmd` when installation is approved) so execution policy does not select the PowerShell shim. Do not change execution policy to run a shim.

```powershell
npm.cmd install -g @beads/bd@1.3.1
bd.cmd version
```

Install the official **Dolt 2.2.0 Windows release** with approval. The release and installation links are in `SOURCES.md`. Verify the distributed artifact using available official checksum/signature information before running it. Set `$DoltExe` to that verified executable's absolute path and invoke it explicitly when PATH resolves another version. A PATH version check does not establish the running server's version. Do not use a random mirror, an unpinned latest installer, or a source build as the default workaround.

```powershell
& $DoltExe version
bd.cmd init --help
bd.cmd update --help
bd.cmd heartbeat --help
```

## Run the database visibly first

For a new setup only, in a dedicated PowerShell terminal with `$DoltExe` set as above:

```powershell
$DoltData = Join-Path $HOME '.terminal-companion-dev\dolt'
New-Item -ItemType Directory -Force $DoltData | Out-Null
Set-Location $DoltData
& $DoltExe sql-server --host 127.0.0.1 --port 3308
```

Keep that terminal open during development. The audited workspace uses port 3308; when resuming, read its metadata and reuse the verified server rather than starting another one. For a new setup, if the chosen port is occupied, do not kill the other process: choose a free loopback port and use that same port in every client. Do not expose this root/default development server to your LAN or the internet. Loopback-only development trusts local OS users; it is not a multi-tenant secure database deployment.

In the integration checkout, initialize ONCE, after confirming no unrelated `.beads` exists:

```powershell
$env:BEADS_ACTOR = 'ross-coordinator'
git config beads.role maintainer
bd.cmd init --server --external --server-host 127.0.0.1 --server-port 3308 --database terminal_companion --prefix tc --skip-agents --skip-hooks
bd.cmd where
bd.cmd doctor
bd.cmd ready --json
```

If an existing workspace is found, stop and inspect it. Do not add `--force`, delete state, or silently migrate it. `maintainer` here describes your role in your OWN fork, not permission on upstream.

The two skip flags avoid unrelated instruction and Git-hook mutations during initialization. Inspect generated `.beads` files and `.git/info/exclude` before committing: fork detection can exclude planning files. Force-add only reviewed non-secret metadata/config/.gitignore if you intentionally track them; never force-add the whole directory or database contents. No Git operation constitutes a Beads data backup.

## Install the Codex integration deliberately

```powershell
bd.cmd setup codex
bd.cmd setup codex --check
git diff -- AGENTS.md .codex .agents
git status --short
```

Review generated skill/hook code and any tracked or untracked settings before trusting it. Preserve the Terminal Companion addendum and upstream guidance. Do not accept a managed setup that overwrites unrelated config. Project hook execution needs the client to trust the reviewed sources. For mixed development harnesses, `bd setup claude` and `bd setup opencode` are optional and should receive the same diff review; they are not needed merely because those providers are product targets.

Git hooks are optional at this stage. If you install them later, inspect the existing hook manager and use a compatible chain; do not overwrite upstream hooks. No legacy separate `beads-sync` branch is needed for this workflow.

## Seed the initial work

```powershell
node tools/companion/seed-beads.mjs --dry-run
node tools/companion/seed-beads.mjs --apply
bd.cmd ready --json
```

Only the coordinator runs the seeder, while other workers are paused. It checks the CLI version and the expected `tc` prefix, uses a local exclusive lock, then creates tasks in dependency order with stable external references. Re-running resumes after a partial failure and skips existing seed records. It never reopens or overwrites an existing task. It is not a cross-machine distributed lock and does not reconcile a changed seed file. Once imported, edit tasks through Beads rather than expecting seed changes to update them.

The returned ID map is written to ignored `.companion-local/beads-seed-map.json`. IDs are generated by Beads; `C01`, etc. are seed keys, NOT real issue IDs.

## Daily worker commands

```powershell
$env:BEADS_ACTOR = 'ross-desktop1-codex-opencode'
bd.cmd --sandbox where
bd.cmd --sandbox prime
bd.cmd --sandbox ready --json
bd.cmd --sandbox show tc-REPLACE --json
bd.cmd --sandbox update tc-REPLACE --claim --json
bd.cmd --sandbox heartbeat tc-REPLACE
bd.cmd --sandbox comments add tc-REPLACE 'Branch agent/opencode-spike; native Windows spike; agreed scope recorded in task.'
```

Replace the issue ID with the real value. Beads' `--sandbox` disables automatic Dolt pushes; it does not replace Codex filesystem/network controls. Stop if claim or heartbeat fails. The documented claim lease default is five minutes in the targeted release; inspect the actual configuration and heartbeat more frequently. Run heartbeat at checkpoints and around long commands. For longer unattended actions, arrange an explicitly supervised heartbeat or pause the worker; do not keep a detached heartbeat alive forever after its worker dies.

Initially do NOT automate `bd reclaim`. Before reassignment, the coordinator verifies that the old writer has stopped, preserves its branch/changes, and uses the supported unclaim/reassignment path. Expiry is not process fencing. Beads cannot physically prevent an old Codex process from editing its files.

Use `bd comments add <id> -f <file>` for handoffs. Keep in-progress tasks out of the ready pool until reviewed integration. The coordinator manages review ownership and closes with an explicit reason after acceptance is met; do not use `--force` to bypass blockers.

## Persistence, backups, and synchronization

The Dolt database is the task store. Git commits preserve code and selected planning configuration. `.beads/issues.jsonl`, when exported, is interchange, not a complete database backup. Server-mode writes may be persisted without a Dolt history checkpoint; one coordinator owns checkpoint/push/backup operations while writers are quiescent.

Inspect `bd backup --help`, `bd backup init --help`, and `bd backup status` on the pinned build. For the direct-server workspace, configure a supported backup destination, run a backup, then verify restore into an isolated test workspace/server before relying on it. A folder on the same disk is only a local recovery copy. Never overwrite the live database to test restore.

`bd dolt push` / `bd dolt pull` are separate from Git push/pull and require a deliberately configured Dolt remote. Do not automatically push Beads history to a public fork. A private planning remote or a protected external backup is preferable for private development notes. Keep remotes, credentials, and access controls explicit.

For multiple desktops, see `MULTIAGENT.md`. Only one designated coordinator performs schema upgrades and backups. Record versions and restore procedures first. Do not allow several workers to migrate the same database.
