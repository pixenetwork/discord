import test from 'node:test';
import assert from 'node:assert/strict';
import {collectAquapediaCitationLinks} from '../src/aquapedia-source-citation-audit.mjs';
test('count only explicit third-party research links, not tracking, discord, or own website',()=>{
 const html='<a href="https://doi.org/10.1643/CI-10-008">Published</a><a href="https://aquapedia.app/x/">own</a><a href="https://discord.com/channels/123">thread</a><script src="https://static.cloudflareinsights.com/a.js"></script>';
 const result=collectAquapediaCitationLinks('https://aquapedia.app/plecopedia/research/x/',html);
 assert.deepEqual(result.links,['https://doi.org/10.1643/CI-10-008']);
 assert.equal(result.externalCitationCount,1);
 assert.equal(result.claimVerified,false);
});
test('Cory section anchors must have local report citations; unrelated sibling links cannot substitute',()=>{
 const html='<article id="panda"><a href="https://scotcat.com/articles/panda.html">source</a></article><article id="sterbai"><p>report without cited link</p></article>';
 assert.equal(collectAquapediaCitationLinks('https://aquapedia.app/corydoraspedia/breeding/#panda',html).externalCitationCount,1);
 assert.equal(collectAquapediaCitationLinks('https://aquapedia.app/corydoraspedia/breeding/#sterbai',html).externalCitationCount,0);
 assert.throws(()=>collectAquapediaCitationLinks('https://aquapedia.app/corydoraspedia/breeding/#missing',html),/Citation audit/);
});
test('Cory fragment cannot be satisfied by general parent-page links outside its own article',()=>{
 const html='<header><a href="https://journal.org/any">generic</a></header><article class="cory-report" id="panda"><p>uncited</p></article>';
 assert.equal(collectAquapediaCitationLinks('https://aquapedia.app/corydoraspedia/breeding/#panda',html).externalCitationCount,0);
});
test('untrusted URLs and malformed sources fail closed',()=>{
 for(const url of ['https://evil.org/x','http://aquapedia.app/plecopedia/research/x/','https://aquapedia.app/guppypedia/entries/gup-001/?bad=1']){
  assert.throws(()=>collectAquapediaCitationLinks(url,'<a href="https://doi.org/x">x</a>'),/Citation audit/);
 }
 assert.throws(()=>collectAquapediaCitationLinks('https://aquapedia.app/plecopedia/research/x/',null),/Citation audit/);
});
