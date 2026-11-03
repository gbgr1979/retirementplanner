import test from 'node:test';
import assert from 'node:assert/strict';
import {project} from '../src/model.js';
import {createExamplePlan, validatePlan, parsePlan, serializePlan, MAX_PLAN_BYTES} from '../src/plan.js';
const alter = fn => {const p = createExamplePlan(); fn(p); return p;};
const invalid = (plan, pattern) => {const result = validatePlan(plan); assert.equal(result.valid, false); if (pattern) assert.match(result.errors.join('\n'), pattern);};
test('example is valid, independent and explicitly illustrative', () => {
  const p = createExamplePlan(); assert.deepEqual(validatePlan(p), {valid:true, errors:[]});
  assert.match(p.name, /Illustrative/); p.pots[0].balance = 0; assert.equal(createExamplePlan().pots[0].balance,40000);
});
test('save/load roundtrip includes both people, pots, events, settings and incomes', () => {
  const p = createExamplePlan(); p.includePartner = true;
  assert.deepEqual(parsePlan(serializePlan(p)), p);
  p.includePartner = false; assert.equal(parsePlan(serializePlan(p)).people.length,2);
});
test('validation never mutates existing plan', () => {const p = createExamplePlan(); const before = JSON.stringify(p); validatePlan(p); serializePlan(p); assert.equal(JSON.stringify(p), before);});
test('unsupported versions and missing/unknown fields rejected', () => {
  invalid(alter(p => p.version = 4), /Unsupported plan version/);
  invalid(alter(p => p.version = {toString: 1}), /Unsupported plan version/);
  invalid(alter(p => delete p.inflation), /inflation is required/);
  invalid(alter(p => p.extra = true), /extra is not supported/);
  invalid(alter(p => p.people[0].extra = 1), /extra is not supported/);
});
test('JSON malformed, unsafe prototype keys and large files rejected', () => {
  assert.throws(() => parsePlan('{'), /valid JSON/);
  assert.throws(() => parsePlan(' '.repeat(MAX_PLAN_BYTES + 1)), /1 MB/);
  const p = JSON.stringify(createExamplePlan());
  assert.throws(() => parsePlan(p.replace('"version":3','"__proto__":{"polluted":true},"version":3')), /Unsafe property/);
  assert.equal({}.polluted, undefined);
  invalid(alter(p => p.pots[0].constructor = {}), /Unsafe property/);
  invalid(alter(p => p.pots[0].id = 'constructor'), /safe identifier/);
});
test('multibyte file size uses byte count', () => {assert.throws(() => parsePlan('é'.repeat(MAX_PLAN_BYTES / 2 + 1)), /1 MB/);});
test('invalid dates and reversed ranges rejected; leap date accepted', () => {
  invalid(alter(p => p.people[0].dob = '1979-02-29'), /valid YYYY/);
  invalid(alter(p => p.people[0].dob = '1979-13-01'), /valid YYYY/);
  invalid(alter(p => p.startMonth = '2026-13'), /valid YYYY/);
  invalid(alter(p => p.pots[0].contributionEnd = '2025-01'), /must not precede/);
  invalid(alter(p => p.incomes[0].endMonth = '2040-01'), /must not precede/);
  invalid(alter(p => p.events[0].month = '2025-01'), /must not precede/);
  assert.equal(validatePlan(alter(p => p.people[1].dob = '1980-02-29')).valid,true);
});
test('financial bounds and nonfinite values rejected', () => {
  for (const value of [NaN,Infinity,-1,100000001,'100']) invalid(alter(p => p.pots[0].balance = value), /balance must/);
  invalid(alter(p => p.pots[0].growth = -100), /growth must/);
  invalid(alter(p => p.events[0].amount = 0), /amount must/);
  invalid(alter(p => p.endAge = 95.5), /integer/);
  invalid(alter(p => p.endAge = 40), /Projection must/);
  invalid(alter(p => p.people[0].taxFreeUsed = 300000), /taxFreeUsed must/);
});
test('references, types, duplicate identities and preserved people validated', () => {
  invalid(alter(p => p.events[0].potId = 'missing'), /existing pot/);
  invalid(alter(p => p.pots[1].id = p.pots[0].id), /duplicated/);
  invalid(alter(p => p.incomes[0].id = p.pots[0].id), /duplicated/);
  invalid(alter(p => p.people.pop()), /preserve both/);
  invalid(alter(p => p.people[1].id = 'you'), /unique ids/);
  invalid(alter(p => p.pots[0].owner = 'joint'), /owner must/);
  invalid(alter(p => p.pots[0].type = 'lisa'), /type must/);
  invalid(alter(p => p.includePartner = 'false'), /true or false/);
});
test('bounded array counts and plain JSON only', () => {
  invalid(alter(p => p.events = Array.from({length:201}, (_,i) => ({...p.events[0],id:`event${i}`}))), /at most 200/);
  invalid(alter(p => p.pots = null), /array/);
  invalid(null, /object/); invalid([], /object/);
  invalid(alter(p => p.people[0].dob = new Date()), /plain JSON/);
  const cyclic = createExamplePlan(); cyclic.circular = cyclic; invalid(cyclic, /circular/);
  const accessor = createExamplePlan(); Object.defineProperty(accessor,'name',{enumerable:true,get(){throw new Error('should not run');}}); invalid(accessor, /Accessor/);
});
test('supported transfer is same owner nonpension, no source-target duplication', () => {
  const good = alter(p => { p.events[0].type = 'transfer'; p.events[0].toPotId = 'cash'; }); assert.equal(validatePlan(good).valid,true);
  invalid(alter(p => {p.events[0].type = 'transfer'; p.events[0].toPotId = 'pension';}), /different non-pension/);
  invalid(alter(p => {p.events[0].type = 'transfer'; p.events[0].toPotId = 'partnerIsa';}), /same person/);
  invalid(alter(p => {p.events[0].type = 'transfer'; p.events[0].toPotId = 'isa';}), /different/);
  invalid(alter(p => p.events[0].toPotId = 'cash'), /empty/);
});
test('nonpension contributions cannot receive tax relief or employer additions', () => {
  invalid(alter(p => p.pots[0].contributionBasis = 'netRelief'), /non-pension/);
  invalid(alter(p => p.pots[0].employerContribution = 1), /non-pension/);
  assert.equal(validatePlan(alter(p => p.pots[2].contributionBasis = 'netRelief')).valid,true);
});
test('bad load leaves caller data unchanged', () => {const existing = createExamplePlan(); const saved = serializePlan(existing); assert.throws(() => parsePlan('{"version":3}')); assert.equal(serializePlan(existing), saved);});

