import {parseMoneyInput, formatMoneyValue} from './money-input.js';

export const weeklyToMonthly = weekly => weekly * 52 / 12;
export const monthlyToWeekly = monthly => monthly * 12 / 52;
const copy = value => JSON.parse(JSON.stringify(value));
const activePeople = plan => plan.people.filter(person => person.id === 'you' || plan.includePartner);
const stateEntries = (plan, owner) => plan.incomes.filter(income => income.type === 'state' && income.owner === owner);
const esc = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
function failure(message, field) { const error = new Error(message); error.field = field; throw error; }
function assertSingle(plan, person) {
  const entries = stateEntries(plan, person.id);
  if (entries.length > 1) failure(`${person.name} has more than one State Pension income. Resolve these in the detailed income editor before using this setup.`, 'summary');
  return entries[0];
}

/** No entitlement or claim date is inferred. This independent draft cannot mutate a plan. */
export function createStatePensionDraft(plan) {
  const people = {};
  for (const person of activePeople(plan)) {
    const income = assertSingle(plan, person);
    people[person.id] = {enabled: Boolean(income), weeklyAmount: income ? formatMoneyValue(monthlyToWeekly(income.monthlyAmount)) : '', startMonth: income?.startMonth ?? '', escalation: income?.escalation ?? 0};
  }
  return {useTowardTarget: plan.drawdown?.mode === 'totalIncome', people};
}

/** Pure upsert: preserve unrelated records, excluded partners, amounts and IDs. */
export function buildStatePensionPlan(snapshot, draft) {
  const result = copy(snapshot);
  result.drawdown.mode = draft.useTowardTarget ? 'totalIncome' : 'pots';
  const ids = new Set([...snapshot.pots, ...snapshot.incomes, ...snapshot.events].map(item => item.id));
  for (const person of activePeople(snapshot)) {
    const existing = assertSingle(snapshot, person);
    const input = draft.people[person.id];
    if (!input) failure(`Missing State Pension settings for ${person.name}.`, 'summary');
    if (!input.enabled) {
      result.incomes = result.incomes.filter(income => !(income.type === 'state' && income.owner === person.id));
      continue;
    }
    const prefix = `sp-${person.id}`;
    const weekly = parseMoneyInput(input.weeklyAmount);
    if (!Number.isFinite(weekly) || weekly < 0 || weekly > 10000) failure('Enter a weekly forecast between £0 and £10,000.', `${prefix}-weekly`);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.startMonth) || input.startMonth < '1900-01' || input.startMonth > '2250-12' || input.startMonth <= person.dob.slice(0, 7)) failure('Enter an explicit claim start month after the birth month (1900–2250). Check your State Pension age.', `${prefix}-start`);
    const escalation = parseMoneyInput(input.escalation);
    if (!Number.isFinite(escalation) || escalation < 0 || escalation > 15) failure('Enter an annual increase assumption between 0% and 15%.', `${prefix}-escalation`);
    if (existing && input.startMonth > existing.endMonth) failure('The claim start is after this income’s existing end month. Adjust the end month in the detailed income editor first.', `${prefix}-start`);
    let id = existing?.id;
    if (!id) { let suffix = 1; id = `state-${person.id}`; while (ids.has(id)) id = `state-${person.id}-${suffix++}`; ids.add(id); }
    const updated = {...(existing ?? {id, name: `${person.name} State Pension`, owner: person.id, type: 'state', endMonth: '2250-12'}),
      // Comparison is numeric so adding grouping or trailing zeroes never loses precision.
      monthlyAmount: existing && weekly === monthlyToWeekly(existing.monthlyAmount) ? existing.monthlyAmount : weeklyToMonthly(weekly),
      startMonth: input.startMonth, escalation};
    const index = result.incomes.findIndex(income => income.id === id);
    if (index < 0) result.incomes.push(updated); else result.incomes[index] = updated;
  }
  return result;
}

