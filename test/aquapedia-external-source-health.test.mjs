import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeCitationHeadAccessibility} from '../src/aquapedia-external-source-health.mjs';
const source={records:[
 {url:'https://aquapedia.app/plecopedia/research/a/',links:['https://doi.org/a','https://scotcat.com/a']},
 {url:'https://aquapedia.app/plecopedia/research/b/',links:['https://doi.org/a']},
 {url:'https://aquapedia.app/guppypedia/entries/gup-001/',links:['https://ikgh.org/a']}
]};
const refs=[
 {url:'https://doi.org/a',status:403,outcome:'http_status'},
 {url:'https://scotcat.com/a',status:200,outcome:'reachable_head'},
 {url:'https://ikgh.org/a',status:200,outcome:'reachable_head'}
];
test('HEAD-only source health classifies restrictions as unconfirmed, not broken articles',()=>{
 const p=summarizeCitationHeadAccessibility(source,refs);
 assert.deepEqual(p.refTotals,{checked:3,reachableByHead:2,inaccessibleByHead:1});
 assert.deepEqual(p.pageTotals,{audited:3,hasReachableSource:2,onlyRestrictedSources:1});
 assert.deepEqual(p.affectedUrls,['https://aquapedia.app/plecopedia/research/b/']);
 assert.equal(p.sourceClaimsVerified,false);
 assert.equal(p.linksProvenBroken,0);
});
test('missing a cited source result fails closed',()=>{
 assert.throws(()=>summarizeCitationHeadAccessibility(source,refs.slice(1)),/Citation health/);
});
test('duplicate or phantom sources are rejected rather than counted twice',()=>{
 assert.throws(()=>summarizeCitationHeadAccessibility(source,[...refs,refs[0]]),/Citation health/);
 assert.throws(()=>summarizeCitationHeadAccessibility(source,[...refs,{url:'https://unknown.org/',status:200,outcome:'reachable_head'}]),/Citation health/);
});
