import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateSeed, seedTasks, existingMap, parseJson, psLiteral } from './lib.mjs';
const file = new URL('../../docs/companion/bootstrap-beads.json', import.meta.url);
const seed = JSON.parse(fs.readFileSync(file, 'utf8'));
const clone = () => structuredClone(seed);

test('all seed tasks are dependency/parent ordered', () => {
  const sorted = validateSeed(seed), seen = new Set();
  for (const task of sorted) {
    for (const d of [...task.depends_on, ...(task.parent ? [task.parent] : [])]) assert.ok(seen.has(d));
    seen.add(task.key);
  }
  assert.equal(seen.size, 24);
});
test('duplicate task key is rejected', () => { const s=clone(); s.tasks.push(s.tasks[0]); assert.throws(()=>validateSeed(s),/duplicate/); });
test('unknown dependency is rejected', () => { const s=clone(); s.tasks[0].depends_on=['UNKNOWN']; assert.throws(()=>validateSeed(s),/Unknown/); });
test('dependency cycle is rejected', () => { const s=clone(); s.tasks[0].depends_on=['C01']; assert.throws(()=>validateSeed(s),/cycle/); });
test('invalid priority is rejected', () => { const s=clone(); s.tasks[0].priority=10; assert.throws(()=>validateSeed(s),/Invalid task/); });
test('clean JSON only', () => { assert.equal(parseJson('{"id":"tc-x"}','test').id,'tc-x'); assert.throws(()=>parseJson('warning\n{}','test'),/clean JSON/); });
test('existing records must be an array', () => assert.throws(()=>existingMap({},seed.namespace),/array/));
test('duplicate external refs fail instead of silently choosing one', () => {
  const ref=seed.namespace+'/C00'; assert.throws(()=>existingMap([{id:'tc-a',external_ref:ref},{id:'tc-b',external_ref:ref}],seed.namespace),/Duplicate/);
});
test('idempotent import and resolved IDs for dependencies', () => {
  const rows=[]; let count=0;
  const create=(task,ctx)=>{
    if(task.key==='C01') assert.equal(ctx.parentId,'tc-1');
    if(task.key==='C02') assert.deepEqual(ctx.dependencyIds,['tc-2']);
    const row={id:`tc-${++count}`,external_ref:ctx.externalRef}; rows.push(row); return row;
  };
  const ids=seedTasks(seed,[],create);
  assert.equal(count,24);assert.equal(Object.keys(ids).length,24);
  const again=seedTasks(seed,rows,()=>{throw new Error('must not create twice');});
  assert.deepEqual(again,ids);
});
test('resume after partial import skips existing work', () => {
  const rows=[{id:'tc-old',external_ref:seed.namespace+'/C00'}]; let count=0;
  const ids=seedTasks(seed,rows,(task,ctx)=>{if(task.key==='C01')assert.equal(ctx.parentId,'tc-old');return{id:`tc-new${++count}`};});
  assert.equal(count,23); assert.equal(ids.C00,'tc-old');
});
test('create failure stops immediately', () => {
  let count=0; assert.throws(()=>seedTasks(seed,[],()=>{count++;throw new Error('offline');}),/offline/);assert.equal(count,1);
});
test('unexpected create response fails closed', () => assert.throws(()=>seedTasks(seed,[],()=>({id:'other-x'})),/Unexpected/));
test('PowerShell literal escapes single quotes, not interpolation',()=>{
  assert.equal(psLiteral("C:\\Ross's repo\\bd.cmd"),"'C:\\Ross''s repo\\bd.cmd'");
  assert.equal(psLiteral('$HOME; echo nope'),"'$HOME; echo nope'");
});
