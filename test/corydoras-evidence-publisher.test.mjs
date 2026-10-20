import test from 'node:test';
import assert from 'node:assert/strict';
import {evidencePacket} from '../tools/corydoras-forum-publisher.mjs';

test('Corydoradinae evidence publisher packet is a single safe source-linked research update',()=>{
  const p=evidencePacket();
  assert.ok(p.content.length>800 && p.content.length<=2000);
  for(let n=1;n<=8;n++)assert.ok(p.content.includes('\n'+n+'. **'));
  assert.ok(p.content.includes('Research draft'));
  assert.ok(p.content.includes('https://doi.org/10.1093/zoolinnean/zlaf035'));
  assert.ok(p.content.includes('https://doi.org/10.1007/BF00002344'));
  assert.ok(p.content.includes('https://doi.org/10.1038/nature09660'));
  assert.equal(p.embeds.length,1);
  assert.ok(p.embeds[0].footer.text.startsWith('AQP-CORY-evidence-eight-topics-20261019'));
  assert.deepEqual(p.allowedMentions.parse,[]);
  assert.ok(!p.content.includes('discord.com/channels/'));
  assert.ok(!p.content.includes('github.com/pixenetwork/aquapedia'));
  assert.ok(!p.files);
});
