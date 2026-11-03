/** Age-based gross targets. Callers supply a validated v4 plan. No mutation. */
const monthIndex = text => Number(text.slice(0,4))*12+Number(text.slice(5,7))-1;
const monthText = index => `${Math.floor(index/12)}-${String(index%12+1).padStart(2,'0')}`;
const primaryPerson = plan => plan.people.find(person => person.id === 'you');

/** First full month on/after this birthday, including December rollover. */
export function stageStartMonth(dob, fromAge) {
  return monthText(monthIndex(dob.slice(0,7))+fromAge*12+(dob.slice(8,10)==='01'?0:1));
}

/** -1 denotes baseline, or a month before retirement when no target applies. */
export function stageIndexAtMonth(plan, month) {
  const primary = primaryPerson(plan);
  if (month < primary.retirementMonth) return -1;
  let active = -1;
  for (const [index,stage] of plan.drawdown.stages.entries()) {
    if (stageStartMonth(primary.dob,stage.fromAge) > month) break;
    active = index;
  }
  return active;
}

/** Annual amount before indexation, zero before retirement; never sum this field. */
export function annualTargetAtMonth(plan, month) {
  if (month < primaryPerson(plan).retirementMonth) return 0;
  const index = stageIndexAtMonth(plan,month);
  return index < 0 ? plan.drawdown.annualAmount : plan.drawdown.stages[index].annualAmount;
}

/** Effective projection ranges, with exclusive endMonth. Stages outside the
 * horizon stay saved in the plan but cannot produce an empty/negative range.
 */
export function incomeStageRanges(plan) {
  const primary = primaryPerson(plan);
  const startMonth = [plan.startMonth,primary.retirementMonth].sort().at(-1);
  const endMonth = monthText(Math.min(monthIndex(primary.dob.slice(0,7))+plan.endAge*12,monthIndex(plan.startMonth)+80*12));
  if (startMonth >= endMonth) return [];
  const boundaries = [startMonth,...plan.drawdown.stages.map(stage=>stageStartMonth(primary.dob,stage.fromAge)).filter(month=>month>startMonth && month<endMonth),endMonth];
  return boundaries.slice(0,-1).map((startMonth,index)=>{
    const stageIndex = stageIndexAtMonth(plan,startMonth);
    return {stageIndex,fromAge:stageIndex<0?null:plan.drawdown.stages[stageIndex].fromAge,annualAmount:annualTargetAtMonth(plan,startMonth),startMonth,endMonth:boundaries[index+1]};
  });
}

/** Describe only effective ranges; saved changes beyond the horizon stay excluded. */
export function incomeSequenceSummary(plan) {
  const ranges = incomeStageRanges(plan);
  if (!ranges.length) return 'Retirement is outside this projection.';
  const money = new Intl.NumberFormat('en-GB', {style:'currency', currency:'GBP', minimumFractionDigits:0, maximumFractionDigits:2});
  return ranges.map((range, index) => {
    const next = ranges[index + 1];
    return `${index ? 'then ' : ''}${money.format(range.annualAmount)} a year ${next ? `until age ${next.fromAge}` : 'to plan end'}`;
  }).join(', ') + '.';
}
