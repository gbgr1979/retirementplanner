import {validatePlan, PLAN_VERSION} from './plan.js';
const OWNERS = ['you', 'partner'];
const TYPES = [['savings','savings','cash savings',2,0],['isa','stocksIsa','stocks & shares ISA',5,0.3],['pension','sipp','pension',5,0.5]];
const monthValid = value => typeof value === 'string' && /^(19\d{2}|20\d{2}|21\d{2}|22[0-4]\d|2250)-(0[1-9]|1[0-2])$/.test(value);
const numeric = (value,min,max,integer=false) => typeof value === 'number' && Number.isFinite(value) && value>=min && value<=max && (!integer || Number.isInteger(value));
/** In-memory draft only. Ages intentionally start blank; nothing is saved automatically. */
export function createWizardDraft(startMonth = new Date().toISOString().slice(0,7)) {
  return {startMonth, includePartner:false, you:{age:'',retirementAge:67}, partner:{age:'',retirementAge:67}, monthlySpending:2000, inflation:2.5,
    pots:OWNERS.flatMap(owner => TYPES.map(([suffix,type,label,growth,fee]) => ({id:`${owner}-${suffix}`,owner,type,name:`${owner==='you'?'Your':"Partner’s"} ${label}`,balance:0,monthlyContribution:0,employerContribution:0,growth,fee})))};
}
/** Field paths align with form inputs. Review (step 3) checks all earlier steps. */
export function validateWizardStep(draft,step) {
  const errors=[];
  const error=(field,message)=>errors.push({field,message});
  if (!draft || typeof draft!=='object' || Array.isArray(draft)) return {valid:false,errors:[{field:'plan',message:'Start a new plan to continue.'}]};
  if (![0,1,2,3].includes(step)) return {valid:false,errors:[{field:'step',message:'Unknown setup step.'}]};
  if (step===3) {
    for (const index of [0,1,2]) errors.push(...validateWizardStep(draft,index).errors);
    return {valid:errors.length===0,errors};
  }
  const activeOwners=draft.includePartner===true?OWNERS:['you'];
  if (step===0) {
    if (!monthValid(draft.startMonth)) error('startMonth','Choose a valid plan start month.');
    if (typeof draft.includePartner!=='boolean') error('includePartner','Choose whether to include a partner.');
    for (const owner of activeOwners) {
      const person=draft[owner];
      if (!numeric(person?.age,18,90,true)) error(`${owner}.age`,'Enter a whole-number age from 18 to 90.');
      if (!numeric(person?.retirementAge,18,100,true)) error(`${owner}.retirementAge`,'Enter a whole-number retirement age up to 100.');
      else if (numeric(person?.age,18,90,true) && person.retirementAge<person.age) error(`${owner}.retirementAge`,'Retirement age must be your current age or later.');
      if (numeric(person?.age,18,90,true) && monthValid(draft.startMonth) && Number(draft.startMonth.slice(0,4))-person.age<1900) error(`${owner}.age`,'This age would put your approximate birth date before the supported year 1900.');
    }
    if (numeric(draft.you?.age,18,90,true) && numeric(draft.you?.retirementAge,18,100,true) && draft.you.retirementAge>=draft.you.age+80) error('you.retirementAge','Choose a retirement age that leaves at least one later year within the 80-year projection limit.');
    if (monthValid(draft.startMonth) && numeric(draft.you?.age,18,90,true) && numeric(draft.you?.retirementAge,18,100,true)) {
      const endAge=Math.min(Math.max(95,draft.you.retirementAge+5),draft.you.age+80,110);
      if (Number(draft.startMonth.slice(0,4))-draft.you.age+endAge>2250) error('startMonth','The projection would run beyond the supported year 2250.');
    }
  }
  if (step===1 || step===2) {
    if (!Array.isArray(draft.pots) || draft.pots.length!==6) error('pots','Setup needs three pots for each person. Please restart setup.');
    else {
      for (const owner of activeOwners) for (const [suffix,type] of TYPES) {
        const id=`${owner}-${suffix}`, matches=draft.pots.filter(p=>p?.id===id), pot=matches[0], index=draft.pots.indexOf(pot), prefix=`pots.${index}`;
        if (matches.length!==1 || pot.owner!==owner || pot.type!==type) {error('pots',`The ${owner} ${suffix} pot is missing or invalid.`);continue;}
        if (typeof pot.name!=='string' || !pot.name.trim() || pot.name.length>100 || /[\u0000-\u001f\u007f]/.test(pot.name)) error(`${prefix}.name`,'Enter a pot name of 1–100 characters.');
        if (step===1) {
          if (!numeric(pot.balance,0,100000000)) error(`${prefix}.balance`,'Enter a balance from £0 to £100,000,000.');
          if (!numeric(pot.monthlyContribution,0,1000000)) error(`${prefix}.monthlyContribution`,'Enter a monthly amount from £0 to £1,000,000.');
          if (!numeric(pot.employerContribution,0,1000000) || (type!=='sipp' && pot.employerContribution!==0)) error(`${prefix}.employerContribution`,'Employer additions must be between £0 and £1,000,000, and apply only to pensions.');
        } else {
          if (!numeric(pot.growth,-50,50)) error(`${prefix}.growth`,'Enter annual growth between −50% and 50%.');
          if (!numeric(pot.fee,0,20)) error(`${prefix}.fee`,'Enter annual fees between 0% and 20%.');
        }
      }
    }
    if (step===2) {
      if (!numeric(draft.inflation,0,15)) error('inflation','Enter annual inflation between 0% and 15%.');
      if (!numeric(draft.monthlySpending,0,1000000)) error('monthlySpending','Enter monthly retirement spending from £0 to £1,000,000.');
    }
  }
  return {valid:errors.length===0,errors};
}
/** Build fresh schema data; never inherit fictitious example balances or State Pension. */
export function buildWizardPlan(draft) {
  const result=validateWizardStep(draft,3);
  if (!result.valid) throw new Error(result.errors.map(e=>e.message).join('\n'));
  const startYear=Number(draft.startMonth.slice(0,4)), month=draft.startMonth.slice(5,7);
  const person=(id,input)=>({id,name:id==='you'?'You':'Partner',dob:`${startYear-input.age}-${month}-01`,retirementMonth:`${startYear-input.age+input.retirementAge}-${month}`,region:'rUK',taxFreeUsed:0});
  const you=person('you',draft.you);
  // Placeholder is excluded, not a guessed partner age; the UI must explain this.
  const partner=person('partner',draft.includePartner?draft.partner:draft.you);
  if (!draft.includePartner) partner.name='Partner (details not entered)';
  const people=[you,partner], active=draft.includePartner?OWNERS:['you'];
  const plan={version:PLAN_VERSION,drawdown:{annualAmount:draft.monthlySpending*12,inflationLinked:true},name:'My retirement plan',startMonth:draft.startMonth,endAge:Math.min(Math.max(95,draft.you.retirementAge+5),draft.you.age+80,110),includePartner:draft.includePartner,inflation:draft.inflation,scenarioSpread:2,monthlySpending:draft.monthlySpending,spendingStart:you.retirementMonth,people,
    pots:active.flatMap(owner=>TYPES.map(([suffix])=>draft.pots.find(p=>p.id===`${owner}-${suffix}`))).map(p=>({id:p.id,name:p.name,owner:p.owner,type:p.type,balance:p.balance,monthlyContribution:p.monthlyContribution,employerContribution:p.employerContribution,contributionBasis:'gross',growth:p.growth,fee:p.fee,contributionStart:draft.startMonth,contributionEnd:people.find(person=>person.id===p.owner).retirementMonth,accessAge:55})),incomes:[],events:[]};
  const checked=validatePlan(plan);
  if (!checked.valid) throw new Error(checked.errors.join('\n'));
  return plan;
}
