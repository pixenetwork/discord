import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogFromSource,priorityRecords,PRIORITY_NAMES} from '../tools/corydoras-forum-publisher.mjs';

test('directory priority names resolve to 45 unique existing source records',()=>{
  const records=catalogFromSource();
  assert.equal(records.length,528);
  assert.equal(PRIORITY_NAMES.length,45);
  assert.equal(new Set(PRIORITY_NAMES.map(x=>x.toLowerCase())).size,45);
  const selected=priorityRecords(records);
  assert.deepEqual(selected.missing,[]);
  assert.equal(selected.matches.length,45);
  assert.equal(new Set(selected.matches.map(x=>x.id)).size,45);
});
test('three historical priority names point to existing directory IDs',()=>{
  const records=catalogFromSource();
  const byName=new Map(records.map(x=>[x.name,x]));
  assert.equal(byName.get('Brochis arcuata')?.id,'829');
  assert.equal(byName.get('Gastrodermus napoensis')?.id,'417');
  assert.equal(byName.get('Gastrodermus pauciradiatum')?.id,'273');
  for(const name of ['Hoplisoma arcuatum','Hoplisoma napoense','Aspidoras pauciradiatus']){
    assert.equal(byName.has(name),false);
    assert.equal(PRIORITY_NAMES.includes(name),false);
  }
  assert.equal(records.filter(r=>/pauciradiat|napoens|arcuat/i.test(r.name)).length,3);
});
