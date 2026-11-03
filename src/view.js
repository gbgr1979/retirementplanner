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

const monthNumber = value => Number(value.slice(0,4))*12+Number(value.slice(5,7))-1;
const monthString = value => `${Math.floor(value/12)}-${String(value%12+1).padStart(2,'0')}`;
const readableMonth = value => new Date(`${value}-01T00:00:00Z`).toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'});
/** The model ends immediately before the primary person's end-age birthday month. */
export function retirementDateLinks(plan) {
 const retirementMonth=plan.people.find(person=>person.id==='you').retirementMonth;
 return {potIds:plan.pots.filter(pot=>pot.owner==='you'&&pot.contributionEnd===retirementMonth).map(pot=>pot.id),spending:plan.spendingStart===retirementMonth};
}
export function retirementYearControls(plan,links=retirementDateLinks(plan)) {
 const primary=plan.people.find(person=>person.id==='you');
 const current=monthNumber(primary.retirementMonth), start=monthNumber(plan.startMonth);
 const min=Math.max(monthNumber(primary.dob)+18*12,start);
 const max=Math.min(monthNumber(primary.dob)+plan.endAge*12,start+80*12)-1;
 const target=direction=>{
  const next=current+direction*12;
  // Old plans can start outside the horizon. Allow exact annual steps inward,
  // never farther out, and never leap across the whole valid interval.
  const allowed=current<min?direction===1&&next<=max
   :current>max?direction===-1&&next>=min:next>=min&&next<=max;
  if(!allowed)return current;
  const nextText=monthString(next);
  if(plan.pots.some(pot=>pot.owner==='you'&&links.potIds.includes(pot.id)&&nextText<pot.contributionStart))return current;
  return next;
 };
 return {earlierMonth:monthString(target(-1)),laterMonth:monthString(target(1)),minMonth:monthString(min),maxMonth:monthString(max)};
}
export function adjustRetirementMonth(plan,direction,links=retirementDateLinks(plan)) {
 if(direction!==-1&&direction!==1)throw new Error('Retirement adjustment must be plus or minus one year.');
 const controls=retirementYearControls(plan,links);
 return direction===-1?controls.earlierMonth:controls.laterMonth;
}
/** Move linked wizard dates only. Events, incomes, custom dates and partner stay fixed. */
export function shiftRetirementYear(plan,direction,links=retirementDateLinks(plan)) {
 const oldMonth=plan.people.find(person=>person.id==='you').retirementMonth;
 const nextMonth=adjustRetirementMonth(plan,direction,links);
 if(nextMonth===oldMonth)return plan;
 return {...plan,
  people:plan.people.map(person=>person.id==='you'?{...person,retirementMonth:nextMonth}:person),
  spendingStart:links.spending?nextMonth:plan.spendingStart,
  pots:plan.pots.map(pot=>pot.owner==='you'&&links.potIds.includes(pot.id)
   ?{...pot,contributionEnd:nextMonth}:pot)
 };
}
/** Annual samples cannot locate a monthly balance: deliberately mark the year column. */
export function retirementMarker(retirementMonth,years,months=[]) {
 const year=Number(retirementMonth.slice(0,4));
 const index=years.findIndex(row=>Number(row.year)===year);
 const inMonths=!months.length||(retirementMonth>=months[0].month&&retirementMonth<=months.at(-1).month);
 const visible=index>=0&&inMonths;
 const label=`Your retirement: ${readableMonth(retirementMonth)}`;
 return {visible,index:visible?index:null,position:visible?index/Math.max(1,years.length-1):null,label,
  note:visible?`${label}. The line marks the retirement year’s plotted balance, not an exact monthly balance.`
   :`${label} is outside the projection. No retirement line is shown.`};
}

