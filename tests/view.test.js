import test from 'node:test';import assert from 'node:assert/strict';
import {discountFactor,retirementSnapshot,escapeHTML} from '../src/view.js';
import {createExamplePlan} from '../src/plan.js';
test('inflation discount includes every modelled month including partial final year',()=>{let p=createExamplePlan();p.inflation=12;assert.equal(discountFactor(p,[{month:'2026-11'},{month:'2026-12'}],2026),1.12**(2/12));assert.equal(discountFactor(p,[{month:'2027-02'}],2027),1.12**(4/12));assert.equal(discountFactor(p,[],2026,false),1);});
test('primary person identity independent of imported array order',()=>{let p=createExamplePlan();p.people.reverse();assert.deepEqual(retirementSnapshot(p,[{year:2044},{year:2046}]),{year:{year:2044},withinHorizon:true});});
test('retirement outside horizon is not mislabeled retirement year',()=>{let p=createExamplePlan();p.people.find(x=>x.id==='you').retirementMonth='2100-01';assert.deepEqual(retirementSnapshot(p,[{year:2074}]),{year:{year:2074},withinHorizon:false});});
test('user text is HTML escaped including attribute delimiters',()=>assert.equal(escapeHTML('<img src="x" onerror=\'alert(1)\'>&'), '&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt;&amp;'));

import {updatePlanScreen} from '../src/view.js';
function screenFixture(){const elements=Object.fromEntries(['landing','planner-view','plan-actions','skip-projection'].map(id=>[id,{hidden:false}]));return {elements,getElementById:id=>elements[id]};}
test('initial landing hides financial workspace and actions',()=>{const root=screenFixture();assert.equal(updatePlanScreen(root,'initialise'),false);assert.equal(root.elements.landing.hidden,false);for(const id of ['planner-view','plan-actions','skip-projection'])assert.equal(root.elements[id].hidden,true);});
test('wizard completion or successful load reveals workspace and actions',()=>{for(const acceptedBy of ['wizard','load']){const root=screenFixture();updatePlanScreen(root,'initialise');assert.equal(updatePlanScreen(root,'planAccepted'),true,acceptedBy);assert.equal(root.elements.landing.hidden,true);for(const id of ['planner-view','plan-actions','skip-projection'])assert.equal(root.elements[id].hidden,false);}});
test('cancelled wizard, cancelled load and invalid files never switch screens',()=>{for(const alreadyHavePlan of [false,true]){const root=screenFixture();updatePlanScreen(root,'initialise');if(alreadyHavePlan)updatePlanScreen(root,'planAccepted');for(const event of ['wizardCancelled','loadCancelled','loadFailed'])assert.equal(updatePlanScreen(root,event),alreadyHavePlan);}});
test('repeated acceptance preserves workspace; new page initialisation restores landing',()=>{const root=screenFixture();updatePlanScreen(root,'initialise');updatePlanScreen(root,'planAccepted');assert.equal(updatePlanScreen(root,'planAccepted'),true);assert.equal(updatePlanScreen(root,'initialise'),false);});

import {adjustAnnualWithdrawal,withdrawalOutcome} from '../src/view.js';
test('annual withdrawal controls increment exactly £1000 and clamp both bounds',()=>{assert.equal(adjustAnnualWithdrawal(30000,1),31000);assert.equal(adjustAnnualWithdrawal(30000,-1),29000);assert.equal(adjustAnnualWithdrawal(500,-1),0);assert.equal(adjustAnnualWithdrawal(0,-1),0);assert.equal(adjustAnnualWithdrawal(11999500,1),12000000);assert.equal(adjustAnnualWithdrawal(12000000,1),12000000);let value=10.23;for(let n=0;n<100;n++)value=adjustAnnualWithdrawal(value,1);for(let n=0;n<100;n++)value=adjustAnnualWithdrawal(value,-1);assert.equal(value,10.23);assert.throws(()=>adjustAnnualWithdrawal(NaN,1));assert.throws(()=>adjustAnnualWithdrawal(-1,1));assert.throws(()=>adjustAnnualWithdrawal(1,0));});
test('withdrawal status distinguishes no target, no horizon, locked funds and actual depletion',()=>{const p=createExamplePlan();let r={months:[],firstUnmetWithdrawal:null};assert.match(withdrawalOutcome(p,r).text,/Choose an annual/);p.drawdown.annualAmount=12000;assert.match(withdrawalOutcome(p,r).text,/outside this projection/);r.months=[{month:'2030-01',withdrawalTarget:1000}];assert.match(withdrawalOutcome(p,r).text,/end of the projection, not a guarantee/);r.firstUnmetWithdrawal={month:'2030-01',locked:10000,total:10000};assert.match(withdrawalOutcome(p,r).text,/not the same as all your money running out/);r.firstUnmetWithdrawal={month:'2030-01',locked:0,total:0};assert.match(withdrawalOutcome(p,r).text,/pots are depleted/);assert.equal(withdrawalOutcome(p,r).hasGap,true);});

