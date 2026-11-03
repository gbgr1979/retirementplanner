import {validatePlan} from './plan.js';

/** Deterministic illustration, not regulated advice. Tax rules frozen at 2026/27.
 * Sources checked 2 November 2026: gov.uk/income-tax-rates and
 * gov.uk/scottish-income-tax. All April flows assigned to the new tax year
 * (monthly approximation to the statutory 6 April boundary).
 */
export const TAX_VERSION = '2026/27';
const PENSION = new Set(['sipp', 'workplace']);
// User-supplied identifiers must never resolve inherited Object properties.
const dictionary = entries => Object.assign(Object.create(null), Object.fromEntries(entries ?? []));
const sum = values => values.reduce((a,b) => a+b, 0);
const monthIndex = text => Number(text.slice(0,4))*12+Number(text.slice(5,7))-1;
const monthText = n => `${Math.floor(n/12)}-${String(n%12+1).padStart(2,'0')}`;
const taxYear = month => Number(month.slice(0,4))-(Number(month.slice(5,7))<4?1:0);
const ageMonth = (dob, age) => monthIndex(dob.slice(0,7))+age*12;
const annualFactor = rate => Math.pow(1+rate/100,1/12);

/** Income only: no NI, savings/dividends, other reliefs or adjusted-net-income deductions. */
export function incomeTax(gross, region='rUK') {
  const allowance = Math.max(0,12570-Math.max(0,gross-100000)/2);
  let taxable = Math.max(0,gross-allowance), total = 0;
  // Widths are taxable-income bands, not gross-income boundaries.
  const bands = region==='scotland'
    ? [[3967,.19],[12989,.20],[14136,.21],[31338,.42],[62710,.45],[Infinity,.48]]
    : [[37700,.20],[87440,.40],[Infinity,.45]];
  for(const [width,rate] of bands) {
    const slice = Math.min(taxable,width); total += slice*rate; taxable -= slice;
    if(taxable<=0) break;
  }
  return total;
}

export function pensionAccessible(pot, person, month) {
  if(!PENSION.has(pot.type)) return true;
  const statutory = month<'2028-04'?55:57;
  // No protected early-access ages are inferred. Birthday month becomes accessible
  // only the following month unless the birthday is on its first day.
  const effective = Math.max(statutory,pot.accessAge ?? statutory);
  const firstMonth = ageMonth(person.dob,effective)+(person.dob.slice(8,10)==='01'?0:1);
  return monthIndex(month)>=firstMonth;
}

