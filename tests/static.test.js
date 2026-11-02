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
