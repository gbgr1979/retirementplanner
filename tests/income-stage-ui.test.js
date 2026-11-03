import test from 'node:test';
import assert from 'node:assert/strict';
import {createExamplePlan, validatePlan, parsePlan, serializePlan} from '../src/plan.js';
import {createIncomeStageDraft, buildIncomeStagePlan, addIncomeStageDraft, mountIncomeStages, stepIncomeAmount} from '../src/income-stage-ui.js';

const fresh = () => createExamplePlan();
test('draft round trip preserves all values, modes, State Pension and precision', () => {
  const plan = fresh(); plan.drawdown.annualAmount = 35000.123456789; plan.drawdown.stages = [{fromAge:70, annualAmount:25000.123456789}];
  for (const mode of ['pots','totalIncome']) for (const inflationLinked of [true,false]) {
    plan.drawdown.mode = mode; plan.drawdown.inflationLinked = inflationLinked;
    assert.deepEqual(buildIncomeStagePlan(plan, createIncomeStageDraft(plan)), plan);
  }
});
test('baseline and subsequent targets edit transactionally without mutating snapshot or draft', () => {
  const plan = fresh(), before = structuredClone(plan), draft = createIncomeStageDraft(plan);
  draft.annualAmount = '35,000'; draft.stages.push({fromAge:'70', annualAmount:'25,000'});
  const beforeDraft = structuredClone(draft), candidate = buildIncomeStagePlan(plan, draft);
  assert.deepEqual(plan, before); assert.deepEqual(draft, beforeDraft);
  assert.equal(candidate.drawdown.annualAmount,35000); assert.deepEqual(candidate.drawdown.stages,[{fromAge:70,annualAmount:25000}]);
  assert.equal(validatePlan(candidate).valid,true);
  candidate.people[0].name = 'Changed'; assert.notEqual(plan.people[0].name,'Changed');
});
test('strict ages reject blank, decimals, exponent notation, duplicate and reversed order with field', () => {
  for (const age of ['', '70.5','7e1','17','111','Infinity']) {
    const plan=fresh(), draft=createIncomeStageDraft(plan); draft.stages=[{fromAge:age, annualAmount:'1'}];
    assert.throws(()=>buildIncomeStagePlan(plan,draft), error => error.field==='is-age-0');
  }
  for (const age of ['70','69']) {
    const plan=fresh(), draft=createIncomeStageDraft(plan); draft.stages=[{fromAge:'70',annualAmount:'1'},{fromAge:age,annualAmount:'2'}];
    assert.throws(()=>buildIncomeStagePlan(plan,draft), error => error.field==='is-age-1');
  }
});
test('strict currency rejects malformed, empty and out-of-range values in every amount', () => {
  for (const amount of ['', '25,00','NaN','Infinity','-1','12,000,000.01']) {
    const plan=fresh(), draft=createIncomeStageDraft(plan); draft.annualAmount=amount;
    assert.throws(()=>buildIncomeStagePlan(plan,draft), error=>error.field==='is-baseline');
    draft.annualAmount='0'; draft.stages=[{fromAge:'70',annualAmount:amount}];
    assert.throws(()=>buildIncomeStagePlan(plan,draft), error=>error.field==='is-amount-0');
  }
  const plan=fresh(), draft=createIncomeStageDraft(plan); draft.annualAmount='0'; draft.stages=[{fromAge:'18',annualAmount:'12,000,000'},{fromAge:'110',annualAmount:'0'}];
  assert.equal(validatePlan(buildIncomeStagePlan(plan,draft)).valid,true);
});
test('maximum 10 changes and full candidate validation apply', () => {
  const plan=fresh(), draft=createIncomeStageDraft(plan); draft.stages=Array.from({length:10},(_,i)=>({fromAge:String(60+i),annualAmount:'1'}));
  assert.equal(validatePlan(buildIncomeStagePlan(plan,draft)).valid,true);
  assert.throws(()=>addIncomeStageDraft(plan,draft),/10/);
  draft.stages.push({fromAge:'80',annualAmount:'1'}); assert.throws(()=>buildIncomeStagePlan(plan,draft),/10/);
  draft.stages=[]; plan.inflation=100; assert.throws(()=>buildIncomeStagePlan(plan,draft),/inflation/);
});
test('add copies previous amount, defaults to 70 then plus 5, and never mutates draft', () => {
  const plan=fresh(); plan.people.find(p=>p.id==='you').retirementMonth='2040-01';
  const draft=createIncomeStageDraft(plan); draft.annualAmount='35,123.45'; const next=addIncomeStageDraft(plan,draft);
  assert.deepEqual(draft.stages,[]); assert.deepEqual(next.stages,[{fromAge:'70',annualAmount:'35,123.45'}]);
  next.stages[0].annualAmount='25,000'; assert.deepEqual(addIncomeStageDraft(plan,next).stages[1],{fromAge:'75',annualAmount:'25,000'});
  next.stages[0].fromAge='108'; assert.equal(addIncomeStageDraft(plan,next).stages[1].fromAge,'110');
  next.stages[0].fromAge='110'; assert.throws(()=>addIncomeStageDraft(plan,next),/already 110/);
});
test('first new age is after later retirement and removal can restore single baseline', () => {
  const plan=fresh(), person=plan.people.find(p=>p.id==='you'); person.dob='1970-06-15'; person.retirementMonth='2045-08';
  const draft=addIncomeStageDraft(plan,createIncomeStageDraft(plan)); assert.equal(draft.stages[0].fromAge,'76');
  draft.stages=[]; assert.deepEqual(buildIncomeStagePlan(plan,draft).drawdown.stages,[]);
});

