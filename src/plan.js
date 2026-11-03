/** Versioned, local-only plan interchange. No persistence occurs in this module. */
export const PLAN_VERSION = 4;
export const MAX_PLAN_BYTES = 1024 * 1024;
const unsafeKeys = new Set(['__proto__', 'prototype', 'constructor']);
const pensionTypes = new Set(['sipp', 'workplace']);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
function validMonth(value) { return typeof value === 'string' && monthPattern.test(value) && Number(value.slice(0, 4)) >= 1900 && Number(value.slice(0, 4)) <= 2250; }
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !validMonth(value.slice(0, 7))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
/** Return validation errors without changing the input. Names are plain text, not markup. */
export function validatePlan(plan) { return validateVersion(plan, PLAN_VERSION); }
// Each legacy shape is strictly checked before any migration adds new fields.
function validateVersion(plan, expectedVersion) {
  const errors = [];
  const fail = message => { if (errors.length < 100) errors.push(message); };
  const seen = new WeakSet();
  function safeTree(value, depth = 0) {
    if (depth > 12) { fail('Plan nesting is too deep.'); return; }
    if (value && typeof value === 'object') {
      if (seen.has(value)) { fail('Plan must not contain circular or shared object references.'); return; }
      seen.add(value);
      if (!Array.isArray(value) && !isRecord(value)) { fail('Plan must contain only plain JSON objects.'); return; }
      for (const key of Object.keys(value)) {
        if (unsafeKeys.has(key)) fail(`Unsafe property name: ${key}.`);
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor && !('value' in descriptor)) { fail('Accessor properties are not allowed.'); continue; }
        safeTree(value[key], depth + 1);
      }
    }
  }
  safeTree(plan);
  if (errors.length) return {valid: false, errors};
  function object(value, keys, path) {
    if (!isRecord(value)) { fail(`${path} must be an object.`); return false; }
    for (const key of Object.keys(value)) if (!keys.includes(key)) fail(`${path}.${key} is not supported.`);
    for (const key of keys) if (!Object.hasOwn(value, key)) fail(`${path}.${key} is required.`);
    return true;
  }
  function string(value, path, max = 100) { if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) fail(`${path} must be non-empty text of at most ${max} characters.`); }
  function number(value, path, min, max, integer = false) { if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) fail(`${path} must be ${integer ? 'an integer' : 'a number'} between ${min} and ${max}.`); }
  function oneOf(value, values, path) { if (!values.includes(value)) fail(`${path} must be one of: ${values.join(', ')}.`); }
  function month(value, path) { if (!validMonth(value)) fail(`${path} must be a valid YYYY-MM month (1900–2250).`); }
  function array(value, path, limit) { if (!Array.isArray(value) || value.length > limit) { fail(`${path} must be an array with at most ${limit} entries.`); return []; } return value; }
  function identifier(value, path) { if (typeof value !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_-]{0,49}$/.test(value) || unsafeKeys.has(value)) fail(`${path} must be a safe identifier (1–50 letters, numbers, hyphens or underscores).`); }
  if (!object(plan, ['version','name','startMonth','endAge','includePartner','inflation','scenarioSpread','monthlySpending','spendingStart','people','pots','incomes','events', ...(expectedVersion >= 2 ? ['drawdown'] : [])], 'plan')) return {valid: false, errors};
  if (plan.version !== expectedVersion) fail(`Unsupported plan version. This app supports version ${PLAN_VERSION} only.`);
  string(plan.name, 'name'); month(plan.startMonth, 'startMonth'); month(plan.spendingStart, 'spendingStart');
  if (expectedVersion >= 2 && object(plan.drawdown, ['annualAmount','inflationLinked', ...(expectedVersion >= 3 ? ['mode'] : []), ...(expectedVersion >= 4 ? ['stages'] : [])], 'drawdown')) {
    if (expectedVersion >= 3) oneOf(plan.drawdown.mode, ['pots','totalIncome'], 'drawdown.mode');
    number(plan.drawdown.annualAmount, 'drawdown.annualAmount', 0, 12000000);
    if (expectedVersion >= 4) {
      const stages = array(plan.drawdown.stages, 'drawdown.stages', 10);
      stages.forEach((stage, i) => {
        const path = `drawdown.stages[${i}]`;
        if (!object(stage, ['fromAge','annualAmount'], path)) return;
        number(stage.fromAge, `${path}.fromAge`, 18, 110, true);
        number(stage.annualAmount, `${path}.annualAmount`, 0, 12000000);
        if (i > 0 && stage.fromAge <= stages[i-1]?.fromAge) fail('drawdown.stages ages must be strictly increasing and unique.');
      });
    }
    if (typeof plan.drawdown.inflationLinked !== 'boolean') fail('drawdown.inflationLinked must be true or false.');
  }
  number(plan.endAge, 'endAge', 18, 110, true); number(plan.inflation, 'inflation', -10, 20); number(plan.scenarioSpread, 'scenarioSpread', 0, 10); number(plan.monthlySpending, 'monthlySpending', 0, 1000000);
  if (typeof plan.includePartner !== 'boolean') fail('includePartner must be true or false.');
  const people = array(plan.people, 'people', 2), pots = array(plan.pots, 'pots', 50), incomes = array(plan.incomes, 'incomes', 50), events = array(plan.events, 'events', 200);
  const personIds = new Set();
  people.forEach((person, i) => {
    const p = `people[${i}]`;
    if (!object(person, ['id','name','dob','retirementMonth','region','taxFreeUsed'], p)) return;
    oneOf(person.id, ['you','partner'], `${p}.id`); if (personIds.has(person.id)) fail('People must have unique ids.'); personIds.add(person.id);
    string(person.name, `${p}.name`, 60); if (!validDate(person.dob)) fail(`${p}.dob must be a valid YYYY-MM-DD date.`);
    month(person.retirementMonth, `${p}.retirementMonth`); oneOf(person.region, ['rUK','scotland'], `${p}.region`); number(person.taxFreeUsed, `${p}.taxFreeUsed`, 0, 268275);
    if (validDate(person.dob) && validMonth(plan.startMonth) && person.dob.slice(0,7) > plan.startMonth) fail(`${p}.dob must not be after the plan start.`);
    if (validDate(person.dob) && validMonth(person.retirementMonth) && person.retirementMonth <= person.dob.slice(0,7)) fail(`${p}.retirementMonth must be after birth.`);
  });
  if (people.length !== 2 || !personIds.has('you') || !personIds.has('partner')) fail('Plan must preserve both you and partner records, even when partner is disabled.');
  const primary = people.find(p => p?.id === 'you');
  if (primary && validDate(primary.dob) && validMonth(plan.startMonth) && Number.isInteger(plan.endAge)) {
    const endYear = Number(primary.dob.slice(0,4)) + plan.endAge;
    const endMonth = `${endYear}-${primary.dob.slice(5,7)}`;
    if (endMonth <= plan.startMonth || endYear - Number(plan.startMonth.slice(0,4)) > 80) fail('Projection must finish after its start and within 80 years.');
  }
  const allIds = new Set();
  function unique(value, path) { identifier(value, path); if (allIds.has(value)) fail(`${path} is duplicated.`); allIds.add(value); }
  pots.forEach((pot, i) => {
    const p = `pots[${i}]`;
    if (!object(pot, ['id','name','owner','type','balance','monthlyContribution','employerContribution','contributionBasis','growth','fee','contributionStart','contributionEnd','accessAge'], p)) return;
    unique(pot.id, `${p}.id`); string(pot.name, `${p}.name`); oneOf(pot.owner, ['you','partner'], `${p}.owner`); oneOf(pot.type, ['savings','cashIsa','stocksIsa','sipp','workplace'], `${p}.type`);
    number(pot.balance, `${p}.balance`, 0, 100000000); number(pot.monthlyContribution, `${p}.monthlyContribution`, 0, 1000000); number(pot.employerContribution, `${p}.employerContribution`, 0, 1000000);
    oneOf(pot.contributionBasis, ['gross','netRelief'], `${p}.contributionBasis`); number(pot.growth, `${p}.growth`, -50, 50); number(pot.fee, `${p}.fee`, 0, 20); number(pot.accessAge, `${p}.accessAge`, 55, 75, true);
    month(pot.contributionStart, `${p}.contributionStart`); month(pot.contributionEnd, `${p}.contributionEnd`);
    if (validMonth(pot.contributionStart) && validMonth(pot.contributionEnd) && pot.contributionEnd < pot.contributionStart) fail(`${p}.contributionEnd must not precede contributionStart.`);
    if (!pensionTypes.has(pot.type) && (pot.contributionBasis !== 'gross' || pot.employerContribution !== 0)) fail(`${p}: non-pension pots require gross contributions and no employer contribution.`);
  });
  incomes.forEach((income, i) => {
    const p = `incomes[${i}]`;
    if (!object(income, ['id','name','owner','type','monthlyAmount','startMonth','endMonth','escalation'], p)) return;
    unique(income.id, `${p}.id`); string(income.name, `${p}.name`); oneOf(income.owner, ['you','partner'], `${p}.owner`); oneOf(income.type, ['state','db','other'], `${p}.type`);
    number(income.monthlyAmount, `${p}.monthlyAmount`, 0, 1000000); number(income.escalation, `${p}.escalation`, -10, 20); month(income.startMonth, `${p}.startMonth`); month(income.endMonth, `${p}.endMonth`);
    if (validMonth(income.startMonth) && validMonth(income.endMonth) && income.endMonth < income.startMonth) fail(`${p}.endMonth must not precede startMonth.`);
  });
  events.forEach((event, i) => {
    const p = `events[${i}]`;
    if (!object(event, ['id','name','month','type','potId','toPotId','amount'], p)) return;
    unique(event.id, `${p}.id`); string(event.name, `${p}.name`); month(event.month, `${p}.month`); oneOf(event.type, ['withdrawal','transfer'], `${p}.type`); number(event.amount, `${p}.amount`, 0.01, 100000000);
    const source = pots.find(pot => pot?.id === event.potId), target = pots.find(pot => pot?.id === event.toPotId);
    if (!source) fail(`${p}.potId must identify an existing pot.`);
    if (event.type === 'withdrawal' && event.toPotId !== '') fail(`${p}.toPotId must be empty for a withdrawal.`);
    if (event.type === 'transfer') {
      if (!target) fail(`${p}.toPotId must identify an existing pot.`);
      if (source && target && (source.id === target.id || source.owner !== target.owner || pensionTypes.has(source.type) || pensionTypes.has(target.type))) fail(`${p}: transfers require two different non-pension pots owned by the same person.`);
    }
    if (validMonth(event.month) && validMonth(plan.startMonth) && event.month < plan.startMonth) fail(`${p}.month must not precede the plan start.`);
  });
  return {valid: errors.length === 0, errors};
}
export function parsePlan(text) {
  if (typeof text !== 'string') throw new Error('Choose a JSON plan file.');
  if (new TextEncoder().encode(text).byteLength > MAX_PLAN_BYTES) throw new Error('Plan file exceeds the 1 MB limit.');
  let plan;
  try { plan = JSON.parse(text); } catch { throw new Error('This is not a valid JSON plan file.'); }
  if (plan?.version === 1 || plan?.version === 2 || plan?.version === 3) {
    const legacy = validateVersion(plan, plan.version);
    if (!legacy.valid) throw new Error(legacy.errors.join('\n'));
    plan = {...plan, version: PLAN_VERSION, drawdown: {mode: 'pots', ...(plan.version === 1 ? {annualAmount: 0, inflationLinked: true} : plan.drawdown), stages: []}};
  }
  const result = validatePlan(plan);
  if (!result.valid) throw new Error(result.errors.join('\n'));
  return plan;
}
export function serializePlan(plan) {
  const result = validatePlan(plan);
  if (!result.valid) throw new Error(result.errors.join('\n'));
  const text = JSON.stringify(plan, null, 2);
  if (new TextEncoder().encode(text).byteLength > MAX_PLAN_BYTES) throw new Error('Plan file exceeds the 1 MB limit.');
  return text;
}
export function createExamplePlan() {
  return {
    version: PLAN_VERSION, drawdown: {mode: 'pots', annualAmount: 0, inflationLinked: true, stages: []}, name: 'Illustrative retirement plan', startMonth: '2026-11', endAge: 95, includePartner: false,
    inflation: 2.5, scenarioSpread: 2, monthlySpending: 2500, spendingStart: '2044-11',
    people: [
      {id:'you',name:'You (example)',dob:'1979-11-01',retirementMonth:'2044-11',region:'rUK',taxFreeUsed:0},
      {id:'partner',name:'Partner (example)',dob:'1981-11-01',retirementMonth:'2046-11',region:'rUK',taxFreeUsed:0}
    ],
    pots: [
      {id:'isa',name:'Stocks & shares ISA',owner:'you',type:'stocksIsa',balance:40000,monthlyContribution:300,employerContribution:0,contributionBasis:'gross',growth:5,fee:0.3,contributionStart:'2026-11',contributionEnd:'2044-10',accessAge:57},
      {id:'cash',name:'Cash savings',owner:'you',type:'savings',balance:15000,monthlyContribution:100,employerContribution:0,contributionBasis:'gross',growth:2.5,fee:0,contributionStart:'2026-11',contributionEnd:'2044-10',accessAge:57},
      {id:'pension',name:'Workplace pension',owner:'you',type:'workplace',balance:120000,monthlyContribution:400,employerContribution:250,contributionBasis:'gross',growth:5,fee:0.5,contributionStart:'2026-11',contributionEnd:'2044-10',accessAge:57},
      {id:'partnerIsa',name:'Partner ISA (example)',owner:'partner',type:'cashIsa',balance:20000,monthlyContribution:150,employerContribution:0,contributionBasis:'gross',growth:3,fee:0,contributionStart:'2026-11',contributionEnd:'2046-10',accessAge:57}
    ],
    incomes: [{id:'stateExample',name:'State Pension — illustrative, replace with your forecast',owner:'you',type:'state',monthlyAmount:900,startMonth:'2046-11',endMonth:'2074-11',escalation:2.5}],
    events: [{id:'holiday',name:'Example retirement trip',month:'2044-11',type:'withdrawal',potId:'isa',toPotId:'',amount:8000}]
  };
}
