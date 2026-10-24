import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const manifest=JSON.parse(fs.readFileSync(new URL('../resources/aquapedia-cross-taxa-release-review-20261021.json',import.meta.url),'utf8'));
const inventory=JSON.parse(fs.readFileSync(new URL('../resources/aquapedia-cross-taxa-citation-presence-20261021.json',import.meta.url),'utf8'));
test('all 143 unique proposed URLs have scoped third-party links, never a verified pedigree badge',()=>{
 const urls=[...new Set(manifest.proposals.flatMap(x=>x.sourceUrls))].sort();
 assert.equal(urls.length,143);
 assert.deepEqual(inventory.records.map(x=>x.url).sort(),urls);
 assert.equal(inventory.uniqueFetchedPages,134);
 assert.deepEqual(inventory.counts,{guppy:48,corydoras:10,pleco:85});
 assert.deepEqual(inventory.missing,{guppy:0,corydoras:0,pleco:0});
 assert.ok(inventory.records.every(x=>x.externalCitationCount>0 && !x.claimVerified && !x.mediaRightsVerified));
 assert.equal(inventory.discordWrites,0);
 assert.equal(inventory.publicationAuthorized,false);
});
test('Cory evidence is from section-local links, not sources elsewhere on a shared page',()=>{
 const cory=inventory.records.filter(x=>x.url.includes('/corydoraspedia/'));
 assert.equal(cory.length,10);
 assert.ok(cory.every(x=>x.sourceScope==='anchor-local'));
 assert.ok(cory.every(x=>x.links.length>=1));
});
test('Guppy judging standard is evidence of phenotype names only',()=>{
 const guppy=inventory.records.filter(x=>x.url.includes('/guppypedia/'));
 assert.equal(guppy.length,48);
 assert.ok(guppy.every(x=>x.links.includes('https://ikgh.org/wp-content/uploads/2023/05/IHS-Version-2023.pdf')));
 assert.ok(guppy.every(x=>x.claimVerified===false));
});
