import test from 'node:test';
import assert from 'node:assert/strict';
import {createExamplePlan, validatePlan} from '../src/plan.js';
import {createIncomeStageDraft, buildIncomeStagePlan, addIncomeStageDraft, mountIncomeStages} from '../src/income-stage-ui.js';

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

// Minimal DOM fixture for lifecycle and delegated-event tests. Native close is queued.
function fixture(getPlan = fresh, onComplete = () => {}) {
  class Element {
    constructor(id) {this.id=id; this.handlers={}; this.value=''; this.dataset={}; this.isConnected=true;}
    addEventListener(type,fn) {(this.handlers[type]??=new Set()).add(fn);}
    removeEventListener(type,fn) {this.handlers[type]?.delete(fn);}
    async emit(type,event={}) {for (const fn of this.handlers[type]||[]) await fn({target:this,preventDefault(){},...event});}
    setAttribute(key,value) {this[key]=value;}
    removeAttribute(key) {delete this[key];}
    focus() {root.activeElement=this;}
    closest(selector) {return selector===`#${this.id}` || (selector==='[data-remove-stage]' && this.dataset.removeStage!==undefined) ? this : null;}
  }
  const root={activeElement:null,querySelector(selector){return nodes.get(selector.slice(1))||null;}};
  const nodes=new Map(['edit-income-stages','income-stages-dialog','income-stages-content'].map(id=>[id,new Element(id)]));
  const trigger=nodes.get('edit-income-stages'), dialog=nodes.get('income-stages-dialog'), content=nodes.get('income-stages-content');
  content.querySelector=selector=>nodes.get(selector.slice(1))||null;
  Object.defineProperty(content,'innerHTML',{set(html){this.html=html; for (const match of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)) {const el=new Element(match[1]); el.value=match[0].match(/\bvalue="([^"]*)"/)?.[1]??''; nodes.set(el.id,el);}}});
  dialog.showModal=()=>{dialog.open=true;}; dialog.close=()=>{dialog.open=false;};
  let error=null; const dispose=mountIncomeStages({root,getPlan,onComplete,onError:e=>{error=e;}});
  trigger.focus();
  return {root,nodes,trigger,dialog,content,dispose,get error(){return error;},input:(id,value)=>{nodes.get(id).value=value;},submit:()=>content.emit('submit',{target:nodes.get('is-form')}),click:id=>content.emit('click',{target:nodes.get(id)})};
}
test('Cancel and Escape discard changes and return focus, with rapid reopening safe', async () => {
  const plan=fresh(), before=structuredClone(plan); let applied=0; const f=fixture(()=>plan,()=>applied++);
  await f.trigger.emit('click'); f.input('is-baseline','99'); await f.click('is-add'); assert.match(f.content.html,/is-age-0/);
  await f.click('is-cancel'); await f.dialog.emit('close'); assert.equal(f.root.activeElement,f.trigger); assert.deepEqual(plan,before); assert.equal(applied,0);
  await f.trigger.emit('click'); assert.equal(f.nodes.get('is-baseline').value,createIncomeStageDraft(plan).annualAmount);
  await f.dialog.emit('cancel'); await f.trigger.emit('click'); await f.dialog.emit('close');
  assert.equal(f.dialog.open,true); await f.submit(); assert.equal(applied,1); f.dispose();
});
test('invalid age focuses inline field; valid apply sends full pending snapshot', async () => {
  const plan=fresh(); plan.pots[0].balance=12345; let applied; const f=fixture(()=>plan,value=>{applied=value;});
  await f.trigger.emit('click'); await f.click('is-add'); f.input('is-age-0',''); await f.submit();
  assert.equal(applied,undefined); assert.equal(f.root.activeElement.id,'is-age-0'); assert.equal(f.nodes.get('is-age-0')['aria-invalid'],'true');
  f.input('is-age-0','70'); f.input('is-amount-0','25,000'); await f.submit(); assert.equal(applied.pots[0].balance,12345); assert.equal(applied.drawdown.stages[0].annualAmount,25000); assert.equal(f.dialog.open,false);
});
test('invalid pending plan blocks opening; failed apply retains editable draft', async () => {
  const bad=fresh(); bad.endAge=200; const f=fixture(()=>bad); await f.trigger.emit('click'); assert.ok(f.error); assert.notEqual(f.dialog.open,true);
  const g=fixture(fresh,()=>{throw new Error('Save failed');}); await g.trigger.emit('click'); g.input('is-baseline','35000'); await g.submit(); assert.equal(g.dialog.open,true); assert.equal(g.nodes.get('is-errors').textContent,'Save failed'); assert.equal(g.nodes.get('is-apply').disabled,false);
});
test('old asynchronous apply cannot close a newly reopened dialog', async () => {
  let resolve; const f=fixture(fresh,()=>new Promise(done=>{resolve=done;})); await f.trigger.emit('click'); const pending=f.submit();
  await f.click('is-cancel'); await f.trigger.emit('click'); resolve(); await pending; assert.equal(f.dialog.open,true);
});
test('explicit Remove affects only draft until Apply and adds do not reset typed baseline', async () => {
  const plan=fresh(); plan.drawdown.stages=[{fromAge:70,annualAmount:25000}]; let result; const f=fixture(()=>plan,value=>{result=value;});
  await f.trigger.emit('click'); f.input('is-baseline','35,000');
  const remove={dataset:{removeStage:'0'},closest:selector=>selector==='[data-remove-stage]'?remove:null};
  await f.content.emit('click',{target:remove}); assert.equal(plan.drawdown.stages.length,1);
  assert.equal(f.nodes.get('is-baseline').value,'35,000'); await f.submit(); assert.deepEqual(result.drawdown.stages,[]); assert.equal(result.drawdown.annualAmount,35000);
});
test('dialog explains inflation, fixed nominal mode, primary age and exact effective month', async () => {
  const plan=fresh(); plan.people.find(p=>p.id==='you').dob='1970-06-15'; plan.drawdown.stages=[{fromAge:70,annualAmount:25000}];
  const f=fixture(()=>plan); await f.trigger.emit('click'); assert.match(f.content.html,/projection-start/); assert.match(f.content.html,/Pot withdrawals before tax/); assert.match(f.nodes.get('is-range-0').textContent,/2040-07/);
  await f.click('is-cancel'); plan.drawdown.inflationLinked=false; plan.drawdown.mode='totalIncome'; await f.trigger.emit('click'); assert.match(f.content.html,/fixed nominal/); assert.match(f.content.html,/Combined income target before tax/); assert.match(f.content.html,/primary person/);
});
test('visible top Close button discards draft and restores opener focus', async () => {
  let applied=0; const f=fixture(fresh,()=>applied++); await f.trigger.emit('click'); f.input('is-baseline','99'); await f.click('is-close'); await f.dialog.emit('close'); assert.equal(f.dialog.open,false); assert.equal(applied,0); assert.equal(f.root.activeElement,f.trigger);
});
