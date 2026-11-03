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
 edit.people[0].retirementMonth='2040-02';assert.deepEqual(reconcileRetirementLinks(later,edit,links),{potIds:[],spending:false});
});

import {parsePlan,serializePlan} from '../src/plan.js';
test('saved plans do not guess automatic date links after reloading a custom-date collision',()=>{
 const p=createExamplePlan(),ret=p.people[0].retirementMonth;p.pots[0].contributionEnd=ret;
 p.pots[1].owner='you';p.pots[1].contributionEnd=`${Number(ret.slice(0,4))+1}${ret.slice(4)}`;
 const later=shiftRetirementYear(p,1,retirementDateLinks(p)),loaded=parsePlan(serializePlan(later));
 const unlinked={potIds:[],spending:false},back=shiftRetirementYear(loaded,-1,unlinked);
 assert.equal(back.pots[1].contributionEnd,p.pots[1].contributionEnd);assert.deepEqual(back.pots,loaded.pots);assert.equal(back.spendingStart,loaded.spendingStart);
 const manual=structuredClone(loaded);manual.people[0].retirementMonth=ret;
 assert.deepEqual(reconcileRetirementLinks(loaded,manual,unlinked),unlinked);
 manual.pots[0].contributionEnd=ret;assert.deepEqual(reconcileRetirementLinks(loaded,manual,unlinked).potIds,[manual.pots[0].id]);
});

