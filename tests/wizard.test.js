import test from 'node:test';
import assert from 'node:assert/strict';
import {createWizardDraft,syncWizardStatePensionDefaults,validateWizardStep,buildWizardPlan} from '../src/wizard-plan.js';
import {validatePlan,serializePlan,parsePlan} from '../src/plan.js';
import {project} from '../src/model.js';
const ready=()=>{const draft=createWizardDraft('2026-11');draft.you.age=47;draft.you.statePension.enabled=false;draft.partner.statePension.enabled=false;return draft;};
test('new wizard has blank ages, zero balances and six independent pots',()=>{
 const d=createWizardDraft('2026-11');assert.equal(d.you.age,'');assert.equal(d.partner.age,'');assert.equal(d.pots.length,6);assert.ok(d.pots.every(p=>p.balance===0&&p.monthlyContribution===0&&p.employerContribution===0));assert.equal(validateWizardStep(d,0).valid,false);
 d.pots[0].balance=4;assert.equal(createWizardDraft('2026-11').pots[0].balance,0);
});
test('fresh personal plan has no demo income, events, or assets and preserves schema',()=>{
 const p=buildWizardPlan(ready());assert.equal(p.name,'My retirement plan');assert.deepEqual(p.incomes,[]);assert.deepEqual(p.events,[]);assert.equal(p.pots.length,3);assert.ok(p.pots.every(p=>p.balance===0));assert.equal(validatePlan(p).valid,true);assert.deepEqual(parsePlan(serializePlan(p)),p);
});
test('approximate birth and retirement dates use supplied month and day 01',()=>{
 const d=ready();d.you.retirementAge=65;const p=buildWizardPlan(d);assert.equal(p.people[0].dob,'1979-11-01');assert.equal(p.people[0].retirementMonth,'2044-11');assert.equal(p.spendingStart,'2044-11');assert.equal(p.pots[0].contributionEnd,'2044-11');assert.equal(p.endAge,95);
});
test('pure validation and building do not mutate draft or erase back-navigation values',()=>{
 const d=ready();d.partner.age=44;d.pots[3].balance=12345;const before=structuredClone(d);for(let step=0;step<4;step++)validateWizardStep(d,step);const p=buildWizardPlan(d);assert.deepEqual(d,before);p.pots[0].balance=2;assert.deepEqual(d,before);
});
test('partner toggle excludes but retains draft data and includes it when enabled',()=>{
 const d=ready();d.partner.age=44;d.partner.retirementAge=64;d.pots[3].balance=12000;
 let p=buildWizardPlan(d);assert.equal(p.includePartner,false);assert.equal(p.pots.length,3);assert.equal(p.people.length,2);assert.equal(d.pots[3].balance,12000);
 d.includePartner=true;p=buildWizardPlan(d);assert.equal(p.pots.length,6);assert.equal(p.people[1].dob,'1982-11-01');assert.equal(p.people[1].retirementMonth,'2046-11');assert.equal(p.pots[3].balance,12000);
});
test('partner age is required only when included',()=>{const d=ready();assert.equal(validateWizardStep(d,0).valid,true);d.includePartner=true;assert.ok(validateWizardStep(d,0).errors.some(e=>e.field==='partner.age'));});
test('ages and horizon boundaries are explicit',()=>{
 for(const age of ['',17,91,47.5,NaN,'47']){const d=ready();d.you.age=age;assert.equal(validateWizardStep(d,0).valid,false);}
 for(const age of [18,90]){const d=ready();d.you.age=age;d.you.retirementAge=age;assert.equal(validateWizardStep(d,0).valid,true);assert.equal(validatePlan(buildWizardPlan(d)).valid,true);}
 const d=ready();d.you.retirementAge=46;assert.equal(validateWizardStep(d,0).valid,false);d.you.age=18;d.you.retirementAge=100;assert.equal(validateWizardStep(d,0).valid,false);d.you.retirementAge=97;assert.equal(buildWizardPlan(d).endAge,98);
});
test('strict numeric input and correct schema maximums',()=>{
 const d=ready();for(const value of [-1,100000001,Infinity,'5','']){d.pots[0].balance=value;assert.equal(validateWizardStep(d,1).valid,false);}d.pots[0].balance=100000000;assert.equal(validateWizardStep(d,1).valid,true);
 d.inflation=16;assert.equal(validateWizardStep(d,2).valid,false);d.inflation=0;d.monthlySpending=0;assert.equal(validateWizardStep(d,2).valid,true);d.pots[0].growth=-51;assert.equal(validateWizardStep(d,2).valid,false);
});
test('pension total monthly amount is gross once, with no implicit relief or employer duplication',()=>{
 const d=ready();d.pots[2].monthlyContribution=700;const p=buildWizardPlan(d);assert.equal(p.pots[2].monthlyContribution,700);assert.equal(p.pots[2].employerContribution,0);assert.equal(p.pots[2].contributionBasis,'gross');assert.equal(project(p).months[0].contributions,700);
 d.pots[2].employerContribution=100;assert.equal(project(buildWizardPlan(d)).months[0].contributions,800);
});
test('result produces a finite usable forecast',()=>{
 const d=ready();d.pots[0].balance=20000;d.pots[1].monthlyContribution=200;const result=project(buildWizardPlan(d));assert.ok(result.months.length>0);assert.ok(result.months.every(m=>Number.isFinite(m.total)&&Number.isFinite(m.spending)));assert.equal(result.months[0].incomeGross,0);
});
test('bad shape and unsupported steps fail usefully; build does not accept incomplete draft',()=>{
 assert.equal(validateWizardStep(null,0).valid,false);assert.equal(validateWizardStep(ready(),5).valid,false);assert.throws(()=>buildWizardPlan(createWizardDraft('2026-11')),/age/);
 const d=ready();d.pots.pop();assert.equal(validateWizardStep(d,1).valid,false);d.startMonth='2026-13';assert.equal(validateWizardStep(d,0).valid,false);
});

