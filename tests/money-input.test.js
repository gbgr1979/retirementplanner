import test from 'node:test';
import assert from 'node:assert/strict';
import {formatMoneyValue, parseMoneyInput, attachMoneyInputs} from '../src/money-input.js';

test('money formatting adds grouping without rounding decimal strings', () => {
  for (const [value, expected] of [[2000,'2,000'],['1234567.890123456789','1,234,567.890123456789'],['2000.','2,000.'],['2000.00','2,000.00'],['.25','.25'],['-1200.50','-1,200.50'],['+1200','+1,200'],['0000','0,000'],['',''],['-','-'],['.','.'],[1e21,'1,000,000,000,000,000,000,000'],[1e-7,'0.0000001']]) {
    assert.equal(formatMoneyValue(value), expected);
  }
});
test('numeric displays retain round-trip precision, including exponent notation', () => {
  for (const value of [0, 0.001, 1e-7, 1e21, Number.MIN_VALUE, Number.MAX_VALUE, 1234.567891234, -1e-7]) {
    assert.equal(parseMoneyInput(formatMoneyValue(value)), value);
  }
});
test('money parsing validates grouping, disallows exponent/coercion and stays numeric', () => {
  for (const value of ['1,234.50','1234.50','+1234.50']) assert.equal(parseMoneyInput(value),1234.5);
  assert.equal(parseMoneyInput('2000.'),2000);
  assert.equal(parseMoneyInput('.25'),.25);
  assert.equal(parseMoneyInput(' 2,000 '),2000);
  for (const value of ['', ' ', '-', '.', '1,23', '12,34,567', ',123', '123,', '1,,234', '1.2.3', '1e3', '0x20', 'Infinity', '£2,000', '2 000', null, undefined, true, [], {}, '9'.repeat(400)]) {
    assert.ok(Number.isNaN(parseMoneyInput(value)), String(value));
  }
  for (const value of ['1,23', '12,34,567','1e3']) assert.equal(formatMoneyValue(value),value);
});

function harness(value = '') {
  const handlers = new Map();
  const attrs = new Map();
  const target = {value, selectionStart:value.length, selectionEnd:value.length, selectionDirection:'none',
    matches:selector=>selector==='input[data-money]',
    setAttribute:(key,value)=>attrs.set(key,value),
    setSelectionRange(start,end,direction='none'){this.selectionStart=start;this.selectionEnd=end;this.selectionDirection=direction;}};
  const root = {addEventListener(type,handler,capture){assert.equal(capture,true);handlers.set(type,handler);},
    removeEventListener(type,handler,capture){assert.equal(capture,true);assert.equal(handlers.get(type),handler);handlers.delete(type);},querySelectorAll:()=>[target]};
  const dispose = attachMoneyInputs(root);
  function fire(type, details={}) {handlers.get(type)?.({target,...details});}
  function select(start,end=start,direction='none') {target.setSelectionRange(start,end,direction);}
  function edit(inputType,data=null) {
    fire('beforeinput',{inputType,data});
    let a=target.selectionStart,b=target.selectionEnd;
    if(a===b && inputType==='deleteContentBackward')a=Math.max(0,a-1);
    if(a===b && inputType==='deleteContentForward')b=Math.min(target.value.length,b+1);
    const insert=inputType.startsWith('insert')?data:'';
    target.value=target.value.slice(0,a)+insert+target.value.slice(b);
    select(a+(insert?.length||0));
    fire('input',{inputType,data});
  }
  return {target,attrs,handlers,dispose,fire,select,edit};
}

