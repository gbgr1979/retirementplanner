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

/** Inline draft controller. Never rebuild amount inputs during ordinary typing or chart refreshes. */
export function mountIncomeStages({root = document, getPlan, onComplete, onDraftChange = () => {}, onError = () => {}}) {
  const content = root.querySelector('#income-ranges');
  if (!content) throw new Error('Income ranges need their inline container.');
  let snapshot = copy(getPlan()), draft = createIncomeStageDraft(snapshot);
  const find = id => content.querySelector(`#${id}`);
  function readDraft() {
    draft.annualAmount = find('is-baseline').value;
    draft.stages.forEach((stage, i) => { stage.fromAge = find(`is-age-${i}`).value; stage.annualAmount = find(`is-amount-${i}`).value; });
  }
  function clearErrors() {
    find('is-errors').hidden = true;
    for (const id of ['is-add', 'is-baseline', ...draft.stages.flatMap((_, i) => [`is-age-${i}`, `is-amount-${i}`])]) {
      find(id)?.removeAttribute('aria-invalid');
      if (find(`${id}-error`)) find(`${id}-error`).textContent = '';
    }
  }
  function showError(error, focus = false) {
    const summary = find('is-errors'); summary.hidden = false; summary.textContent = `${error.message} Charts still show the last valid plan.`;
    const field = find(error.field || 'is-errors') || summary;
    if (field !== summary) { field.setAttribute('aria-invalid', 'true'); const inline = find(`${error.field}-error`); if (inline) inline.textContent = error.message; }
    if (focus) field.focus();
    onError(error);
  }
  function updateRanges() {
    const person = primary(snapshot);
    find('is-baseline-range').textContent = draft.stages.length ? `Retirement until age ${draft.stages[0].fromAge || '…'}` : 'From retirement onwards';
    find('is-baseline-date').textContent = `Retirement starts ${person.retirementMonth}`;
    find('is-age-basis').textContent = `Ages refer to ${person.name} (the primary person). Each range starts at the first monthly boundary on or after their birthday.`;
    draft.stages.forEach((stage, i) => {
      const next = draft.stages[i + 1], age = Number(stage.fromAge);
      find(`is-remove-${i}`).setAttribute('aria-label', `Remove range starting at age ${/^\d+$/.test(stage.fromAge) && age >= 18 && age <= 110 ? stage.fromAge : 'not yet valid'}`);
      find(`is-until-${i}`).textContent = next ? `until age ${next.fromAge || '…'}` : 'onwards';
      const month = /^\d+$/.test(stage.fromAge) && age >= 18 && age <= 110 ? stageStartMonth(person.dob, age) : null;
      const note = month && month <= person.retirementMonth ? ' Already in force at retirement; the latest applicable range takes priority.' : age >= snapshot.endAge ? ' At or beyond the plan ending age; retained even if unused.' : '';
      find(`is-range-${i}`).textContent = `${month ? `Starts ${month}.` : 'Enter a valid age to see the start month.'}${note}`;
    });
    for (const [i, amount] of [[-1, draft.annualAmount], ...draft.stages.map((s,i) => [i,s.annualAmount])]) {
      const value = parseMoneyInput(amount);
      find(`is-minus-${i}`).disabled = Number.isFinite(value) && value <= 0;
      find(`is-plus-${i}`).disabled = Number.isFinite(value) && value >= 12000000;
    }
  }
  function render(focus) {
    const money = (id, value, i) => `<div class="range-amount"><label for="${id}">Annual amount before tax</label><div class="plan-stepper range-stepper"><button type="button" id="is-minus-${i}" data-step="-1" data-stage="${i}" aria-label="Reduce annual amount for range ${i + 2} by £1,000">−</button><div class="plan-value"><span aria-hidden="true">£</span><input type="text" data-money inputmode="decimal" id="${id}" value="${esc(value)}" aria-describedby="${id}-error"></div><button type="button" id="is-plus-${i}" data-step="1" data-stage="${i}" aria-label="Increase annual amount for range ${i + 2} by £1,000">+</button></div><span class="field-error" id="${id}-error"></span></div>`;
    content.innerHTML = `<div class="income-range-heading"><h4>Income by age range</h4><span>£1,000 steps · edit any amount</span></div><div id="is-errors" class="field-error" role="alert" tabindex="-1" hidden></div>
      <div class="income-range-row"><div class="range-period"><strong id="is-baseline-range"></strong><p id="is-baseline-date" class="plan-control-hint"></p></div>${money('is-baseline',draft.annualAmount,-1)}</div>
      ${draft.stages.map((stage,i) => `<div class="income-range-row"><div class="range-period"><div class="range-age-line"><label for="is-age-${i}">From age</label><input type="text" inputmode="numeric" id="is-age-${i}" value="${esc(stage.fromAge)}" aria-describedby="is-age-${i}-error is-range-${i}"><strong id="is-until-${i}"></strong></div><span id="is-age-${i}-error" class="field-error"></span><p id="is-range-${i}" class="plan-control-hint"></p><button type="button" class="text-button range-remove" id="is-remove-${i}" data-remove-stage="${i}" aria-label="Remove range starting at age ${esc(stage.fromAge)}">Remove range</button></div>${money(`is-amount-${i}`,stage.annualAmount,i)}</div>`).join('')}
      <div class="income-range-footer"><button type="button" id="is-add" ${draft.stages.length >= 10 ? 'disabled' : ''}>+ Add age range</button><p class="plan-control-hint">The new range starts with the previous amount. Edit it to suit your plan.</p></div><p id="is-age-basis" class="plan-control-hint"></p>`;
    updateRanges(); if (focus) find(focus)?.focus();
  }
  function readPlan(base = getPlan(), focus = true) {
    readDraft(); clearErrors();
    try { return buildIncomeStagePlan(base, draft); }
    catch (error) { showError(error, focus); throw error; }
  }
  function apply(focus = false) {
    try { const candidate = readPlan(getPlan(), focus); snapshot = copy(candidate); onComplete(candidate); return true; }
    catch (error) { if (!error.field) showError(error, focus); return false; }
  }
  function change(event) {
    if (event.isComposing) return;
    readDraft(); onDraftChange(); updateRanges(); apply(false);
  }
  function click(event) {
    const remove = event.target.closest('[data-remove-stage]');
    const step = event.target.closest('[data-step]');
    if (remove) { readDraft(); draft.stages.splice(Number(remove.dataset.removeStage),1); onDraftChange(); render('is-add'); apply(false); return; }
    if (event.target.closest('#is-add')) {
      readDraft();
      try { draft = addIncomeStageDraft(getPlan(), draft); onDraftChange(); render(`is-age-${draft.stages.length - 1}`); apply(false); }
      catch (error) { showError(error,true); }
    }
    if (step) {
      try {
        // Validate every pending range before a button can change any live amount.
        readPlan(getPlan()); const i = Number(step.dataset.stage), id = i < 0 ? 'is-baseline' : `is-amount-${i}`;
        find(id).value = stepIncomeAmount(find(id).value, Number(step.dataset.step));
        readDraft(); onDraftChange(); updateRanges(); apply(true);
      } catch (error) { if (!error.field) showError(error,true); }
    }
  }
  render(); content.addEventListener('input',change); content.addEventListener('click',click);
  return {
    readPlan, apply,
    refresh(plan) { snapshot = copy(plan); updateRanges(); },
    reset(plan) { snapshot = copy(plan); draft = createIncomeStageDraft(plan); render(); },
    destroy() { content.removeEventListener('input',change); content.removeEventListener('click',click); }
  };
}
