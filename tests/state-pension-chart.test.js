import test from 'node:test';
import assert from 'node:assert/strict';
import {createExamplePlan} from '../src/plan.js';
import {project, incomeTax} from '../src/model.js';
import {incomeChartSeries, discountFactor, svgChart} from '../src/view.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} != ${expected}`);
function fixture() {
  const plan = createExamplePlan();
  Object.assign(plan, {startMonth:'2026-04', endAge:61, inflation:0, events:[], monthlySpending:0});
  Object.assign(plan.people[0], {dob:'1966-04-01', retirementMonth:'2026-04'});
  plan.drawdown = {mode:'pots', annualAmount:12000, inflationLinked:false, stages:[]};
  plan.pots = [{...plan.pots[2], balance:100000, growth:0, fee:0}];
  plan.incomes = [
    {id:'state', name:'State', owner:'you', type:'state', monthlyAmount:1000, startMonth:plan.startMonth, endMonth:'2028-12', escalation:0},
    {id:'db', name:'DB', owner:'you', type:'db', monthlyAmount:1000, startMonth:plan.startMonth, endMonth:'2028-12', escalation:0}
  ];
  return plan;
}

test('State Pension is separated after the existing per-owner proportional tax allocation', () => {
  const result = project(fixture());
  const tax = incomeTax(24000 + 9000);
  near(result.months.reduce((sum, row) => sum + row.statePensionGross, 0), 12000);
  near(result.months.reduce((sum, row) => sum + row.statePensionNet, 0), 12000 - tax * 12000 / 33000);
  for (const year of result.years) {
    const months = result.months.filter(row => row.month.startsWith(String(year.year)));
    near(year.statePensionGross, months.reduce((sum, row) => sum + row.statePensionGross, 0));
    near(year.statePensionNet, months.reduce((sum, row) => sum + row.statePensionNet, 0));
    assert.ok(year.statePensionNet <= year.incomeNet);
  }
});

test('partner inclusion, separate tax regions, start/end months and escalation remain distinct', () => {
  const plan = fixture(); plan.endAge = 62;
  plan.people[1].region = 'scotland';
  plan.incomes.push({...plan.incomes[0], id:'partner-state', owner:'partner', monthlyAmount:2000});
  const alone = project(plan);
  plan.includePartner = true;
  const together = project(plan);
  near(together.months.slice(0,12).reduce((sum, row) => sum + row.statePensionNet, 0),
    alone.months.slice(0,12).reduce((sum, row) => sum + row.statePensionNet, 0) + 24000 - incomeTax(24000, 'scotland'));
  plan.incomes = [{...plan.incomes[0], startMonth:'2027-04', endMonth:'2027-04', escalation:10}];
  const timed = project(plan);
  near(timed.months[11].statePensionGross, 0);
  near(timed.months[12].statePensionGross, 1100);
  near(timed.months[13].statePensionGross, 0);
});

test('separating State Pension leaves wealth, cash, withdrawals and total tax unchanged', () => {
  const plan = fixture(), state = project(plan);
  plan.incomes[0].type = 'db';
  const db = project(plan);
  const withoutComponent = rows => rows.map(({statePensionGross, statePensionNet, ...row}) => row);
  assert.deepEqual(withoutComponent(state.months), withoutComponent(db.months));
  assert.deepEqual(withoutComponent(state.years), withoutComponent(db.years));
});

test('purple series uses the same units as total cash and never stacks State Pension twice', () => {
  const plan = fixture(); plan.inflation = 10;
  const result = project(plan), before = JSON.stringify(result);
  for (const real of [true, false]) {
    const series = incomeChartSeries(plan, result, real);
    const pension = series.find(item => item.label.startsWith('State Pension'));
    assert.equal(pension.colour, '#74479b');
    result.years.forEach((year, index) => {
      const factor = discountFactor(plan, result.months, year.year, real);
      near(pension.values[index], year.statePensionNet / factor);
      near(series[0].values[index], (year.incomeNet + year.withdrawalsNet) / factor);
    });
    assert.match(svgChart(result.years, series), /data-series="State Pension \(included in total cash\)"[^>]*stroke="#74479b"/);
  }
  assert.equal(JSON.stringify(result), before);
});

test('no purple series is drawn for absent or out-of-horizon State Pension income', () => {
  const plan = fixture();
  for (const incomes of [[], [{...plan.incomes[0], startMonth:'2028-04', endMonth:'2028-12'}]]) {
    plan.incomes = incomes;
    assert.ok(!incomeChartSeries(plan, project(plan)).some(series => series.label.startsWith('State Pension')));
  }
});
