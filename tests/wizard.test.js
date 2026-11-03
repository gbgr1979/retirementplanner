import test from 'node:test';
import assert from 'node:assert/strict';
import {createWizardDraft,validateWizardStep,buildWizardPlan} from '../src/wizard-plan.js';
import {validatePlan,serializePlan,parsePlan} from '../src/plan.js';
import {project} from '../src/model.js';
const ready=()=>{const draft=createWizardDraft('2026-11');draft.you.age=47;return draft;};
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

test('excluded partner placeholder cannot be mistaken for entered details',()=>{const draft=createWizardDraft('2026-11');draft.you.age=47;const plan=buildWizardPlan(draft);assert.equal(plan.people.find(p=>p.id==='partner').name,'Partner (details not entered)');assert.equal(plan.includePartner,false);});

test('wizard v2 uses annual gross draw target from monthly spending, without assumed pension income',()=>{
 const d=ready();d.monthlySpending=2400;const p=buildWizardPlan(d);assert.equal(p.version,2);assert.deepEqual(p.drawdown,{annualAmount:28800,inflationLinked:true});assert.deepEqual(p.incomes,[]);assert.deepEqual(p.events,[]);
 d.monthlySpending=0;assert.equal(buildWizardPlan(d).drawdown.annualAmount,0);d.monthlySpending=1000000;assert.equal(buildWizardPlan(d).drawdown.annualAmount,12000000);
});