export function project(plan, {scenario='base'}={}) {
  const validation = validatePlan(plan);
  if(!validation.valid) throw new Error('Invalid plan: '+validation.errors.join(' '));
  if(!['base','lower','higher'].includes(scenario)) throw new Error('Unknown scenario');
  const people = plan.people.filter(p=>p.id==='you'||plan.includePartner);
  const personMap = new Map(people.map(p=>[p.id,p]));
  const primary = personMap.get('you');
  if(!primary) throw new Error('Primary person is required');
  const pots = plan.pots.filter(p=>personMap.has(p.owner));
  const drawdown = plan.drawdown;
  const totalIncomeMode = drawdown.mode === 'totalIncome';
  const priority = {savings:0,cashIsa:1,stocksIsa:2,sipp:3,workplace:3};
  const drawdownPots = pots.map((pot,index)=>({pot,index})).sort((a,b)=>priority[a.pot.type]-priority[b.pot.type] || Number(a.pot.owner==='partner')-Number(b.pot.owner==='partner') || a.index-b.index).map(item=>item.pot);
  const potMap = new Map(pots.map(p=>[p.id,p]));
  const balances = dictionary(pots.map(p=>[p.id,p.balance]));
  const lumpSumRemaining = dictionary(people.map(p=>[p.id,Math.max(0,268275-p.taxFreeUsed)]));
  const begin = monthIndex(plan.startMonth);
  const end = Math.min(ageMonth(primary.dob,plan.endAge),begin+80*12);
  const months = [], warnings = new Set(), taxBuckets = new Map();
  const adjustment = scenario==='lower'?-plan.scenarioSpread:scenario==='higher'?plan.scenarioSpread:0;
  const warn = (row, text) => {row.warnings.push(text);warnings.add(text);};
  const assumptions = [
    'Illustration, not advice: fixed returns do not model market volatility, sequence risk or guarantee outcomes.',
    'Income-tax bands and the standard lump-sum allowance are frozen at 2026/27 for every projected year; future tax changes, including changes from April 2027, are not modelled.',
    'Monthly timing: contributions at the start; growth then charges; events at the end in their listed order. Pension access starts the month after a mid-month birthday.',
    'April is assigned wholly to the new tax year, approximating the statutory 6 April boundary. Partial first/final tax years use a full annual allowance and omit income outside the plan.',
    'Tax is calculated per owner over each modelled tax year and allocated proportionally to taxable income and withdrawals; it is not a PAYE timing forecast.',
    'DC withdrawals assume uncrystallised funds: 25% tax-free, capped by each owner’s remaining standard £268,275 lump-sum allowance. Existing crystallised pots, protected allowances and other benefit events are unsupported.',
    'Only modelled non-savings income and taxable DC withdrawals enter income tax. Savings-interest tax, NI, capital gains, dividends, benefits, marriage allowance, contribution tax deductions and higher-rate relief are excluded.',
    'Spending and income begin as amounts in plan-start pounds, then rise at inflation / each income’s escalation. Event amounts are fixed future nominal gross withdrawals.',
    'The annual before-tax target starts in the primary person’s retirement month and is split monthly. Inflation-linked targets use plan-start purchasing power, otherwise they stay fixed nominal.',
    totalIncomeMode
      ? 'Total-income mode: active gross State Pension, defined-benefit and other income reduce the household target before pot withdrawals. Income above the target is not reinvested and does not create future credit.'
      : 'Pot-withdrawal mode: the target is gross pot withdrawals alone. State Pension, defined-benefit and other income remain additional and do not reduce this target.',
    'Successful scheduled gross withdrawals offset only that month’s target. Transfers and rejected events do not count; events exceeding the target still execute in full, with no credit against future months.',
    'After scheduled events, the remaining target draws from accessible active pots in this order: cash savings, cash ISA, stocks and shares ISA, then SIPP/workplace DC together. Within each group, your pots precede your partner’s, retaining listed order. Partial funding is reported, never a negative balance.',
    'The target is before tax, not a promised net income or a tax-optimised strategy. Tax is calculated after gross flows. Spending compares cash received and does not cause another withdrawal. Surplus is not reinvested or carried forward.',
    'Contributions are funded externally, not subtracted from household spending. They stop at the owner’s retirement month or the specified end month, whichever is earlier.',
    'Transfers only move accessible non-pension pots belonging to the same owner; they do not represent formal ISA transfers, enforce subscription rules or model pensions transfers.',
    'No State Pension entitlement is inferred: enter your forecast and start month. No deaths, survivor benefits, IHT or care costs are inferred.'
  ];
  warnings.add('Tax illustration uses frozen 2026/27 rules for all years. Future tax changes, including changes from April 2027, are not modelled; before-tax targets are not guaranteed take-home income.');
  if(pots.some(p=>p.type==='savings' && p.growth+adjustment>0)) warnings.add('Taxable savings-interest tax is not modelled. Savings balances and available cash can be overstated; after-tax figures cover modelled non-savings income and pension withdrawals only.');
  if(plan.startMonth.slice(5)!=='04') warnings.add('The first tax year is partial. Add all relevant income or interpret the tax estimate cautiously: income before the projection is not included.');
  for (const event of plan.events) {
    if (potMap.has(event.potId) && (monthIndex(event.month)<begin || monthIndex(event.month)>=end)) warnings.add(`${event.name}: outside the projection horizon; no withdrawal or transfer is modelled.`);
  }
  const contributionsByTaxYear = new Map();
  const mpaaOwners = new Set();
  for(let index=begin; index<end; index++) {
    const month=monthText(index), opening=sum(Object.values(balances));
    const row={month,opening,balances:dictionary(),accessible:0,locked:0,total:0,incomeGross:0,incomeNet:0,withdrawalsGross:0,withdrawalsNet:0,withdrawalTarget:0,incomeTarget:0,incomeOffset:0,scheduledWithdrawalsGross:0,recurringWithdrawalsGross:0,unmetWithdrawal:0,tax:0,spending:0,shortfall:0,contributions:0,growth:0,fees:0,warnings:[],potLedger:dictionary(),taxComplete:false};
    const ownerFlows=dictionary(people.map(p=>[p.id,{income:0,taxableWithdrawal:0,withdrawal:0}]));
    for(const pot of pots) {
      const person=personMap.get(pot.owner);
      const ledger={opening:balances[pot.id],contributions:0,growth:0,fees:0,withdrawals:0,transfersIn:0,transfersOut:0,closing:0};
      if(month>=pot.contributionStart && month<=pot.contributionEnd && month<person.retirementMonth) {
        ledger.contributions=pot.monthlyContribution*(PENSION.has(pot.type)&&pot.contributionBasis==='netRelief'?1.25:1)+(PENSION.has(pot.type)?pot.employerContribution:0);
        balances[pot.id]+=ledger.contributions;
        const key=`${taxYear(month)}:${pot.owner}:${PENSION.has(pot.type)?'pension':pot.type.endsWith('Isa')?'isa':'savings'}`;
        contributionsByTaxYear.set(key,(contributionsByTaxYear.get(key)||0)+ledger.contributions);
        if(PENSION.has(pot.type)&&mpaaOwners.has(pot.owner)&&ledger.contributions>0) warnings.add(`${person.name}: DC contributions continue after a taxable flexible withdrawal; MPAA eligibility and the £10,000 limit require review. No allowance charge is modelled.`);
      }
      ledger.growth=balances[pot.id]*(annualFactor(Math.max(-99,pot.growth+adjustment))-1);
      balances[pot.id]+=ledger.growth;
      ledger.fees=balances[pot.id]*(1-Math.pow(1-pot.fee/100,1/12));
      balances[pot.id]-=ledger.fees;
      row.contributions+=ledger.contributions;row.growth+=ledger.growth;row.fees+=ledger.fees;
      row.potLedger[pot.id]=ledger;
    }
    for(const income of plan.incomes.filter(i=>personMap.has(i.owner))) {
      if(month>=income.startMonth&&month<=income.endMonth) {
        const amount=income.monthlyAmount*Math.pow(1+income.escalation/100,(index-begin)/12);
        ownerFlows[income.owner].income+=amount;row.incomeGross+=amount;
      }
    }
    // One accounting path for both explicit events and recurring withdrawals.
    // Caller has checked access and sufficient balance; amount is actual gross removed.
    function removeForSpending(pot, amount, recurring=false) {
      balances[pot.id]=Math.max(0,balances[pot.id]-amount);
      row.withdrawalsGross+=amount;
      row[recurring?'recurringWithdrawalsGross':'scheduledWithdrawalsGross']+=amount;
      row.potLedger[pot.id].withdrawals+=amount;
      const flow=ownerFlows[pot.owner];flow.withdrawal+=amount;
      if(PENSION.has(pot.type)) {
        const taxFree=Math.min(amount*.25,lumpSumRemaining[pot.owner]);
        lumpSumRemaining[pot.owner]-=taxFree;flow.taxableWithdrawal+=amount-taxFree;
        if(amount>taxFree) {
          mpaaOwners.add(pot.owner);
          warnings.add(`${personMap.get(pot.owner).name}: a modelled taxable flexible pension withdrawal may trigger the money purchase annual allowance. Confirm your position before making further DC contributions.`);
        }
      }
    }
    for(const event of plan.events.filter(e=>e.month===month)) {
      const pot=potMap.get(event.potId);
      if(!pot) continue; // A disabled partner's events are intentionally inactive.
      const person=personMap.get(pot.owner);
      const prefix=`${month} — ${event.name}`;
      if(!pensionAccessible(pot,person,month)) {warn(row,`${prefix}: rejected; pension is not accessible.`);continue;}
      const target=potMap.get(event.toPotId);
      if(event.type==='transfer'&&(!target||target.owner!==pot.owner||target.id===pot.id||PENSION.has(pot.type)||PENSION.has(target.type))) {warn(row,`${prefix}: rejected; only same-owner non-pension transfers are supported.`);continue;}
      if(event.amount>balances[pot.id]) {warn(row,`${prefix}: rejected; insufficient funds in ${pot.name}. No partial withdrawal or fallback was made.`);continue;}
      if(event.type==='transfer') {
        balances[pot.id]=Math.max(0,balances[pot.id]-event.amount);
        balances[target.id]+=event.amount;row.potLedger[pot.id].transfersOut+=event.amount;row.potLedger[target.id].transfersIn+=event.amount;
        if(target.type.endsWith('Isa')) warnings.add(`${prefix}: ISA transfer/subscription treatment is not checked. Confirm the permitted transfer process and annual subscription allowance.`);
      } else removeForSpending(pot,event.amount);
    }
    const grossTarget=month>=primary.retirementMonth
      ? drawdown.annualAmount/12*(drawdown.inflationLinked?Math.pow(1+plan.inflation/100,(index-begin)/12):1):0;
    if(totalIncomeMode) {
      row.incomeTarget=grossTarget;
      row.incomeOffset=Math.min(grossTarget,row.incomeGross);
    }
    row.withdrawalTarget=Math.max(0,grossTarget-row.incomeOffset);
    let remaining=Math.max(0,row.withdrawalTarget-row.scheduledWithdrawalsGross);
    for(const pot of drawdownPots) {
      if(remaining<=0) break;
      if(!pensionAccessible(pot,personMap.get(pot.owner),month)) continue;
      const amount=Math.min(remaining,balances[pot.id]);
      if(amount>0) {removeForSpending(pot,amount,true);remaining=Math.max(0,remaining-amount);}
    }
    row.unmetWithdrawal=Math.max(0,row.withdrawalTarget-row.withdrawalsGross);
    row.spending=month>=plan.spendingStart?plan.monthlySpending*Math.pow(1+plan.inflation/100,(index-begin)/12):0;
    for(const pot of pots) {
      row.potLedger[pot.id].closing=balances[pot.id];
      if(pensionAccessible(pot,personMap.get(pot.owner),month)) row.accessible+=balances[pot.id]; else row.locked+=balances[pot.id];
    }
    row.balances=dictionary(Object.entries(balances));row.total=row.accessible+row.locked;
    row.incomeNet=row.incomeGross;row.withdrawalsNet=row.withdrawalsGross;
    for(const person of people) {
      const key=`${taxYear(month)}:${person.id}`;
      if(!taxBuckets.has(key)) taxBuckets.set(key,{person,gross:0,entries:[]});
      const bucket=taxBuckets.get(key),flow=ownerFlows[person.id];
      bucket.gross+=flow.income+flow.taxableWithdrawal;
      bucket.entries.push({row,...flow});
    }
    months.push(row);
  }
  for(const bucket of taxBuckets.values()) {
    const tax=incomeTax(bucket.gross,bucket.person.region);
    for(const flow of bucket.entries) {
      const incomeTaxShare=bucket.gross?tax*flow.income/bucket.gross:0;
      const withdrawalTaxShare=bucket.gross?tax*flow.taxableWithdrawal/bucket.gross:0;
      flow.row.tax+=incomeTaxShare+withdrawalTaxShare;
      flow.row.incomeNet-=incomeTaxShare;flow.row.withdrawalsNet-=withdrawalTaxShare;
    }
  }
  for(const [key,amount] of contributionsByTaxYear) {
    if(key.endsWith(':pension')&&amount>60000) warnings.add(`${key.split(':')[0]}/${Number(key.split(':')[0])+1}: ${key.split(':')[1]} pension contributions exceed £60,000. Allowance charges, taper, carry-forward and earnings limits are not modelled.`);
    if(key.endsWith(':isa')&&amount>20000) warnings.add(`${key.split(':')[0]}/${Number(key.split(':')[0])+1}: ${key.split(':')[1]} modelled ISA subscriptions exceed £20,000. Correct the plan; ISA allowance enforcement is not automatic.`);
  }
  const yearMap=new Map();
  for(const row of months) {
    row.shortfall=Math.max(0,row.spending-row.incomeNet-row.withdrawalsNet);
    row.surplus=Math.max(0,row.incomeNet+row.withdrawalsNet-row.spending);
    const year=Number(row.month.slice(0,4));
    if(!yearMap.has(year)) yearMap.set(year,{year,opening:row.opening,contributions:0,growth:0,fees:0,withdrawals:0,closing:0,incomeGross:0,incomeNet:0,withdrawalsNet:0,withdrawalTarget:0,incomeTarget:0,incomeOffset:0,scheduledWithdrawalsGross:0,recurringWithdrawalsGross:0,unmetWithdrawal:0,spending:0,shortfall:0,tax:0,accessible:0,locked:0,balances:dictionary(),potLedger:dictionary()});
    const annual=yearMap.get(year);
    for(const key of ['contributions','growth','fees','incomeGross','incomeNet','withdrawalsNet','withdrawalTarget','incomeTarget','incomeOffset','scheduledWithdrawalsGross','recurringWithdrawalsGross','unmetWithdrawal','spending','shortfall','tax']) annual[key]+=row[key];
    annual.withdrawals+=row.withdrawalsGross;annual.closing=row.total;annual.accessible=row.accessible;annual.locked=row.locked;annual.balances=dictionary(Object.entries(row.balances));
    for(const [id,l] of Object.entries(row.potLedger)) {
      if(!Object.hasOwn(annual.potLedger,id)) annual.potLedger[id]={opening:l.opening,contributions:0,growth:0,fees:0,withdrawals:0,transfersIn:0,transfersOut:0,closing:0};
      for(const key of ['contributions','growth','fees','withdrawals','transfersIn','transfersOut']) annual.potLedger[id][key]+=l[key];
      annual.potLedger[id].closing=l.closing;
    }
  }
  const firstUnmet=months.find(row=>row.unmetWithdrawal>0.000001);
  const firstUnmetWithdrawal=firstUnmet?{month:firstUnmet.month,amount:firstUnmet.unmetWithdrawal,locked:firstUnmet.locked,total:firstUnmet.total,accessible:firstUnmet.accessible}:null;
  if(firstUnmetWithdrawal) warnings.add(`The recurring gross withdrawal target is first underfunded in ${firstUnmetWithdrawal.month}. Locked pension wealth may remain; this does not necessarily mean all money has run out.`);
  return {firstUnmetWithdrawal,months,years:[...yearMap.values()],warnings:[...warnings],assumptions,taxComplete:false,taxVersion:TAX_VERSION,scenario};
}
