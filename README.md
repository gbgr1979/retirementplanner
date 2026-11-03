# Retirement Path — UK retirement-planning MVP

A dependency-free, browser-only static web app. Working name only; the included example file uses fictitious numbers and dates of birth, not Gareth's personal financial information. Source repository: https://github.com/gbgr1979/retirementplanner . No automatic deployment is configured; the optional Windows publisher below runs only when you launch it.

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
- **Recurring gross withdrawals are controlled by the annual target above the graph.** They start at the primary person’s retirement month and are removed monthly from accessible pots in the disclosed order. A spending deficit beyond that selected target stays unfunded; spending is not deducted a second time. Surplus income/withdrawal cash is not carried to later months or reinvested. Consequently annual cash may exceed annual spending while some months still have gaps.
- Transfers preserve household wealth; only accessible same-owner non-pension transfers are supported. They do not establish formal ISA-transfer status or enforce subscription rules. ISA/pension contribution threshold warnings are not comprehensive allowance/tax-charge calculations.
- No Monte Carlo, optimiser, death/survivor modelling, IHT, means-tested benefits, guaranteed entitlement, protected pension rights, salary sacrifice, allowance taper or carry-forward engine.

## Privacy and security

Financial data exists only in current JavaScript memory and files you explicitly download. There is **no localStorage/IndexedDB autosave**, cookie, tracking, analytics, external font, external script, ad or network API request. Reloading/closing loses edits unless you save. Downloaded JSON is **unencrypted**: protect it as personal financial information. On ordinary public hosting, the host still sees standard page requests; opening official-source links navigates to those services.

Plan files use strict version 3 validation, bounded values/counts, valid calendar dates, known IDs and fields, a 1 MB UTF-8 limit, and unsafe prototype-key rejection. Invalid files leave the existing plan untouched. Valid version 1 and 2 files are strictly validated before migration to version 3. Version 1 receives a £0 recurring target; version 2 preserves its target and inflation basis. Both remain in pots-only mode, so their projections do not silently change. Unknown versions are rejected explicitly. All user strings are escaped before rendering. Exporting a file requests a browser download; users should confirm their browser actually saved it.

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

## Pull latest source and publish from Windows

Prerequisites: a **Git clone** (not a ZIP download), Git for Windows, Windows PowerShell 5.1 on 64-bit Windows, internet access, and an existing Azure Static Web App. Once these scripts are on `main`, pull once and double-click **`publish.cmd`**. It updates from `origin/main`, prepares and verifies the twelve public assets in `dist/`, and deploys to **production**. No Azure app URL is needed: the deployment token selects the app. Running the script is the action that publishes; merely downloading these files does not deploy anything.

The launcher refuses the wrong repository, a branch other than `main`, dirty/untracked source files, or local commits not on remote main. It never resets, force-pulls, deletes your source changes, or switches branches. Commit, move or stash your changes yourself when instructed. It fetches then fast-forwards to the fetched commit (equivalent to an ff-only pull), and starts the freshly updated publisher in a new PowerShell process.

### The same CMD + PS1 arrangement

You use just **`publish.cmd`** and **`publish.ps1`**, side by side at the root of the clone:

- `publish.cmd` is the double-click launcher.
- `publish.ps1` is your private wrapper, with your deployment token hardcoded inside. It calls the maintained helpers in `deployment/`; you do not need to edit those helpers.

Save your supplied private `publish.ps1` beside `publish.cmd`. Alternatively, copy `deployment/publish.example.ps1` to root `publish.ps1` and replace its placeholder token locally. Then double-click `publish.cmd`. There is **no separate token file** to configure. If you have the earlier `publish.local.ps1`, it is no longer used; securely remove that old copy once your new wrapper is in place.

`publish.ps1` is a **plaintext secret**, Git-ignored and excluded from the website. Never commit, share, or include it in a source ZIP; restrict access to your Windows account. The updater refuses tracked private wrappers and preserves your ignored copy during pulls. Git ignore does not prevent deliberate `git add -f`. **Rotate any deployment token previously pasted into chat** in Azure Portal → Static Web App → Manage deployment token, and update your private PS1 with the replacement.

If the template still has its placeholder, an existing `SWA_CLI_DEPLOYMENT_TOKEN` environment value or a masked prompt is used instead. The token never appears in command-line arguments; keychain storage is disabled. The actual private wrapper is intentionally absent from GitHub, so a fresh clone needs your private PS1 copied beside the CMD once.

### Check without publishing

From Command Prompt in the clone:

```bat
publish.cmd -PrepareOnly
publish.cmd -PrepareOnly -NoPause
publish.cmd -NoPause
```

`-PrepareOnly` still pulls main and prepares/verifies the public files, but **does not use the token, download the Microsoft deployment client, connect to Azure, or publish**. `-NoPause` disables the closing Enter prompt; without a token, a real publish still prompts for one. Exit code is zero on success and nonzero on failure. Publishing requires **no Node.js, npm, Azure CLI, or module installation**. For development, `npm run check` still runs the JavaScript tests/build with Node.js; those developer tests are not run by the Windows publisher.