/** Preserve inferred matching dates across comparisons; re-link only explicitly edited dates. */
export function reconcileRetirementLinks(previous,candidate,links) {
 const retirement=candidate.people.find(p=>p.id==='you').retirementMonth;
 const changedRetirement=retirement!==previous.people.find(p=>p.id==='you').retirementMonth;
 return {spending:candidate.spendingStart!==previous.spendingStart?candidate.spendingStart===retirement:links.spending&&(!changedRetirement||candidate.spendingStart===retirement),potIds:candidate.pots.filter(p=>{const old=previous.pots.find(o=>o.id===p.id);return !old||old.owner!==p.owner||old.contributionEnd!==p.contributionEnd?p.owner==='you'&&p.contributionEnd===retirement:links.potIds.includes(p.id)&&(!changedRetirement||p.contributionEnd===retirement);}).map(p=>p.id)};
}

/** Stored projection dates define the chart domain; retirement never clips it. */
export function projectionTimeline(plan,result) {
 const start=result.months[0]?.month||plan.startMonth,end=result.months.at(-1)?.month;
 const retirement=plan.people.find(p=>p.id==='you').retirementMonth;
 const span=`Projection starts ${readableMonth(start)}${end?` and runs to ${readableMonth(end)}`:''}.`;
 const timing=retirement===start?'Retirement is set to the projection start, so planned withdrawals begin immediately.'
  :retirement<start?'Retirement is before the projection start, so planned withdrawals begin at the start of this projection.'
  :`Retirement is set to ${readableMonth(retirement)}; the chart includes the years before it.`;
 return `${span} ${timing}`;
}

/** Pure annual chart rendering: always uses every provided projection year. */
export function svgChart(years,series,stacked=false,marker=null){const w=760,h=260,left=66,right=16,top=20,bottom=34,plotH=h-top-bottom;const max=Math.max(1,...years.map((y,i)=>stacked?series.reduce((s,a)=>s+(a.values[i]||0),0):Math.max(...series.map(a=>a.values[i]||0))));const x=i=>left+i*(w-left-right)/Math.max(1,years.length-1);const y=v=>h-bottom-v/max*plotH;let svg=`<svg viewBox="0 0 ${w} ${h}" data-start-year="${years[0].year}" data-end-year="${years.at(-1).year}" role="img" aria-label="${stacked?'Projected year-end balances by pot':'Annual estimated cash and spending'}"><title>${stacked?'Wealth projection':'Income and spending'} from ${years[0].year} to ${years.at(-1).year}; full values in the annual ledger below</title>`;for(let i=0;i<4;i++){let value=max*i/3;svg+=`<line x1="${left}" y1="${y(value)}" x2="${w-right}" y2="${y(value)}" class="gridline"/><text x="${left-8}" y="${y(value)+4}" text-anchor="end">£${Math.round(value/1000)}k</text>`;}let base=years.map(()=>0);series.forEach(s=>{if(stacked){const tops=s.values.map((v,i)=>base[i]+v);svg+=`<path fill="${s.colour}" d="M ${tops.map((v,i)=>`${x(i)},${y(v)}`).join(' L ')} L ${base.map((v,i)=>`${x(i)},${y(v)}`).reverse().join(' L ')} Z"/>`;base=tops;}else svg+=`<polyline fill="none" stroke="${s.colour}" stroke-width="3" ${s.dash?'stroke-dasharray="7 5"':''} points="${s.values.map((v,i)=>`${x(i)},${y(v)}`).join(' ')}"/>`;});years.forEach((a,i)=>{if(i===0||i===years.length-1||i%10===0)svg+=`<text x="${x(i)}" y="${h-8}" text-anchor="middle">${a.year}</text>`;});if(marker?.visible){const mx=x(marker.index),anchor=mx>(w-left-right)/2+left?'end':'start',tx=mx+(anchor==='end'?-7:7);svg+=`<g role="img" aria-label="${escapeHTML(marker.label)}"><line class="retirement-marker" x1="${mx}" x2="${mx}" y1="${top}" y2="${h-bottom}"/><text class="retirement-marker-label" x="${tx}" y="${top+12}" text-anchor="${anchor}">Retirement ${escapeHTML(years[marker.index].year)}</text></g>`;}return svg+'</svg>';}
