# Validation record — 2 November 2026

## Automated

`npm run check`: **45 tests passed**, JavaScript syntax checks passed, static build passed. No dependencies were installed.

Coverage includes:
- Monthly compounding, fees, contributions, retirement stop dates, balances and annual ledger conservation.
- Pension-access boundary, same-month ordered events, rejected inaccessible/insufficient events, internal transfers without wealth or income double-counting.
- Separate household owners, retained-but-disabled partner data, scenario ordering, immutable input.
- Income-tax bands/taper, Scottish differences, separate tax years and allowances, capped cumulative pension tax-free cash.
- Full fictitious 576-month example under all three scenarios; finite nonnegative balances and reconciled pots/months/years.
- Strict JSON roundtrip/schema, malformed/oversized/nonfinite/bad-date files, duplicate/dangling references, unsafe keys and inherited-name pot IDs.
- Date-correct inflation display, reversed imported people order, retirement outside projection horizon, HTML escaping.
- First-party static assets, no implicit browser persistence/network API in app, Azure security policy.

Independent reviewer additionally ran **51,840 monthly ledger assertions** across 30 varied plans/scenarios and 30 save/load round trips, verified official live tax tables, and reran the inherited-key regression. No model/schema blocker remained within the stated scope.

## Browser checks

Supported managed `sites-preview` and cloud CUA browser were used, not an improvised Chromium launch. Internal preview only, no public deployment.

Verified:
- App loads and renders real calculations, charts, form data and annual ledger.
- Desktop screenshot inspected: warm neutral/green editorial layout with accessible labelled controls.
- Partner inclusion changes household result; lower-growth scenario reduces example result.
- Add pot / apply, plan-name edit and explicit save-download request work.
- No claim that a browser download request proves the file was saved to the user's disk.

Independent UI review also verified:
- Partner include/exclude updates and retained excluded partner values.
- Invalid end-age blocks applying changes and preserves existing metrics.
- Completed JSON download with a returned download path.
- Loading that fictional downloaded file prompts replacement; Cancel retains unsaved name and dirty state.
- Removal confirmation Cancel preserves all pots and keyboard focus.
- Per-pot numerical ledger is visible.

The file chooser required native approval and completed without a bypass. Load replacement **Accept** was not browser-tested; strict roundtrip logic is unit-tested. Mobile CSS was statically reviewed but no actual narrow-viewport rendering was tested because no supported viewport-control method was available. The Node tests are not equivalent to complete cross-browser or assistive-technology certification. Real Windows downloads and Azure deployment remain to be checked after repository handoff/publication.

## Release boundaries

This is a locally built MVP prepared for initial source upload to `gbgr1979/retirementplanner`; it is not a published website. Financial model limitations are prominently shown in the app and README: gross withdrawal targets/events, no optimised drawdown or surplus carry-forward, incomplete/frozen tax estimate. This does not validate retirement sustainability or recommend a withdrawal strategy. Further specialist review is advisable before promoting it as a public financial planning tool.

## Guided setup update — 2 November 2026

Independent actual-browser checks passed: prominent homepage CTA; blank age, negative balance and out-of-range growth validation with focus; Back retains fields; partner toggle retains entered values; review totals; explicit replacement required; Escape preserves original unsaved editor and returns focus to CTA; completion updates model/charts and focuses results; repeated wizard Cancel preserves the existing plan and newer unsaved edit; keyboard Tab enters the first field.

Mobile responsive CSS was reviewed, but actual mobile/narrow-viewport rendering remains untested (no supported viewport control). Native dialog provides focus containment and Escape behaviour. Pure wizard tests cover fresh data/no guessed pension income, partner retention, ages/dates/horizon validation, one-count combined pension contributions, and ordinary pension-access boundary changes. No new dependency or user setup step was introduced. Both deployment paths explicitly include the wizard's two JavaScript modules in the nine-file public allowlist; standalone publishing client code is unchanged.

