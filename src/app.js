import {mountIncomeStages} from './income-stage-ui.js';
import {mountStatePension} from './state-pension.js';
import {parseMoneyInput,attachMoneyInputs} from './money-input.js';
import {mountWizard} from './wizard-ui.js';
import {incomeChartSeries,editorMarkup,escapeHTML,discountFactor,retirementSnapshot,updatePlanScreen,withdrawalOutcome,retirementDateLinks,retirementYearControls,shiftRetirementYear,retirementMarker,reconcileRetirementLinks,projectionTimeline,svgChart,mountHelpDialog,withdrawalCardSummary,planSummary,growthRateControls,shiftGroupGrowth,projectionEventMarkers} from './view.js';
import {createExamplePlan,validatePlan,parsePlan,serializePlan,addPlanItem} from './plan.js';
import {project} from './model.js';
const $=id=>document.getElementById(id);
attachMoneyInputs(document);
mountHelpDialog(document);
const esc=escapeHTML;
const colours=['#21624d','#749f81','#c39a4b','#60849b','#9a7183','#8c8764','#54767b','#bd7961'];
const money=v=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(v||0);
let cleanLabel='Example plan · not saved';
let plan=createExamplePlan(),dirty=false,real=true,result,selectedYear;
let retirementLinks=retirementDateLinks(plan);
const linksFor=candidate=>reconcileRetirementLinks(plan,candidate,retirementLinks);
function acceptEdits(candidate){const validated=validate(candidate);retirementLinks=linksFor(validated);plan=validated;}
function renderEditor() {
 const editor = $('editor');
 const sections = new Map(Array.from(editor.children)
  .filter(element => element.tagName === 'DETAILS')
  .map((element, index) => [index, element.open]));
 editor.innerHTML = editorMarkup(plan);
 Array.from(editor.children).filter(element => element.tagName === 'DETAILS')
  .forEach((element, index) => { if (sections.has(index)) element.open = sections.get(index); });
}
function readDetailedEditor(){const candidate=structuredClone(plan);for(const el of $('editor').querySelectorAll('[name]')){const bits=el.name.split('.');let obj=candidate;for(const bit of bits.slice(0,-1))obj=obj[bit];obj[bits.at(-1)]=el.type==='checkbox'?el.checked:el.hasAttribute('data-money')?parseMoneyInput(el.value):el.type==='number'?(el.value.trim()===''?NaN:Number(el.value)):el.value;}candidate.drawdown.inflationLinked=$('withdrawal-inflation').checked;candidate.drawdown.mode=$('withdrawal-mode').value;return candidate;}
function readEditor(){return incomeRanges.readPlan(readDetailedEditor());}
function validate(candidate){const validation=validatePlan(candidate);if(!validation.valid)throw new Error(validation.errors.join('\n'));return candidate;}
function notify(message,error=false){$('message').hidden=!message;$('message').textContent=message;$('message').classList.toggle('error',error);}
function status(){ $('save-status').textContent=dirty?'Unsaved changes':cleanLabel; }
function apply(){try{acceptEdits(readEditor());dirty=true;status();notify('');renderResults();$('edit-status').textContent='Projection updated.';return true;}catch(e){notify(e.message,true);return false;}}
function factor(year){return discountFactor(plan,result?.months||[],year,real);}

