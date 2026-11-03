// Currency display is text-only: plan values are parsed separately as numbers.
// Keep decimal strings intact rather than rounding them through Intl/Number.
const MONEY = /^[+-]?(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d*)?|\.\d+)$/;
const TRANSIENT = /^[+-]?(?:\.)?$/;
const clean = value => String(value).trim();
const ungroup = value => value.replaceAll(',', '');

export function parseMoneyInput(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return NaN;
  const text = clean(value);
  if (!MONEY.test(text)) return NaN;
  const number = Number(ungroup(text));
  return Number.isFinite(number) ? number : NaN;
}

function expandNumber(number) {
  const text = String(number);
  if (!/[eE]/.test(text)) return text;
  const [mantissa, exponent] = text.toLowerCase().split('e');
  const sign = mantissa.startsWith('-') ? '-' : '';
  const [whole, fraction = ''] = mantissa.replace(/^-/, '').split('.');
  const digits = whole + fraction;
  const point = whole.length + Number(exponent);
  return sign + (point <= 0 ? '0.' + '0'.repeat(-point) + digits
    : point >= digits.length ? digits + '0'.repeat(point - digits.length)
      : digits.slice(0, point) + '.' + digits.slice(point));
}

export function formatMoneyValue(value) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'number' && Number.isFinite(value) ? expandNumber(value) : String(value);
  if (!MONEY.test(text)) return text;
  const [whole, fraction] = ungroup(text).split('.');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction === undefined ? '' : '.' + fraction);
}

const rawPosition = (text, position) => ungroup(text.slice(0, position)).length;
function displayPosition(text, rawIndex) {
  if (rawIndex <= 0) return 0;
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== ',') count++;
    if (count === rawIndex) return i + 1;
  }
  return text.length;
}

/** Delegated listeners also cover inputs added after setup. Returns a disposer. */
export function attachMoneyInputs(root) {
  const pending = new WeakMap();
  const pasted = new WeakMap();
  const composing = new WeakSet();
  const inputFor = event => {
    const input = event.target;
    if (!input?.matches?.('input[data-money]')) return null;
    input.setAttribute('inputmode', 'decimal');
    return input;
  };
  const write = (input, raw, start, end = start, direction = 'none') => {
    const formatted = formatMoneyValue(raw);
    input.value = formatted;
    // Invalid text is intentionally unchanged, including malformed pasted commas.
    const mapped = MONEY.test(raw);
    input.setSelectionRange?.(mapped ? displayPosition(formatted, start) : start,
      mapped ? displayPosition(formatted, end) : end, direction || 'none');
  };
  function prepare(input, type, data) {
    pending.delete(input);
    const text = input.value;
    if (!MONEY.test(text) && !TRANSIENT.test(text)) return;
    const start = input.selectionStart ?? text.length;
    const end = input.selectionEnd ?? start;
    const raw = ungroup(text);
    let a = rawPosition(text, start), b = rawPosition(text, end);
    let nativeStart = start, nativeEnd = end;
    let insert = '';
    if (type === 'insertText' || type === 'insertFromPaste' || type === 'insertReplacementText') {
      if (typeof data !== 'string') return;
      // Only commas from the previous valid display may be discarded freely.
      // Pasted grouping must itself be valid, even when the whole result is valid.
      if (type !== 'insertText' && data.includes(',') && !MONEY.test(data)) return;
      insert = type === 'insertText' ? data : MONEY.test(data) ? ungroup(data) : data;
    } else if (type === 'deleteContentBackward' || type === 'deleteContentForward') {
      if (start === end) {
        if (type === 'deleteContentBackward') nativeStart = Math.max(0, start - 1);
        else nativeEnd = Math.min(text.length, end + 1);
      }
      if (a === b) {
        if (type === 'deleteContentBackward') a = Math.max(0, a - 1);
        else b = Math.min(raw.length, b + 1);
      }
    } else return;
    const next = raw.slice(0, a) + insert + raw.slice(b);
    const native = text.slice(0, nativeStart) + (type.startsWith('insert') ? data : '') + text.slice(nativeEnd);
    pending.set(input, {type, next, caret: a + insert.length, native});
  }
  const paste = event => {
    const input = inputFor(event);
    if (!input || composing.has(input)) return;
    const data = event.clipboardData?.getData('text/plain');
    pasted.set(input, data);
    prepare(input, 'insertFromPaste', data);
  };
  const beforeinput = event => {
    const input = inputFor(event);
    if (!input) return;
    if (event.isComposing || composing.has(input)) {pending.delete(input); return;}
    const data = event.inputType === 'insertFromPaste'
      ? event.dataTransfer?.getData('text/plain') ?? event.data ?? pasted.get(input)
      : event.data;
    prepare(input, event.inputType, data);
  };
  const input = event => {
    const input = inputFor(event);
    if (!input) return;
    const edit = pending.get(input);
    pending.delete(input); pasted.delete(input);
    if (event.isComposing || composing.has(input)) return;
    if (edit && edit.type === event.inputType && edit.native === input.value) {
      write(input, edit.next, edit.caret);
      return;
    }
    // Without a matching beforeinput edit, use strict validation, never stripping
    // arbitrary separators. This covers autofill, undo/redo and synthetic input.
    const text = input.value;
    if (!MONEY.test(text)) return;
    const start = rawPosition(text, input.selectionStart ?? text.length);
    const end = rawPosition(text, input.selectionEnd ?? text.length);
    write(input, ungroup(text), start, end, input.selectionDirection);
  };
  const compositionstart = event => {
    const input = inputFor(event);
    if (input) {composing.add(input); pending.delete(input); pasted.delete(input);}
  };
  const compositionend = event => {
    const target = inputFor(event);
    if (target) {
      composing.delete(target);
      input({target, isComposing: false});
      // Some IMEs only send composing input before compositionend. Notify the
      // application's normal input handlers of the completed, formatted value.
      const EventClass = target.ownerDocument?.defaultView?.Event || globalThis.Event;
      if (target.dispatchEvent && EventClass) target.dispatchEvent(new EventClass('input', {bubbles: true}));
    }
  };
  const focusin = event => {inputFor(event);};
  const handlers = {beforeinput, input, paste, compositionstart, compositionend, focusin};
  for (const [type, handler] of Object.entries(handlers)) root.addEventListener(type, handler, true);
  for (const input of root.querySelectorAll?.('input[data-money]') || []) {
    input.setAttribute('inputmode', 'decimal');
    input.value = formatMoneyValue(input.value);
  }
  return () => {
    for (const [type, handler] of Object.entries(handlers)) root.removeEventListener(type, handler, true);
  };
}