## Landing simplification — 2 November 2026

Initial HTML hides the workspace, financial actions and projection skip link before JavaScript, preventing an example-dashboard flash. Screen-state tests cover first display, accepted wizard/load, cancelled/failed flows, repeated acceptance and reload initialisation. Load and wizard completion handlers are checked to reveal the workspace only after acceptance. The existing nine-file public payload and standalone publisher are unchanged.

Final landing check: **66 tests**, syntax/build and nine-file payload verification passed. Independent actual desktop browser review confirmed calm initial landing; Cancel/Escape return to landing and focus; first completion with £12,345 reveals the matching planner; repeated New plan requires replacement consent; Cancel preserves £12,345 and a newer unsaved name edit. Successful file-load transition was checked in source/tests, not the browser because the file chooser requires separate approval. Actual mobile rendering remains untested.

## Recurring withdrawal feature — 3 November 2026

Annual gross target controls now drive real monthly pot reductions. Independent model review passed 11 exact black-box cases and 86,400 monthly invariants across 50 varied plans ×3 scenarios, deterministic type/owner/list-order checks and 50 exact roundtrips with input immutability. Covered actual event offsets (including failures and excess), transfers, partial/exact depletion, locked versus exhausted funds, owner tax/lump-sum allocation, partner inclusion, and inflation anchor. Strict v1 migration retains the old zero-recurring-withdrawal meaning.

Pure control tests cover exact £1,000 adjustments, zero/cap bounds, decimal drift and outcome labels. All checks remain local; no deployment or financial guarantees are implied. No new public modules or publishing dependencies were added.

Final recurring-withdrawal check: **91 tests**, syntax/build and exact nine-file static payload passed. Independent actual-browser QA confirmed the wizard’s disclosed £24k default, £1k repeated/keyboard adjustments, changed graph paths and earlier shortfall, zero/minus floor, invalid/cap handling, unchanged amount basis across money/scenario toggles, fixed-nominal mode, explicit horizon-not-guarantee status, pending editor-value preservation and clean landing. Mobile rendering and browser file-load acceptance remain untested; schema migration/roundtrips are tested programmatically. No PowerShell runtime is available, but exact public-file and publisher security contract tests pass.

## Currency input and retirement-year controls (3 November 2026)
Currency fields share a strict text formatter/parser with live grouping, decimal and caret preservation, validated paste, composition handling and delegated dynamic-input support. Financial data remains numeric; plan schemas and the financial engine are unchanged. Tests cover empty/transient/invalid text, precision, edits around commas, selection, paste and numeric roundtrips. The new module is included in both exact deployment allowlists (ten public assets).

Retirement controls move exactly one year while preserving the month, partner data and unrelated events/incomes. Matching primary contribution end dates and spending start move consistently; cached setup links prevent an unrelated date being captured when comparisons pass through it. Loaded plans start with no automatic date links, avoiding ambiguous custom-date changes after save/reload. Helpers and tests cover repeated comparisons, collisions, manual edits, projection bounds, partial-year/offscreen markers and the 80-year model cap. Marker placement explicitly represents the retirement year's annual balance column.

Final automated check: **115 tests**, syntax/build and ten-file static payload verification passed. Independent desktop browser review passed live `2000` → `2,000`, middle edits/backspace/delete, decimals/trailing dot, empty/malformed input rejection, real clipboard valid/invalid paste, wizard/editor/annual/dynamic-pot coverage, numeric withdrawal increments and unchanged non-money fields. Retirement marker/year control checks passed repeated changes, month preservation, changed graph/drawdown timing, matching-date sync, partner/pending-name preservation, keyboard focus and lower bounds. Actual mobile rendering and browser file-load acceptance remain untested; programmatic plan roundtrips remain covered. No PowerShell runtime is available; publisher parity/security tests pass.

