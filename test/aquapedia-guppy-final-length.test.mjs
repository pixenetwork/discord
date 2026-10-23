import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildCrossTaxaReleaseGate} from '../src/aquapedia-cross-taxa-release-gate.mjs';
const fixture=name=>JSON.parse(fs.readFileSync(new URL('./fixtures/'+name,import.meta.url),'utf8'));
const records=[
 ...fixture('guppypedia-source-20261021.json'),
 ...fixture('plecopedia-public-source-20261021.json'),
 ...fixture('corydoraspedia-thread-review-20261021.json').records.map(({name,slug,url,type,status})=>({name,slug,url,type,status,group:'corydoras'}))
];
const snapshots={guppy:fixture('guppypedia-forum-starters-20261021.json'),
 cory:fixture('corydoraspedia-thread-review-20261021.json'),
 pleco:fixture('plecopedia-thread-parity-20261021.json')};
test('final review-wrapped Guppy content remains under 1,900 UTF-16 code units',()=>{
 const gate=buildCrossTaxaReleaseGate(records,snapshots,{now:'2026-10-22T02:10:00.000Z'});
 assert.equal(gate.proposals.length,99);
 assert.ok(gate.proposals.every(p=>p.content.length<=1900));
 assert.ok(gate.proposals.filter(x=>x.group==='guppy').every(x=>x.content.includes('Not a verified pedigree')));
});
