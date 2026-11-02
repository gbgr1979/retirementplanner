import test from 'node:test';import assert from 'node:assert/strict';
import {discountFactor,retirementSnapshot,escapeHTML} from '../src/view.js';
import {createExamplePlan} from '../src/plan.js';
test('inflation discount includes every modelled month including partial final year',()=>{let p=createExamplePlan();p.inflation=12;assert.equal(discountFactor(p,[{month:'2026-11'},{month:'2026-12'}],2026),1.12**(2/12));assert.equal(discountFactor(p,[{month:'2027-02'}],2027),1.12**(4/12));assert.equal(discountFactor(p,[],2026,false),1);});
test('primary person identity independent of imported array order',()=>{let p=createExamplePlan();p.people.reverse();assert.deepEqual(retirementSnapshot(p,[{year:2044},{year:2046}]),{year:{year:2044},withinHorizon:true});});
test('retirement outside horizon is not mislabeled retirement year',()=>{let p=createExamplePlan();p.people.find(x=>x.id==='you').retirementMonth='2100-01';assert.deepEqual(retirementSnapshot(p,[{year:2074}]),{year:{year:2074},withinHorizon:false});});
test('user text is HTML escaped including attribute delimiters',()=>assert.equal(escapeHTML('<img src="x" onerror=\'alert(1)\'>&'), '&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt;&amp;'));