test('fresh pension uses statutory access age rather than inventing a 57 minimum before 2028',()=>{
 const d=ready();d.you.age=56;d.pots[2].balance=1000;d.pots[2].growth=0;d.pots[2].fee=0;
 const p=buildWizardPlan(d);assert.equal(p.pots[2].accessAge,55);assert.equal(project(p).months[0].accessible,1000);assert.equal(project(p).months[0].locked,0);
 d.you.age=53;const forecast=project(buildWizardPlan(d));
 assert.equal(forecast.months.find(m=>m.month==='2028-11').locked,1000);
 assert.equal(forecast.months.find(m=>m.month==='2030-11').accessible,1000);
});

test('excluded partner placeholder cannot be mistaken for entered details',()=>{const draft=createWizardDraft('2026-11');draft.you.age=47;syncWizardStatePensionDefaults(draft);const plan=buildWizardPlan(draft);assert.equal(plan.people.find(p=>p.id==='partner').name,'Partner (details not entered)');assert.equal(plan.includePartner,false);});

test('wizard v3 uses annual gross draw target from monthly spending, without assumed pension income',()=>{
 const d=ready();d.monthlySpending=2400;const p=buildWizardPlan(d);assert.equal(p.version,3);assert.deepEqual(p.drawdown,{mode:'pots',annualAmount:28800,inflationLinked:true});assert.deepEqual(p.incomes,[]);assert.deepEqual(p.events,[]);
 d.monthlySpending=0;assert.equal(buildWizardPlan(d).drawdown.annualAmount,0);d.monthlySpending=1000000;assert.equal(buildWizardPlan(d).drawdown.annualAmount,12000000);
});