function renderResults(){try{result=project(plan,{scenario:'base'});}catch(e){notify('Projection could not be calculated: '+e.message,true);return;}
const years=result.years;if(!years.length)return;$('projection-timeline').textContent=projectionTimeline(plan,result);renderWithdrawalControl();renderRetirementControl();renderGrowthControls();const retirement=retirementSnapshot(plan,years).year;

const summary=planSummary(plan,result,real),prefix=plan.includePartner?'Household pot':'Pot';
$('metrics').innerHTML=`<div><span>${prefix} at retirement</span><strong ${summary.retirement.value===null?'class="metric-unavailable"':''}>${summary.retirement.value===null?'Outside this plan':money(summary.retirement.value)}</strong><small>${esc(summary.retirement.dateLabel)}</small></div><div><span>${prefix} left at plan end</span><strong ${summary.end.value===null?'class="metric-unavailable"':''}>${summary.end.value===null?'Not available':money(summary.end.value)}</strong><small>${esc(summary.end.dateLabel)}</small></div>`;
$('summary-retirement-help').textContent=summary.retirement.note;$('summary-end-help').textContent=summary.end.note;

const marker=retirementMarker(plan.people.find(p=>p.id==='you').retirementMonth,years,result.months,plan.people.find(p=>p.id==='you').dob);$('retirement-marker-note').textContent=marker.note;
const pensionEvents=projectionEventMarkers(plan,result);$('projection-event-notes').innerHTML=pensionEvents.notes.map(note=>`<li>${esc(note)}</li>`).join('');
const activePots=plan.pots.filter(p=>plan.includePartner||p.owner!=='partner');$('wealth-chart').innerHTML=svgChart(years,activePots.map((p,i)=>({colour:colours[i%colours.length],values:years.map(y=>(y.balances?.[p.id]||0)/factor(y.year))})),true,marker,pensionEvents.markers);
$('legend').innerHTML=activePots.map((p,i)=>`<span><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="5" fill="${colours[i%colours.length]}"/></svg> ${esc(p.name)}</span>`).join('');
for(const [kind,colour,label] of [['state','#74479b','State Pension starts (income, not a pot)'],['depletion','#b04a38','First total-pot depletion']])if(pensionEvents.markers.some(marker=>marker.kind===kind))$('legend').innerHTML+=`<span><svg width="22" height="12" aria-hidden="true"><path d="M0 6H22" stroke="${colour}" stroke-width="2" stroke-dasharray="4 3"/></svg>${label}</span>`;
$('income-chart').innerHTML=svgChart(years,incomeChartSeries(plan,result,real));
$('state-pension-income-key').hidden=!years.some(year=>year.statePensionGross>0);
if(!years.some(y=>String(y.year)===String(selectedYear)))selectedYear=retirement.year;$('ledger-year').innerHTML=years.map(y=>`<option value="${y.year}" ${String(y.year)===String(selectedYear)?'selected':''}>${y.year} · turning ${y.year-Number(plan.people.find(p=>p.id==='you').dob.slice(0,4))}</option>`).join('');renderLedger();
$('event-timeline').innerHTML=plan.events.filter(e=>plan.includePartner||plan.pots.find(p=>p.id===e.potId)?.owner!=='partner').sort((a,b)=>a.month.localeCompare(b.month)).map(e=>`<li><time>${esc(e.month)}</time><div><strong>${esc(e.name)}</strong><span>${esc(e.type)} · ${money(e.amount)} gross future pounds · ${esc(plan.pots.find(p=>p.id===e.potId)?.name)}</span></div></li>`).join('')||'<li>No planned events. Add one in section 05.</li>';
const warnings=[...new Set([...(plan.includePartner&&plan.people.some(p=>p.name==='Partner (details not entered)')?['Partner details have not been entered. Replace the placeholder dates and figures in Household & timeline before using a joint projection.']:[]),'Tax is an estimate of pension / non-savings income tax, not a complete tax return. Savings interest tax is not included.',...(result.warnings||[])])];$('warnings').innerHTML='<ul>'+warnings.map(w=>`<li>${esc(typeof w==='string'?w:JSON.stringify(w))}</li>`).join('')+'</ul>';$('assumptions').innerHTML='<ul>'+(result.assumptions||[]).map(a=>`<li>${esc(a)}</li>`).join('')+'</ul>';
}
function renderLedger(){const y=result.years.find(y=>String(y.year)===String(selectedYear));if(!y)return;const f=factor(y.year);const rows=[['Opening wealth',y.opening],['+ Gross contributions',y.contributions],['+ Growth',y.growth],['− Fees',y.fees],['− Total gross withdrawals',y.withdrawals],['Closing wealth',y.closing],...(plan.drawdown.mode==='totalIncome'?[['Gross total income target',y.incomeTarget],['Gross income counted towards target',y.incomeOffset]]:[]),['Gross amount required from pots',y.withdrawalTarget],['Of total withdrawals: scheduled',y.scheduledWithdrawalsGross],['Of total withdrawals: recurring',y.recurringWithdrawalsGross],['Gross income streams',y.incomeGross],['Estimated income tax',y.tax],['Income after modelled tax',y.incomeNet],['Withdrawals after modelled tax',y.withdrawalsNet],['Spending target',y.spending],['Unmet gross withdrawal target',y.unmetWithdrawal],['Unfunded spending gap (monthly deficits)',y.shortfall]];$('ledger').innerHTML=`<p class="help">${real?"Today's money: all entries in this annual ledger share the same year-end discount factor so the balance reconciles.":'Future pounds: nominal cash values.'} Transfers are internal movements. Cash estimates exclude savings-interest tax.</p><table><caption class="sr-only">Annual financial ledger for ${y.year}</caption><tbody>${rows.map(([name,value])=>`<tr ${name==='Closing wealth'?'class="ledger-total"':''}><th scope="row">${name}</th><td>${money((value||0)/f)}</td></tr>`).join('')}</tbody></table><h4>Balances by pot</h4><table><caption class="sr-only">Year-end balances by pot for ${y.year}</caption><tbody>${plan.pots.filter(p=>plan.includePartner||p.owner!=='partner').map(p=>`<tr><th scope="row">${esc(p.name)}</th><td>${money((y.balances[p.id]||0)/f)}</td></tr>`).join('')}</tbody></table>`;}
function renderWithdrawalControl(){
 $('plan-help-error').hidden=true;$('plan-help-error').textContent='';
 incomeRanges.refresh(plan);
 $('withdrawal-inflation').checked=plan.drawdown.inflationLinked;$('withdrawal-mode').value=plan.drawdown.mode;
 const combined=plan.drawdown.mode==='totalIncome';$('withdrawal-title').textContent=combined?'Your annual income':'Annual pot withdrawals';
 const stateCount=plan.incomes.filter(i=>i.type==='state'&&i.monthlyAmount>0&&(plan.includePartner||i.owner!=='partner')).length;$('state-pension-status').textContent=stateCount?`State Pension ${combined?'included in target':'added separately'}${stateCount>1?' · '+stateCount+' forecasts':''}`:'State Pension not added';
 const who=plan.includePartner?'Household':'Your';
 const retirement=plan.people.find(p=>p.id==='you').retirementMonth;
 $('withdrawal-basis').textContent=`${who} ${combined?'total income target, including State and other pensions':'pot-withdrawal target with pension income additional'}, before tax. ${plan.drawdown.inflationLinked?`In ${plan.startMonth} pounds, increasing with inflation`:'Fixed future pounds, not inflation-linked'}, from your retirement in ${retirement}. Buttons change their own range by £1,000; every range shares this money basis and inflation runs from the plan start, not the stage start.`;
 $('withdrawal-summary').textContent=`Before tax · ${combined?'includes pension income':'pots only'} · ${plan.drawdown.inflationLinked?plan.startMonth+' pounds · increases with inflation':'fixed future pounds · no inflation increase'}`;
 const outcome=withdrawalOutcome(plan,result,real);
 $('withdrawal-status').textContent=withdrawalCardSummary(plan,result,real);$('withdrawal-detail-status').textContent=outcome.text;
 $('withdrawal-status').classList.toggle('has-gap',outcome.hasGap);
}
function renderGrowthControls(){
 for(const group of growthRateControls(plan)){
  const prefix='growth-'+group.category, output=$(prefix+'-value');
  output.textContent=group.mixed?'Mixed':group.display;
  output.title=group.display;output.setAttribute('aria-label',group.label+' base growth: '+group.display);
  output.classList.toggle('growth-mixed',group.mixed);
  $(prefix+'-hint').textContent=group.count?(group.mixed?`${group.min}% to ${group.max}% · `:'')+`${group.count} included ${group.count===1?'pot':'pots'}`:'No included pots';
  $(prefix+'-minus').disabled=!group.canDecrease;$(prefix+'-plus').disabled=!group.canIncrease;
 }
}
function changeGrowth(category,direction){
 try{const candidate=validate(readEditor()),shifted=shiftGroupGrowth(candidate,category,direction);
 if(shifted===candidate){notify('That growth change would exceed the allowed range, or there are no included pots in that category.',true);return;}
 acceptEdits(shifted);dirty=true;status();notify('');renderEditor();renderResults();$('edit-status').textContent='Projection updated with your base growth rates.';
 }catch(error){notify(error.message,true);}
}
for(const category of ['savings','isa','pension']){
 $('growth-'+category+'-minus').addEventListener('click',()=>changeGrowth(category,-1));
 $('growth-'+category+'-plus').addEventListener('click',()=>changeGrowth(category,1));
}

