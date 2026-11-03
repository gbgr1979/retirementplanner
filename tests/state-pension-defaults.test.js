import test from 'node:test';
import assert from 'node:assert/strict';
import {statePensionDate, firstFullStatePensionMonth, getStatePensionDefaults, FULL_NEW_STATE_PENSION_WEEKLY} from '../src/state-pension-defaults.js';

test('66 and 67 birthdays and precise transition boundaries', () => {
  for (const [dob, date] of [['1954-10-06','2020-10-06'],['1960-04-05','2026-04-05'],['1960-04-06','2026-05-06'],['1960-05-05','2026-06-05'],['1960-05-06','2026-07-06'],['1961-03-05','2028-02-05'],['1961-03-06','2028-03-06'],['1977-04-05','2044-04-05']]) assert.equal(statePensionDate(dob), date, dob);
});
test('all eleven 66 to 67 monthly bands include both boundaries', () => {
  const bands = [
    ['1960-04-06','1960-05-05','2026-05-06','2026-06-05'],
    ['1960-05-06','1960-06-05','2026-07-06','2026-08-05'],
    ['1960-06-06','1960-07-05','2026-09-06','2026-10-05'],
    ['1960-07-06','1960-08-05','2026-11-06','2026-12-05'],
    ['1960-08-06','1960-09-05','2027-01-06','2027-02-05'],
    ['1960-09-06','1960-10-05','2027-03-06','2027-04-05'],
    ['1960-10-06','1960-11-05','2027-05-06','2027-06-05'],
    ['1960-11-06','1960-12-05','2027-07-06','2027-08-05'],
    ['1960-12-06','1961-01-05','2027-09-06','2027-10-05'],
    ['1961-01-06','1961-02-05','2027-11-06','2027-12-05'],
    ['1961-02-06','1961-03-05','2028-01-06','2028-02-05']
  ];
  for (const [first,last,firstDate,lastDate] of bands) {
    assert.equal(statePensionDate(first),firstDate);assert.equal(statePensionDate(last),lastDate);
  }
});
test('66 to 67 month-end examples clamp instead of rolling into next month', () => {
  for (const [dob, date] of [['1960-07-31','2026-11-30'],['1960-12-31','2027-09-30'],['1961-01-31','2027-11-30']]) assert.equal(statePensionDate(dob), date);
});
test('every 67 to 68 band has a fixed eligibility date, not birthday-plus-months', () => {
  const bands = [
    ['1977-04-06','1977-05-05','2044-05-06'],['1977-05-06','1977-06-05','2044-07-06'],
    ['1977-06-06','1977-07-05','2044-09-06'],['1977-07-06','1977-08-05','2044-11-06'],
    ['1977-08-06','1977-09-05','2045-01-06'],['1977-09-06','1977-10-05','2045-03-06'],
    ['1977-10-06','1977-11-05','2045-05-06'],['1977-11-06','1977-12-05','2045-07-06'],
    ['1977-12-06','1978-01-05','2045-09-06'],['1978-01-06','1978-02-05','2045-11-06'],
    ['1978-02-06','1978-03-05','2046-01-06'],['1978-03-06','1978-04-05','2046-03-06']
  ];
  for (const [first,last,date] of bands) {assert.equal(statePensionDate(first),date);assert.equal(statePensionDate(last),date);}
  assert.equal(statePensionDate('1978-04-06'), '2046-04-06');
  assert.equal(statePensionDate('2000-02-29'), '2068-02-29');
});
test('65 to 66 common timetable is supported; older cohorts are intentionally not guessed', () => {
  assert.equal(statePensionDate('1953-12-06'),'2019-03-06');
  assert.equal(statePensionDate('1954-01-05'),'2019-03-06');
  assert.equal(statePensionDate('1954-10-05'),'2020-09-06');
  for (const dob of ['1953-12-05','1951-04-06','1936-01-01']) {
    assert.equal(statePensionDate(dob),null);
    const result=getStatePensionDefaults({dob});
    assert.equal(result.weeklyAmount,null);assert.equal(result.startMonth,null);
    assert.equal(result.reason,'older-cohort-needs-forecast');
  }
});
test('projection convention chooses first complete eligible month', () => {
  assert.equal(firstFullStatePensionMonth('2044-05-06'),'2044-06');
  assert.equal(firstFullStatePensionMonth('2044-05-01'),'2044-05');
  assert.equal(firstFullStatePensionMonth('2044-12-31'),'2045-01');
  assert.equal(firstFullStatePensionMonth('2250-12-31'),null);
});
test('age-only wizard defaults are explicit approximations, not a universal age67', () => {
  const input=Object.freeze({age:49,startMonth:'2026-11'});
  const result=getStatePensionDefaults(input);
  assert.equal(result.dob,'1977-11-01');assert.equal(result.eligibilityDate,'2045-05-06');
  assert.equal(result.startMonth,'2045-06');assert.equal(result.approximate,true);
  assert.equal(result.weeklyAmount,241.30);assert.equal(result.weeklyAmount,FULL_NEW_STATE_PENSION_WEEKLY);
  assert.equal(result.escalation,2.5);assert.equal(result.reason,'approximate-age-only');
  assert.equal(getStatePensionDefaults({age:30,startMonth:'2026-11'}).startMonth,'2064-11');
});
test('exact DOB wins; defaults remain pure and preserve past eligibility', () => {
  const result=getStatePensionDefaults({dob:'1960-07-31',age:49,startMonth:'2026-11'});
  assert.equal(result.approximate,false);assert.equal(result.startMonth,'2026-12');
  assert.equal(getStatePensionDefaults({dob:'1955-01-01',startMonth:'2026-11'}).startMonth,'2021-01');
});
test('invalid, unknown and unsupported input returns no misleading amounts or dates', () => {
  for (const input of [undefined,null,{}, {age:''}, {age:'49',startMonth:'2026-11'}, {age:49.5,startMonth:'2026-11'}, {age:10,startMonth:'2026-11'}, {age:49,startMonth:'2026-13'}, {dob:'1960-02-30',age:49,startMonth:'2026-11'}, {dob:'1900-02-29'}, {dob:'2028-01-01',startMonth:'2026-11'}, {dob:'2250-01-01'}]) {
    const result=getStatePensionDefaults(input);
    assert.equal(result.weeklyAmount,null,JSON.stringify(input));assert.equal(result.startMonth,null);
  }
  for (const date of [null,undefined,'','1960-2-03','1960-02-30','1900-02-29','x']) assert.equal(statePensionDate(date),null);
});
