#!/usr/bin/env node
/** Import a reviewed seed into an already-initialized Beads workspace. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeBdRunner, runProgram, parseJson, validateSeed, seedTasks } from './lib.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let lockFd, lockPath, tempDir;
try {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && !['--apply','--dry-run'].includes(args[0]))) throw new Error('Usage: node tools/companion/seed-beads.mjs [--dry-run | --apply]');
  const seed = JSON.parse(fs.readFileSync(path.join(repo, 'docs/companion/bootstrap-beads.json'), 'utf8'));
  const tasks = validateSeed(seed);
  console.log(`Namespace: ${seed.namespace}; expected Beads ${seed.beadsVersion}; prefix ${seed.expectedPrefix}`);
  if (args[0] !== '--apply') {
    for (const t of tasks) console.log(`${t.key} [P${t.priority}] ${t.title}; blocked by: ${t.depends_on.join(', ') || 'none'}`);
    console.log(`Dry run: ${tasks.length} seed records validated. No commands sent to Beads and no files changed.`);
  } else {
    if (!process.env.BEADS_ACTOR?.trim()) throw new Error('Set BEADS_ACTOR to the coordinator identity before seeding.');
    const root = runProgram('git', ['rev-parse','--show-toplevel'], { cwd: repo });
    if (fs.realpathSync(root) !== fs.realpathSync(repo)) throw new Error('Tool must be installed at the Git worktree root.');
    const local = path.join(repo, '.companion-local');
    if (fs.existsSync(local) && fs.lstatSync(local).isSymbolicLink()) throw new Error('.companion-local cannot be a symlink.');
    fs.mkdirSync(local, { recursive: true });
    lockPath = path.join(local, 'seed.lock');
    try { lockFd = fs.openSync(lockPath, 'wx'); }
    catch { throw new Error('Seed lock exists or cannot be created. Verify no seeder is active; do not remove another process\'s lock.'); }
    fs.writeFileSync(lockFd, JSON.stringify({ pid: process.pid, actor: process.env.BEADS_ACTOR, startedAt: new Date().toISOString() }));
    const bd = makeBdRunner({ cwd: repo });
    const version = bd(['version']);
    const detected = version.match(/\b(\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?)\b/)?.[1];
    if (detected !== seed.beadsVersion) throw new Error(`Expected Beads ${seed.beadsVersion}, got ${version}. Review an upgrade separately.`);
    console.log('Workspace:\n' + bd(['where']));
    const prefix = bd(['config','get','issue_prefix']).trim().replace(/^"|"$/g, '');
    if (prefix !== seed.expectedPrefix) throw new Error(`Expected issue prefix ${seed.expectedPrefix}; got ${prefix}. Refusing to seed another project.`);
    const existing = parseJson(bd(['list','--all','--limit','0','--json','--external-contains',seed.namespace + '/']), 'bd list');
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'companion-beads-'));
    const ids = seedTasks(seed, existing, (task, context) => {
      const bodyFile = path.join(tempDir, `${task.key}.md`);
      const body = `${task.description}\n\nAcceptance criteria:\n${(task.acceptance ?? []).map(x => '- ' + x).join('\n')}\n`;
      fs.writeFileSync(bodyFile, body, { encoding: 'utf8', mode: 0o600 });
      const command = ['create','--title',task.title,'--type',task.type,'--priority',String(task.priority),
        '--external-ref',context.externalRef,'--body-file',bodyFile,'--json'];
      if (context.parentId) command.push('--parent',context.parentId);
      if (context.dependencyIds.length) command.push('--deps',context.dependencyIds.join(','));
      return parseJson(bd(command), `bd create ${task.key}`);
    }, (task, id, created) => console.log(`${created ? 'Created' : 'Kept'} ${task.key} -> ${id}`));
    const output = path.join(local, 'beads-seed-map.json');
    if (fs.existsSync(output) && fs.lstatSync(output).isSymbolicLink()) throw new Error('ID map cannot be a symlink.');
    fs.writeFileSync(output, JSON.stringify({ namespace: seed.namespace, ids }, null, 2) + '\n', 'utf8');
    console.log(`Seed complete. Actual Beads IDs: ${output}\nUse Beads for live status; do not maintain status in the seed file.`);
  }
} catch (error) {
  console.error(`ERROR: ${error.message}`); process.exitCode = 1;
} finally {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  if (lockFd !== undefined) { fs.closeSync(lockFd); fs.unlinkSync(lockPath); }
}