Save/reload safety regression: loaded plans intentionally start with no automatic date links. A custom date that coincides with the compared retirement date remains unchanged on later year adjustments. Changing retirement manually does not re-link untouched custom dates. The control explains that loaded contribution/spending dates need separate editing.

## Retirement control placement and chart-start clarification (3 November 2026)
The reported screenshot shows projection start November 2026 and selected retirement November 2026, with the first x-axis tick 2026. No dropped pre-retirement data was reproduced. Independent Node checks confirm age 47 / retirement age 57 starting November 2026 yields retirement November 2036 while retaining all graph years from 2026; repeated year changes leave the start unchanged.

Moved retirement-year controls into the Annual withdrawals card. Added explicit projection start/end and same-start retirement explanation. Extracted existing annual SVG rendering into a pure helper so tests assert actual first x-axis labels, leftmost plotted sample and marker, not just model rows. Saved earlier/later projection starts are preserved and labelled, never silently relabelled to the computer's current year. All 119 tests and syntax/build checks pass; public payload remains ten assets.

## Unified withdrawal/retirement card (3 November 2026)
Rebuilt the card with a single header, aligned desktop controls and shared value/button styling. Narrow layouts stack the controls. Long explanations moved into a labelled native modal; tax basis, selected month and concise outcome remain on the card. Modal tests cover open, repeat open, close, Escape, focus return and cleanup. Financial engine and plan schemas are unchanged. Inflation-change validation errors appear inside the modal and failed changes revert the switch.

Independent desktop visual/browser QA verified the alignment, both steppers, graph updates, pending editor preservation, help keyboard access, Escape/Close focus return and inflation setting. Implementer also inspected actual card and modal screenshots and verified close restores focus. Actual mobile rendering and browser saved-file loading remain untested; responsive CSS and schema roundtrips are checked separately.

## Two pot summaries and age-labelled marker (3 November 2026)
Replaced the three summary metrics with retirement opening pot and remaining final-month pot. Exact month snapshots avoid treating the end of the retirement calendar year as the retirement starting amount. Real-money discounting uses elapsed months at opening and elapsed months plus one at closing. Labels expose the final month and planned primary age, including the 80-year cap; help explains locked pots, future pension tax, active partner scope and that the horizon is not a death prediction. Existing shortfall status remains visible in the withdrawal card.

The marker now shows age at the start of the retirement month; full date remains in its accessible description and chart axis. Tests cover birthday day/month boundaries and invalid dates, final partial-year/month balances, inflation timing, active partner totals, depletion, out-of-range retirement and the horizon cap.

## Personal State Pension and total-income mode (3 November 2026)
Added explicit personal forecasts in guided setup and a non-destructive existing-plan dialog. No entitlement or claim age is guessed. Weekly forecasts become average monthly income; chosen increase starts at the projection start. Active partners retain separate income dates and tax ownership. Existing State Pension records are updated rather than duplicated; excluded partner and unrelated income data are preserved.

Schema v3 adds an explicit pots-only versus total-gross-income target mode. Strictly validated v1/v2 files migrate to pots-only without changing their existing target. In total-income mode actual active gross pension income offsets that month's target before scheduled/recurring pot withdrawals. Surplus income is not reinvested. Taxes remain frozen at 2026/27, with later changes including April 2027 explicitly unmodelled. Net lifestyle income is not promised.

166 automated tests, syntax/build and exact eleven-file publishing payload pass. Independent model review passed 41,472 monthly conservation checks, bridge timing, per-owner tax, event offsets, surplus, migration and precision-preserving State Pension upserts. Independent desktop browser review passed empty/default/invalid forecasts, self+partner setup, combined-mode review, bridge and claim-date pot changes, explicit legacy-mode switching, cancellation, pending edits and repeated updates without duplicates. Mobile rendering and browser saved-file migration were not exercised; migration and file roundtrips are covered programmatically.

## State Pension wizard defaults

