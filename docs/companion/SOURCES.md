# Source register

Checked 2026-10-14. Primary sources only. Moving `dev`/`main` documentation may not match a particular installed binary. The bootstrap records the actual fork SHA and tool versions; the runtime compatibility spikes are authoritative for this project.

## Happier

- Repository: https://github.com/happier-dev/happier
- License: https://raw.githubusercontent.com/happier-dev/happier/dev/LICENCE
- Contributor/source-run guidance: https://raw.githubusercontent.com/happier-dev/happier/dev/CONTRIBUTING.md
- Existing agent constitution: https://raw.githubusercontent.com/happier-dev/happier/dev/AGENTS.md
- Scripts, workspaces, Yarn pin: https://raw.githubusercontent.com/happier-dev/happier/dev/package.json
- Repo-local isolation: https://docs.happier.dev/self-hosting/repo-local
- OpenCode integration: https://docs.happier.dev/agents/opencode
- Codex integration: https://docs.happier.dev/agents/codex
- Claude unified terminal: https://docs.happier.dev/sessions/claude-unified-terminal

These support reuse candidates, not a claim that simultaneous native Windows control is verified. Upstream describes `dev` as integration, `preview` as release-candidate, and `main` as stable; this fork samples and records `dev` for an initial audit.

## Codex development workflow

- Agent instructions: https://developers.openai.com/codex/agent-configuration/agents-md
- Subagents: https://developers.openai.com/codex/agent-configuration/subagents
- Worktrees: https://developers.openai.com/codex/environments/git-worktrees
- CLI reference: https://developers.openai.com/codex/cli/reference
- Skills: https://developers.openai.com/codex/build-skills
- App Server: https://developers.openai.com/codex/app-server

Use installed CLI help for current flags. Do not assume a delegated subagent has a private working directory.

## Beads (explicit bootstrap target: v1.3.1)

- Release: https://github.com/gastownhall/beads/releases/tag/v1.3.1
- Installation: https://raw.githubusercontent.com/gastownhall/beads/v1.3.1/docs/getting-started/installation.md
- Server modes and Dolt 2.2.0 compatibility pin: https://raw.githubusercontent.com/gastownhall/beads/v1.3.1/docs/architecture/dolt.md
- Init flags: https://raw.githubusercontent.com/gastownhall/beads/v1.3.1/cmd/bd/init.go
- Create/dependency flags: https://raw.githubusercontent.com/gastownhall/beads/v1.3.1/cmd/bd/create.go
- List and external-ref filtering: https://raw.githubusercontent.com/gastownhall/beads/v1.3.1/cmd/bd/list.go
- Claim/update behavior: https://raw.githubusercontent.com/gastownhall/beads/v1.3.1/cmd/bd/update.go
- Heartbeat semantics: https://raw.githubusercontent.com/gastownhall/beads/v1.3.1/cmd/bd/heartbeat.go
- Actor environment resolution: https://raw.githubusercontent.com/gastownhall/beads/v1.3.1/cmd/bd/main.go
- Worktree discovery (moving docs): https://beads.gascity.com/reference/worktrees
- Agent setup (moving docs): https://beads.gascity.com/getting-started/ide-setup

Use the explicit direct-server mode. Do not rely on conflicting/default-topology descriptions across releases. This plan deliberately avoids eventual-replica claims as a global lock and avoids legacy JSONL/sync-branch workflows.

## GitHub, Dolt, and Android

- Fork command: https://cli.github.com/manual/gh_repo_fork
- Fork visibility: https://docs.github.com/en/pull-requests/reference/forks
- Actions permissions API: https://docs.github.com/en/rest/actions/permissions
- Dolt installation: https://www.dolthub.com/docs/introduction/installation/
- Dolt 2.2.0 release: https://github.com/dolthub/dolt/releases/tag/v2.2.0
- Dolt SQL-server CLI: https://www.dolthub.com/docs/cli-reference/cli/
- Expo push setup: https://docs.expo.dev/push-notifications/push-notifications-setup/
- Firebase message encryption boundary: https://firebase.google.com/docs/cloud-messaging/customize-messages/set-message-type
- Firebase Android priority/Doze: https://firebase.google.com/docs/cloud-messaging/android/message-priority

## Interpretation

The architecture, workflow, task breakdown, and acceptance matrix in this pack are proposed engineering decisions for the user's stated requirements. References are not evidence of a successful build, product validation, security audit, or performance guarantee.
