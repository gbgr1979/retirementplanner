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

This is a locally built MVP prepared for initial source upload to `gbgr1979/retirementplanner`; it is not a published website. Financial model limitations are prominently shown in the app and README: gross-only scheduled withdrawals, no automatic drawdown or surplus carry-forward, incomplete/frozen tax estimate. This does not validate retirement sustainability or recommend a withdrawal strategy. Further specialist review is advisable before promoting it as a public financial planning tool.

## Guided setup update — 2 November 2026

Independent actual-browser checks passed: prominent homepage CTA; blank age, negative balance and out-of-range growth validation with focus; Back retains fields; partner toggle retains entered values; review totals; explicit replacement required; Escape preserves original unsaved editor and returns focus to CTA; completion updates model/charts and focuses results; repeated wizard Cancel preserves the existing plan and newer unsaved edit; keyboard Tab enters the first field.

Mobile responsive CSS was reviewed, but actual mobile/narrow-viewport rendering remains untested (no supported viewport control). Native dialog provides focus containment and Escape behaviour. Pure wizard tests cover fresh data/no guessed pension income, partner retention, ages/dates/horizon validation, one-count combined pension contributions, and ordinary pension-access boundary changes. No new dependency or user setup step was introduced. Both deployment paths explicitly include the wizard's two JavaScript modules in the nine-file public allowlist; standalone publishing client code is unchanged.

## Landing simplification — 2 November 2026

Initial HTML hides the workspace, financial actions and projection skip link before JavaScript, preventing an example-dashboard flash. Screen-state tests cover first display, accepted wizard/load, cancelled/failed flows, repeated acceptance and reload initialisation. Load and wizard completion handlers are checked to reveal the workspace only after acceptance. The existing nine-file public payload and standalone publisher are unchanged.

Final landing check: **66 tests**, syntax/build and nine-file payload verification passed. Independent actual desktop browser review confirmed calm initial landing; Cancel/Escape return to landing and focus; first completion with £12,345 reveals the matching planner; repeated New plan requires replacement consent; Cancel preserves £12,345 and a newer unsaved name edit. Successful file-load transition was checked in source/tests, not the browser because the file chooser requires separate approval. Actual mobile rendering remains untested.
