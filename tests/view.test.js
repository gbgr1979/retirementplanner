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
 const draft=createWizardDraft('2026-11');draft.you.age=47;draft.you.retirementAge=57;draft.you.statePension.enabled=false;
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

import {planSummary} from '../src/view.js';
test('pot summary uses exact retirement opening and final partial-year closing after withdrawals',()=>{
 const p=createExamplePlan();p.startMonth='2044-10';p.endAge=66;p.people[0].retirementMonth='2044-11';
 const r=project(p),s=planSummary(p,r,false),ret=r.months.find(m=>m.month==='2044-11'),last=r.months.at(-1);
 assert.equal(s.retirement.value,ret.opening);assert.equal(s.retirement.month,'2044-11');assert.match(s.retirement.label,/November 2044/);
 assert.equal(last.month,'2045-10');assert.equal(s.end.value,last.total);assert.equal(s.end.month,last.month);
 assert.match(s.retirement.dateLabel,/November 2044 · before withdrawals/);assert.match(s.end.dateLabel,/October 2045 · up to your age 66/);assert.match(s.end.note,/before any tax on future withdrawals/);assert.match(s.end.label,/October 2045/);assert.match(s.end.note,/up to your age 66/);assert.match(s.end.note,/before your birthday month/);assert.match(s.end.note,/not a predicted date of death/);
});
test('pot summary discounts retirement opening and final closing at their distinct exact month offsets',()=>{
 const p=createExamplePlan();p.inflation=12;p.people[0].retirementMonth='2026-12';
 const r={months:[{month:'2026-11',opening:200,total:190},{month:'2026-12',opening:190,total:180},{month:'2027-02',opening:170,total:160}]};
 const s=planSummary(p,r);assert.equal(s.retirement.value,190/(1.12**(1/12)));assert.equal(s.end.value,160/(1.12**(4/12)));
 p.people[0].retirementMonth=p.startMonth;assert.equal(planSummary(p,r).retirement.value,200);
 p.inflation=0;assert.equal(planSummary(p,r).end.value,160);
});
test('pot summary includes active partner and locked pots in totals but horizon follows primary identity',()=>{
 const p=createExamplePlan();p.startMonth='2044-11';p.endAge=66;p.includePartner=true;p.people.reverse();
 const r=project(p),s=planSummary(p,r,false),last=r.months.at(-1);
 assert.equal(s.end.value,last.accessible+last.locked);assert.match(s.end.note,/your partner/);assert.match(s.end.note,/age 66/);
 p.includePartner=false;const solo=planSummary(p,project(p),false);assert.doesNotMatch(solo.end.note,/your partner/);assert.ok(solo.end.value<s.end.value);
 const locked={months:[{month:'2044-11',opening:100,total:70,accessible:0,locked:70}]};assert.equal(planSummary(p,locked,false).end.value,70);
});
test('pot summary keeps zero and depleted balances and never fabricates out-of-range retirement snapshots',()=>{
 const p=createExamplePlan();p.people[0].retirementMonth=p.startMonth;
 const r={months:[{month:p.startMonth,opening:0,total:0}]};
 assert.equal(planSummary(p,r).retirement.value,0);assert.equal(planSummary(p,r).end.value,0);
 r.months[0].opening=100;assert.equal(planSummary(p,r,false).end.value,0);
 for(const retirement of ['2025-01','2100-01']){p.people[0].retirementMonth=retirement;const s=planSummary(p,r);assert.equal(s.retirement.value,null);assert.match(s.retirement.note,/no retirement balance/);}
 assert.equal(planSummary(p,{months:[]}).end.value,null);assert.equal(planSummary(p,{months:[]}).end.month,null);
});
test('80-year cap is not presented as reaching an unmodelled planned age',()=>{
 const p=createExamplePlan();p.people[0].dob='2020-06-01';p.people[0].retirementMonth='2085-06';p.endAge=110;
 const r={months:[{month:'2106-10',opening:100,total:99}]},s=planSummary(p,r,false);assert.equal(s.end.month,'2106-10');assert.equal(s.end.value,r.months.at(-1).total);
 assert.match(s.end.note,/80-year limit before your planned end age of 110/);assert.doesNotMatch(s.end.note,/Planned up to your age/);
});

