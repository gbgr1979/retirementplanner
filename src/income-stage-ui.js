import {parseMoneyInput, formatMoneyValue} from './money-input.js';
import {validatePlan} from './plan.js';
import {stageStartMonth} from './income-stages.js';

const copy = value => JSON.parse(JSON.stringify(value));
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function fail(message, field = 'is-errors') { const error = new Error(message); error.field = field; throw error; }
function assertValid(plan) { const result = validatePlan(plan); if (!result.valid) fail(result.errors.join(' ')); }
const primary = plan => plan.people.find(person => person.id === 'you');

/** Add a whole-pound step in decimal space, without binary floating-point drift.
 * Keep the user's fractional precision; the model remains numeric at the boundary.
 */
export function stepIncomeAmount(value, direction) {
  const amount = parseMoneyInput(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 12000000 || ![-1, 1].includes(direction)) {
    fail('Enter an annual amount between £0 and £12,000,000 before changing it.');
  }
  const raw = String(value).trim().replaceAll(',', '').replace(/^[+-]/, '');
  const [whole, fraction = ''] = raw.split('.');
  const scale = 10n ** BigInt(fraction.length);
  const units = BigInt(whole || '0') * scale + BigInt(fraction || '0');
  const shifted = units + BigInt(direction) * 1000n * scale;
  const bounded = shifted < 0n ? 0n : shifted > 12000000n * scale ? 12000000n * scale : shifted;
  const integer = String(bounded / scale);
  const decimal = fraction.length ? '.' + String(bounded % scale).padStart(fraction.length, '0') : raw.includes('.') ? '.' : '';
  return formatMoneyValue(integer + decimal);
}

/** A separate text draft: only a fully valid candidate changes the live plan. */
export function createIncomeStageDraft(plan) {
  return {annualAmount: formatMoneyValue(plan.drawdown.annualAmount), stages: (plan.drawdown.stages || []).map(stage => ({fromAge: String(stage.fromAge), annualAmount: formatMoneyValue(stage.annualAmount)}))};
}

/** Parse explicitly, preserve all other plan data, and validate the complete candidate. */
export function buildIncomeStagePlan(snapshot, draft) {
  const amount = (value, field) => {
    const number = parseMoneyInput(value);
    if (!Number.isFinite(number) || number < 0 || number > 12000000) fail('Enter an annual amount between £0 and £12,000,000.', field);
    return number;
  };
  if (!Array.isArray(draft.stages) || draft.stages.length > 10) fail('Use no more than 10 age changes.');
  const result = copy(snapshot);
  result.drawdown.annualAmount = amount(draft.annualAmount, 'is-baseline');
  let previous = 17;
  result.drawdown.stages = draft.stages.map((stage, index) => {
    const text = String(stage.fromAge).trim();
    const age = /^\d+$/.test(text) ? Number(text) : NaN;
    if (!Number.isInteger(age) || age < 18 || age > 110) fail('Enter a whole age between 18 and 110.', `is-age-${index}`);
    if (age <= previous) fail('Each start age must be later than the previous start age. Reorder by editing the ages, or remove the unwanted stage.', `is-age-${index}`);
    previous = age;
    return {fromAge: age, annualAmount: amount(stage.annualAmount, `is-amount-${index}`)};
  });
  assertValid(result);
  return result;
}

/** Copy the previous target; never choose a new spending commitment for the user. */
export function addIncomeStageDraft(plan, draft) {
  if (draft.stages.length >= 10) fail('Use no more than 10 age changes.', 'is-add');
  const person = primary(plan);
  const retirementYearAge = Number(person.retirementMonth.slice(0, 4)) - Number(person.dob.slice(0, 4));
  let age = Math.max(70, retirementYearAge);
  while (age <= 110 && stageStartMonth(person.dob, age) <= person.retirementMonth) age++;
  if (draft.stages.length) {
    const previous = Number(draft.stages.at(-1).fromAge);
    if (!Number.isInteger(previous) || previous < 18 || previous > 110) fail('Enter a valid start age before adding another stage.', `is-age-${draft.stages.length - 1}`);
    age = Math.min(110, previous + 5);
    if (age <= previous) fail('The final start age is already 110. Edit or remove it before adding another stage.', 'is-add');
  }
  if (age > 110) fail('There is no later age available up to age 110.', 'is-add');
  return {...draft, stages: [...draft.stages.map(stage => ({...stage})), {fromAge: String(age), annualAmount: draft.stages.at(-1)?.annualAmount ?? draft.annualAmount}]};
}