178 tests, syntax/build and exact twelve-asset publishing checks pass. New plans include the 2026/27 full-new-rate illustration (£241.30/week) with 2.5% nominal growth, editable/off per person. Official timetable transitions and month-end clamps are tested; approximate age-based birth dates and first-full-month timing are disclosed. Older cohorts without enough eligibility detail require personal values. Explicit custom dates survive repeated age/default collisions and partner toggles. Existing plans remain unchanged.

Independent model review passed official date boundaries, weekly conversion, escalation applied once, claim bridge, partner exclusion and legacy preservation. Desktop browser QA passed defaults for ages47/49, custom amount/date, off/zero, Back/Next, older-cohort explanation, left-menu editing, focus return and rapid Cancel/reopen. Mobile rendering and browser saved-file loading remain untested. PowerShell runtime unavailable; publisher parity/security tests pass.

## Quick growth controls

184 tests, syntax/build and twelve-asset payload checks pass. Pure helpers preserve mixed rates, decimal precision, excluded partners, fees, incomes and scenario spread; reject whole-group out-of-bounds steps; and retain exact plan-file roundtrips. Independent model checks verified a known one-year balance under base/lower/higher growth after fees.

Actual desktop browser checks passed the matching three-control row, ±0.5 steps, live chart and editor updates, pending edits/keyboard focus, mixed-range shifts, excluded/included partner, upper/lower bounds and scenario separation. Mobile rendering and browser file loading remain untested; save/load roundtrips are covered programmatically. No deployment was performed.

## Income stages and graph annotations

218 tests, syntax/build and fourteen-asset publishing checks pass. Strict v4 plans support up to 10 ordered age changes while preserving baseline amounts, mode and one inflation anchor. Legacy v1–v3 files migrate to flat plans without changing existing values. Independent financial review verified exact birthday boundaries, delayed retirement, zero/out-of-horizon stages, partner income, event offsets and per-owner tax, plus 34,560 monthly reconciliation checks.

Independent desktop browser checks passed flat default, duplicate-age validation, stage creation/removal, selected-stage £1,000 adjustments, zero targets, transactional Cancel/Escape, pending edits, ledger target changes, State Pension offsets and graph/end-pot changes. Purple State Pension start and red depletion markers were visually checked, with distinct staggered labels and notes. The growth-scenario row is absent and the three base-growth controls remain. Numerical marker tests cover starting zero, locked balances, tiny positive balances, recovery and partner exclusion. Mobile rendering, browser saved-file migration and every possible marker overlap combination were not browser-tested. File migrations and roundtrips are covered programmatically. PowerShell runtime unavailable; exact publishing parity/security checks pass. No deployment performed.

## Inline income ranges

Income ranges are now directly visible in the retirement-scenario card; the modal and selected-stage picker are removed. Each row has its own amount, £1,000 buttons, boundary age and removal action. Valid edits recalculate immediately. Invalid or unfinished drafts retain their values, focus and caret, and block other plan-changing actions rather than being discarded. New/load resets are explicit. Underlying schema and projection maths are unchanged.

222 tests, syntax/build and fourteen-asset checks pass. Independent calculation/state review verified unchanged projections after rebuild, isolated edits, zero targets, pending detailed settings, retirement-stage selection and file compatibility. Independent desktop browser review passed visible row layout, add/remove, per-row controls, graph updates, invalid-age recovery, pending-edit retention and keyboard focus. Decimal-safe arithmetic fixes were verified with baseline £0.10 and staged £500.10 keyboard +/− cycles; exact repeat-step and JSON roundtrip tests cover higher precision too. Remove-button accessible names track edited ages. Mobile rendering and browser saved-file loading remain untested; roundtrips and migrations are tested programmatically. No deployment performed.

## Calendar-year income table