import {ageAtMonthStart} from '../src/view.js';
test('retirement marker shows actual age at the start of its month, including birthday boundaries',()=>{
 assert.equal(ageAtMonthStart('1980-11-01','2037-11'),57);assert.equal(ageAtMonthStart('1980-11-15','2037-11'),56);assert.equal(ageAtMonthStart('1980-11-15','2037-12'),57);assert.equal(ageAtMonthStart('1980-11-15','2037-10'),56);
 assert.equal(ageAtMonthStart('1980-02-29','2037-03'),57);assert.equal(ageAtMonthStart('1980-02-29','2037-02'),56);assert.equal(ageAtMonthStart('bad','2037-11'),null);assert.equal(ageAtMonthStart('1980-02-30','2037-11'),null);
 const years=[{year:2026},{year:2037},{year:2038}],marker=retirementMarker('2037-11',years,[],'1980-11-01');assert.equal(marker.chartLabel,'Retirement – age 57');assert.match(marker.label,/November 2037/);assert.match(svgChart(years,[],true,marker),/Retirement – age 57/);assert.equal(retirementMarker('2038-11',years,[],'1980-11-01').age,58);assert.equal(retirementMarker('2037-11',years).chartLabel,'Retirement');
});

test('income-funded target is not misreported as retirement outside the projection',()=>{
 const p=createExamplePlan();p.drawdown={stages:[],mode:'totalIncome',annualAmount:12000,inflationLinked:false};
 const r={months:[{month:'2040-01',withdrawalTarget:0,incomeTarget:1000}],firstUnmetWithdrawal:null};
 assert.match(withdrawalOutcome(p,r).text,/funded through/);assert.match(withdrawalCardSummary(p,r),/Gross target funded through/);
});

import {growthRateControls,shiftGroupGrowth,GROWTH_RATE_STEP} from '../src/view.js';
test('growth controls group every supported pot type and show honest mixed ranges',()=>{
 const p=createExamplePlan();p.includePartner=true;
 p.pots.push({...p.pots[2],id:'sipp',type:'sipp',growth:4.125});
 const [savings,isa,pension]=growthRateControls(p);
 assert.equal(GROWTH_RATE_STEP,.5);assert.equal(savings.count,1);assert.equal(savings.rate,2.5);assert.equal(savings.display,'2.5%');
 assert.equal(isa.count,2);assert.equal(isa.rate,null);assert.equal(isa.mixed,true);assert.equal(isa.display,'Mixed: 3%–5%');
 assert.equal(pension.count,2);assert.equal(pension.min,4.125);assert.equal(pension.max,5);
 for(const control of [savings,isa,pension])assert.ok(control.canDecrease&&control.canIncrease);
 for(const category of ['savings','isa','pension']){
  const changed=shiftGroupGrowth(p,category,1),types=category==='savings'?['savings']:category==='isa'?['cashIsa','stocksIsa']:['sipp','workplace'];
  changed.pots.forEach((pot,i)=>assert.equal(pot.growth,p.pots[i].growth+(types.includes(pot.type)?.5:0)));
 }
});
test('growth shifts preserve heterogeneous precise rates, all unrelated fields and hidden partner pots',()=>{
 const p=createExamplePlan();p.pots[0].growth=3.123456789;p.pots.push({...p.pots[0],id:'anotherIsa',growth:1.234567891});
 const before=structuredClone(p),shifted=shiftGroupGrowth(p,'isa',1);
 assert.deepEqual(p,before);assert.notEqual(shifted,p);assert.equal(shifted.pots[0].growth,3.623456789);assert.equal(shifted.pots.at(-1).growth,1.734567891);
 assert.equal(shifted.pots[3],p.pots[3]);assert.equal(growthRateControls(p)[1].count,2);
 assert.deepEqual(shiftRetirementYear(p,1).incomes,shifted.incomes);
 assert.deepEqual({...shifted,pots:p.pots},p);
 for(let i=0;i<p.pots.length;i++)assert.deepEqual({...shifted.pots[i],growth:p.pots[i].growth},p.pots[i]);
 assert.deepEqual(shiftGroupGrowth(shifted,'isa',-1),p);
 p.includePartner=true;assert.equal(shiftGroupGrowth(p,'isa',1).pots[3].growth,3.5);
});
test('growth steps reject invalid inputs and stop the entire group at base-rate bounds',()=>{
 const p=createExamplePlan();p.includePartner=true;p.pots[0].growth=49.75;
 assert.equal(growthRateControls(p)[1].canIncrease,false);assert.equal(shiftGroupGrowth(p,'isa',1),p);
 p.pots[0].growth=49.5;let q=shiftGroupGrowth(p,'isa',1);assert.equal(q.pots[0].growth,50);assert.equal(shiftGroupGrowth(q,'isa',1),q);
 p.pots[0].growth=-49.5;q=shiftGroupGrowth(p,'isa',-1);assert.equal(q.pots[0].growth,-50);assert.equal(shiftGroupGrowth(q,'isa',-1),q);
 p.pots[0].growth=-49.75;assert.equal(shiftGroupGrowth(p,'isa',-1),p);
 for(const growth of [NaN,Infinity,-Infinity,'5',51,-51]){p.pots[0].growth=growth;assert.equal(shiftGroupGrowth(p,'isa',1),p);assert.equal(growthRateControls(p)[1].canDecrease,false);}
 for(const direction of [0,2,'1',NaN])assert.equal(shiftGroupGrowth(p,'savings',direction),p);
 for(const category of ['unknown','__proto__',null])assert.equal(shiftGroupGrowth(p,category,1),p);
 p.pots=[];assert.equal(shiftGroupGrowth(p,'savings',1),p);for(const row of growthRateControls(p)){assert.equal(row.display,'No pots');assert.equal(row.count,0);assert.equal(row.canIncrease,false);assert.equal(row.rate,null);}
});
test('decimal growth steps restore precise custom rates after repeated comparisons',()=>{
 for(const growth of [0.1,-0.1,3.123456789,0.000001,-0.000001,49.5,-49.5]){
  const p=createExamplePlan();p.pots[1].growth=growth;let q=p;
  const direction=growth>0?-1:1;
  for(let i=0;i<20;i++)q=shiftGroupGrowth(q,'savings',direction);
  for(let i=0;i<20;i++)q=shiftGroupGrowth(q,'savings',-direction);
  assert.deepEqual(q,p);assert.ok(Number.isFinite(q.pots[1].growth));
 }
});
test('growth comparison changes model totals and chart, survives saving, and restores projection',()=>{
 const p=createExamplePlan(),baseline=project(p),shifted=shiftGroupGrowth(p,'pension',1),result=project(shifted);
 assert.ok(result.years.at(-1).closing>baseline.years.at(-1).closing);
 const chart=r=>svgChart(r.years,[{colour:'#21624d',values:r.years.map(y=>y.closing)}],true);
 assert.notEqual(chart(result),chart(baseline));
 const loaded=parsePlan(serializePlan(shifted));assert.deepEqual(loaded,shifted);assert.deepEqual(project(loaded),result);
 assert.deepEqual(project(shiftGroupGrowth(shifted,'pension',-1)),baseline);
});

