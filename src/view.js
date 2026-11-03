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
 if(!plan.drawdown?.annualAmount&&!plan.drawdown?.stages?.some(stage=>stage.annualAmount>0))return {hasGap:false,text:'Choose an annual amount to test. Scheduled events still apply.'};
 const active=result.months.filter(m=>m.activeAnnualTarget>0||(plan.drawdown.mode==='totalIncome'?m.incomeTarget>0:m.withdrawalTarget>0));
 if(!active.length)return {hasGap:false,text:result.months.some(m=>m.month>=plan.people.find(p=>p.id==='you').retirementMonth)?'No positive target applies within this projection. Check your income stages.':'Your retirement starts outside this projection. Extend the planning horizon to test withdrawals.'};
 const gap=result.firstUnmetWithdrawal;
 const date=month=>new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'});
 if(gap)return {hasGap:true,text:`First ${plan.drawdown.mode==='totalIncome'?'income-target':'withdrawal'} shortfall: ${date(gap.month)}. ${gap.locked>0.01?'Some pension funds are still locked — this is not the same as all your money running out.':gap.total<=0.01?'Your modelled pots are depleted at that point.':'The accessible pots cannot meet that month’s target.'} Try a lower amount to compare.`};
 return {hasGap:false,text:`This target is funded through ${date(result.months.at(-1).month)} in this scenario. That is the end of the projection, not a guarantee of sustainable income.`};
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
export function retirementMarker(retirementMonth,years,months=[],dob=null) {
 const year=Number(retirementMonth.slice(0,4));
 const index=years.findIndex(row=>Number(row.year)===year);
 const inMonths=!months.length||(retirementMonth>=months[0].month&&retirementMonth<=months.at(-1).month);
 const visible=index>=0&&inMonths;
 const age=ageAtMonthStart(dob,retirementMonth);
 const chartLabel=age===null?'Retirement':`Retirement – age ${age}`;
 const label=`Your retirement: ${readableMonth(retirementMonth)}${age===null?'':` · age ${age} at the start of the month`}`;
 return {visible,index:visible?index:null,position:visible?index/Math.max(1,years.length-1):null,label,chartLabel,age,
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
export function svgChart(years,series,stacked=false,marker=null,eventMarkers=[]){const w=760,h=260,left=66,right=16,top=20,bottom=34,plotH=h-top-bottom;const max=Math.max(1,...years.map((y,i)=>stacked?series.reduce((s,a)=>s+(a.values[i]||0),0):Math.max(...series.map(a=>a.values[i]||0))));const x=i=>left+i*(w-left-right)/Math.max(1,years.length-1);const y=v=>h-bottom-v/max*plotH;let svg=`<svg viewBox="0 0 ${w} ${h}" data-start-year="${years[0].year}" data-end-year="${years.at(-1).year}" role="img" aria-label="${stacked?'Projected year-end balances by pot':'Annual estimated cash and spending'}"><title>${stacked?'Wealth projection':'Income and spending'} from ${years[0].year} to ${years.at(-1).year}; full values in the annual ledger below</title>`;for(let i=0;i<4;i++){let value=max*i/3;svg+=`<line x1="${left}" y1="${y(value)}" x2="${w-right}" y2="${y(value)}" class="gridline"/><text x="${left-8}" y="${y(value)+4}" text-anchor="end">£${Math.round(value/1000)}k</text>`;}let base=years.map(()=>0);series.forEach(s=>{if(stacked){const tops=s.values.map((v,i)=>base[i]+v);svg+=`<path fill="${s.colour}" d="M ${tops.map((v,i)=>`${x(i)},${y(v)}`).join(' L ')} L ${base.map((v,i)=>`${x(i)},${y(v)}`).reverse().join(' L ')} Z"/>`;base=tops;}else svg+=`<polyline fill="none" stroke="${s.colour}" stroke-width="3" ${s.dash?'stroke-dasharray="7 5"':''} points="${s.values.map((v,i)=>`${x(i)},${y(v)}`).join(' ')}"/>`;});years.forEach((a,i)=>{if(i===0||i===years.length-1||i%10===0)svg+=`<text x="${x(i)}" y="${h-8}" text-anchor="middle">${a.year}</text>`;});if(marker?.visible){const mx=x(marker.index),anchor=mx>(w-left-right)/2+left?'end':'start',tx=mx+(anchor==='end'?-7:7);svg+=`<g role="img" aria-label="${escapeHTML(marker.label)}"><line class="retirement-marker" x1="${mx}" x2="${mx}" y1="${top}" y2="${h-bottom}"/><text class="retirement-marker-label" x="${tx}" y="${top+12}" text-anchor="${anchor}">${escapeHTML(marker.chartLabel||'Retirement')}</text></g>`;}const occupied=[];for(const event of eventMarkers){if(!Number.isInteger(event.index)||event.index<0||event.index>=years.length)continue;const mx=x(event.index),anchor=mx>(w-left-right)/2+left?'end':'start',tx=mx+(anchor==='end'?-7:7),width=(event.chartLabel||event.label).length*6.4,start=anchor==='end'?tx-width:tx,end=anchor==='end'?tx:tx+width;let row=0;while(occupied[row]?.some(([a,b])=>start<b+12&&end>a-12))row++;(occupied[row]??=[]).push([start,end]);const kind=event.kind==='state'?'state':'depletion';svg+=`<g role="img" aria-label="${escapeHTML(event.label)}"><line class="${kind}-marker" x1="${mx}" x2="${mx}" y1="${top}" y2="${h-bottom}"/><text class="${kind}-marker-label" x="${tx}" y="${top+32+row*18}" text-anchor="${anchor}">${escapeHTML(event.chartLabel||event.label)}</text></g>`;}return svg+'</svg>';}

/** Native modal focus containment; help never reads or changes financial state. */
export function mountHelpDialog(root,{triggerId='plan-help',dialogId='plan-help-dialog',closeId='plan-help-close'}={}) {
 const trigger=root.getElementById(triggerId),dialog=root.getElementById(dialogId),close=root.getElementById(closeId);
 if(!trigger||!dialog||!close)throw new Error('Help dialog controls are missing.');
 let opener=null;
 const open=event=>{
  event.preventDefault();
  if(dialog.open)return;
  opener=event.currentTarget||trigger;
  dialog.showModal();
  close.focus();
 };
 const dismiss=event=>{
  event.preventDefault();
  if(dialog.open)dialog.close();
 };
 const keydown=event=>{if(event.key==='Escape')dismiss(event);};
 const restore=()=>{
  // Native close events are queued: an old event must not steal a reopened modal's focus.
  if(dialog.open)return;
  const target=opener;opener=null;
  if(target?.isConnected!==false)target?.focus();
 };
 trigger.addEventListener('click',open);
 close.addEventListener('click',dismiss);
 dialog.addEventListener('cancel',dismiss);
 dialog.addEventListener('keydown',keydown);
 dialog.addEventListener('close',restore);
 return ()=>{
  trigger.removeEventListener('click',open);
  close.removeEventListener('click',dismiss);
  dialog.removeEventListener('cancel',dismiss);
  dialog.removeEventListener('keydown',keydown);
  dialog.removeEventListener('close',restore);
 };
}

/** Compact card status; complete caveats remain available in the help dialog. */
export function withdrawalCardSummary(plan,result) {
 if(!plan.drawdown.annualAmount&&!plan.drawdown.stages?.some(stage=>stage.annualAmount>0))return 'Set an annual amount to compare withdrawals.';
 const gap=result.firstUnmetWithdrawal;
 if(gap)return `Shortfall from ${readableMonth(gap.month)}. ${gap.locked>0.01?'Some pension funds remain locked.':gap.total<=0.01?'Modelled pots depleted.':'Accessible pots cannot cover the target.'}`;
 const last=result.months.filter(m=>m.activeAnnualTarget>0||(plan.drawdown.mode==='totalIncome'?m.incomeTarget>0:m.withdrawalTarget>0)).at(-1);
 return last?`Funded through ${readableMonth(result.months.at(-1).month)} in this scenario. Not guaranteed.`:result.months.some(m=>m.month>=plan.people.find(p=>p.id==='you').retirementMonth)?'No positive income target applies within this projection.':'Retirement is outside this projection.';
}

/** Two monthly pot snapshots. End-of-plan is a planning assumption, not a death forecast. */
export function planSummary(plan,result,real=true) {
 const primary=plan.people.find(person=>person.id==='you');
 const retirementMonth=primary.retirementMonth;
 const retirementRow=result.months.find(row=>row.month===retirementMonth);
 const last=result.months.at(-1);
 const start=monthNumber(plan.startMonth);
 const value=(amount,month,closing)=>amount/(real?Math.pow(1+plan.inflation/100,(monthNumber(month)-start+(closing?1:0))/12):1);
 const basis=real?'Values are in projection-start money.':'Values are in future money.';
 const scope=(plan.includePartner?'Includes your and your partner’s active pots, including locked pensions.':'Includes all your active pots, including locked pensions.')+' Pension balances are before any tax on future withdrawals; this is not a net estate valuation.';
 const ageEnd=monthNumber(primary.dob)+plan.endAge*12;
 const capped=ageEnd>start+80*12;
 const horizon=capped?`The projection reaches its 80-year limit before your planned end age of ${plan.endAge}.`
  :`Planned up to your age ${plan.endAge}, ending just before your birthday month.`;
 return {
  retirement:{value:retirementRow?value(retirementRow.opening,retirementMonth,false):null,month:retirementMonth,
   dateLabel:`${readableMonth(retirementMonth)} · ${retirementRow?'before withdrawals':'outside projection'}`,
   label:`At retirement · ${readableMonth(retirementMonth)}`,
   note:retirementRow?`Before that month’s growth, contributions and withdrawals. ${scope} ${basis}`
    :`Retirement is ${retirementMonth<plan.startMonth?'before the projection starts':'outside the projection'}, so no retirement balance is available.`},
  end:{value:last?value(last.total,last.month,true):null,month:last?.month??null,
   dateLabel:last?`${readableMonth(last.month)} · ${capped?'80-year projection limit':`up to your age ${plan.endAge}`}`:'No projected months',
   label:last?`At end of plan · ${readableMonth(last.month)}`:'At end of plan',
   note:last?`${horizon} After the final month’s withdrawals. ${scope} This is a planning horizon, not a predicted date of death or a guaranteed inheritance. ${basis}`
    :'No projected months are available, so no end-of-plan balance is available.'}
 };
}

/** Retirement is modelled from day one of its selected month, not an invented day. */
export function ageAtMonthStart(dob,month) {
 if(typeof dob!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(dob)||typeof month!=='string'||!/^\d{4}-\d{2}$/.test(month))return null;
 const birth=new Date(`${dob}T00:00:00Z`),date=new Date(`${month}-01T00:00:00Z`);
 if(!Number.isFinite(birth.getTime())||!Number.isFinite(date.getTime())||birth.toISOString().slice(0,10)!==dob||date.toISOString().slice(0,7)!==month||date<birth)return null;
 return date.getUTCFullYear()-birth.getUTCFullYear()-(date.getUTCMonth()<birth.getUTCMonth()||(date.getUTCMonth()===birth.getUTCMonth()&&birth.getUTCDate()>1)?1:0);
}

export const GROWTH_RATE_STEP = 0.5;
const growthGroups = [
 {category:'savings',label:'Savings',types:['savings']},
 {category:'isa',label:'ISA',types:['cashIsa','stocksIsa']},
 {category:'pension',label:'Pension',types:['sipp','workplace']}
];
const activeGrowthPots = (plan,group) => (plan?.pots||[]).filter(pot=>
 (pot.owner==='you'||(plan.includePartner===true&&pot.owner==='partner'))&&group.types.includes(pot.type));
/** Add half a percentage point in decimal space, retaining imported rate precision. */
function steppedGrowth(rate,direction) {
 const [mantissa,exponent='0']=String(rate).split('e');
 const [whole,fraction='']=mantissa.split('.');
 const decimals=fraction.length-Number(exponent),scale=Math.max(1,decimals);
 const units=BigInt(whole+fraction)*10n**BigInt(scale-decimals);
 const shifted=units+BigInt(direction)*5n*10n**BigInt(scale-1);
 const negative=shifted<0n,digits=(negative?-shifted:shifted).toString().padStart(scale+1,'0');
 return Number(`${negative?'-':''}${digits.slice(0,-scale)}.${digits.slice(-scale)}`);
}
const validGrowth = rate => Number.isFinite(rate)&&rate>=-50&&rate<=50;
const canShiftGrowth = (pots,direction) => pots.length>0&&pots.every(pot=>
 validGrowth(pot.growth)&&validGrowth(steppedGrowth(pot.growth,direction)));
/** Group base rates before fees; never blend unlike pots into a misleading average. */
export function growthRateControls(plan) {
 return growthGroups.map(group=>{
  const pots=activeGrowthPots(plan,group),valid=pots.every(pot=>validGrowth(pot.growth));
  const rates=valid?pots.map(pot=>pot.growth):[];
  const min=rates.length?Math.min(...rates):null,max=rates.length?Math.max(...rates):null;
  const mixed=rates.length>0&&min!==max,rate=rates.length&&!mixed?min:null;
  return {category:group.category,label:group.label,count:pots.length,rate,min,max,mixed,
   display:!pots.length?'No pots':!valid?'Invalid rate':mixed?`Mixed: ${min}%–${max}%`:`${rate}%`,
   canDecrease:canShiftGrowth(pots,-1),canIncrease:canShiftGrowth(pots,1),step:GROWTH_RATE_STEP};
 });
}
/** Shift every active pot in one group equally, preserving other plan assumptions. */
export function shiftGroupGrowth(plan,category,direction) {
 const group=growthGroups.find(group=>group.category===category);
 if(!group||(direction!==-1&&direction!==1))return plan;
 const pots=activeGrowthPots(plan,group);
 if(!canShiftGrowth(pots,direction))return plan;
 const affected=new Set(pots);
 return {...plan,pots:plan.pots.map(pot=>affected.has(pot)?{...pot,growth:steppedGrowth(pot.growth,direction)}:pot)};
}

/** Income events annotate annual columns; they never enter the wealth series. */
export function projectionEventMarkers(plan,result) {
 const markers=[],notes=[],months=result.months||[],years=result.years||[];
 if(!months.length)return {markers,notes};
 const primary=plan.people.find(person=>person.id==='you');
 const activeOwners=new Set(plan.people.filter(person=>person.id==='you'||plan.includePartner&&person.id==='partner').map(person=>person.id));
 const seen=new Set();
 for(const income of plan.incomes||[]) {
  if(income.type!=='state'||!activeOwners.has(income.owner)||!(income.monthlyAmount>0))continue;
  // Positive configured receipts plus the actual projected income row establish
  // inclusion. The model does not expose individual income-stream ledgers.
  const receipt=months.find(row=>row.month>=income.startMonth&&row.month<=income.endMonth&&row.incomeGross>0);
  if(!receipt)continue;
  const owner=income.owner==='you'?'Your':"Partner’s";
  const key=`${income.owner}:${income.startMonth}`;
  if(seen.has(key))continue;
  seen.add(key);
  if(income.startMonth<months[0].month) {
   notes.push(`${owner} State Pension is already in payment at the projection start (${readableMonth(months[0].month)}). It is income, not part of the pot balance.`);
   continue;
  }
  const index=years.findIndex(row=>Number(row.year)===Number(receipt.month.slice(0,4)));
  if(index<0)continue;
  const chartLabel=`${owner} State Pension starts`;
  const label=`${chartLabel}: ${readableMonth(receipt.month)}. Income, not pot wealth.`;
  markers.push({index,label,chartLabel,kind:'state',month:receipt.month,owner:income.owner});
  notes.push(`${label} The line marks that year’s plotted balance, not an exact monthly balance.`);
 }
 // Include the first opening balance, so a pot exhausted in month one counts.
 // Exact zero is deliberate: even a small positive balance is not depletion.
 let hadWealth=false;
 for(let i=0;i<months.length;i++) {
  const row=months[i];
  if(row.opening>0)hadWealth=true;
  if(row.total===0&&hadWealth) {
   const index=years.findIndex(year=>Number(year.year)===Number(row.month.slice(0,4)));
   if(index>=0) {
    const recovers=months.slice(i+1).some(later=>later.total>0);
    const age=ageAtMonthStart(primary?.dob,row.month);
    const chartLabel=`${recovers?'Pot first reaches £0':'Pot ran out'}${age===null?'':` – age ${age}`}`;
    const label=`${chartLabel}: ${readableMonth(row.month)}${age===null?'':` (your age at the start of the month)`}. All active pots, including locked pensions${plan.includePartner?' and your partner’s pots':''}, total £0 after this month’s transactions.${recovers?' The balance becomes positive again later.':''}`;
    markers.push({index,label,chartLabel,kind:'depletion',month:row.month,age,recovers});
    notes.push(`${label} The line marks that year’s plotted balance, not an exact monthly balance.`);
   }
   break;
  }
  if(row.total>0)hadWealth=true;
 }
 return {markers,notes};
}
