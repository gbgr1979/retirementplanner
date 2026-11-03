import test from 'node:test';
import assert from 'node:assert/strict';
import {addPlanItem, createExamplePlan, validatePlan, parsePlan, serializePlan} from '../src/plan.js';
import {project} from '../src/model.js';

test('adding every item to an already-retired plan yields valid, saveable data', () => {
  const plan = createExamplePlan();
  plan.people[0].retirementMonth = '2025-11';
  const before = structuredClone(plan);
  for (const collection of ['pots', 'incomes', 'events']) {
    const added = addPlanItem(plan, collection, 'added-' + collection);
    assert.equal(validatePlan(added).valid, true);
    assert.deepEqual(parsePlan(serializePlan(added)), added);
    assert.ok(project(added).months.length > 0);
    const item = added[collection].at(-1);
    assert.equal(item.contributionStart ?? item.startMonth ?? item.month, plan.startMonth);
    added[collection].pop();
    assert.deepEqual(added, plan);
  }
  assert.deepEqual(plan, before);
});

test('new income dates cover the actual horizon, including retirement after 2100', () => {
  const plan = createExamplePlan();
  plan.startMonth = '2090-11'; plan.people[0].dob = '2040-11-01'; plan.people[0].retirementMonth = '2105-11';
  plan.events = [];
  const added = addPlanItem(plan, 'incomes', 'new-income').incomes.at(-1);
  assert.equal(added.startMonth, '2105-11');
  assert.equal(added.endMonth, '2135-10');
});

test('rejected additions preserve the input, including collection limits and duplicate IDs', () => {
  for (const collection of ['pots', 'incomes', 'events']) {
    const plan = createExamplePlan();
    if (collection === 'pots') plan.events = [];
    const count = collection === 'events' ? 200 : 50;
    plan[collection] = Array.from({length:count}, (_, i) => ({...plan[collection][0], id:'existing-' + collection + i}));
    const before = structuredClone(plan);
    assert.throws(() => addPlanItem(plan, collection, 'extra-' + collection), /at most/);
    assert.deepEqual(plan, before);
  }
  const plan = createExamplePlan(), before = structuredClone(plan);
  assert.throws(() => addPlanItem(plan, 'pots', plan.pots[0].id), /duplicated/);
  assert.throws(() => addPlanItem(plan, 'unknown', 'unused'), /Unknown/);
  assert.deepEqual(plan, before);
});

test('event creation uses an included pot and rejects an empty active household', () => {
  const plan = createExamplePlan(); plan.pots.reverse();
  assert.equal(addPlanItem(plan, 'events', 'new-event').events.at(-1).potId, 'pension');
  plan.pots = plan.pots.filter(pot => pot.owner === 'partner'); plan.events = [];
  assert.throws(() => addPlanItem(plan, 'events', 'new-event'), /included pot/);
  plan.includePartner = true;
  assert.equal(addPlanItem(plan, 'events', 'new-event').events.at(-1).potId, plan.pots[0].id);
});
