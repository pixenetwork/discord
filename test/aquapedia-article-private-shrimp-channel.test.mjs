import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync(new URL('../tools/aquapedia-article-content-watch-20261015.mjs',import.meta.url),'utf8');
const start=src.indexOf('  const results=channels.find(');
const end=src.indexOf('  if(!results||!shrimps)',start);
assert.ok(start>=0&&end>start,'Find real article publisher destination discovery');
const discover=new Function('channels','ChannelType','researcher',src.slice(start,end)+'return {results,shrimps};');

const researcher={id:'private-research-cat'};
const forum={id:'public-guides',name:'🦐・shrimp-guides',type:0,parent_id:'public-cat'};
const privateShrimp={id:'private-shrimp-updates',name:'🦐・shrimp-research-updates',type:0,parent_id:researcher.id};
const researchResults={id:'research-results',name:'🧬・research-results',type:0,parent_id:researcher.id};
const types={GuildText:0};

test('publisher selects only dedicated shrimp research updates, not public shrimp-guides',()=>{
 const x=discover([forum,privateShrimp,researchResults],types,researcher);
 assert.equal(x.shrimps.id,'private-shrimp-updates');
 assert.equal(x.results.id,'research-results');
});
test('publisher refuses public shrimp-guides even if private destination is absent',()=>{
 const x=discover([forum,researchResults],types,researcher);
 assert.equal(x.shrimps,undefined);
});
test('publisher refuses a deceptive similarly named shrimp channel outside private research category',()=>{
 const outside={...privateShrimp,id:'fake-public',parent_id:'public-cat'};
 const x=discover([outside,forum,researchResults],types,researcher);
 assert.equal(x.shrimps,undefined);
});
test('historical shrimp receipt must not silently migrate its message ID to new channel',()=>{
 const src2=src.slice(src.indexOf('     const channel=dest(url),old=state.receipts[key];'),src.indexOf('     state.pages[url]=item;',src.indexOf('     const channel=dest(url),old=state.receipts[key];')));
 assert.match(src2,/old&&old\.channel!==channel/);
 assert.match(src2,/resolveArchivedReceiptChannel/);
 assert.match(src2,/const targetChannel=old\?\.channel\|\|channel/);
});