const legacyExample = () => { const p=createExamplePlan(); p.version=1; delete p.drawdown; return p; };
test('v1 load migrates without mutating original and preserves old no-automatic-drawdown meaning',()=>{
 const legacy=legacyExample(), original=structuredClone(legacy), text=JSON.stringify(legacy);
 const current=parsePlan(text);assert.deepEqual(project(current),project({...legacy,version:3,drawdown:{mode:'pots',annualAmount:0,inflationLinked:true}}));assert.equal(current.version,3);assert.deepEqual(current.drawdown,{mode:'pots',annualAmount:0,inflationLinked:true});
 const restored=structuredClone(current);restored.version=1;delete restored.drawdown;assert.deepEqual(restored,original);assert.deepEqual(legacy,original);
 assert.equal(validatePlan(current).valid,true);assert.deepEqual(parsePlan(serializePlan(current)),current);assert.equal(validatePlan(legacy).valid,false);assert.throws(()=>serializePlan(legacy),/version/);
});
test('legacy fields are strictly validated BEFORE migration',()=>{
 for(const change of [p=>p.drawdown={annualAmount:900,inflationLinked:true},p=>p.unknown=1,p=>delete p.pots,p=>p.people[0].extra=true,p=>p.pots[0].balance=-1]) {
  const legacy=legacyExample();change(legacy);assert.throws(()=>parsePlan(JSON.stringify(legacy)));
 }
 const text=JSON.stringify(legacyExample());assert.throws(()=>parsePlan(text.replace('"version":1','"version":1,"__proto__":{"polluted":true}')),/Unsafe property/);assert.equal({}.polluted,undefined);
});
test('v3 drawdown is required, finite, bounded and strict',()=>{
 invalid(alter(p=>delete p.drawdown),/drawdown/);invalid(alter(p=>p.drawdown=null),/drawdown/);
 for(const value of [-1,12000001,Infinity,NaN,'100',null]) invalid(alter(p=>p.drawdown.annualAmount=value),/annualAmount/);
 for(const value of [0,12000000]) {const p=alter(p=>p.drawdown.annualAmount=value);assert.equal(validatePlan(p).valid,true);assert.deepEqual(parsePlan(serializePlan(p)),p);}
 invalid(alter(p=>p.drawdown.inflationLinked=1),/inflationLinked/);invalid(alter(p=>p.drawdown.extra=true),/not supported/);
 assert.throws(()=>parsePlan(JSON.stringify(createExamplePlan()).replace('"annualAmount":0','"annualAmount":1e999')),/annualAmount/);
});

test('v2 migration preserves amounts, indexation and explicit pot-only semantics',()=>{
 for(const inflationLinked of [false,true]) {
  const old=createExamplePlan();old.version=2;delete old.drawdown.mode;old.drawdown.annualAmount=36000;old.drawdown.inflationLinked=inflationLinked;
  const before=structuredClone(old), migrated=parsePlan(JSON.stringify(old));
  assert.equal(migrated.version,3);assert.deepEqual(migrated.drawdown,{mode:'pots',annualAmount:36000,inflationLinked});
  assert.deepEqual(migrated,{...before,version:3,drawdown:{...before.drawdown,mode:'pots'}});assert.deepEqual(old,before);
  assert.deepEqual(parsePlan(serializePlan(migrated)),migrated);
 }
});
test('v2 migration rejects poisoned, missing, invalid and future fields before migration',()=>{
 const legacy=()=>{const p=createExamplePlan();p.version=2;delete p.drawdown.mode;return p;};
 for(const change of [p=>p.drawdown.mode='totalIncome',p=>delete p.drawdown,p=>delete p.drawdown.inflationLinked,p=>p.drawdown.annualAmount='500',p=>p.drawdown.extra=1,p=>p.extra=1,p=>p.incomes[0].extra=1]) {
  const p=legacy();change(p);assert.throws(()=>parsePlan(JSON.stringify(p)));
 }
 for(const key of ['__proto__','constructor','prototype']) assert.throws(()=>parsePlan(JSON.stringify(legacy()).replace('"annualAmount":0',`"annualAmount":0,"${key}":{}`)),/Unsafe property/);
});
test('v3 requires explicit supported mode and does not coerce numeric data',()=>{
 for(const mode of [undefined,null,'income','',true,1]) invalid(alter(p=>p.drawdown.mode=mode),/mode/);
 invalid(alter(p=>delete p.drawdown.mode),/mode is required/);
 for(const mode of ['pots','totalIncome']) {const p=alter(p=>p.drawdown.mode=mode);assert.deepEqual(parsePlan(serializePlan(p)),p);}
 invalid(alter(p=>p.incomes[0].monthlyAmount='900'),/monthlyAmount/);
 const p=createExamplePlan();delete p.drawdown.mode;assert.throws(()=>parsePlan(JSON.stringify(p)),/mode/);
});