function renderRetirementControl(){
 const month=plan.people.find(p=>p.id==='you').retirementMonth,controls=retirementYearControls(plan,retirementLinks);
 const date=new Date(`${month}-01T00:00:00Z`),monthName=date.toLocaleDateString('en-GB',{month:'long',timeZone:'UTC'});
 $('retirement-control-title').textContent=`Retire in ${monthName}`;$('retirement-date').textContent=month.slice(0,4);$('retirement-date').setAttribute('aria-label',`Retirement ${monthName} ${month.slice(0,4)}`);$('retirement-month').textContent=monthName;
 $('retirement-minus').disabled=controls.earlierMonth===month;$('retirement-plus').disabled=controls.laterMonth===month;
 $('retirement-bounds').textContent=`Each click changes one year and keeps the month. Projection range: ${controls.minMonth} to ${controls.maxMonth}. Changes cannot put matching contribution end dates before their start dates.`;
}
function changeRetirement(direction){
 try{const candidate=validate(readEditor()),links=linksFor(candidate),shifted=shiftRetirementYear(candidate,direction,links);
 if(shifted===candidate){notify('That retirement-year change is outside the allowed range or would end contributions before they start. Adjust the detailed dates if needed.',true);return;}
 validate(shifted);plan=shifted;retirementLinks=links;dirty=true;status();notify('');renderEditor();renderResults();$('edit-status').textContent='Projection updated with your retirement date and matching dates.';
 }catch(error){notify(error.message,true);}
}
$('retirement-minus').addEventListener('click',()=>changeRetirement(-1));
$('retirement-plus').addEventListener('click',()=>changeRetirement(1));
for(const id of ['withdrawal-inflation','withdrawal-mode'])$(id).addEventListener('change',()=>{if(!incomeRanges.apply(true)){ $('plan-help-error').hidden=false;$('plan-help-error').textContent='Fix the highlighted income range or pending plan edits before changing the target basis.';$('withdrawal-inflation').checked=plan.drawdown.inflationLinked;$('withdrawal-mode').value=plan.drawdown.mode;}});
$('editor').addEventListener('submit',e=>{e.preventDefault();apply();});$('editor').addEventListener('input',()=>{dirty=true;status();$('edit-status').textContent='Edits not yet applied to the charts.';});
function removeItemFromEditor(reference) {
  if (!window.confirm('Remove this item from the plan? You can cancel to keep it.')) return;
  const [key, index] = reference.split(':');
  try {
    const candidate = readEditor();
    if (key === 'pots' && candidate.events.some(event =>
      event.potId === candidate.pots[index].id || event.toPotId === candidate.pots[index].id)) {
      notify('Remove events referencing this pot before removing the pot.', true);
      return;
    }
    candidate[key].splice(Number(index), 1);
    acceptEdits(candidate);
    dirty = true;
    status();
    renderEditor();
    renderResults();
    $('editor').querySelector(`[data-add="${key}"]`)?.focus();
    notify('');
  } catch (error) { notify(error.message, true); }
}

