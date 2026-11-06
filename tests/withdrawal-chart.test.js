import test from 'node:test';
import assert from 'node:assert/strict';
import {createExamplePlan} from '../src/plan.js';
import {project} from '../src/model.js';
import {discountFactor, potWithdrawalSeries, svgChart, retirementMarker} from '../src/view.js';

function fixture() {
 const plan=createExamplePlan();
 Object.assign(plan,{startMonth:'2026-04',endAge:62,inflation:0,events:[],monthlySpending:0});
 Object.assign(plan.people[0],{dob:'1966-04-01',retirementMonth:'2026-04'});
 plan.pots=[{...plan.pots[0],balance:100000,growth:0,fee:0,monthlyContribution:0}];
 plan.drawdown={mode:'totalIncome',annualAmount:12000,inflationLinked:false,stages:[]};
 plan.incomes=[{id:'state',name:'State Pension',owner:'you',type:'state',monthlyAmount:500,startMonth:'2027-04',endMonth:'2028-12',escalation:0}];
 return plan;
}

test('withdrawal line uses actual annual gross removals and reduces when pension income begins',()=>{
 const plan=fixture();
 plan.events=[{id:'extra',name:'One-off withdrawal',month:'2026-04',type:'withdrawal',potId:plan.pots[0].id,toPotId:'',amount:1500}];
 const result=project(plan),before=JSON.stringify(result);
 const series=potWithdrawalSeries(plan,result,false);
 // Actual partial calendar years, including the £500 event excess, with no annualising.
 assert.deepEqual(series.values,[9500,7500,1500]);
 assert.match(series.label,/Actual pot withdrawals before tax/);
 assert.equal(series.colour,'#1d5fa6');
 assert.equal(JSON.stringify(result),before);
});

test('income line respects money display, partner exclusion, transfers and actual funding shortfalls',()=>{
 const plan=fixture();plan.inflation=10;
 plan.pots.push({...plan.pots[0],id:'partner',owner:'partner',balance:100000});
 plan.pots[0].balance=500;
 let result=project(plan);
 assert.deepEqual(potWithdrawalSeries(plan,result,false).values,[500,0,0]);
 for(const [i,year] of result.years.entries()) {
  assert.equal(potWithdrawalSeries(plan,result,true).values[i],year.withdrawals/discountFactor(plan,result.months,year.year,true));
 }
 plan.includePartner=true;result=project(plan);
 assert.ok(potWithdrawalSeries(plan,result,false).values[0]>500);
});

test('internal transfers never enter the withdrawal series',()=>{
 const plan=fixture();plan.drawdown.annualAmount=0;
 plan.pots.push({...plan.pots[0],id:'other',balance:0});
 plan.events=[{id:'move',name:'Internal transfer',type:'transfer',month:'2026-04',potId:plan.pots[0].id,toPotId:'other',amount:1000}];
 assert.deepEqual(potWithdrawalSeries(plan,project(plan),false).values,[0,0,0]);
});

const years=[{year:2026},{year:2027}];
const wealth=[{colour:'#c39a4b',values:[100,200]}];
const line=values=>({label:'Actual pot withdrawals before tax',axisLabel:'Withdrawals (£/year)',colour:'#1d5fa6',values});
const draw=secondary=>svgChart(years,wealth,true,null,[],secondary);
const points=svg=>svg.match(/data-axis="right"[^>]*points="([^"]+)"/)[1];

test('independent withdrawal scale never changes the stacked wealth values or scale',()=>{
 const small=draw(line([10,20])),large=draw(line([10000,20000]));
 assert.deepEqual(small.match(/<path[^>]+>/g),large.match(/<path[^>]+>/g));
 assert.equal(points(small),points(large));
 assert.match(small,/data-axis-max="30"/);
 assert.match(large,/data-axis-max="30000"/);
 assert.match(large,/left axis.*right axis/);
 assert.match(large,/Withdrawals \(£\/year\)/);
 const otherWealth=svgChart(years,[{...wealth[0],values:[100000,200000]}],true,null,[],line([10,20]));
 assert.equal(points(small),points(otherWealth));
});

test('right-axis line shares the year positions of the areas and retirement marker',()=>{
 const marker=retirementMarker('2027-04',years,[],'1966-04-01');
 const svg=svgChart(years,wealth,true,marker,[],line([0,10]));
 const xs=points(svg).split(' ').map(point=>Number(point.split(',')[0]));
 assert.deepEqual(xs,[76,682]);
 assert.match(svg,/<line class="retirement-marker" x1="682" x2="682"/);
 assert.match(svg,/data-start-year="2026" data-end-year="2027"/);
});

test('zero, penny-sized and large withdrawals produce finite right scales and escaped labels',()=>{
 for(const values of [[0,0],[0,0.001],[0,100000000]]) {
  const svg=draw(line(values));
  assert.doesNotMatch(svg,/NaN|Infinity/);
  assert.ok(Number(svg.match(/data-axis-max="([^"]+)"/)[1])>=Math.max(...values));
  if(values[1]===0.001) assert.match(svg,/£0\.0005/);
 }
 const svg=draw({...line([0,10]),label:'<script>',axisLabel:'<img>'});
 assert.doesNotMatch(svg,/<script>|<img>/);
 assert.match(svg,/&lt;script&gt;/);
});
