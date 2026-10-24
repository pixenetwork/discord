import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../tools/aquapedia-article-content-watch-20261015.mjs',import.meta.url),'utf8');
const start=source.indexOf('  const privateDestination=c=>{');
const end=source.indexOf('  // Guard only destinations',start);
assert.ok(start>=0&&end>start,'Find actual publisher permission gate');
const build=new Function('guild','channels','PermissionFlagsBits',source.slice(start,end)+'return privateDestination;');
const guild='guild-1',researchCat='research-parent',bit=1024n;
const parent={id:researchCat,name:'Research category',permission_overwrites:[{id:guild,deny:'1024',allow:'0'}]};
const privateDestination=child=>build(guild,[parent,child],{ViewChannel:bit})(child);

test('unsynced child remains unsafe despite parent @everyone deny',()=>{
 const child={id:'child',name:'Unsynced public child',parent_id:researchCat,permission_overwrites:[]};
 assert.throws(()=>privateDestination(child),/PRIVACY_BLOCK/);
});
test('child with explicit @everyone ViewChannel deny is permitted',()=>{
 const child={id:'child',name:'Private child',parent_id:researchCat,permission_overwrites:[{id:guild,allow:'0',deny:'1024'}]};
 assert.doesNotThrow(()=>privateDestination(child));
});
test('explicit child @everyone allow is rejected even with parent deny',()=>{
 const child={id:'child',name:'Public child',parent_id:researchCat,permission_overwrites:[{id:guild,allow:'1024',deny:'0'}]};
 assert.throws(()=>privateDestination(child),/PRIVACY_BLOCK/);
});
test('the publisher disables automatic REST retries for ambiguous Discord POST outcomes',()=>{
 const match=source.match(/new REST\((\{[^)]*\})\)\.setToken\(token\)/);
 assert.ok(match,'Find publisher REST client options');
 const options=new Function('return '+match[1])();
 assert.equal(options.retries,0);
});
