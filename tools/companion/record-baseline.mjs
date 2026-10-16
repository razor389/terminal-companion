#!/usr/bin/env node
/** Record the chosen source snapshot before the starter's first commit. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runProgram } from './lib.mjs';
try {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const git = args => runProgram('git', args, { cwd: root });
  if (fs.realpathSync(git(['rev-parse','--show-toplevel'])) !== fs.realpathSync(root)) throw new Error('Install at the worktree root first.');
  const output = path.join(root, 'docs/companion/UPSTREAM_BASELINE.json');
  if (fs.existsSync(output)) throw new Error('Baseline already exists. Do not rewrite provenance; record later upstream updates separately.');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const record = {
    recordedAt: new Date().toISOString(), sourceCommit: git(['rev-parse','HEAD']),
    branchAtRecording: git(['branch','--show-current']),
    packageManagerAtSnapshot: pkg.packageManager ?? null,
    nodeUsedForRecording: process.version,
    note: 'Snapshot selected before the starter commit. Not a build, runtime compatibility, or security certification.',
    compatibility: { windows: 'not yet tested', android: 'not yet tested', codex: 'not yet tested',
      claude: 'not yet tested', opencode: 'not yet tested' }
  };
  fs.writeFileSync(output, JSON.stringify(record,null,2) + '\n', { encoding:'utf8', flag:'wx' });
  console.log(`Recorded ${record.sourceCommit} in ${output}`);
} catch (error) { console.error(`ERROR: ${error.message}`); process.exitCode = 1; }