Retirement timing now appears first, followed by a native three-column table with From year, End year and Annual amount before tax. Each editable end year sets one shared exclusive boundary; the following row mirrors its exact month/year and primary-person age. The final cell shows the actual model horizon, including a partial final year and the 80-year cap. The footer adds a row by copying the previous amount. Amount buttons remain decimal-safe.

The underlying age stages and schema are unchanged. Date-of-birth changes preserve saved ages and refresh calendar labels; simultaneous unfinished year and birth-date edits are rejected rather than silently reinterpreted. Independent numerical review checked 540 birthday/year inverses, December and leap boundaries, monthly pension/withdrawal offsets, partial horizons and unchanged save/load projections. Mobile rendering and browser file loading remain untested; responsive styles and programmatic roundtrips are checked. No deployment performed.

All 230 tests, syntax/build and fourteen-asset payload checks pass. Independent desktop screenshot and interaction checks passed retirement-first order, table alignment, contiguous dates, decimal amount steps, duplicate-year validation/recovery, live graph changes, pending edits and focus.

## Review corrections — 3 November 2026

All 240 unit and HTTP tests, syntax checks for every browser/tooling module, static build and exact fourteen-asset payload verification pass on Windows with Node 24. The server regression verifies Windows and POSIX path handling and actually requests the homepage, stylesheet and every browser module; private publisher/source-plan paths return 404.

The scenario headline now highlights the first spending deficit independently of the gross withdrawal target. A full-year regression with a £24,000 gross target and £2,000 monthly spending reports £1,857.22 available after modelled tax and a £142.78 gap, despite the gross target being funded. Coverage includes zero targets, simultaneous gross/net gaps, display-money conversion and monthly deficits hidden by annual surpluses. No automatic gross-up or financial-engine changes were introduced.

Item additions validate an independent candidate before updating the live plan. Regression cases cover already-retired plans, future income beyond 2100, collection limits, duplicate IDs, active pot selection, save/reload and removal. Detailed editor markup lives in the display module; open settings sections survive editor rebuilds.

Actual headless Microsoft Edge checks passed at 1365×1000 and 390×844: startup, cancelled and completed setup, required-field validation, spending warning and styling, add/apply/save/remove for pots/incomes/events, invalid pending-edit preservation, file download and reload, and no horizontal overflow or browser exceptions. Desktop/mobile card screenshots were visually inspected. Narrow desktop-browser emulation is not physical-device or assistive-technology certification.

GitHub Actions is configured to run the core checks on Windows/Linux with Node 22/24 and optional Chromium browser checks on Linux. These hosted jobs have not run in this session. Browser tooling is development-only and is excluded from the public payload. No source push or deployment was performed.

## Compact scenario and State Pension display — 3 November 2026

247 tests, syntax checks for all source/tooling modules, build and exact fourteen-asset payload verification pass. Browser checks pass in Microsoft Edge at 1365×900 and 390×844, including collapsed forecast details, custom forecasts retained through Back/Next, automatic disclosure on validation errors, live amount changes, saved files and no horizontal overflow. The tested two-period desktop card is under 430px high, and the complete wealth plot fits in the same 900px-high viewport as its controls when the results section is aligned to the top. Screenshots of the wizard, desktop/mobile controls and purple income line were inspected.

The From/Until table retains exact birthday-month boundaries and shows matching ages. Change income later adds a period; an effective-range summary describes the sequence and excludes unused before-retirement/out-of-horizon changes. Invalid drafts preserve raw text and last valid chart values. Pot summary values follow the wealth chart to keep the graph immediately beside the comparison workflow.

State Pension has separate gross/net component fields on monthly and annual projection rows. Its net series subtracts only its share of existing per-owner modelled tax. Regression tests cover partner inclusion and Scottish tax, escalation and payment dates, partial calendar years, inflation display, no-payment cases, and identical pot balances, total cash and total tax when equivalent income is classified as DB instead. Purple is a labelled component of total income, not an extra cash flow or wealth balance. The saved schema remains v4. No deployment performed.
