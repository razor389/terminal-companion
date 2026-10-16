/** Local development utilities; no third-party dependencies or network calls. */
import { spawnSync } from 'node:child_process';

export function psLiteral(value) {
  return "'" + String(value).replaceAll("'", "''") + "'";
}
export function runProgram(command, args = [], { cwd = process.cwd(), env = process.env, timeout = 120_000 } = {}) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', timeout,
    maxBuffer: 16 * 1024 * 1024, windowsHide: true, shell: false });
  if (result.error) throw new Error(`${command}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${command} exited ${result.status ?? result.signal}:\n${result.stderr || result.stdout}`);
  // Never discard stderr diagnostics just because a command succeeded.
  if (result.stderr?.trim()) process.stderr.write(result.stderr);
  return result.stdout.trim();
}
export function makeBdRunner(options = {}) {
  if (process.platform !== 'win32') return (args) => runProgram('bd', args, options);
  // npm installs a .cmd shim on Windows. Resolve it, then invoke literal arguments
  // in a fresh PowerShell process rather than using shell:true string concatenation.
  let executable;
  for (const name of ['bd.exe', 'bd.cmd']) {
    try { executable = runProgram('where.exe', [name], options).split(/\r?\n/)[0]; break; } catch {}
  }
  if (!executable) throw new Error('bd.exe/bd.cmd not found on PATH. Install the pinned Beads CLI first.');
  if (executable.toLowerCase().endsWith('.exe')) return (args) => runProgram(executable, args, options);
  return (args) => {
    const script = `$ErrorActionPreference = 'Continue'; & ${[executable, ...args].map(psLiteral).join(' ')}; if ($null -eq $LASTEXITCODE) { exit 1 }; exit $LASTEXITCODE`;
    return runProgram('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand',
      Buffer.from(script, 'utf16le').toString('base64')], options);
  };
}
export function parseJson(text, label) {
  try { return JSON.parse(text); } catch { throw new Error(`${label} did not return clean JSON. No output was silently discarded:\n${String(text).slice(0, 2000)}`); }
}
export function validateSeed(seed) {
  if (seed?.schemaVersion !== 1 || !/^[a-z0-9/-]+$/.test(seed.namespace ?? '') ||
      !/^\d+\.\d+\.\d+$/.test(seed.beadsVersion ?? '') || !/^[a-z][a-z0-9_-]*$/.test(seed.expectedPrefix ?? '') ||
      !Array.isArray(seed.tasks) || !seed.tasks.length) throw new Error('Invalid seed header.');
  const tasks = new Map();
  for (const task of seed.tasks) {
    if (!/^[A-Z][0-9]+$/.test(task.key ?? '') || tasks.has(task.key)) throw new Error(`Invalid or duplicate key: ${task.key}`);
    if (!task.title?.trim() || !['epic','task','bug','feature','chore'].includes(task.type) ||
        !Number.isInteger(task.priority) || task.priority < 0 || task.priority > 4 ||
        !task.description?.trim() || !Array.isArray(task.depends_on)) throw new Error(`Invalid task: ${task.key}`);
    tasks.set(task.key, task);
  }
  const sorted = [], visiting = new Set(), done = new Set();
  function visit(key) {
    if (done.has(key)) return;
    if (visiting.has(key)) throw new Error(`Dependency/parent cycle at ${key}`);
    const task = tasks.get(key);
    if (!task) throw new Error(`Unknown dependency/parent: ${key}`);
    visiting.add(key);
    for (const dep of [...(task.parent ? [task.parent] : []), ...task.depends_on]) visit(dep);
    visiting.delete(key); done.add(key); sorted.push(task);
  }
  for (const key of tasks.keys()) visit(key);
  return sorted;
}
export function existingMap(issues, namespace) {
  if (!Array.isArray(issues)) throw new Error('bd list --json must return an array. Refusing to assume an empty database.');
  const map = new Map();
  for (const issue of issues) {
    const ref = issue.external_ref;
    if (typeof ref !== 'string' || !ref.startsWith(namespace + '/')) continue;
    if (map.has(ref) || typeof issue.id !== 'string' || !issue.id) throw new Error(`Duplicate or invalid seed reference: ${ref}`);
    map.set(ref, issue.id);
  }
  return map;
}
/** Inject the create callback for offline tests. Existing records are never edited. */
export function seedTasks(seed, existing, create, onProgress = () => {}) {
  const tasks = validateSeed(seed), refs = existingMap(existing, seed.namespace), ids = {};
  for (const task of tasks) {
    const externalRef = `${seed.namespace}/${task.key}`;
    const previous = refs.get(externalRef);
    if (previous) { ids[task.key] = previous; onProgress(task, previous, false); continue; }
    const result = create(task, { externalRef, parentId: task.parent ? ids[task.parent] : null,
      dependencyIds: task.depends_on.map(key => ids[key]) });
    if (!result || typeof result.id !== 'string' || !result.id.startsWith(seed.expectedPrefix + '-')) {
      throw new Error(`Unexpected create response for ${task.key}; inspect Beads before retrying.`);
    }
    ids[task.key] = result.id; refs.set(externalRef, result.id); onProgress(task, result.id, true);
  }
  return ids;
}
