import test from 'node:test';
import assert from 'node:assert/strict';
import { publishAquapediaCards } from '../src/aquapedia-posts.mjs';

function makeCase({ completeSecondPage = true } = {}) {
  const events = [];
  const entry = { id: 'breeder-old', entityType: 'breeder', name: 'Old Breeder',
    organismGroup: 'shrimp', breederForumName: 'old-breeder', sources: ['https://example.com'] };
  const post = { id: 'm-old', author: { id: 'bot' },
    embeds: [{ footer: { text: 'Aquapedia • breeder-old • photos pending rights review' } }],
    async edit() { events.push('edit'); return post; } };
  const thread = { id: 't-old', name: 'Breeder profile — Old Breeder',
    archivedAt: new Date('2024-01-01T00:00:00Z'), archived: false,
    messages: { async fetch(q) { if(typeof q==='string') return post; return new Map([['m-old',post]]); } } };
  let page = 0;
  const forum = { id:'f', name: 'old-breeder', type: 15, parentId: 'cat', threads: {
    async fetchActive() { return { threads:new Map() }; },
    async fetchArchived(opts) {
      page++;
      if(page===1) return { threads:new Map([['t-recent',{id:'t-recent', name:'Unrelated', archivedAt:new Date('2025-01-01T00:00:00Z')}]]), hasMore:true };
      if(!completeSecondPage) throw new Error('archive page unavailable');
      assert.ok(opts.before,'must request older page');
      return { threads:new Map([['t-old',thread]]), hasMore:false };
    },
    async create() { events.push('DUPLICATE-CREATE'); return thread; }
  }};
  const category={id:'cat',name:'🔬・BREEDER RESEARCH',type:4};
  return { guild:{client:{user:{id:'bot'}},channels:{cache:new Map([['cat',category],['forum',forum]])}},entry,events, getPages:()=>page };
}
test('searches older archived pages before reusing an existing breeder thread',async()=>{
  const {guild,entry,events,getPages}=makeCase();
  const r=await publishAquapediaCards(guild,{status:'completed',discordPublicationApproved:true,cards:[entry]});
  assert.equal(getPages(),2);
  assert.equal(r.posted,1);
  assert.deepEqual(events,['edit']);
});
test('incomplete archived search never creates a possibly duplicate thread',async()=>{
  const {guild,entry,events}=makeCase({completeSecondPage:false});
  const r=await publishAquapediaCards(guild,{status:'completed',discordPublicationApproved:true,cards:[entry]});
  assert.equal(r.posted,0);
  assert.ok(!events.includes('DUPLICATE-CREATE'));
});
