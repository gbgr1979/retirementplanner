# Retirement Path — UK retirement-planning MVP

A dependency-free, browser-only static web app. Working name only; all initial numbers and dates of birth are fictitious examples, not Gareth's personal financial information. Source repository: https://github.com/gbgr1979/retirementplanner . No deployment is configured.

## Run on Windows

Install Node.js 22 or later. If `C:\Projects-Retirement` is empty, clone into it from PowerShell:

```powershell
git clone https://github.com/gbgr1979/retirementplanner.git C:\Projects-Retirement
```

If already cloned, use `git pull` from that folder instead. Do not overwrite existing unrelated files. Then:

```powershell
cd C:\Projects-Retirement
npm run check
npm run dev
```

Open http://127.0.0.1:4173 . Press Ctrl+C to stop. No `npm install` is needed: this project has no third-party packages. Do not open index.html directly via file://; ES modules require an HTTP server.

```powershell
npm test       # Node built-in tests
npm run build # creates dist/ for static hosting
```

Publish only the contents of `dist/` when ready. `staticwebapp.config.json` supplies Azure Static Web Apps security headers. It does not provision resources or deploy anything. There is no backend, storage account, API key or signup flow.

## Included

- Individual or optional-partner plan, separate dates, ownership and Scottish/rest-of-UK income-tax regions.
- Cash savings, cash ISA, stocks & shares ISA, SIPP and workplace DC pots. Per-pot growth, fees, gross/net-relief personal contributions and gross employer contributions.
- State Pension forecasts and DB/other pension income as income streams, not growing pots.
- Dated gross withdrawals and same-owner non-pension transfers. Invalid/locked/unfunded events are rejected with visible warnings, not hidden borrowing.
- Monthly deterministic modelling; inflation-adjusted/future-pound views; lower/base/higher growth sensitivity.
- Stacked wealth, cash/spending/monthly-gap charts, calendar-year ledger and milestones.
- Explicit JSON save/load with version/schema/security validation, replacement confirmation and unsaved-change warning. Partner records remain in files when excluded.

## Important model boundaries

This is an educational illustration, not financial advice, a regulated suitability assessment or a tax return. It deliberately does **not** answer “safe to retire” with a definitive yes/no.

- Income tax: frozen **2026/27** bands, per person and April–March model year. April is wholly assigned to the new tax year rather than splitting at 6 April. Partial years use full personal allowances and omit outside-plan income. Scottish non-savings bands and personal-allowance taper are included.
- Only entered pension/non-savings income and taxable DC withdrawals enter this income-tax estimate. **Savings-interest tax, dividends, CGT, NI, benefits, other income, contribution deductions, higher-rate relief, marriage allowance and future tax changes are excluded.** After-modelled-tax cash is not comprehensive disposable income. Taxable savings balances may be overstated.
- DC withdrawals assume uncrystallised funds with 25% tax-free subject to remaining standard £268,275 allowance. Existing crystallisation, protections and special benefit events are unsupported. Tax allocation is proportional across each year's entered income, not PAYE timing.
- Pension access honours the ordinary statutory increase from 55 to 57 in April 2028, with any higher entered age. Mid-month birthdays become accessible in the following month. Protected ages and special cases are unsupported.
- Contributions enter at month start, growth then charges apply, events occur at month end. Contributions stop in retirement month even if entered end date is later. Net-relief pension payments receive only basic-rate relief (×1.25). External contribution funding is not deducted from spending.
- Spending/income input amounts are in projection-start pounds; event amounts are fixed nominal future pounds. Deterministic returns do not model market volatility or sequence-of-return risk.
- **No automatic drawdown.** A monthly deficit stays unfunded. Surplus income/withdrawal cash is not carried to later months or reinvested. Consequently annual cash may exceed annual spending while some months still have gaps. This is shown explicitly rather than hidden.
- Transfers preserve household wealth; only accessible same-owner non-pension transfers are supported. They do not establish formal ISA-transfer status or enforce subscription rules. ISA/pension contribution threshold warnings are not comprehensive allowance/tax-charge calculations.
- No Monte Carlo, optimiser, death/survivor modelling, IHT, means-tested benefits, guaranteed entitlement, protected pension rights, salary sacrifice, allowance taper or carry-forward engine.

## Privacy and security

Financial data exists only in current JavaScript memory and files you explicitly download. There is **no localStorage/IndexedDB autosave**, cookie, tracking, analytics, external font, external script, ad or network API request. Reloading/closing loses edits unless you save. Downloaded JSON is **unencrypted**: protect it as personal financial information. On ordinary public hosting, the host still sees standard page requests; opening official-source links navigates to those services.

Plan files use strict version 1 validation, bounded values/counts, valid calendar dates, known IDs and fields, a 1 MB UTF-8 limit, and unsafe prototype-key rejection. Invalid files leave the existing plan untouched. Future file versions are rejected explicitly, not silently guessed. All user strings are escaped before rendering. Exporting a file requests a browser download; users should confirm their browser actually saved it.

## Structure

- `src/model.js`: pure monthly calculation and bounded tax engine.
- `src/plan.js`: schema, import/export and example data.
- `src/app.js`: UI state, forms, charts and explicit file actions.
- `src/view.js`: tested pure display helpers.
- `sample-plan.json`: fictional example matching the starting plan.
- `tests/`: model and schema tests.
- `scripts/`: zero-dependency local server and build.
- `CONTRACT.md`: internal data/API reference.
- `QA.md`: validation record and remaining limits.

## Official references

Rules reviewed 2 November 2026. Always verify current rules before making decisions:

- https://www.gov.uk/government/publications/rates-and-allowances-income-tax/income-tax-rates-and-allowances-current-and-past
- https://www.gov.uk/scottish-income-tax
- https://www.gov.uk/check-state-pension
- https://www.gov.uk/individual-savings-accounts
- https://www.gov.uk/tax-on-pension/tax-free
- https://www.gov.uk/tax-on-your-private-pension/annual-allowance
- https://www.moneyhelper.org.uk/en/pensions-and-retirement

No affiliation or endorsement is implied. This MVP should receive further independent financial-model review and broader device/accessibility testing before public use.
