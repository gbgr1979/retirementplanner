import test from 'node:test';
import assert from 'node:assert/strict';
import {createExamplePlan,parsePlan,serializePlan} from '../src/plan.js';
import {project,incomeTax} from '../src/model.js';
import {stageStartMonth,stageIndexAtMonth,annualTargetAtMonth,incomeStageRanges,incomeSequenceSummary} from '../src/income-stages.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<.00001,`${a} != ${b}`);
function plan(){
 const p=createExamplePlan();p.startMonth='2026-04';p.endAge=72;p.inflation=0;p.monthlySpending=0;p.events=[];p.incomes=[];
 Object.assign(p.people[0],{dob:'1957-04-01',retirementMonth:'2026-04'});
 p.pots=[{...p.pots[0],balance:1000000,growth:0,fee:0,monthlyContribution:0,contributionStart:'2026-04',contributionEnd:'2026-04'}];
 p.drawdown={mode:'pots',annualAmount:48000,inflationLinked:false,stages:[{fromAge:70,annualAmount:36000},{fromAge:71,annualAmount:24000}]};return p;
}

test('plain-language income summary describes effective age ranges and skips unused stages',()=>{
 const p=plan();
 assert.equal(incomeSequenceSummary(p),'£48,000 a year until age 70, then £36,000 a year until age 71, then £24,000 a year to plan end.');
 p.people[0].retirementMonth='2028-06';
 assert.equal(incomeSequenceSummary(p),'£24,000 a year to plan end.');
 p.people[0].retirementMonth='2026-04';p.drawdown.stages=[{fromAge:110,annualAmount:1}];
 assert.equal(incomeSequenceSummary(p),'£48,000 a year to plan end.');
 p.people[0].retirementMonth='2030-04';
 assert.equal(incomeSequenceSummary(p),'Retirement is outside this projection.');
});
test('birthday boundary uses same month only for day one, with leap and year rollovers',()=>{
 assert.equal(stageStartMonth('1957-04-01',70),'2027-04');assert.equal(stageStartMonth('1957-04-02',70),'2027-05');
 assert.equal(stageStartMonth('1957-12-31',70),'2028-01');assert.equal(stageStartMonth('1960-02-29',70),'2030-03');
});
test('baseline and successive stage values apply at exact full-month boundaries',()=>{
 const p=plan();p.people[0].dob='1957-04-15';
 assert.equal(annualTargetAtMonth(p,'2026-03'),0);assert.equal(annualTargetAtMonth(p,'2027-04'),48000);assert.equal(annualTargetAtMonth(p,'2027-05'),36000);assert.equal(annualTargetAtMonth(p,'2028-05'),24000);
 assert.equal(stageIndexAtMonth(p,'2027-04'),-1);assert.equal(stageIndexAtMonth(p,'2027-05'),0);assert.equal(stageIndexAtMonth(p,'2028-05'),1);
 const r=project(p);near(r.months.find(m=>m.month==='2027-04').withdrawalTarget,4000);near(r.months.find(m=>m.month==='2027-05').withdrawalTarget,3000);
});
test('later retirement activates latest passed stage, never before retirement, with reversible dates',()=>{
 const p=plan();p.people[0].retirementMonth='2028-06';assert.equal(annualTargetAtMonth(p,'2028-05'),0);assert.equal(annualTargetAtMonth(p,'2028-06'),24000);
 assert.deepEqual(incomeStageRanges(p),[{stageIndex:1,fromAge:71,annualAmount:24000,startMonth:'2028-06',endMonth:'2029-04'}]);
 p.people[0].retirementMonth='2026-04';assert.equal(incomeStageRanges(p).length,3);assert.equal(annualTargetAtMonth(p,'2026-04'),48000);
});
test('ranges clamp to plan start and horizon without erasing earlier or future saved stages',()=>{
 const p=plan();p.drawdown.stages=[{fromAge:18,annualAmount:12000},{fromAge:70,annualAmount:6000},{fromAge:72,annualAmount:1},{fromAge:110,annualAmount:0}];const before=serializePlan(p);
 const ranges=incomeStageRanges(p);assert.deepEqual(ranges,[{stageIndex:0,fromAge:18,annualAmount:12000,startMonth:'2026-04',endMonth:'2027-04'},{stageIndex:1,fromAge:70,annualAmount:6000,startMonth:'2027-04',endMonth:'2029-04'}]);
 project(p);assert.equal(serializePlan(p),before);assert.deepEqual(parsePlan(before),p);
 p.people[0].retirementMonth='2030-04';assert.deepEqual(incomeStageRanges(p),[]);
});
test('zero stages stop recurring withdrawals, keep fixed events and no future credit',()=>{
 const p=plan();p.drawdown.stages=[{fromAge:70,annualAmount:0},{fromAge:71,annualAmount:12000}];p.events=[{id:'trip',name:'Trip',month:'2027-04',type:'withdrawal',potId:p.pots[0].id,toPotId:'',amount:2000}];
 const r=project(p);near(r.months[12].withdrawalTarget,0);near(r.months[12].withdrawalsGross,2000);near(r.months[13].withdrawalsGross,0);near(r.months[24].withdrawalsGross,1000);
});
test('inflation stays anchored to original plan start at each stage, nominal option stays fixed',()=>{
 const p=plan();p.inflation=10;p.drawdown.inflationLinked=true;let r=project(p);
 near(r.months[12].withdrawalTarget,3000*1.1);near(r.months[24].withdrawalTarget,2000*1.21);near(r.months[24].activeAnnualTarget,24000);
 p.drawdown.inflationLinked=false;r=project(p);near(r.months[12].withdrawalTarget,3000);near(r.months[24].withdrawalTarget,2000);
});
test('household stage follows primary age and offsets active partner income once in total mode',()=>{
 const p=plan();p.drawdown.mode='totalIncome';p.incomes=[{id:'partnerState',name:'Partner income',owner:'partner',type:'state',monthlyAmount:1000,startMonth:'2026-04',endMonth:'2030-04',escalation:0}];
 p.includePartner=true;let r=project(p);near(r.months[12].incomeTarget,3000);near(r.months[12].incomeOffset,1000);near(r.months[12].withdrawalsGross,2000);near(r.months[12].incomeGross,1000);
 p.includePartner=false;r=project(p);near(r.months[12].withdrawalsGross,3000);near(r.months[12].incomeGross,0);
});
test('staged combined goal offsets income and event once; tax is calculated on actual pension flows',()=>{
 const p=plan();p.drawdown.mode='totalIncome';p.pots[0].type='sipp';p.incomes=[{id:'state',name:'Income',owner:'you',type:'state',monthlyAmount:1000,startMonth:'2026-04',endMonth:'2030-04',escalation:0}];
 p.events=[{id:'trip',name:'Trip',month:'2027-04',type:'withdrawal',potId:p.pots[0].id,toPotId:'',amount:500}];
 const r=project(p),m=r.months[12];near(m.incomeTarget,3000);near(m.incomeOffset,1000);near(m.withdrawalTarget,2000);near(m.scheduledWithdrawalsGross,500);near(m.recurringWithdrawalsGross,1500);
 near(r.months.slice(12,24).reduce((s,m)=>s+m.tax,0),incomeTax(12000+24000*.75));
 for(const month of r.months)near(month.opening+month.contributions+month.growth-month.fees-month.withdrawalsGross,month.total);
});
test('no stages exactly preserves flat targets and projections are immutable across scenarios',()=>{
 const p=plan();p.drawdown.stages=[];const before=serializePlan(p);
 for(const scenario of ['lower','base','higher']){const r=project(p,{scenario});for(const m of r.months){near(m.withdrawalTarget,4000);assert.equal(m.stageIndex,-1);}assert.equal(serializePlan(p),before);}
 assert.deepEqual(incomeStageRanges(p),[{stageIndex:-1,fromAge:null,annualAmount:48000,startMonth:'2026-04',endMonth:'2029-04'}]);
});
