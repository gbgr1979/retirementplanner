import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
test('entry assets exist and runtime stays first-party with no implicit persistence',async()=>{
 const html=await readFile('index.html','utf8');
 for(const [,asset] of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)){assert.ok(!asset.startsWith('http'));await readFile(asset);}
 const app=await readFile('src/app.js','utf8');assert.doesNotMatch(app,/\b(?:localStorage|sessionStorage|indexedDB|fetch|XMLHttpRequest)\b/);
 const config=JSON.parse(await readFile('staticwebapp.config.json','utf8'));assert.match(config.globalHeaders['Content-Security-Policy'],/connect-src 'none'/);assert.match(config.globalHeaders['Content-Security-Policy'],/script-src 'self'/);
});
test('wizard modules are explicitly shipped and have no implicit persistence or network',async()=>{
 const {staticFiles}=await import('../scripts/static-files.mjs');
 assert.ok(staticFiles.includes('src/wizard-plan.js'));assert.ok(staticFiles.includes('src/wizard-ui.js'));
 for(const file of ['src/wizard-plan.js','src/wizard-ui.js'])assert.doesNotMatch(await readFile(file,'utf8'),/\b(?:localStorage|sessionStorage|indexedDB|fetch|XMLHttpRequest)\b/);
 const html=await readFile('index.html','utf8');assert.match(html,/<button id="start-wizard"/);assert.match(html,/<dialog id="setup-wizard" aria-labelledby="wizard-title"/);
});
test('initial HTML never flashes example dashboard before JavaScript',async()=>{const html=await readFile('index.html','utf8');for(const id of ['planner-view','plan-actions','skip-projection'])assert.match(html,new RegExp(`<[^>]+id="${id}"[^>]* hidden`));assert.match(html,/<section id="landing"/);assert.match(html,/id="load-home"/);const app=await readFile('src/app.js','utf8');assert.match(app,/for\(const id of \['load','load-home'\]/);assert.match(app,/plan=loaded[\s\S]*?updatePlanScreen\(document,'planAccepted'\)/);assert.match(app,/onComplete:freshPlan=>[\s\S]*?updatePlanScreen\(document,'planAccepted'\)/);});
test('landing copy describes starting assets, projections and planned withdrawals without sustainability promises',async()=>{
 const html=await readFile('index.html','utf8');const landing=html.match(/<section id="landing"[\s\S]*?<\/section>/)[0];
 assert.match(landing,/savings, investments and pensions today/);assert.match(landing,/what they could be worth/);assert.match(landing,/planned withdrawals change your balances over time/);assert.doesNotMatch(landing,/safe withdrawal|sustainable withdrawal|guarantee|how long your money will last/i);
});

test('currency presentation is shared across editor wizard and annual control without changing model schema',async()=>{
 const app=await readFile('src/app.js','utf8'),wizard=await readFile('src/wizard-ui.js','utf8'),html=await readFile('index.html','utf8');
 for(const source of [app,wizard]){assert.match(source,/formatMoneyValue/);assert.match(source,/parseMoneyInput/);assert.match(source,/label.includes\('£'\)/);assert.match(source,/data-money/);}
 assert.match(html,/id="withdrawal-amount" type="text" data-money inputmode="decimal"/);
 const {staticFiles}=await import('../scripts/static-files.mjs');assert.ok(staticFiles.includes('src/money-input.js'));
});
