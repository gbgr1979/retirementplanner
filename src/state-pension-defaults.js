/** Illustrative defaults, not a personal entitlement or payment-date forecast.
 * GOV.UK sources checked 3 November 2026. The 2026/27 rate is a baseline,
 * not a forecast of the rate at a future claim date. Recheck when rates/law change.
 */
export const STATE_PENSION_SOURCES = Object.freeze({
  timetable: 'https://www.gov.uk/government/publications/state-pension-age-timetable/state-pension-age-timetable',
  rate: 'https://www.gov.uk/new-state-pension/what-youll-get',
  eligibility: 'https://www.gov.uk/new-state-pension',
  forecast: 'https://www.gov.uk/check-state-pension'
});
export const FULL_NEW_STATE_PENSION_WEEKLY = 241.30;
export const STATE_PENSION_ESCALATION = 2.5;
export const STATE_PENSION_RATE_YEAR = '2026/27';
const pad = n => String(n).padStart(2, '0');
const format = (year, month, day) => `${year}-${pad(month)}-${pad(day)}`;
const leap = year => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
const daysInMonth = (year, month) => [31, leap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  return year >= 1900 && year <= 2250 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}
function addMonths(date, months) {
  const [year, month, day] = date.split('-').map(Number);
  const index = year * 12 + month - 1 + months, y = Math.floor(index / 12), m = index % 12 + 1;
  return format(y, m, Math.min(day, daysInMonth(y, m)));
}
function bandIndex(dob, first) {
  const [year, month, day] = dob.split('-').map(Number);
  const [firstYear, firstMonth] = first.split('-').map(Number);
  return (year - firstYear) * 12 + month - firstMonth - (day < 6 ? 1 : 0);
}
/** Legislated eligibility date for cohorts with a gender-independent timetable.
 * Earlier cohorts deliberately return null: this wizard does not collect sex.
 * In particular it must not assume that everybody has the new State Pension.
 */
export function statePensionDate(dob) {
  if (!validDate(dob) || dob < '1953-12-06') return null;
  let date;
  if (dob < '1954-10-06') date = addMonths('2019-03-06', 2 * bandIndex(dob, '1953-12-06'));
  else if (dob < '1960-04-06') date = addMonths(dob, 66 * 12);
  else if (dob < '1961-03-06') date = addMonths(dob, 66 * 12 + 1 + bandIndex(dob, '1960-04-06'));
  else if (dob < '1977-04-06') date = addMonths(dob, 67 * 12);
  else if (dob < '1978-04-06') date = addMonths('2044-05-06', 2 * bandIndex(dob, '1977-04-06'));
  else date = addMonths(dob, 68 * 12);
  return validDate(date) ? date : null;
}
/** First complete projection month, avoiding credit for a partial eligibility month.
 * This is a modelling convention, not the date DWP will pay a claim.
 */
export function firstFullStatePensionMonth(eligibilityDate) {
  if (!validDate(eligibilityDate)) return null;
  const date = eligibilityDate.endsWith('-01') ? eligibilityDate : addMonths(eligibilityDate, 1);
  return validDate(date) ? date.slice(0, 7) : null;
}
/** Exact DOB takes precedence. Age-only input uses the wizard's approximate DOB.
 * Invalid explicit DOB never silently falls back to age. No input is mutated.
 * Null values mean the caller must ask for a personal amount/start month.
 */
export function getStatePensionDefaults(input = {}) {
  const {dob, age, startMonth} = input && typeof input === 'object' ? input : {};
  const exact = dob !== undefined && dob !== null && dob !== '';
  const validMonth = typeof startMonth === 'string' && validDate(`${startMonth}-01`);
  const approximateDob = validMonth && Number.isInteger(age) && age >= 18 && age <= 90
    ? `${Number(startMonth.slice(0, 4)) - age}-${startMonth.slice(5)}-01` : null;
  const birthDate = exact ? dob : approximateDob;
  const result = {dob: validDate(birthDate) ? birthDate : null, approximate: !exact, eligibilityDate: null, startMonth: null, weeklyAmount: null, escalation: STATE_PENSION_ESCALATION, reason: null};
  if (!validDate(birthDate) || (validMonth && birthDate > `${startMonth}-01`)) return {...result, reason: 'invalid-input'};
  if (birthDate < '1953-12-06') return {...result, reason: 'older-cohort-needs-forecast'};
  const eligibilityDate = statePensionDate(birthDate);
  const claimMonth = firstFullStatePensionMonth(eligibilityDate);
  if (!claimMonth) return {...result, reason: 'outside-supported-range'};
  return {...result, eligibilityDate, startMonth: claimMonth, weeklyAmount: FULL_NEW_STATE_PENSION_WEEKLY, reason: exact ? 'illustrative-full-rate' : 'approximate-age-only'};
}