export function mountStatePension({root = document, getPlan, onComplete, onError = () => {}}) {
  const trigger = root.querySelector('#edit-state-pension');
  const dialog = root.querySelector('#state-pension-dialog');
  const content = root.querySelector('#state-pension-content');
  if (!trigger || !dialog || !content) throw new Error('State Pension setup needs its trigger, dialog and content elements.');
  let snapshot = null, draft = null, opener = trigger;
  const find = id => content.querySelector(`#${id}`);
  const close = () => dialog.close();
  const reset = () => { if (dialog.open) return; snapshot = null; draft = null; const returnTo=opener?.isConnected===false ? root.querySelector(`#${opener.id}`) || trigger : opener; returnTo?.focus(); };
  function showError(error) {
    const summary = find('sp-errors');
    summary.hidden = false; summary.textContent = error.message;
    const field = find(error.field || 'sp-errors') || summary;
    if (field !== summary) { field.setAttribute('aria-invalid', 'true'); const inline = find(`${error.field}-error`); if (inline) inline.textContent = error.message; }
    field.focus();
  }
  function render() {
    content.innerHTML = `<h2 id="sp-title" tabindex="-1">Set up State Pension</h2>
      <p>Add your own gross forecast in projection-start (${esc(snapshot.startMonth)}) pounds. Existing figures may be illustrations rather than your entitlement. Check the amount and claim date. <a href="https://www.gov.uk/check-state-pension" target="_blank" rel="noopener noreferrer">Check your State Pension forecast</a> and <a href="https://www.gov.uk/state-pension-age" target="_blank" rel="noopener noreferrer">State Pension age</a>.</p>
      <p class="help">We convert weekly × 52 ÷ 12 into an average calendar-month income, not a four-weekly payment. The claim month is modelled as a whole month. Annual increases apply from the projection start, including years before claiming. This is your assumption, not a guaranteed uprating or triple-lock forecast.</p>
      <div id="sp-errors" role="alert" tabindex="-1" hidden></div>
      <form id="sp-form" novalidate>${activePeople(snapshot).map(person => {
        const value = draft.people[person.id], prefix = `sp-${person.id}`;
        return `<fieldset><legend>${esc(person.name)}</legend><label class="check"><input type="checkbox" id="${prefix}-enabled" ${value.enabled ? 'checked' : ''}> Include State Pension</label>
          <p class="help">Unchecking removes this person’s existing State Pension when you apply.</p>
          <div id="${prefix}-fields" ${value.enabled ? '' : 'hidden'}>
          <label for="${prefix}-weekly">Weekly gross forecast (£)</label><input type="text" data-money inputmode="decimal" id="${prefix}-weekly" value="${esc(value.weeklyAmount)}" aria-describedby="${prefix}-weekly-error"><span class="field-error" id="${prefix}-weekly-error"></span>
          <label for="${prefix}-start">Claim start month</label><input type="month" id="${prefix}-start" value="${esc(value.startMonth)}" aria-describedby="${prefix}-start-error"><span class="field-error" id="${prefix}-start-error"></span>
          <label for="${prefix}-escalation">Annual increase assumption (%) from projection start</label><input type="number" min="0" max="15" step="any" id="${prefix}-escalation" value="${esc(value.escalation)}" aria-describedby="${prefix}-escalation-error"><span class="field-error" id="${prefix}-escalation-error"></span></div></fieldset>`;
      }).join('')}
      <label class="check"><input id="sp-target" type="checkbox" ${draft.useTowardTarget ? 'checked' : ''}> Use pension income toward the annual target (before tax)</label>
      <p class="help">Enabling this changes the target from pot withdrawals to combined gross income, including other modelled income. The annual target amount stays unchanged. Existing plans never switch automatically.</p>
      <p id="sp-mode-note" role="status"></p>
      <p class="help">State Pension is taxable income. This illustration freezes 2026/27 Income Tax assumptions into future years and does not model future changes, including changes from April 2027. It is not a tax forecast.</p>
      <div class="wizard-footer"><button type="button" id="sp-cancel">Cancel</button><button type="submit" class="primary">Apply State Pension</button></div></form>`;
    dialog.setAttribute('aria-labelledby', 'sp-title');
    updateModeNote(); find('sp-title').focus();
  }
  function updateModeNote() { find('sp-mode-note').textContent = find('sp-target').checked ? 'Pension and other income count toward your gross annual target; accessible pots cover any remaining gross gap.' : 'State Pension remains additional income on top of your chosen pot withdrawals.'; }
  function open() {
    if (dialog.open) return;
    opener = root.activeElement || trigger;
    try { snapshot = copy(getPlan()); draft = createStatePensionDraft(snapshot); dialog.showModal(); render(); }
    catch (error) { snapshot = null; draft = null; onError(error); }
  }
  function change(event) {
    if (!draft) return;
    for (const person of activePeople(snapshot)) {
      if (event.target.id === `sp-${person.id}-enabled`) find(`sp-${person.id}-fields`).hidden = !event.target.checked;
    }
    if (event.target.id === 'sp-target') updateModeNote();
    event.target.removeAttribute('aria-invalid');
    const inline = find(`${event.target.id}-error`); if (inline) inline.textContent = '';
  }
  async function submit(event) {
    if (event.target.id !== 'sp-form') return;
    event.preventDefault();
    for (const person of activePeople(snapshot)) {
      const prefix = `sp-${person.id}`;
      draft.people[person.id] = {enabled: find(`${prefix}-enabled`).checked, weeklyAmount: find(`${prefix}-weekly`).value, startMonth: find(`${prefix}-start`).value, escalation: find(`${prefix}-escalation`).value};
    }
    draft.useTowardTarget = find('sp-target').checked;
    try { const candidate = buildStatePensionPlan(snapshot, draft); await onComplete(candidate); close(); }
    catch (error) { showError(error); }
  }
  const click = event => { if (event.target.closest('#sp-cancel')) close(); };
  const cancel = event => { event.preventDefault(); close(); };
  trigger.addEventListener('click', open); content.addEventListener('change', change); content.addEventListener('input', change); content.addEventListener('click', click); content.addEventListener('submit', submit); dialog.addEventListener('cancel', cancel); dialog.addEventListener('close', reset);
  return () => { trigger.removeEventListener('click', open); content.removeEventListener('change', change); content.removeEventListener('input', change); content.removeEventListener('click', click); content.removeEventListener('submit', submit); dialog.removeEventListener('cancel', cancel); dialog.removeEventListener('close', reset); };
}