import {adjustRetirementMonth,shiftRetirementYear,retirementYearControls,retirementMarker,retirementDateLinks} from '../src/view.js';
test('retirement shifts one year while preserving month, partner and input',()=>{
 const plan=createExamplePlan();plan.people.reverse();const before=JSON.stringify(plan);
 const shifted=shiftRetirementYear(plan,1);
 assert.equal(shifted.people.find(p=>p.id==='you').retirementMonth,'2045-11');
 assert.deepEqual(shifted.people.find(p=>p.id==='partner'),plan.people.find(p=>p.id==='partner'));
 assert.equal(JSON.stringify(plan),before);assert.notEqual(shifted,plan);
 assert.deepEqual(shiftRetirementYear(shifted,-1),plan);
 assert.throws(()=>adjustRetirementMonth(plan,0));
});
test('matching wizard dates move; custom contribution dates and all other dates stay fixed',()=>{
 const plan=createExamplePlan();plan.pots[0].contributionEnd='2044-11';plan.pots[3].contributionEnd='2044-11';
 const shifted=shiftRetirementYear(plan,-1);
 assert.equal(shifted.spendingStart,'2043-11');assert.equal(shifted.pots[0].contributionEnd,'2043-11');
 assert.equal(shifted.pots[1].contributionEnd,'2044-10');assert.equal(shifted.pots[3].contributionEnd,'2044-11');
 assert.deepEqual(shifted.events,plan.events);assert.deepEqual(shifted.incomes,plan.incomes);
 assert.deepEqual(shiftRetirementYear(shifted,1),plan);
 plan.spendingStart='2043-12';assert.equal(shiftRetirementYear(plan,1).spendingStart,'2043-12');
});
test('retirement bounds use projection start, birthday age 18 and exclusive end-age month',()=>{
 const plan=createExamplePlan(), primary=plan.people[0];primary.retirementMonth='2027-01';
 assert.equal(adjustRetirementMonth(plan,-1),'2027-01');
 primary.retirementMonth='2074-10';assert.equal(adjustRetirementMonth(plan,1),'2074-10');
 primary.retirementMonth='2073-11';assert.equal(adjustRetirementMonth(plan,1),'2073-11');
 primary.dob='2020-06-15';primary.retirementMonth='2038-06';
 assert.equal(retirementYearControls(plan).minMonth,'2038-06');assert.equal(adjustRetirementMonth(plan,-1),'2038-06');
 primary.dob='2000-06-01';plan.endAge=110;assert.equal(retirementYearControls(plan).maxMonth,'2106-10');
});
test('old retirement outside the horizon can move inward exactly one year without deadlock',()=>{
 const plan=createExamplePlan(),primary=plan.people[0];primary.retirementMonth='2020-02';
 assert.equal(adjustRetirementMonth(plan,-1),'2020-02');assert.equal(adjustRetirementMonth(plan,1),'2021-02');
 primary.retirementMonth='2090-12';assert.equal(adjustRetirementMonth(plan,-1),'2089-12');assert.equal(adjustRetirementMonth(plan,1),'2090-12');
});
test('linked contribution dates cannot become invalid or lose reversible matching',()=>{
 const plan=createExamplePlan();plan.pots[0].contributionStart='2044-01';plan.pots[0].contributionEnd='2044-11';
 assert.equal(adjustRetirementMonth(plan,-1),'2044-11');assert.equal(shiftRetirementYear(plan,-1),plan);
});
test('retirement marker maps to annual sample and labels its monthly precision honestly',()=>{
 const years=[{year:2043},{year:2044},{year:2045}];
 const marker=retirementMarker('2044-06',years);
 assert.equal(marker.visible,true);assert.equal(marker.index,1);assert.equal(marker.position,.5);assert.match(marker.label,/June 2044/);assert.match(marker.note,/not an exact monthly balance/);
 assert.equal(retirementMarker('2043-01',years).position,0);assert.equal(retirementMarker('2045-12',years).position,1);
 assert.equal(retirementMarker('2044-06',[{year:2044}]).position,0);
});
test('retirement marker omits out-of-range dates including partial boundary years',()=>{
 const years=[{year:2026},{year:2027}], months=[{month:'2026-11'},{month:'2027-05'}];
 for(const month of ['2025-12','2026-10','2027-06','2028-01']){
  const marker=retirementMarker(month,years,months);assert.equal(marker.visible,false);assert.equal(marker.position,null);assert.match(marker.note,/outside the projection/);
 }
 assert.equal(retirementMarker('2026-11',years,months).visible,true);assert.equal(retirementMarker('2027-05',years,months).visible,true);
 assert.equal(retirementMarker('2044-06',[]).visible,false);
});

test('stable date links preserve custom dates when retirement passes through them',()=>{
 const plan=createExamplePlan();plan.pots[0].contributionEnd='2045-11';plan.spendingStart='2045-11';plan.pots[1].contributionEnd='2044-11';
 const links=retirementDateLinks(plan), shifted=shiftRetirementYear(plan,1,links);
 assert.deepEqual(links,{potIds:['cash'],spending:false});
 assert.deepEqual(shiftRetirementYear(shifted,-1,links),plan);
 assert.equal(shiftRetirementYear(shifted,1,links).pots[0].contributionEnd,'2045-11');
 assert.equal(shiftRetirementYear(shifted,1,links).spendingStart,'2045-11');
});

import {reconcileRetirementLinks} from '../src/view.js';
test('unrelated editor changes preserve original retirement matching dates after a collision',()=>{
 const p=createExamplePlan(),old=p.people.find(p=>p.id==='you').retirementMonth;
 p.pots[0].contributionEnd=old;p.pots[1].owner='you';p.pots[1].contributionEnd=`${Number(old.slice(0,4))+1}${old.slice(4)}`;
 const links=retirementDateLinks(p),later=shiftRetirementYear(p,1,links),edit=structuredClone(later);edit.name='New name';
 const kept=reconcileRetirementLinks(later,edit,links);assert.deepEqual(kept,links);
 assert.equal(shiftRetirementYear(edit,-1,kept).pots[1].contributionEnd,p.pots[1].contributionEnd);
 edit.pots[0].contributionEnd='2090-01';assert.ok(!reconcileRetirementLinks(later,edit,links).potIds.includes(edit.pots[0].id));
 edit.people[0].retirementMonth='2040-02';assert.deepEqual(reconcileRetirementLinks(later,edit,links),retirementDateLinks(edit));
});
