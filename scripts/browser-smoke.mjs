import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdir, readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createAppServer} from './serve.mjs';
import {createExamplePlan, parsePlan} from '../src/plan.js';

// Optional development dependency; never included in the public website.
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.RETIREMENT_PLAYWRIGHT_PATH || 'playwright');
const server = createAppServer();
server.listen(0, '127.0.0.1');
await once(server, 'listening');
let browser;
let activePage;
try {
  browser = await chromium.launch({channel:process.env.RETIREMENT_BROWSER_CHANNEL || undefined});
  await mkdir('test-results', {recursive:true});
  for (const [name, viewport] of [['desktop', {width:1365, height:900}], ['mobile', {width:390, height:844}]]) {
    const context = await browser.newContext({viewport, acceptDownloads:true});
    const page = await context.newPage();
    activePage = page;
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.locator('#start-wizard').click();
    await page.locator('#wizard-cancel').click();
    assert.equal(await page.locator('#planner-view').isHidden(), true);
    await page.locator('#start-wizard').click();
    await page.locator('#wizard-next').click();
    assert.equal(await page.locator('#wizard-errors').isVisible(), true);
    await page.locator('#setup-wizard [name="you.age"]').fill('67');
    await page.locator('#wizard-next').click();
    assert.equal(await page.locator('#wizard-you-statePension-enabled').isChecked(), true);
    assert.equal(await page.locator('#wizard-state-you').evaluate(el => el.open), false);
    assert.equal(await page.locator('#wizard-you-statePension-weeklyAmount').isVisible(), false);
    await page.locator('#setup-wizard').screenshot({path:`test-results/compact-wizard-${name}.png`});
    await page.locator('#wizard-state-you > summary').click();
    await page.locator('#wizard-you-statePension-weeklyAmount').fill('250');
    await page.locator('#wizard-back').click();
    await page.locator('#wizard-next').click();
    assert.equal(await page.locator('#wizard-you-statePension-weeklyAmount').inputValue(), '250');
    await page.locator('#wizard-state-you > summary').click();
    await page.locator('#wizard-you-statePension-weeklyAmount').fill('');
    await page.locator('#wizard-state-you > summary').click();
    await page.locator('#wizard-next').click();
    assert.equal(await page.locator('#wizard-state-you').evaluate(el => el.open), true);
    assert.equal(await page.locator('#wizard-you-statePension-weeklyAmount').getAttribute('aria-invalid'), 'true');
    await page.locator('#wizard-you-statePension-weeklyAmount').fill('250');
    await page.locator('#setup-wizard [name="pots.2.balance"]').fill('200000');
    await page.locator('#wizard-next').click();
    await page.locator('#wizard-next').click();
    await page.locator('#wizard-next').click();
    await page.locator('#planner-view').waitFor({state:'visible'});

    // Partner fields follow the checkbox immediately, retaining unapplied edits.
    const partnerSection = page.locator('#editor [data-person="partner"]');
    const includePartner = page.locator('#editor [name="includePartner"]');
    assert.equal(await partnerSection.isVisible(), false);
    await includePartner.check();
    assert.equal(await partnerSection.isVisible(), true);
    const partnerName = partnerSection.locator('[name$=".name"]');
    await partnerName.fill('Partner draft');
    await includePartner.uncheck();
    assert.equal(await partnerSection.isVisible(), false);
    await includePartner.check();
    assert.equal(await partnerName.inputValue(), 'Partner draft');
    await includePartner.uncheck();
    await page.locator('#editor button[type="submit"]').click();
    assert.equal(await partnerSection.isVisible(), false);
    const partnerDownloadEvent = page.waitForEvent('download');
    await page.locator('#save').click();
    const partnerSaved = parsePlan(await readFile(await (await partnerDownloadEvent).path(), 'utf8'));
    assert.equal(partnerSaved.includePartner, false);
    assert.equal(partnerSaved.people.find(person => person.id === 'partner').name, 'Partner draft');
    await page.locator('#file').setInputFiles({name:'partner-hidden.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(partnerSaved))});
    assert.equal(await partnerSection.isVisible(), false);
    await includePartner.check();
    assert.equal(await partnerSection.isVisible(), true);
    assert.equal(await partnerName.inputValue(), 'Partner draft');
    await includePartner.uncheck();

    const plan = createExamplePlan();
    Object.assign(plan, {startMonth:'2026-04', endAge:68, inflation:0, spendingStart:'2026-04', monthlySpending:2000, events:[]});
    Object.assign(plan.people[0], {dob:'1959-04-01', retirementMonth:'2025-04'});
    plan.drawdown = {mode:'totalIncome', annualAmount:24000, inflationLinked:false, stages:[]};
    plan.pots = [{...plan.pots[2], balance:100000, growth:0, fee:0, monthlyContribution:0, employerContribution:0}];
    plan.incomes = [{id:'state', name:'State Pension', owner:'you', type:'state', monthlyAmount:241.30*52/12, startMonth:'2026-04', endMonth:'2250-12', escalation:0}];
    await page.locator('#file').setInputFiles({name:'fictional-review-plan.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(plan))});
    await page.locator('#planner-view').waitFor({state:'visible'});
    await page.waitForFunction(() => document.getElementById('withdrawal-status').textContent.includes('£142.78'));
    assert.match(await page.locator('#withdrawal-status').textContent(), /^Spending gap.*£1,857\.22 available against £2,000\.00/);
    assert.equal(await page.locator('#withdrawal-status').evaluate(el => el.classList.contains('has-gap')), true);

    // A retired plan can add, apply, save and remove all three kinds of item.
    for (const collection of ['pots', 'incomes', 'events']) {
      const details = page.locator(`#editor [data-add="${collection}"]`).locator('xpath=ancestor::details[1]');
      await details.evaluate(el => { el.open = true; });
      await page.locator(`#editor [data-add="${collection}"]`).click();
      const index = collection === 'events' ? 0 : 1;
      await page.locator(`[name="${collection}.${index}.name"]`).waitFor();
      await page.locator('#editor button[type="submit"]').click();
      const downloadEvent = page.waitForEvent('download');
      await page.locator('#save').click();
      const download = await downloadEvent;
      const saved = parsePlan(await readFile(await download.path(), 'utf8'));
      assert.equal(saved[collection].length, index + 1);
      if (collection === 'pots') {
        assert.equal(saved.pots.at(-1).contributionStart, plan.startMonth);
        assert.equal(saved.pots.at(-1).contributionEnd, plan.startMonth);
      }
      await page.locator(`[data-remove="${collection}:${index}"]`).click();
      assert.equal(await page.locator(`[name="${collection}.${index}.name"]`).count(), 0);
    }

    // An invalid pending edit blocks additions without being lost or applied.
    const metrics = await page.locator('#metrics').textContent();
    await page.locator('[name="pots.0.balance"]').fill('');
    await page.locator('[data-add="pots"]').click();
    assert.equal(await page.locator('[name="pots.1.name"]').count(), 0);
    assert.equal(await page.locator('[name="pots.0.balance"]').inputValue(), '');
    assert.equal(await page.locator('#metrics').textContent(), metrics);
    assert.equal(await page.locator('#message').isVisible(), true);
    await page.locator('[name="pots.0.balance"]').fill('100000');
    await page.locator('#editor button[type="submit"]').click();

    // Save/reload through the actual browser file handlers.
    const downloadEvent = page.waitForEvent('download');
    await page.locator('#save').click();
    const saved = parsePlan(await readFile(await (await downloadEvent).path(), 'utf8'));
    await page.reload();
    await page.locator('#file').setInputFiles({name:'roundtrip.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(saved))});
    await page.locator('#planner-view').waitFor({state:'visible'});
    await page.waitForFunction(() => document.getElementById('withdrawal-status').textContent.includes('£142.78'));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name}: horizontal overflow`);
    await page.screenshot({path:`test-results/review-fixes-${name}.png`, fullPage:true});
    await page.locator('.withdrawal-card').screenshot({path:`test-results/review-fixes-${name}-card.png`});
    const comparison = createExamplePlan();
    comparison.people[0].retirementMonth = '2039-11';
    comparison.drawdown = {mode:'totalIncome', annualAmount:40000, inflationLinked:true, stages:[{fromAge:70, annualAmount:20000}]};
    comparison.events = []; comparison.monthlySpending = 2000; comparison.spendingStart = '2039-11';
    comparison.pots[0].balance = 140000; comparison.pots[0].monthlyContribution = 0;
    comparison.pots[2].balance = 240000; comparison.pots[2].monthlyContribution = 2000; comparison.pots[2].employerContribution = 0;
    comparison.incomes[0].startMonth = '2047-11'; comparison.incomes[0].monthlyAmount = 241.30*52/12;
    await page.locator('#file').setInputFiles({name:'fictional-comparison.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(comparison))});
    await page.waitForFunction(() => document.getElementById('is-income-summary').textContent.includes('£40,000'));
    assert.match(await page.locator('#is-income-summary').textContent(), /£40,000 a year until age 70, then £20,000 a year to plan end/);
    const beforePath = await page.locator('#wealth-chart').innerHTML();
    const withdrawalLine=page.locator('#wealth-chart polyline[data-axis="right"]');
    assert.equal(await withdrawalLine.getAttribute('stroke'),'#1d5fa6');
    const withdrawalPoints=await withdrawalLine.getAttribute('points');
    await page.locator('#is-plus--1').click();
    assert.notEqual(await page.locator('#wealth-chart').innerHTML(), beforePath);
    assert.notEqual(await withdrawalLine.getAttribute('points'),withdrawalPoints);
    await page.locator('#is-minus--1').click();
    await page.locator('#nominal').click();
    assert.notEqual(await withdrawalLine.getAttribute('points'),withdrawalPoints);
    await page.locator('#real').click();
    assert.equal(await withdrawalLine.getAttribute('points'),withdrawalPoints);
    await page.locator('#results').evaluate(el => el.scrollIntoView({block:'start'}));
    const card = await page.locator('.withdrawal-card').boundingBox();
    const graph = await page.locator('#wealth-chart').boundingBox();
    if (name === 'desktop') {
      assert.ok(card.height < 430, `Scenario card too tall: ${card.height}`);
      assert.ok(graph.y + graph.height < viewport.height, 'Graph should remain visible with scenario controls');
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name}: comparison overflow`);
    const stateLine = page.locator('#income-chart polyline[data-series="State Pension (included in total cash)"]');
    assert.equal(await stateLine.getAttribute('stroke'), '#74479b');
    assert.ok((await stateLine.getAttribute('points')).split(' ').some(point => Number(point.split(',')[1]) < 226));
    await page.screenshot({path:`test-results/compact-scenario-${name}.png`});
    await page.locator('.wealth-card').screenshot({path:`test-results/withdrawal-overlay-${name}.png`});
    await page.locator('.withdrawal-card').screenshot({path:`test-results/compact-scenario-${name}-card.png`});
    await page.locator('#income-chart').locator('xpath=ancestor::article[1]').screenshot({path:`test-results/state-pension-income-${name}.png`});
    assert.deepEqual(errors, [], `${name}: browser errors`);
    await context.close();
    console.log(`${name}: startup, spending warning, item edits, invalid-edit preservation, save/load and layout passed.`);
  }
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({path:'test-results/browser-failure.png', fullPage:true}).catch(() => {});
  }
  throw error;
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
