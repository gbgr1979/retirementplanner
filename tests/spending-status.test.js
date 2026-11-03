import test from 'node:test';
import assert from 'node:assert/strict';
import {createExamplePlan} from '../src/plan.js';
import {project} from '../src/model.js';
import {withdrawalOutcome, withdrawalCardSummary} from '../src/view.js';

function retirementPlan() {
  const plan = createExamplePlan();
  Object.assign(plan, {startMonth:'2026-04', endAge:68, inflation:0, spendingStart:'2026-04', monthlySpending:2000, events:[]});
  Object.assign(plan.people[0], {dob:'1959-04-01', retirementMonth:'2026-04'});
  plan.drawdown = {mode:'totalIncome', annualAmount:24000, inflationLinked:false, stages:[]};
  plan.pots = [{...plan.pots[2], balance:100000, growth:0, fee:0, monthlyContribution:0, employerContribution:0}];
  plan.incomes = [{id:'state', name:'State Pension', owner:'you', type:'state', monthlyAmount:241.30*52/12, startMonth:'2026-04', endMonth:'2250-12', escalation:0}];
  return plan;
}

test('a funded gross target still highlights the monthly spending gap after tax', () => {
  const plan = retirementPlan(), result = project(plan), before = JSON.stringify(result);
  assert.equal(result.firstUnmetWithdrawal, null);
  const outcome = withdrawalOutcome(plan, result);
  assert.equal(outcome.hasGap, true);
  assert.equal(outcome.hasSpendingGap, true);
  assert.equal(outcome.hasWithdrawalGap, false);
  for (const text of [outcome.text, withdrawalCardSummary(plan, result)]) {
    assert.match(text, /^Spending gap from April 2026: £142\.78 that month/);
    assert.match(text, /£1,857\.22 available against £2,000\.00 planned/);
  }
  assert.equal(JSON.stringify(result), before);
});

test('spending gaps remain visible at zero gross target and with withdrawal shortfalls', () => {
  const plan = retirementPlan(); plan.drawdown.annualAmount = 0;
  let result = project(plan);
  assert.match(withdrawalCardSummary(plan, result), /^Spending gap/);
  assert.equal(withdrawalOutcome(plan, result).hasGap, true);
  plan.drawdown.annualAmount = 24000; plan.pots[0].balance = 0;
  result = project(plan);
  const outcome = withdrawalOutcome(plan, result);
  assert.equal(outcome.hasWithdrawalGap, true);
  assert.equal(outcome.hasSpendingGap, true);
  assert.match(outcome.text, /income-target.*shortfall/);
});

test('covered spending does not trigger a warning', () => {
  const plan = retirementPlan(); plan.monthlySpending = 1000;
  const result = project(plan);
  assert.equal(withdrawalOutcome(plan, result).hasGap, false);
  assert.doesNotMatch(withdrawalCardSummary(plan, result), /Spending gap/);
  assert.match(withdrawalCardSummary(plan, result), /^Gross target funded/);
});

test('spending status respects money display and reports first monthly deficit without annual netting', () => {
  const plan = retirementPlan(); plan.inflation = 10;
  const result = {firstUnmetWithdrawal:null, months:[
    {month:'2026-04', shortfall:0, incomeNet:5000, withdrawalsNet:0, spending:2000, withdrawalTarget:0},
    {month:'2027-04', shortfall:110, incomeNet:2090, withdrawalsNet:0, spending:2200, withdrawalTarget:1000}
  ]};
  assert.match(withdrawalCardSummary(plan, result, true), /April 2027: £100\.00.*£1,900\.00 available against £2,000\.00 planned.*2026-04 pounds/);
  assert.match(withdrawalCardSummary(plan, result, false), /April 2027: £110\.00.*£2,090\.00 available against £2,200\.00 planned.*future pounds/);
});