// Small delegated-event DOM fixture: identity lets us verify typing does not rebuild inputs.
function fixture(plan = fresh()) {
  let live = structuredClone(plan), completed = 0;
  class Element {
    constructor(id) { this.id=id; this.handlers={}; this.value=''; this.dataset={}; }
    addEventListener(type,fn) { (this.handlers[type]??=new Set()).add(fn); }
    removeEventListener(type,fn) { this.handlers[type]?.delete(fn); }
    emit(type,event={}) { for(const fn of this.handlers[type]||[]) fn({target:this,...event}); }
    setAttribute(key,value) { this[key]=value; }
    removeAttribute(key) { delete this[key]; }
    focus() { root.activeElement=this; }
    closest(selector) { return selector===`#${this.id}` || selector==='[data-step]'&&this.dataset.step!==undefined || selector==='[data-remove-stage]'&&this.dataset.removeStage!==undefined ? this : null; }
  }
  const nodes=new Map(), content=new Element('income-ranges'); nodes.set(content.id,content);
  const root={activeElement:null,querySelector:selector=>nodes.get(selector.slice(1))||null};
  content.querySelector=root.querySelector;
  Object.defineProperty(content,'innerHTML',{set(html){this.html=html;for(const match of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)){const el=new Element(match[1]);el.value=match[0].match(/\bvalue="([^"]*)"/)?.[1]??'';for(const [,key,value] of match[0].matchAll(/data-(step|stage)="([^"]+)"/g))el.dataset[key]=value;nodes.set(el.id,el);}}});
  const controller=mountIncomeStages({root,getPlan:()=>live,onComplete:next=>{live=next;completed++;controller.refresh(live);}});
  return {root,nodes,content,controller,get live(){return live;},get completed(){return completed;},input(id,value){nodes.get(id).value=value;content.emit('input',{target:nodes.get(id)});},click(id){content.emit('click',{target:nodes.get(id)});},remove(i){const target={dataset:{removeStage:String(i)},closest:s=>s==='[data-remove-stage]'?target:null};content.emit('click',{target});}};
}
test('flat plan is immediately visible; adding copies current amount and applies live',()=>{
  const f=fixture();assert.match(f.content.html,/Income by age range/);assert.equal(f.nodes.get('is-baseline-range').textContent,'From retirement onwards');
  f.input('is-baseline','35,000');f.click('is-add');assert.equal(f.live.drawdown.stages[0].annualAmount,35000);assert.equal(f.nodes.get('is-age-0').value,'70');assert.equal(f.root.activeElement.id,'is-age-0');
  f.input('is-amount-0','25,000');assert.equal(f.live.drawdown.stages[0].annualAmount,25000);assert.equal(f.live.drawdown.annualAmount,35000);
});
test('typing preserves field node, raw partial value and focus during refresh',()=>{
  const f=fixture(),input=f.nodes.get('is-baseline');input.focus();f.input(input.id,'35,000.');f.controller.refresh(f.live);
  assert.equal(f.nodes.get(input.id),input);assert.equal(input.value,'35,000.');assert.equal(f.root.activeElement,input);
  const before=structuredClone(f.live);f.input(input.id,'');f.controller.refresh(f.live);assert.equal(input.value,'');assert.deepEqual(f.live,before);assert.throws(()=>f.controller.readPlan(),/annual amount/);assert.equal(f.root.activeElement,input);
});
test('invalid ranges block entire candidate and external controls; correction commits all edits',()=>{
  const f=fixture();f.click('is-add');f.input('is-age-0','');const before=structuredClone(f.live);
  f.input('is-baseline','40,000');assert.deepEqual(f.live,before);assert.throws(()=>f.controller.readPlan(),/whole age/);assert.equal(f.root.activeElement.id,'is-age-0');
  f.click('is-plus--1');assert.equal(f.nodes.get('is-baseline').value,'40,000');assert.deepEqual(f.live,before);
  f.input('is-age-0','72');assert.equal(f.live.drawdown.annualAmount,40000);assert.equal(f.live.drawdown.stages[0].fromAge,72);
});
test('add and remove retain other invalid input without applying partial plan',()=>{
  const f=fixture();f.input('is-baseline','');const before=structuredClone(f.live);f.click('is-add');assert.equal(f.nodes.get('is-baseline').value,'');assert.equal(f.nodes.get('is-amount-0').value,'');assert.deepEqual(f.live,before);
  f.remove(0);assert.equal(f.nodes.get('is-baseline').value,'');assert.deepEqual(f.live,before);f.input('is-baseline','22,000');assert.equal(f.live.drawdown.annualAmount,22000);
});
test('every row has independent £1000 buttons and lower bound',()=>{
  const f=fixture();f.input('is-baseline','35,000');f.click('is-add');f.input('is-amount-0','25,000');f.click('is-plus-0');assert.equal(f.live.drawdown.stages[0].annualAmount,26000);assert.equal(f.live.drawdown.annualAmount,35000);
  f.click('is-minus--1');assert.equal(f.live.drawdown.annualAmount,34000);f.input('is-amount-0','500');f.click('is-minus-0');assert.equal(f.live.drawdown.stages[0].annualAmount,0);assert.equal(f.nodes.get('is-minus-0').disabled,true);
});
test('refresh retains saved pre-retirement stages and explains their effective dates',()=>{
  const p=fresh();p.people[0].dob='1970-06-15';p.people[0].retirementMonth='2045-08';p.drawdown.stages=[{fromAge:70,annualAmount:25000}];const f=fixture(p);
  assert.match(f.nodes.get('is-range-0').textContent,/2040-07/);assert.match(f.nodes.get('is-range-0').textContent,/Already in force/);f.controller.refresh(p);assert.deepEqual(f.live.drawdown.stages,p.drawdown.stages);
  const next=fresh();f.controller.reset(next);assert.equal(f.nodes.get('is-baseline-range').textContent,'From retirement onwards');assert.deepEqual(f.controller.readPlan(next).drawdown,next.drawdown);
});
test('pending detailed edits are included but never partially applied when invalid',()=>{
  const f=fixture();f.click('is-add');f.input('is-age-0','70.5');const base=structuredClone(f.live);base.pots[0].balance=12345;assert.throws(()=>f.controller.readPlan(base));assert.notEqual(f.live.pots[0].balance,12345);
  f.input('is-age-0','71');assert.equal(f.controller.readPlan(base).pots[0].balance,12345);
});