test('live typing groups thousands and keeps the caret at the semantic position', () => {
  const h=harness();
  for(const digit of '2000')h.edit('insertText',digit);
  assert.equal(h.target.value,'2,000');assert.equal(h.target.selectionStart,5);
  h.select(2);h.edit('insertText','5');
  assert.equal(h.target.value,'25,000');assert.equal(h.target.selectionStart,2);
  h.edit('insertText','6');assert.equal(h.target.value,'256,000');assert.equal(h.target.selectionStart,3);
});
test('typing beside old grouping reflows only generated commas', () => {
  const h=harness('1,234');h.select(1);h.edit('insertText','0');
  assert.equal(h.target.value,'10,234');assert.equal(h.target.selectionStart,2);
  h.select(0,2);h.edit('insertText','999');assert.equal(h.target.value,'999,234');
});
test('backspace and forward-delete adjacent to a comma remove an adjacent digit', () => {
  const back=harness('1,234');back.select(2);back.edit('deleteContentBackward');
  assert.equal(back.target.value,'234');assert.equal(back.target.selectionStart,0);
  const forward=harness('1,234');forward.select(1);forward.edit('deleteContentForward');
  assert.equal(forward.target.value,'134');assert.equal(forward.target.selectionStart,1);
  const normal=harness('12,345');normal.select(2);normal.edit('deleteContentBackward');
  assert.equal(normal.target.value,'1,345');assert.equal(normal.target.selectionStart,1);
});
test('selection replacement, empty and decimal intermediate states survive', () => {
  const h=harness('1,234.50');h.select(0,h.target.value.length);h.edit('deleteContentBackward');assert.equal(h.target.value,'');
  for(const digit of '2000.00')h.edit('insertText',digit);
  assert.equal(h.target.value,'2,000.00');
  h.edit('deleteContentBackward');h.edit('deleteContentBackward');assert.equal(h.target.value,'2,000.');
  h.edit('insertText','.');assert.equal(h.target.value,'2000..');assert.ok(Number.isNaN(parseMoneyInput(h.target.value)));
});
test('valid pasted grouping is formatted while malformed paste stays invalid', () => {
  for(const [pasted,expected] of [['1234567.890','1,234,567.890'],['1,234.50','1,234.50'],['12,34','12,34'],['1e3','1e3'],['1,,234','1,,234']]) {
    const h=harness();h.fire('paste',{clipboardData:{getData:()=>pasted}});h.edit('insertFromPaste',pasted);
    assert.equal(h.target.value,expected);
  }
  const h=harness('1,234');h.select(2);h.fire('paste',{clipboardData:{getData:()=> '5000'}});h.edit('insertFromPaste','5000');
  assert.equal(h.target.value,'15,000,234');
});
test('fallback input validates separators and preserves both selection endpoints', () => {
  const h=harness();h.target.value='1234567.50';h.select(1,7,'backward');h.fire('input',{inputType:'historyUndo'});
  assert.equal(h.target.value,'1,234,567.50');assert.equal(h.target.selectionStart,1);assert.equal(h.target.selectionEnd,9);assert.equal(h.target.selectionDirection,'backward');
  h.target.value='12,34';h.fire('input',{inputType:'insertFromPaste'});assert.equal(h.target.value,'12,34');
});
test('composition is untouched until completion, mobile keyboard is decimal, cleanup removes listeners', () => {
  const h=harness();assert.equal(h.attrs.get('inputmode'),'decimal');
  h.fire('compositionstart');h.target.value='2000';h.select(4);h.fire('input',{isComposing:true});assert.equal(h.target.value,'2000');
  let finalInputs=0;h.target.dispatchEvent=event=>{assert.equal(event.type,'input');assert.equal(event.bubbles,true);finalInputs++;h.fire('input');};
  h.fire('compositionend');assert.equal(finalInputs,1);assert.equal(h.target.value,'2,000');assert.equal(h.target.selectionStart,5);
  h.dispose();assert.equal(h.handlers.size,0);
});

test('paste without beforeinput and dynamically inserted inputs use delegated listeners', () => {
  const h=harness();
  h.fire('paste',{clipboardData:{getData:()=> '25000'}});
  h.target.value='25000';h.select(5);h.fire('input',{inputType:'insertFromPaste'});
  assert.equal(h.target.value,'25,000');
  const dynamic={...h.target,value:'45000',selectionStart:5,selectionEnd:5};
  h.handlers.get('input')({target:dynamic,inputType:'insertText'});
  assert.equal(dynamic.value,'45,000');assert.equal(dynamic.selectionStart,6);
});
test('unexpected browser edits do not apply stale pending transformations', () => {
  const h=harness('1,234');h.select(2);h.fire('beforeinput',{inputType:'insertText',data:'5'});
  h.target.value='12,34';h.fire('input',{inputType:'insertText',data:'5'});
  assert.equal(h.target.value,'12,34');assert.ok(Number.isNaN(parseMoneyInput(h.target.value)));
});
