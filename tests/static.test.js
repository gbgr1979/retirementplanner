import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
test('entry assets exist and runtime stays first-party with no implicit persistence',async()=>{
 const html=await readFile('index.html','utf8');
 for(const [,asset] of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)){assert.ok(!asset.startsWith('http'));await readFile(asset);}
 const app=await readFile('src/app.js','utf8');assert.doesNotMatch(app,/\b(?:localStorage|sessionStorage|indexedDB|fetch|XMLHttpRequest)\b/);
 const config=JSON.parse(await readFile('staticwebapp.config.json','utf8'));assert.match(config.globalHeaders['Content-Security-Policy'],/connect-src 'none'/);assert.match(config.globalHeaders['Content-Security-Policy'],/script-src 'self'/);
});
