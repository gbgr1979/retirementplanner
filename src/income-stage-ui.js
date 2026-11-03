import {parseMoneyInput, formatMoneyValue} from './money-input.js';
import {validatePlan} from './plan.js';
import {stageStartMonth} from './income-stages.js';

const copy = value => JSON.parse(JSON.stringify(value));
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function fail(message, field = 'is-errors') { const error = new Error(message); error.field = field; throw error; }
function assertValid(plan) { const result = validatePlan(plan); if (!result.valid) fail(result.errors.join(' ')); }
const primary = plan => plan.people.find(person => person.id === 'you');

/** A separate draft: no typing, adding or removal changes the live plan. */
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

export function mountIncomeStages({root = document, getPlan, onComplete, onError = () => {}}) {
  const trigger = root.querySelector('#edit-income-stages');
  const dialog = root.querySelector('#income-stages-dialog');
  const content = root.querySelector('#income-stages-content');
  if (!trigger || !dialog || !content) throw new Error('Income stages need their trigger, dialog and content elements.');
  let snapshot = null, draft = null, opener = trigger, generation = 0, submitting = false;
  const find = id => content.querySelector(`#${id}`);
  function close() { generation++; submitting = false; dialog.close(); }
  function reset() {
    // A queued close event from a previous opening must not clear a new draft.
    if (dialog.open) return;
    snapshot = null; draft = null;
    const returnTo = opener?.isConnected === false ? root.querySelector(`#${opener.id}`) || trigger : opener;
    returnTo?.focus();
  }
  function showError(error) {
    const summary = find('is-errors'); summary.hidden = false; summary.textContent = error.message;
    const field = find(error.field || 'is-errors') || summary;
    if (field !== summary) { field.setAttribute('aria-invalid', 'true'); const inline = find(`${error.field}-error`); if (inline) inline.textContent = error.message; }
    field.focus();
  }
  function readDraft() {
    draft.annualAmount = find('is-baseline').value;
    draft.stages.forEach((stage, index) => { stage.fromAge = find(`is-age-${index}`).value; stage.annualAmount = find(`is-amount-${index}`).value; });
  }
  function rangeText(index) {
    const next = draft.stages[index + 1];
    return next ? `Until age ${next.fromAge || '…'}` : 'Until the end of the plan';
  }
  function updateRanges() {
    find('is-baseline-range').textContent = draft.stages.length ? `Until age ${draft.stages[0].fromAge || '…'}` : 'Until the end of the plan';
    draft.stages.forEach((stage, index) => {
      const age = Number(stage.fromAge);
      const month = /^\d+$/.test(stage.fromAge) && age >= 18 && age <= 110 ? stageStartMonth(primary(snapshot).dob, age) : null;
      const note = month && month <= primary(snapshot).retirementMonth ? ' This age change is already in force at retirement; the latest applicable stage takes priority.' : age >= snapshot.endAge ? ' This age is at or beyond the plan’s ending age and may not affect the projection.' : '';
      find(`is-range-${index}`).textContent = `${rangeText(index)}. ${month ? `Change month: ${month}.` : 'Enter a valid age to see the change month.'}${note}`;
    });
  }
  function render(focus = 'is-title') {
    const money = (id, value, label) => `<label for="${id}">${label}</label><input type="text" data-money inputmode="decimal" id="${id}" value="${esc(value)}" aria-describedby="${id}-error"><span class="field-error" id="${id}-error"></span>`;
    content.innerHTML = `<div class="modal-heading"><h2 id="is-title" tabindex="-1">Set income stages</h2><button type="button" id="is-close" aria-label="Close income stages without applying">Close ×</button></div>
      <p class="plan-help">${snapshot.drawdown.mode === 'totalIncome' ? 'Combined income target before tax. Pension and other income count toward the target; accessible pots cover the remaining gross gap.' : 'Pot withdrawals before tax. Pension and other income remain additional to these amounts.'} Your target mode stays unchanged.</p>
      <p class="plan-help">${snapshot.drawdown.inflationLinked ? `Amounts are in projection-start (${esc(snapshot.startMonth)}) pounds and increase with the plan’s inflation assumption from that month, including before each stage begins.` : 'Amounts are fixed nominal pounds and do not increase with inflation.'}</p>
      <p class="plan-help">Start ages refer to ${esc(primary(snapshot).name)} (the primary person). Changes use the first monthly boundary on or after the birthday. Targets apply only during retirement within the plan horizon; these ages do not set life expectancy or stop anyone’s income.</p>
      <div id="is-errors" role="alert" tabindex="-1" hidden></div>
      <form id="is-form" novalidate><fieldset><legend>From retirement (${esc(primary(snapshot).retirementMonth)})</legend><p id="is-baseline-range" class="plan-help"></p>${money('is-baseline', draft.annualAmount, 'Annual amount before tax (£)')}</fieldset>
      ${draft.stages.map((stage, index) => `<fieldset><legend>Age change ${index + 1}</legend><label for="is-age-${index}">From age</label><input type="number" min="18" max="110" step="1" id="is-age-${index}" value="${esc(stage.fromAge)}" aria-describedby="is-age-${index}-error is-range-${index}"><span class="field-error" id="is-age-${index}-error"></span><p class="plan-help" id="is-range-${index}"></p>${money(`is-amount-${index}`, stage.annualAmount, 'Annual amount before tax (£)')}<button type="button" data-remove-stage="${index}" aria-label="Remove age change ${index + 1}">Remove stage</button></fieldset>`).join('')}
      <button type="button" id="is-add" ${draft.stages.length >= 10 ? 'disabled' : ''}>Add age change</button><p class="plan-help">Optional: up to 10 age changes, in increasing age order. Adding or removing a stage only changes this draft until you apply.</p>
      <div class="wizard-footer"><button type="button" id="is-cancel">Cancel</button><button type="submit" id="is-apply" class="primary">Apply income stages</button></div></form>`;
    dialog.setAttribute('aria-labelledby', 'is-title'); updateRanges(); find(focus)?.focus();
  }
  function open() {
    if (dialog.open) return;
    opener = root.activeElement || trigger;
    try { const pending = getPlan(); assertValid(pending); snapshot = copy(pending); draft = createIncomeStageDraft(snapshot); generation++; submitting = false; dialog.showModal(); render(); }
    catch (error) { snapshot = null; draft = null; if (dialog.open) dialog.close(); onError(error); }
  }
  function change(event) {
    if (!draft || submitting) return;
    event.target.removeAttribute('aria-invalid');
    const inline = find(`${event.target.id}-error`); if (inline) inline.textContent = '';
    readDraft(); updateRanges();
  }
  function click(event) {
    if (event.target.closest('#is-cancel') || event.target.closest('#is-close')) { close(); return; }
    if (!draft || submitting) return;
    const remove = event.target.closest('[data-remove-stage]');
    if (remove) { readDraft(); draft.stages.splice(Number(remove.dataset.removeStage), 1); render('is-add'); return; }
    if (event.target.closest('#is-add')) {
      readDraft();
      try { draft = addIncomeStageDraft(snapshot, draft); render(`is-age-${draft.stages.length - 1}`); } catch (error) { showError(error); }
    }
  }
  async function submit(event) {
    if (event.target.id !== 'is-form') return;
    event.preventDefault(); if (!draft || submitting) return;
    readDraft(); const current = generation;
    try {
      const candidate = buildIncomeStagePlan(snapshot, draft); submitting = true; find('is-apply').disabled = true;
      await onComplete(candidate);
      if (current === generation && dialog.open) close();
    } catch (error) { if (current === generation && dialog.open) showError(error); }
    finally { if (current === generation) { submitting = false; if (dialog.open) find('is-apply').disabled = false; } }
  }
  const cancel = event => { event.preventDefault(); close(); };
  trigger.addEventListener('click', open); content.addEventListener('input', change); content.addEventListener('change', change); content.addEventListener('click', click); content.addEventListener('submit', submit); dialog.addEventListener('cancel', cancel); dialog.addEventListener('close', reset);
  return () => { generation++; trigger.removeEventListener('click', open); content.removeEventListener('input', change); content.removeEventListener('change', change); content.removeEventListener('click', click); content.removeEventListener('submit', submit); dialog.removeEventListener('cancel', cancel); dialog.removeEventListener('close', reset); };
}
