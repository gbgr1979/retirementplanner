import test from 'node:test';
import assert from 'node:assert/strict';
import {createExamplePlan, validatePlan} from '../src/plan.js';
import {createStatePensionDraft, buildStatePensionPlan, weeklyToMonthly, monthlyToWeekly} from '../src/state-pension.js';
const fresh = () => {const plan = createExamplePlan(); plan.incomes = []; return plan;};
function enabled(plan, owner = 'you') { const draft = createStatePensionDraft(plan); draft.people[owner] = {enabled: true, weeklyAmount: '230.25', startMonth: '2046-11', escalation: 2.5}; return draft; }

test('no entitlement or claim month defaults, and existing pots mode stays unchecked', () => {
  const draft = createStatePensionDraft(fresh());
  assert.deepEqual(draft.people.you, {enabled: false, weeklyAmount: '', startMonth: '', escalation: 0});
  assert.equal(draft.useTowardTarget, false);
});
test('weekly conversion uses 52 / 12 and round trips without four-week conversion', () => {
  assert.equal(weeklyToMonthly(120), 520); assert.equal(monthlyToWeekly(520), 120);
});
test('upsert preserves ID, original monthly precision and unrelated income, then updates once', () => {
  const plan = createExamplePlan(); plan.incomes[0].monthlyAmount = 901.1234567890123;
  plan.incomes.push({...plan.incomes[0], id:'dbIncome', type:'db'});
  const unchanged = buildStatePensionPlan(plan, createStatePensionDraft(plan));
  assert.deepEqual(unchanged, plan);
  const draft = createStatePensionDraft(plan); draft.people.you.weeklyAmount = '240.55';
  const result = buildStatePensionPlan(plan, draft);
  assert.equal(result.incomes[0].id, 'stateExample'); assert.equal(result.incomes[0].monthlyAmount, weeklyToMonthly(240.55));
  assert.deepEqual(result.incomes[1], plan.incomes[1]); assert.equal(result.incomes.length, 2);
  assert.deepEqual(buildStatePensionPlan(result, createStatePensionDraft(result)), result);
});
test('duplicate active-owner State Pensions block instead of guessing', () => {
  const plan = createExamplePlan(); plan.incomes.push({...plan.incomes[0], id:'another'});
  assert.throws(() => createStatePensionDraft(plan), /detailed income editor/);
  assert.throws(() => buildStatePensionPlan(plan, {people:{you:{enabled:false}}}), /detailed income editor/);
});
test('excluded partner entries stay untouched even when duplicate; active person can clear', () => {
  const plan = createExamplePlan(); plan.incomes.push({...plan.incomes[0], id:'partner-state', owner:'partner'}, {...plan.incomes[0], id:'partner-state-2', owner:'partner'});
  const draft = createStatePensionDraft(plan); assert.equal(draft.people.partner, undefined);
  draft.people.you.enabled = false;
  const result = buildStatePensionPlan(plan, draft);
  assert.deepEqual(result.incomes, plan.incomes.slice(1));
});
test('both active people independently add State Pension; existing other IDs are avoided', () => {
  const plan = fresh(); plan.includePartner = true; plan.pots[0].id = 'state-you'; plan.events = [];
  const draft = enabled(plan); draft.people.partner = {...draft.people.you, weeklyAmount:'110', startMonth:'2048-11'};
  const result = buildStatePensionPlan(plan, draft);
  assert.equal(result.incomes.length, 2); assert.equal(result.incomes[0].id, 'state-you-1'); assert.equal(result.incomes[1].monthlyAmount, weeklyToMonthly(110));
  assert.equal(validatePlan(result).valid, true);
});
test('target mode is explicit and preserves annual amount and inflation choice', () => {
  const plan = fresh(); plan.drawdown.annualAmount = 40000; plan.drawdown.inflationLinked = false;
  const draft = enabled(plan); assert.equal(buildStatePensionPlan(plan, draft).drawdown.mode, 'pots');
  draft.useTowardTarget = true; const result = buildStatePensionPlan(plan, draft);
  assert.deepEqual(result.drawdown, {stages:[],mode:'totalIncome', annualAmount:40000, inflationLinked:false});
  assert.equal(createStatePensionDraft(result).useTowardTarget, true);
});
test('pending snapshot and draft stay isolated through edits, cancellation and build', () => {
  const plan = createExamplePlan(); plan.pots[0].balance = 98765.43; const before = structuredClone(plan);
  const draft = createStatePensionDraft(plan); draft.people.you.weeklyAmount = '300';
  assert.deepEqual(plan, before);
  const draftBefore = structuredClone(draft), result = buildStatePensionPlan(plan, draft);
  assert.deepEqual(plan, before); assert.deepEqual(draft, draftBefore); assert.equal(result.pots[0].balance, 98765.43);
  result.pots[0].balance = 0; assert.equal(plan.pots[0].balance, 98765.43);
});
test('weekly amount accepts inclusive 0–10000 and strict money parsing', () => {
  for (const value of ['0','10,000','230.123456789']) { const plan = fresh(), draft = enabled(plan); draft.people.you.weeklyAmount = value; assert.equal(validatePlan(buildStatePensionPlan(plan,draft)).valid,true); }
  for (const value of ['', '-1','10,000.01','23,00','NaN','Infinity']) { const plan = fresh(), draft = enabled(plan); draft.people.you.weeklyAmount = value; assert.throws(() => buildStatePensionPlan(plan,draft), /weekly forecast/); }
});
test('requires explicit valid claim month after birth and respects existing end', () => {
  for (const value of ['', '1979-11','1978-11','2046-13','2251-01','2046-1']) { const plan = fresh(), draft = enabled(plan); draft.people.you.startMonth = value; assert.throws(() => buildStatePensionPlan(plan,draft), /claim start month/); }
  const plan = createExamplePlan(), draft = createStatePensionDraft(plan); draft.people.you.startMonth = '2080-01'; assert.throws(() => buildStatePensionPlan(plan,draft), /existing end month/);
});
test('annual increase is inclusive 0–15, rejects blank and leaves amount un-escalated at plan start', () => {
  for (const value of [0,15,'2.567']) {const plan = fresh(), draft = enabled(plan); draft.people.you.escalation = value; const result = buildStatePensionPlan(plan,draft); assert.equal(result.incomes[0].escalation, Number(value)); assert.equal(result.incomes[0].monthlyAmount, weeklyToMonthly(230.25));}
  for (const value of ['',-0.1,15.01,'NaN']) {const plan = fresh(), draft = enabled(plan); draft.people.you.escalation=value; assert.throws(() => buildStatePensionPlan(plan,draft), /annual increase/);}
});