/** Calendar years identify birthday-based monthly boundaries, including December rollover. */
export function boundaryYearToAge(dob, value, field = 'is-errors') {
  const text = String(value).trim();
  if (!/^\d{4}$/.test(text)) fail('Enter a four-digit end year.', field);
  for (let age = 18; age <= 110; age++) if (stageStartMonth(dob, age).slice(0, 4) === text) return age;
  fail('Choose an end year corresponding to a primary age between 18 and 110.', field);
}
/** Same exclusive birthday-month / 80-year horizon used by the projection engine. */
export function incomeTableHorizon(plan) {
  const person=primary(plan), index=month=>Number(month.slice(0,4))*12+Number(month.slice(5,7))-1;
  const birthdayEnd=index(person.dob)+plan.endAge*12, cap=index(plan.startMonth)+80*12, end=Math.min(birthdayEnd,cap);
  const month=`${Math.floor(end/12)}-${String(end%12+1).padStart(2,'0')}`;
  const age=Math.floor((end-index(person.dob)-(person.dob.slice(8)==='01'?0:1))/12);
  return {month, note:cap<birthdayEnd?`Plan end · 80-year limit · age ${age}`:`Plan end · up to age ${plan.endAge}`};
}

const monthLabel = month => new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', {month:'short',year:'numeric',timeZone:'UTC'});

