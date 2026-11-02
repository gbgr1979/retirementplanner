import test from 'node:test';
import assert from 'node:assert/strict';
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
  invalid(alter(p => p.version = 2), /Unsupported plan version/);
  invalid(alter(p => p.version = {toString: 1}), /Unsupported plan version/);
  invalid(alter(p => delete p.inflation), /inflation is required/);
  invalid(alter(p => p.extra = true), /extra is not supported/);
  invalid(alter(p => p.people[0].extra = 1), /extra is not supported/);
});
test('JSON malformed, unsafe prototype keys and large files rejected', () => {
  assert.throws(() => parsePlan('{'), /valid JSON/);
  assert.throws(() => parsePlan(' '.repeat(MAX_PLAN_BYTES + 1)), /1 MB/);
  const p = JSON.stringify(createExamplePlan());
  assert.throws(() => parsePlan(p.replace('"version":1','"__proto__":{"polluted":true},"version":1')), /Unsafe property/);
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
test('bad load leaves caller data unchanged', () => {const existing = createExamplePlan(); const saved = serializePlan(existing); assert.throws(() => parsePlan('{"version":2}')); assert.equal(serializePlan(existing), saved);});
