# Retirement Path — UK retirement-planning MVP

A dependency-free, browser-only static web app. Working name only; all initial numbers and dates of birth are fictitious examples, not Gareth's personal financial information. Source repository: https://github.com/gbgr1979/retirementplanner . No automatic deployment is configured; the optional Windows publisher below runs only when you launch it.

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

## Pull latest source and publish from Windows

Prerequisites: a **Git clone** (not a ZIP download), Git for Windows, Windows PowerShell 5.1, Node.js 22+ with npm, internet access, and an existing Azure Static Web App. Once these scripts are on `main`, pull once and double-click **`publish.cmd`**. It updates from `origin/main`, runs all checks, rebuilds `dist/`, and deploys to **production**. No Azure app URL is needed: the deployment token selects the app. Running the script is the action that publishes; merely downloading these files does not deploy anything.

The launcher refuses the wrong repository, a branch other than `main`, dirty/untracked source files, or local commits not on remote main. It never resets, force-pulls, deletes your source changes, or switches branches. Commit, move or stash your changes yourself when instructed. It fetches then fast-forwards to the fetched commit (equivalent to an ff-only pull), and starts the freshly updated publisher in a new PowerShell process.

### Local token file (optional)

Copy `publish.local.example.ps1` to **`publish.local.ps1`**, beside `publish.cmd`, and replace the placeholder locally:

```powershell
$AzureDeploymentToken = 'YOUR_NEW_DEPLOYMENT_TOKEN'
```

This is a **plaintext secret**, not encryption. Restrict access to your Windows account; never email, upload, paste into chat, commit, or include this file in a source ZIP. It is Git-ignored, and the publisher refuses it if it becomes tracked. Git ignore is not protection against deliberate `git add -f`. The file is local PowerShell code: do not use an untrusted downloaded replacement. **Rotate any deployment token previously pasted into chat** in Azure Portal → Static Web App → Manage deployment token, and use the replacement locally.

Without that local file, the publisher uses an existing process environment variable named `SWA_CLI_DEPLOYMENT_TOKEN`, or prompts for a masked token with `Read-Host -AsSecureString`. Do not pass a token on the command line or put it in the tracked scripts. The script does not persist prompted credentials or use the OS keychain. Precedence: local file, environment, hidden prompt. An invalid local file fails rather than silently choosing another token.

### Check without publishing

From Command Prompt in the clone:

```bat
publish.cmd -PrepareOnly
publish.cmd -PrepareOnly -NoPause
publish.cmd -NoPause
```

`-PrepareOnly` still pulls main and runs tests/build, but **does not read the local token, install the Azure CLI, connect to Azure, or publish**. `-NoPause` disables the closing Enter prompt; without a token, a real publish still prompts for one. Exit code is zero on success and nonzero on failure. For local development without pulling, use `npm run check`.

Only seven allowlisted public assets enter `dist/`: `index.html`, `styles.css`, `staticwebapp.config.json`, and the four browser JavaScript modules. Source plans (`sample-plan.json` or your saved financial JSON), credentials, tests, scripts, docs and `.git` are excluded. The browser JavaScript is necessarily public; do not hardcode personal data or secrets into it. Additional files or links in `dist/` fail validation. Keep personal saved plans **outside the Git clone**.

The publisher temporarily installs the official **`@azure/static-web-apps-cli@2.0.10`** from npm with lifecycle scripts disabled and keychain persistence off. No global install or project dependencies are added. The CLI may download Microsoft's deployment client. npm's package cache remains on your machine, but the script's temporary working directory is removed. The token is supplied only to the deploy process through its environment, never as an argument; inherited SWA settings are isolated so an old API path or debug setting cannot alter this deployment. This does not make plaintext secrets inaccessible to other software running as your Windows user.

Reference: [Microsoft SWA CLI deployment](https://learn.microsoft.com/en-us/azure/static-web-apps/static-web-apps-cli), [official deployment options](https://azure.github.io/static-web-apps-cli/docs/cli/swa-deploy/), [pinned release](https://github.com/Azure/static-web-apps-cli/releases/tag/v2.0.10).

Validation: Node tests/build and payload rejection checks run in Linux. Windows PowerShell execution, interactive double-click flow and a real Azure deployment have **not** been run in this environment. Start with `publish.cmd -PrepareOnly` on Windows before your first real publish.