/** Inline table controller; ordinary typing and chart refreshes retain input nodes. */
export function mountIncomeStages({root = document, getPlan, onComplete, onDraftChange = () => {}, onError = () => {}}) {
  const content = root.querySelector('#income-ranges');
  if (!content) throw new Error('Income ranges need their inline container.');
  let snapshot = copy(getPlan()), draft = createIncomeStageDraft(snapshot), years = [], dobNotice = '';
  const find = id => content.querySelector(`#${id}`);
  const yearFor = stage => stageStartMonth(primary(snapshot).dob, Number(stage.fromAge)).slice(0,4);
  const resetYears = () => { years = draft.stages.map(stage => ({text:yearFor(stage),dirty:false})); };
  resetYears();
  function readDraft() {
    draft.annualAmount = find('is-baseline').value;
    draft.stages.forEach((stage,i) => {
      const text = find(`is-year-${i}`).value;
      years[i].dirty ||= text !== years[i].text; years[i].text = text;
      stage.annualAmount = find(`is-amount-${i}`).value;
    });
  }
  function clearErrors() {
    find('is-errors').hidden = true;
    for (const id of ['is-add','is-baseline',...draft.stages.flatMap((_,i)=>[`is-year-${i}`,`is-amount-${i}`])]) {
      find(id)?.removeAttribute('aria-invalid'); if(find(`${id}-error`))find(`${id}-error`).textContent='';
    }
  }
  function showError(error, focus = false) {
    if(error.field?.startsWith('is-age-')){error.field=error.field.replace('is-age-','is-year-');if(error.message.includes('later than the previous'))error.message='Each end year must be later than the previous end year. Edit the years or remove the unwanted row.';}
    const summary=find('is-errors');summary.hidden=false;summary.textContent=`${error.message} Charts still show the last valid plan.`;
    const field=find(error.field||'is-errors')||summary;
    if(field!==summary){field.setAttribute('aria-invalid','true');const inline=find(`${error.field}-error`);if(inline)inline.textContent=error.message;}
    if(focus)field.focus();onError(error);
  }
  function displayBoundary(i) {
    try { const age=years[i].dirty?boundaryYearToAge(primary(snapshot).dob,years[i].text):Number(draft.stages[i].fromAge);return {age,month:stageStartMonth(primary(snapshot).dob,age)}; }
    catch { return null; }
  }
  function updateRanges() {
    const person=primary(snapshot), horizon=incomeTableHorizon(snapshot), possessive=/^you(?:\s*\(.*\))?$/i.test(person.name)?'your':`${person.name}’s`;
    find('is-plan-end').textContent=monthLabel(horizon.month);find('is-plan-end-note').textContent=horizon.note;
    find('is-baseline-range').textContent=monthLabel(person.retirementMonth);
    const [ry,rm]=person.retirementMonth.split('-').map(Number),[by,bm,bd]=person.dob.split('-').map(Number);
    const retirementAge=ry-by-(rm<bm||(rm===bm&&bd>1)?1:0);
    find('is-baseline-date').textContent=`Retirement · age ${retirementAge}`;
    find('is-age-basis').textContent=`End year is exclusive: the next row starts at that boundary. Boundaries use the first monthly boundary on or after ${possessive} birthday, not 1 January. The final row continues to the plan end.`;
    find('is-dob-notice').textContent=dobNotice;find('is-dob-notice').hidden=!dobNotice;
    draft.stages.forEach((stage,i)=>{
      const boundary=displayBoundary(i);
      find(`is-from-${i}`).textContent=boundary?monthLabel(boundary.month):'Enter an end year above';
      find(`is-boundary-${i}`).textContent=boundary?`${monthLabel(boundary.month)} · age ${boundary.age}`:'Enter a valid boundary year';
      find(`is-remove-${i}`).setAttribute('aria-label',`Remove row starting ${boundary?monthLabel(boundary.month):'at an invalid boundary'}`);
      const note=boundary&&boundary.month<=person.retirementMonth?'Already in force at retirement; the latest applicable row takes priority.':boundary&&boundary.age>=snapshot.endAge?'At or beyond the plan ending age; retained even if unused.':'';
      find(`is-range-${i}`).textContent=boundary?`Age ${boundary.age}. ${note}`:note;
    });
    for(const [i,amount] of [[-1,draft.annualAmount],...draft.stages.map((stage,i)=>[i,stage.annualAmount])]){
      const value=parseMoneyInput(amount);find(`is-minus-${i}`).disabled=Number.isFinite(value)&&value<=0;find(`is-plus-${i}`).disabled=Number.isFinite(value)&&value>=12000000;
    }
  }
  function render(focus) {
    const money=(id,value,i)=>`<label class="sr-only" for="${id}">Annual amount before tax for row ${i+2}</label><div class="plan-stepper range-stepper"><button type="button" id="is-minus-${i}" data-step="-1" data-stage="${i}" aria-label="Reduce annual amount for row ${i+2} by £1,000">−</button><div class="plan-value"><span aria-hidden="true">£</span><input type="text" data-money inputmode="decimal" id="${id}" value="${esc(value)}" aria-describedby="${id}-error"></div><button type="button" id="is-plus-${i}" data-step="1" data-stage="${i}" aria-label="Increase annual amount for row ${i+2} by £1,000">+</button></div><span class="field-error" id="${id}-error"></span>`;
    const until=i=>i<draft.stages.length?`<label class="sr-only" for="is-year-${i}">End year for row ${i+1} (exclusive)</label><input class="range-year" type="text" inputmode="numeric" id="is-year-${i}" value="${esc(years[i].text)}" aria-describedby="is-year-${i}-error is-boundary-${i}"><p class="plan-control-hint" id="is-boundary-${i}"></p><span class="field-error" id="is-year-${i}-error"></span>`:'<strong id="is-plan-end"></strong><p id="is-plan-end-note" class="plan-control-hint"></p>';
    content.innerHTML=`<div id="is-errors" class="field-error" role="alert" tabindex="-1" hidden></div><p id="is-dob-notice" class="plan-control-hint" role="status" hidden></p><table class="income-range-table"><caption class="sr-only">Annual income ranges before tax. End years are exclusive.</caption><thead><tr><th scope="col">From year</th><th scope="col">End year</th><th scope="col">Annual amount before tax</th></tr></thead><tbody>
      <tr><td data-label="From year"><strong id="is-baseline-range"></strong><p id="is-baseline-date" class="plan-control-hint"></p></td><td data-label="End year">${until(0)}</td><td data-label="Annual amount before tax">${money('is-baseline',draft.annualAmount,-1)}</td></tr>
      ${draft.stages.map((stage,i)=>`<tr><td data-label="From year"><strong id="is-from-${i}"></strong><p class="plan-control-hint" id="is-range-${i}"></p><button type="button" class="text-button range-remove" id="is-remove-${i}" data-remove-stage="${i}">Remove row</button></td><td data-label="End year">${until(i+1)}</td><td data-label="Annual amount before tax">${money(`is-amount-${i}`,stage.annualAmount,i)}</td></tr>`).join('')}
      </tbody><tfoot><tr><td colspan="3"><div class="income-range-footer"><button type="button" id="is-add" ${draft.stages.length>=10?'disabled':''}>+ Add another row</button><p class="plan-control-hint">Starts with the previous amount. Edit the end year and amount to suit your plan.</p></div></td></tr></tfoot></table><p id="is-age-basis" class="plan-control-hint"></p>`;
    updateRanges();if(focus)find(focus)?.focus();
  }
  function readPlan(base=getPlan(),focus=true) {
    readDraft();clearErrors();
    try {
      if(primary(base).dob!==primary(snapshot).dob&&years.some(year=>year.dirty))fail('The date of birth and a table year have both changed. Restore the date of birth and finish the year edit first, then change the date of birth separately. Typed years have been kept.',`is-year-${years.findIndex(year=>year.dirty)}`);
      const candidateDraft=copy(draft);
      candidateDraft.stages.forEach((stage,i)=>{if(years[i].dirty)stage.fromAge=String(boundaryYearToAge(primary(snapshot).dob,years[i].text,`is-year-${i}`));});
      const candidate=buildIncomeStagePlan(base,candidateDraft);
      // Keep raw year text and input nodes; only ages are committed here.
      draft=candidateDraft;years.forEach(year=>{year.dirty=false;});return candidate;
    } catch(error){showError(error,focus);throw error;}
  }
  function apply(focus=false){try{const candidate=readPlan(getPlan(),focus);onComplete(candidate);refresh(candidate);return true;}catch(error){if(!error.field)showError(error,focus);return false;}}
  function change(event){if(event.isComposing)return;readDraft();onDraftChange();updateRanges();apply(false);}
  function click(event){
    const remove=event.target.closest('[data-remove-stage]'),step=event.target.closest('[data-step]');
    if(remove){readDraft();const i=Number(remove.dataset.removeStage);draft.stages.splice(i,1);years.splice(i,1);onDraftChange();render('is-add');apply(false);return;}
    if(event.target.closest('#is-add')){
      readDraft();try{const current=copy(draft);current.stages.forEach((stage,i)=>{if(years[i].dirty)stage.fromAge=String(boundaryYearToAge(primary(snapshot).dob,years[i].text,`is-year-${i}`));});const next=addIncomeStageDraft(snapshot,current);draft.stages.push(next.stages.at(-1));years.push({text:yearFor(draft.stages.at(-1)),dirty:false});onDraftChange();render(`is-year-${draft.stages.length-1}`);apply(false);}catch(error){showError(error,true);}
    }
    if(step){try{readPlan(getPlan());const i=Number(step.dataset.stage),id=i<0?'is-baseline':`is-amount-${i}`;find(id).value=stepIncomeAmount(find(id).value,Number(step.dataset.step));readDraft();onDraftChange();updateRanges();apply(true);}catch(error){if(!error.field)showError(error,true);}}
  }
  function refresh(plan){
    const changed=primary(snapshot).dob!==primary(plan).dob;snapshot=copy(plan);
    if(changed){dobNotice='Date of birth changed: the saved age boundaries are unchanged; their calendar years are shown below.';draft.stages.forEach((stage,i)=>{if(!years[i].dirty){years[i].text=yearFor(stage);find(`is-year-${i}`).value=years[i].text;}});}
    updateRanges();
  }
  render();content.addEventListener('input',change);content.addEventListener('click',click);
  return {readPlan,apply,refresh,reset(plan){snapshot=copy(plan);draft=createIncomeStageDraft(plan);dobNotice='';resetYears();render();},destroy(){content.removeEventListener('input',change);content.removeEventListener('click',click);}};
}