Only twelve allowlisted public assets enter `dist/`: `index.html`, `styles.css`, `staticwebapp.config.json`, and the nine browser JavaScript modules. Source plans (`sample-plan.json` or your saved financial JSON), credentials, tests, scripts, docs and `.git` are excluded. The browser JavaScript is necessarily public; do not hardcode personal data or secrets into it. Additional files or links in `dist/` fail validation. Keep personal saved plans **outside the Git clone**.

The publisher uses the **same standalone Microsoft deployment-client approach as the original example**, not the Node-based SWA CLI. PowerShell downloads Microsoft's stable Windows x64 client using the official `https://aka.ms/swalocaldeploy` release metadata, validates the SHA-256 before execution, and removes the temporary client/work folder afterward. No software installation is needed. It copies only allowlisted files, byte-for-byte, verifies their hashes, and rejects linked source/output paths. The private wrapper you already received is unchanged.

The token is passed only through process environment variables, never command arguments. It is removed during Git update and client download, then placed in the native client's environment. Native output is token-redacted; staging/branch variables are cleared for production. No token is written to deployment files by these scripts. This does not protect a plaintext private wrapper from other software running as your Windows user.

Reference: [Microsoft SWA CLI deployment](https://learn.microsoft.com/en-us/azure/static-web-apps/static-web-apps-cli), [official deployment options](https://azure.github.io/static-web-apps-cli/docs/cli/swa-deploy/), [Microsoft client download implementation](https://github.com/Azure/static-web-apps-cli/blob/v2.0.10/src/core/download-binary-helper.ts).

Validation: Node tests/build and payload rejection checks run in Linux. Windows PowerShell execution, interactive double-click flow and a real Azure deployment have **not** been run in this environment. Start with `publish.cmd -PrepareOnly` on Windows before your first real publish.

## Guided setup wizard

The homepage **Start your retirement plan** button opens a four-step, keyboard-accessible fresh-plan wizard: timeline, money, editable assumptions, review. Age inputs start blank and balances start at zero. New wizard plans start with an enabled, illustrative full new State Pension of £241.30/week (2026/27), not a guaranteed personal entitlement. Each person can change or switch it off. A 2.5% nominal annual increase is assumed from the projection start, applied once. Claim month uses the legislated timetable and the approximate age-derived DOB, starting in the first complete eligible month; verify exact dates using GOV.UK. For older cohorts before 6 December 1953, no amount or date is supplied because the wizard cannot safely infer the applicable pension without more personal details. Existing and loaded plans are never given these defaults. Use State Pension in the left options header to edit forecasts. Pension monthly input means the total added, including employer payments and tax relief, counted exactly once.

Back retains draft values. Cancel and Escape leave the currently displayed plan and unsaved editor values untouched. Creating a replacement for an existing plan requires an explicit replacement checkbox: this is a **fresh plan**, not a merge into existing advanced settings. First-time setup simply creates the new plan. Completion resets the view to base growth and today's money, marks the plan unsaved and leaves all advanced controls available.

Ages become approximate first-of-month dates; exact dates, Scottish tax region and pension forecasts can be entered afterwards. Growth, charges, inflation, retirement age and spending defaults are editable scenario assumptions, not recommendations. No contact information, account, server request or autosave is added.

## Simple landing page

The initial screen contains only a short introduction, **Start your retirement plan**, and a discreet **Load a saved plan** button. Example figures, editor controls, charts and technical notes remain hidden until a wizard is completed or a saved plan is successfully loaded. Cancelled setup, cancelled file selection/replacement and invalid files do not reveal or reset the workspace.

Once a plan is open, **New plan** starts a separate draft. Cancelling it preserves the current plan and any unsaved editor fields; replacing it requires explicit confirmation. There is deliberately no destructive Home/reset navigation. Reloading a tab returns to the landing page; save your plan file first (unsaved changes trigger the usual browser warning). No new modules, dependencies or publishing steps were added for this simplification.

## Annual withdrawal scenarios

A prominent **Annual withdrawals from your pots** control above the graph changes the plan immediately. Plus/minus adjusts by exactly £1,000 per year (clamped between £0 and £12,000,000); direct entry is also supported. It is explicitly either a gross pot-withdrawal target or a total gross-income target including pension income. Neither is a guaranteed sustainable income or a net lifestyle budget.

- The target begins at the primary person’s retirement month. It is a household target when the partner is included.
- By default it is expressed in projection-start pounds and rises with inflation from the projection start date. The advanced checkbox can select fixed future nominal pounds instead. The chart’s today/future-pound display toggle never changes the stored amount or its basis.
- Each month, actual successful scheduled withdrawals count towards one twelfth of that month’s indexed target. Rejected withdrawals and transfers do not count. Scheduled amounts above the target still execute in full, with no credit against later months.
- Remaining target is drawn partially, if necessary, from accessible cash savings → cash ISA → stocks & shares ISA → SIPP/workplace DC pensions. Within each group, primary-owner pots come first, then partner pots, retaining listed order. No inaccessible pension or excluded partner pot is used; no balance becomes negative. This order is deterministic, not tax-optimised.
- In pots-only mode, State/DB income remains additional. In total-income mode, gross active pension income reduces the amount required from pots, floored at zero. Actual pension withdrawals enter the existing per-owner tax and lump-sum allowance accounting. Spendable cash may therefore be lower than gross withdrawals.
- The first unmet target is reported distinctly from spending shortfall. Locked pensions may remain, so an access shortfall does not mean all wealth has disappeared. Funding through the model horizon is not a promise of lifelong sustainability.
- New wizard plans begin with an explicitly disclosed gross annual target equal to the monthly spending input ×12, editable immediately afterwards. Imported v1 plans start at zero and prompt the user to choose a target. v2 files retain the chosen target and inflation basis in pots-only mode. New wizard plans with an entered positive pension forecast use clearly disclosed total-income mode.

The saved v3 field is `drawdown: { mode, annualAmount, inflationLinked }`; withdrawal start follows primary retirement dynamically so changing that date cannot leave a stale separate start setting.

### Currency entry and retirement-year comparisons
Money inputs add thousands separators as you type (for example, `2,000.50`), including guided setup, detailed pots, income/events and the annual withdrawal control. Decimals and the editing cursor are preserved. Malformed pasted separators are rejected rather than silently stripped. Saved plan values remain numbers; the file format is unchanged.

The wealth chart marks the primary person's retirement year and names the exact month. Because the chart plots annual balances, the line marks that year's sample, not an exact monthly balance. The nearby −/+ controls change retirement by one year, keep the month and recalculate the model. They leave the partner, income streams and scheduled events unchanged. Matching contribution end dates and spending start created by guided setup move with the buttons. After loading a saved plan, contribution and spending dates remain fixed to avoid guessing the original intent of matching dates; adjust them separately in the editor. Dates explicitly edited to match retirement then move with it. Other dates remain fixed, even when a comparison passes through them. No new plan fields are required. Year changes respect the projection range and contribution start dates; existing out-of-range dates can move one year inward. An off-chart retirement date is explicitly reported.

The retirement-year controls sit in the Annual withdrawals section. The graph explicitly states its projection start and end; new wizard plans start in the current month, while loaded plans keep their saved projection start. If retirement is set to the same month as the projection start, the marker appears at the left and the page explains that planned withdrawals begin immediately. Changing retirement never removes the earlier years from the graph.

### Unified scenario card
The annual withdrawal and retirement year use matching side-by-side controls on desktop, stacking on small screens. Before-tax money basis, retirement month and a short result stay visible. The question-mark help button opens a keyboard-accessible dialog with the detailed rules and inflation switch. Escape or Close returns focus to the help button; opening help does not change the plan.

### Two summary values
The summary shows the total pot at the **start of the retirement month**, before that month's flows, and the pot left after the **final simulated month**. The end age is a planning horizon, not a prediction of death. The end value includes any locked pensions and is not an after-tax inheritance estimate. Including a partner makes both totals household values, while the horizon remains the primary person's. Both values follow the money-display toggle. If retirement is outside the projection, no retirement value is invented. Shortfall warnings remain in the withdrawal card.

The chart marker reads “Retirement – age N”. Age is calculated at the first day of the selected retirement month, the model's start point; a birthday later in that month has not yet occurred. The axis and accessible marker description retain the calendar year/date.

### Personal State Pension forecasts
The wizard and the card’s Add/edit forecast dialog accept a weekly gross forecast, explicit first payment month and an editable annual-increase assumption for each active person. No full entitlement or universal claim age is assumed. Use your own [GOV.UK forecast](https://www.gov.uk/check-state-pension) and [State Pension age check](https://www.gov.uk/state-pension-age). Weekly ×52÷12 models an average calendar month, not the four-week payment schedule. Claim months are modelled as whole months. Forecasts are in projection-start pounds; the increase runs from the plan start, including years before claiming. It is not a guaranteed triple-lock forecast.

New wizard plans with positive forecasts explicitly use **Total income before tax**: pots cover the full target before the pension starts and only the remaining gross amount afterwards. Saved plans retain **Withdrawals from pots only** until the user explicitly changes mode. The dedicated dialog edits the existing State Pension record, preserves unrelated incomes/disabled partners and refuses ambiguous duplicate entries. Income above the target is not saved back into pots. Gross income and scheduled withdrawals each count once. Tax remains per person and cannot be interpreted as a guaranteed net lifestyle budget.

Tax is frozen at 2026/27 throughout the projection. Future changes, including the Pension Tax Allowance announced for April 2027, are not implemented; see [HMRC’s explainer](https://www.gov.uk/government/publications/pension-tax-allowance-explainer/pension-tax-allowance-explainer). This limitation is shown on the page and in help.

State Pension timetable and current-rate sources (checked 3 November 2026): https://www.gov.uk/government/publications/state-pension-age-timetable/state-pension-age-timetable and https://www.gov.uk/new-state-pension/what-youll-get. Legislated future ages can change. Current-rate defaults must be reviewed when tax-year rates change.