const forecast=(d,owner='you',overrides={})=>Object.assign(d[owner].statePension,{enabled:true,weeklyAmount:230.25,startMonth:'2046-11',escalation:2.5},overrides);
test('new wizard defaults use full-rate illustration independently for each person',()=>{
 const d=createWizardDraft('2026-11');assert.equal(d.you.statePension.enabled,true);assert.equal(d.you.statePension.weeklyAmount,241.3);assert.equal(d.you.statePension.escalation,2.5);
 d.you.age=47;d.partner.age=49;d.includePartner=true;syncWizardStatePensionDefaults(d);
 assert.equal(d.you.statePension.startMonth,'2047-11');assert.equal(d.partner.statePension.startMonth,'2045-06');
 const p=buildWizardPlan(d);assert.equal(p.incomes.length,2);assert.equal(p.drawdown.mode,'totalIncome');assert.ok(Math.abs(p.incomes[0].monthlyAmount*12-12547.6)<1e-9);
 d.you.statePension.weeklyAmount=100;d.you.statePension.startMonth='2050-01';d.you.statePension.enabled=false;d.you.age=48;syncWizardStatePensionDefaults(d);
 assert.equal(d.you.statePension.weeklyAmount,100);assert.equal(d.you.statePension.startMonth,'2050-01');assert.equal(d.you.statePension.enabled,false);assert.equal(d.partner.statePension.weeklyAmount,241.3);
});
test('untouched dates follow changed ages but older unknown eligibility requires personal details',()=>{
 const d=createWizardDraft('2026-11');d.you.age=47;syncWizardStatePensionDefaults(d);d.you.age=48;syncWizardStatePensionDefaults(d);assert.equal(d.you.statePension.startMonth,'2046-11');
 d.you.age=80;d.you.retirementAge=80;syncWizardStatePensionDefaults(d);assert.equal(d.you.statePension.weeklyAmount,'');assert.equal(d.you.statePension.startMonth,'');assert.equal(validateWizardStep(d,1).valid,false);
 d.you.statePension.enabled=false;assert.equal(validateWizardStep(d,1).valid,true);
});
test('explicit forecast builds exactly one deterministic income with weekly annual conversion',()=>{
 const d=ready();forecast(d);const before=structuredClone(d), p=buildWizardPlan(d), income=p.incomes[0];
 assert.equal(p.incomes.length,1);assert.equal(income.id,'state-you');assert.equal(income.owner,'you');assert.equal(income.type,'state');assert.equal(income.monthlyAmount,230.25*52/12);assert.equal(income.startMonth,'2046-11');assert.equal(income.endMonth,'2074-10');assert.equal(income.escalation,2.5);assert.equal(p.drawdown.mode,'totalIncome');assert.equal(p.drawdown.annualAmount,24000);
 assert.deepEqual(buildWizardPlan(d),p);assert.deepEqual(d,before);assert.deepEqual(parsePlan(serializePlan(p)),p);
 p.incomes[0].monthlyAmount=1;assert.equal(buildWizardPlan(d).incomes[0].monthlyAmount,230.25*52/12);
});
test('disabled forecasts retain but ignore invalid values, zero creates no income',()=>{
 const d=ready();forecast(d,'you',{enabled:false,weeklyAmount:NaN,startMonth:'bad',escalation:99});const before=structuredClone(d);
 assert.equal(validateWizardStep(d,1).valid,true);assert.deepEqual(buildWizardPlan(d).incomes,[]);assert.deepEqual(d,before);
 forecast(d,'you',{weeklyAmount:0});assert.deepEqual(buildWizardPlan(d).incomes,[]);assert.equal(buildWizardPlan(d).drawdown.mode,'pots');
 d.you.statePension.enabled='true';assert.equal(validateWizardStep(d,1).valid,false);
});
test('enabled forecast requires explicit valid amount, claim month and editable escalation at money step',()=>{
 const d=ready();d.you.statePension.enabled=true;d.you.statePension.weeklyAmount='';assert.equal(validateWizardStep(d,0).valid,true);assert.equal(validateWizardStep(d,1).valid,false);assert.throws(()=>buildWizardPlan(d),/State Pension/);
 for(const weeklyAmount of ['', '230', NaN,Infinity,-1,10000.01]) {forecast(d,'you',{weeklyAmount});assert.ok(validateWizardStep(d,1).errors.some(e=>e.field==='you.statePension.weeklyAmount'));}
 for(const startMonth of ['', '2046-13','1979-10','1979-11','2251-01',null]) {forecast(d,'you',{startMonth});assert.ok(validateWizardStep(d,1).errors.some(e=>e.field==='you.statePension.startMonth'));}
 for(const escalation of ['', '2.5', NaN,Infinity,-0.1,15.01]) {forecast(d,'you',{escalation});assert.ok(validateWizardStep(d,1).errors.some(e=>e.field==='you.statePension.escalation'));}
 for(const value of [0,15]) {forecast(d,'you',{escalation:value,weeklyAmount:10000,startMonth:'1979-12'});assert.equal(validateWizardStep(d,1).valid,true);assert.equal(buildWizardPlan(d).incomes[0].escalation,value);}
});
test('partner forecast needs active partner and explicit opt in; toggles never duplicate or erase it',()=>{
 const d=ready();d.partner.age=44;forecast(d,'partner');assert.deepEqual(buildWizardPlan(d).incomes,[]);assert.equal(buildWizardPlan(d).drawdown.mode,'pots');
 d.includePartner=true;let p=buildWizardPlan(d);assert.equal(p.incomes.length,1);assert.equal(p.incomes[0].id,'state-partner');assert.equal(p.incomes[0].owner,'partner');assert.equal(p.drawdown.mode,'totalIncome');
 forecast(d);p=buildWizardPlan(d);assert.deepEqual(p.incomes.map(i=>i.id),['state-you','state-partner']);
 d.includePartner=false;assert.equal(buildWizardPlan(d).incomes.length,1);d.includePartner=true;assert.deepEqual(buildWizardPlan(d),p);
 d.partner.statePension.startMonth='1980-01';assert.ok(validateWizardStep(d,1).errors.some(e=>e.field==='partner.statePension.startMonth'));d.includePartner=false;assert.equal(validateWizardStep(d,1).valid,true);
});
test('forecast can begin before plan start or after projection without guessing another claim date',()=>{
 const d=ready();forecast(d,'you',{startMonth:'2025-01'});assert.equal(buildWizardPlan(d).incomes[0].startMonth,'2025-01');
 forecast(d,'you',{startMonth:'2080-01'});const p=buildWizardPlan(d);assert.equal(p.incomes[0].startMonth,'2080-01');assert.equal(p.incomes[0].endMonth,'2250-12');assert.ok(project(p).months.every(m=>m.incomeGross===0));
});

test('explicit claim override survives collisions with later inferred defaults and partner toggles',()=>{
 const d=createWizardDraft('2026-11');d.you.age=47;d.partner.age=47;d.includePartner=true;syncWizardStatePensionDefaults(d);
 for(const owner of ['you','partner'])d[owner].statePension.startMonth='2048-11';
 d.you.age=46;d.partner.age=46;d.includePartner=false;syncWizardStatePensionDefaults(d);
 d.you.age=45;d.partner.age=45;d.includePartner=true;syncWizardStatePensionDefaults(d);
 assert.equal(d.you.statePension.startMonth,'2048-11');assert.equal(d.partner.statePension.startMonth,'2048-11');
 assert.equal(buildWizardPlan(d).incomes[1].startMonth,'2048-11');
});