import {projectionTimeline,svgChart} from '../src/view.js';
import {project} from '../src/model.js';
import {createWizardDraft,buildWizardPlan} from '../src/wizard-plan.js';
test('wizard timeline and actual SVG keep the projection start before and after retirement-year changes',()=>{
 const draft=createWizardDraft('2026-11');draft.you.age=47;draft.you.retirementAge=57;
 const plan=buildWizardPlan(draft);assert.equal(plan.people[0].retirementMonth,'2036-11');
 for(const candidate of [plan,shiftRetirementYear(plan,1),shiftRetirementYear(plan,-1)]){
  const result=project(candidate),years=result.years,marker=retirementMarker(candidate.people[0].retirementMonth,years,result.months);
  assert.equal(result.months[0].month,'2026-11');assert.equal(years[0].year,2026);assert.ok(marker.index>0);
  const series=[{colour:'#21624d',values:years.map(y=>y.closing)}],svg=svgChart(years,series,true,marker);
  assert.match(svg,/data-start-year="2026"/);assert.match(svg,/>2026<\/text>/);assert.match(svg,/d="M 66,/);
  assert.equal((svg.match(/class="retirement-marker"/g)||[]).length,1);assert.match(projectionTimeline(candidate,result),/Projection starts November 2026/);
 }
});
test('saved past or future projection starts are kept rather than silently relabelled as today',()=>{
 for(const start of ['2020-11','2030-11']){const p=createExamplePlan();p.startMonth=start;
  const loaded=parsePlan(serializePlan(p)),r=project(loaded),marker=retirementMarker(loaded.people[0].retirementMonth,r.years,r.months);
  assert.equal(r.months[0].month,start);assert.match(svgChart(r.years,[],true,marker),new RegExp(`data-start-year="${start.slice(0,4)}"`));assert.match(projectionTimeline(loaded,r),new RegExp(`Projection starts November ${start.slice(0,4)}`));
 }
});
test('retirement at the projection start is explained without dropping or inventing earlier years',()=>{
 const p=createExamplePlan();p.people[0].retirementMonth=p.startMonth;const r=project(p),marker=retirementMarker(p.startMonth,r.years,r.months);
 assert.equal(marker.index,0);assert.match(projectionTimeline(p,r),/Retirement is set to the projection start/);
 assert.match(svgChart(r.years,[],true,marker),new RegExp(`data-start-year="${p.startMonth.slice(0,4)}"`));
});

import {mountHelpDialog} from '../src/view.js';
function helpFixture(ids=['plan-help','plan-help-dialog','plan-help-close']) {
 const root={activeElement:null,elements:{},getElementById(id){return this.elements[id];}};
 for(const id of ids){
  const listeners=new Map();
  root.elements[id]={isConnected:true,open:false,showCount:0,
   addEventListener(type,listener){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(listener);},
   removeEventListener(type,listener){listeners.get(type)?.delete(listener);},
   dispatch(type,extra={}){const event={currentTarget:this,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...extra};for(const listener of listeners.get(type)||[])listener(event);return event;},
   focus(){root.activeElement=this;},
   showModal(){assert.equal(this.open,false);this.open=true;this.showCount++;},
   close(){this.open=false;this.dispatch('close');}
  };
 }
 const [trigger,dialog,close]=ids.map(id=>root.elements[id]);
 return {root,trigger,dialog,close};
}
test('help opens natively, focuses close and returns to its exact trigger without submitting',()=>{
 const {root,trigger,dialog,close}=helpFixture();mountHelpDialog(root);
 // Pointer activation need not focus the trigger before click is dispatched.
 root.activeElement={name:'previous financial input'};
 assert.equal(trigger.dispatch('click').defaultPrevented,true);
 assert.equal(dialog.open,true);assert.equal(dialog.showCount,1);assert.equal(root.activeElement,close);
 assert.equal(close.dispatch('click').defaultPrevented,true);
 assert.equal(dialog.open,false);assert.equal(root.activeElement,trigger);
});
test('help Escape and native cancel close and restore focus, unrelated keys leave it open',()=>{
 const {root,trigger,dialog,close}=helpFixture();mountHelpDialog(root);
 trigger.dispatch('click');assert.equal(dialog.dispatch('keydown',{key:'Tab'}).defaultPrevented,false);
 assert.equal(dialog.open,true);assert.equal(root.activeElement,close);
 assert.equal(dialog.dispatch('keydown',{key:'Escape'}).defaultPrevented,true);
 assert.equal(dialog.open,false);assert.equal(root.activeElement,trigger);
 trigger.dispatch('click');assert.equal(dialog.dispatch('cancel').defaultPrevented,true);
 assert.equal(dialog.open,false);assert.equal(root.activeElement,trigger);
});
test('repeated open is safe and stale close events cannot steal reopened help focus',()=>{
 const {root,trigger,dialog,close}=helpFixture();mountHelpDialog(root);
 trigger.dispatch('click');trigger.dispatch('click');assert.equal(dialog.showCount,1);
 close.dispatch('click');trigger.dispatch('click');assert.equal(dialog.showCount,2);
 dialog.dispatch('close');assert.equal(root.activeElement,close);assert.equal(dialog.open,true);
 dialog.close();assert.equal(root.activeElement,trigger);
});
test('help supports custom IDs, cleanup and disconnected openers',()=>{
 const {root,trigger,dialog,close}=helpFixture(['help','dialog','close']);
 const cleanup=mountHelpDialog(root,{triggerId:'help',dialogId:'dialog',closeId:'close'});
 trigger.dispatch('click');trigger.isConnected=false;dialog.close();assert.equal(root.activeElement,close);
 cleanup();trigger.dispatch('click');assert.equal(dialog.open,false);assert.equal(dialog.showCount,1);
 assert.throws(()=>mountHelpDialog(root),/controls are missing/);
});

import {withdrawalCardSummary} from '../src/view.js';
test('compact scenario status retains uncertainty and distinguishes locked funds',()=>{const p=createExamplePlan(),r={months:[],firstUnmetWithdrawal:null};assert.match(withdrawalCardSummary(p,r),/Set an annual/);p.drawdown.annualAmount=12000;assert.match(withdrawalCardSummary(p,r),/outside/);r.months=[{month:'2060-01',withdrawalTarget:1000}];assert.match(withdrawalCardSummary(p,r),/Not guaranteed/);r.firstUnmetWithdrawal={month:'2040-01',locked:2000,total:2000};assert.match(withdrawalCardSummary(p,r),/remain locked/);r.firstUnmetWithdrawal.locked=0;r.firstUnmetWithdrawal.total=0;assert.match(withdrawalCardSummary(p,r),/depleted/);});