test('adding after age 110 reports an inline error without destroying the draft',()=>{
  const p=fresh();p.drawdown.stages=[{fromAge:110,annualAmount:12345}];const f=fixture(p);f.click('is-add');assert.match(f.nodes.get('is-errors').textContent,/already 110/);assert.equal(f.root.activeElement.id,'is-add');assert.deepEqual(f.live,p);
});

test('decimal step helper preserves arbitrary entered precision without fixed rounding',()=>{
  for (const text of ['0.1','500.1','123.123456789','0.123456789123456789','000.1000','.1','+500.10','500.']) {
    const plus=stepIncomeAmount(text,1), restored=stepIncomeAmount(plus,-1);
    assert.equal(restored.replaceAll(',',''),text.replace(/^\+/,'').replace(/^000(?=\.)/,'0').replace(/^\./,'0.'));
  }
  assert.equal(stepIncomeAmount('500.1',-1),'0.0');
  assert.equal(stepIncomeAmount('11,999,999.123456789',1),'12,000,000.000000000');
  assert.equal(stepIncomeAmount('12,000,000',1),'12,000,000');
  assert.throws(()=>stepIncomeAmount('500,1',1));
});
test('baseline and stage buttons round trip fractions exactly through repeated click activations and saved JSON',()=>{
  for (const text of ['0.1','500.1','123.123456789']) for (const stage of [-1,0]) {
    const f=fixture();if(stage===0)f.click('is-add');const id=stage<0?'is-baseline':`is-amount-${stage}`;
    f.input(id,text);
    // Native keyboard activation dispatches the same click event as pointer use.
    for(let n=0;n<20;n++) f.click(`is-plus-${stage}`);
    for(let n=0;n<20;n++) f.click(`is-minus-${stage}`);
    assert.equal(f.nodes.get(id).value,text);
    const restored=parsePlan(serializePlan(f.live));
    assert.equal(stage<0?restored.drawdown.annualAmount:restored.drawdown.stages[stage].annualAmount,Number(text));
    assert.equal(stage<0?f.live.drawdown.annualAmount:f.live.drawdown.stages[stage].annualAmount,Number(text));
  }
});

test('remove button accessible name follows the edited age, including invalid drafts',()=>{
  const f=fixture();f.click('is-add');f.input('is-age-0','80');assert.equal(f.nodes.get('is-remove-0')['aria-label'],'Remove range starting at age 80');
  f.input('is-age-0','');assert.equal(f.nodes.get('is-remove-0')['aria-label'],'Remove range starting at age not yet valid');
});