import {projectionEventMarkers} from '../src/view.js';
function eventFixture() {
 const plan=createExamplePlan();plan.includePartner=true;
 plan.incomes=[{...plan.incomes[0],owner:'you',startMonth:'2046-03',endMonth:'2047-12'}, {...plan.incomes[0],id:'partnerState',owner:'partner',startMonth:'2046-11',endMonth:'2047-12'}];
 const result={years:[{year:2045},{year:2046},{year:2047}],months:[{month:'2045-11',opening:100,total:100,incomeGross:0},{month:'2046-03',opening:100,total:50,incomeGross:900},{month:'2046-11',opening:50,total:40,incomeGross:1800},{month:'2047-05',opening:40,total:30,incomeGross:1800}]};
 return {plan,result};
}
test('State Pension markers use actual included positive income and distinguish owners sharing a year',()=>{
 const {plan,result}=eventFixture(),before=structuredClone({plan,result});
 const {markers,notes}=projectionEventMarkers(plan,result);
 assert.equal(markers.length,2);assert.deepEqual(markers.map(m=>m.index),[1,1]);
 assert.deepEqual(markers.map(m=>m.owner),['you','partner']);assert.match(markers[0].label,/March 2046/);assert.match(markers[1].label,/November 2046/);
 assert.ok(notes.every(note=>note.includes('Income, not pot wealth')&&note.includes('not an exact monthly balance')));
 assert.deepEqual({plan,result},before);
 plan.includePartner=false;assert.equal(projectionEventMarkers(plan,result).markers.length,1);
 plan.incomes[0].monthlyAmount=0;assert.equal(projectionEventMarkers(plan,result).markers.length,0);
});
test('State Pension already active is a note, while zero, excluded and out-of-horizon streams have no marker',()=>{
 const {plan,result}=eventFixture();plan.incomes=plan.incomes.slice(0,1);
 plan.incomes[0].startMonth='2044-01';result.months[0].incomeGross=900;
 let events=projectionEventMarkers(plan,result);assert.equal(events.markers.length,0);assert.match(events.notes[0],/already in payment/);
 for(const dates of [['2044-01','2045-10'],['2047-06','2047-12'],['2048-01','2049-01']]){
  [plan.incomes[0].startMonth,plan.incomes[0].endMonth]=dates;assert.deepEqual(projectionEventMarkers(plan,result),{markers:[],notes:[]});
 }
 plan.incomes[0].startMonth='2046-03';plan.incomes[0].endMonth='2047-12';result.months.forEach(row=>row.incomeGross=0);
 assert.deepEqual(projectionEventMarkers(plan,result),{markers:[],notes:[]});
 plan.incomes=[];assert.deepEqual(projectionEventMarkers(plan,result),{markers:[],notes:[]});
});
test('depletion means earliest exact total zero after wealth, including first opening and partner pots',()=>{
 const {plan,result}=eventFixture();plan.incomes=[];plan.people.find(p=>p.id==='you').dob='1957-11-15';
 result.months[2].total=0;result.months[3].opening=0;result.months[3].total=0;
 let events=projectionEventMarkers(plan,result),event=events.markers[0];
 assert.equal(event.kind,'depletion');assert.equal(event.month,'2046-11');assert.equal(event.age,88);assert.equal(event.chartLabel,'Pot ran out – age 88');assert.match(event.label,/partner’s pots/);
 result.months[3].total=10;event=projectionEventMarkers(plan,result).markers[0];assert.equal(event.chartLabel,'Pot first reaches £0 – age 88');assert.equal(event.recovers,true);
 assert.match(event.label,/becomes positive again/);
 result.months=result.months.slice(0,1);result.months[0].total=0;assert.equal(projectionEventMarkers(plan,result).markers[0].month,'2045-11');
 result.months[0].opening=0;assert.deepEqual(projectionEventMarkers(plan,result),{markers:[],notes:[]});
});
test('shortfalls, locked funds and tiny positive balances do not become depletion annotations',()=>{
 const {plan,result}=eventFixture();plan.incomes=[];
 for(const balance of [100,0.01,0.000000001,Number.MIN_VALUE]){
  result.months.forEach(row=>{row.total=balance;row.accessible=0;row.locked=balance;row.unmetWithdrawal=1000;});
  result.firstUnmetWithdrawal={month:result.months[0].month,total:balance,locked:balance};
  assert.deepEqual(projectionEventMarkers(plan,result),{markers:[],notes:[]});
 }
 assert.deepEqual(projectionEventMarkers(plan,{years:[],months:[]}),{markers:[],notes:[]});
});
test('event overlays preserve wealth paths and scale, escape text and avoid colliding labels',()=>{
 const {plan,result}=eventFixture();result.months.at(-1).total=0;
 const events=projectionEventMarkers(plan,result),series=[{colour:'#123456',values:[100,40,0]}],ret=retirementMarker('2046-03',result.years,result.months,plan.people[0].dob);
 const baseline=svgChart(result.years,series,true,ret),svg=svgChart(result.years,series,true,ret,events.markers);
 assert.deepEqual(svg.match(/<path[^>]*>/g),baseline.match(/<path[^>]*>/g));assert.deepEqual(svg.match(/<text[^>]*>£[^<]*<\/text>/g),baseline.match(/<text[^>]*>£[^<]*<\/text>/g));
 assert.equal((svg.match(/class="state-marker"/g)||[]).length,2);assert.equal((svg.match(/class="depletion-marker"/g)||[]).length,1);
 const rows=[...svg.matchAll(/class="state-marker-label"[^>]* y="(\d+)"/g)].map(match=>Number(match[1]));assert.equal(rows.length,2);assert.notEqual(rows[0],rows[1]);assert.ok(rows.every(y=>y>32));
 assert.match(svg,/aria-label="Your State Pension starts: March 2046/);
 const escaped=svgChart(result.years,series,true,ret,[{index:1,kind:'state',label:'<script>',chartLabel:'<script>'}]);assert.doesNotMatch(escaped,/<script>/);assert.match(escaped,/&lt;script&gt;/);
});
test('actual projected State Pension starts are annotated only when received inside the horizon',()=>{
 const plan=createExamplePlan();let result=project(plan);
 let event=projectionEventMarkers(plan,result).markers.find(marker=>marker.kind==='state');assert.equal(event.month,plan.incomes[0].startMonth);assert.ok(result.months.find(row=>row.month===event.month).incomeGross>0);
 plan.incomes[0].startMonth='2100-01';plan.incomes[0].endMonth='2101-01';assert.ok(!projectionEventMarkers(plan,project(plan)).markers.some(marker=>marker.kind==='state'));
});

test('positive later stages work when baseline is zero and zero final stages do not shorten funded horizon',()=>{
 const p=createExamplePlan();p.people[0].retirementMonth=p.startMonth;p.drawdown.annualAmount=0;p.drawdown.stages=[{fromAge:50,annualAmount:120},{fromAge:70,annualAmount:0}];p.incomes=[];p.events=[];
 p.pots.forEach(pot=>{pot.balance=1000000;pot.monthlyContribution=0;pot.employerContribution=0;});
 const r=project(p);assert.match(withdrawalOutcome(p,r).text,/funded through/);assert.match(withdrawalCardSummary(p,r),/2074/);
 p.drawdown.stages=[{fromAge:110,annualAmount:120}];const outside=project(p);assert.match(withdrawalCardSummary(p,outside),/No positive income target/);
});