function addItemFromEditor(collection) {
  try {
    acceptEdits(addPlanItem(readEditor(), collection));
    dirty = true;
    status();
    notify('');
    renderEditor();
    renderResults();
    $('editor').querySelector(`[name="${collection}.${plan[collection].length - 1}.name"]`)?.focus();
  } catch (error) { notify(error.message, true); }
}

$('editor').addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.id === 'edit-state-pension-menu') {
    button.focus();
    $('edit-state-pension').click();
  } else if (button.dataset.remove) {
    removeItemFromEditor(button.dataset.remove);
  } else if (button.dataset.add) {
    addItemFromEditor(button.dataset.add);
  }
});
for(const [id,value] of [['real',true],['nominal',false]])$(id).addEventListener('click',()=>{real=value;$('real').setAttribute('aria-pressed',String(real));$('nominal').setAttribute('aria-pressed',String(!real));renderResults();});$('ledger-year').addEventListener('change',e=>{selectedYear=e.target.value;renderLedger();});
$('save').addEventListener('click',()=>{if(!apply())return;const blob=new Blob([serializePlan(plan)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='retirement-plan.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);dirty=false;cleanLabel='Plan file download requested';status();notify('Plan file download requested. Check your downloads. This file is unencrypted; keep it safe.');});
for(const id of ['load','load-home'])$(id).addEventListener('click',()=>{$('file').value='';$('file').click();});$('file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>1024*1024)throw Error('Plan file is too large (maximum 1 MB).');const loaded=parsePlan(await file.text());if(!$('planner-view').hidden&&!window.confirm('Replace the current plan with this file? Any unsaved changes will be lost.'))return;plan=loaded;incomeRanges.reset(plan);retirementLinks={potIds:[],spending:false};dirty=false;cleanLabel='Loaded plan · no unsaved edits';status();updatePlanScreen(document,'planAccepted');renderEditor();renderResults();$('results').focus();notify('Plan loaded. Its data stays in this tab.');}catch(err){notify('Could not load plan. Your existing plan is unchanged. '+err.message,true);}});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});updatePlanScreen(document,'initialise');

mountWizard({hasExistingPlan:()=>!$('planner-view').hidden,onComplete:freshPlan=>{plan=freshPlan;incomeRanges.reset(plan);retirementLinks=retirementDateLinks(plan);dirty=true;selectedYear=undefined;real=true;$('real').setAttribute('aria-pressed','true');$('nominal').setAttribute('aria-pressed','false');status();updatePlanScreen(document,'planAccepted');renderEditor();renderResults();notify('Your new plan is ready. Review your State Pension illustration against your own forecast, check the detailed settings and save a plan file to keep it.');}});

mountStatePension({getPlan:()=>validate(readEditor()),onComplete:candidate=>{acceptEdits(candidate);dirty=true;status();notify('State Pension settings updated. Check the annual target mode before interpreting the projection.');renderEditor();renderResults();},onError:error=>notify(error.message||String(error),true)});

const incomeRanges=mountIncomeStages({getPlan:readDetailedEditor,onComplete:candidate=>{acceptEdits(candidate);dirty=true;status();notify('');renderResults();$('edit-status').textContent='Projection updated with your income ranges.';},onDraftChange:()=>{dirty=true;status();},onError:error=>notify(error.message||String(error),true)});
