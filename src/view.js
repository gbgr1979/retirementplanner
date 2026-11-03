/** Pure display helpers; no browser state or financial calculation. */
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function discountFactor(plan,months,year,real=true){
 if(!real)return 1;
 const last=months.filter(m=>Number(m.month.slice(0,4))===Number(year)).at(-1)?.month||`${year}-12`;
 const elapsed=(Number(last.slice(0,4))-Number(plan.startMonth.slice(0,4)))*12+Number(last.slice(5))-Number(plan.startMonth.slice(5))+1;
 return Math.pow(1+plan.inflation/100,Math.max(0,elapsed)/12);
}
export function retirementSnapshot(plan,years){
 const person=plan.people.find(p=>p.id==='you');
 const retirementYear=Number(person.retirementMonth.slice(0,4));
 const match=years.find(y=>y.year>=retirementYear);
 return {year:match||years.at(-1),withinHorizon:!!match};
}

/** Only successful plan acceptance reveals the workspace; cancelled/failed flows preserve it. */
export function updatePlanScreen(root,event) {
 const landing=root.getElementById('landing');
 if(event==='initialise') {
  landing.hidden=false;
  for(const id of ['planner-view','plan-actions','skip-projection'])root.getElementById(id).hidden=true;
 } else if(event==='planAccepted') {
  landing.hidden=true;
  for(const id of ['planner-view','plan-actions','skip-projection'])root.getElementById(id).hidden=false;
 }
 return !root.getElementById('planner-view').hidden;
}

export const MAX_ANNUAL_WITHDRAWAL = 12000000;
/** Integer pence avoid cumulative floating-point drift in +/- £1,000 controls. */
export function adjustAnnualWithdrawal(amount,direction) {
 if(!Number.isFinite(amount)||amount<0||amount>MAX_ANNUAL_WITHDRAWAL)throw new Error('Enter an annual withdrawal from £0 to £12,000,000.');
 if(direction!==1&&direction!==-1)throw new Error('Withdrawal adjustment must be plus or minus.');
 return Math.min(MAX_ANNUAL_WITHDRAWAL*100,Math.max(0,Math.round(amount*100)+direction*100000))/100;
}

export function withdrawalOutcome(plan,result) {
 if(!plan.drawdown?.annualAmount)return {hasGap:false,text:'Choose an annual amount to test regular withdrawals. Scheduled events still apply.'};
 const active=result.months.filter(m=>m.withdrawalTarget>0);
 if(!active.length)return {hasGap:false,text:'Your retirement starts outside this projection. Extend the planning horizon to test withdrawals.'};
 const gap=result.firstUnmetWithdrawal;
 const date=month=>new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'});
 if(gap)return {hasGap:true,text:`First withdrawal shortfall: ${date(gap.month)}. ${gap.locked>0.01?'Some pension funds are still locked — this is not the same as all your money running out.':gap.total<=0.01?'Your modelled pots are depleted at that point.':'The accessible pots cannot meet that month’s target.'} Try a lower amount to compare.`};
 return {hasGap:false,text:`This target is funded through ${date(active.at(-1).month)} in this scenario. That is the end of the projection, not a guarantee of sustainable income.`};
}
