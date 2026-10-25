import test from 'node:test';
import assert from 'node:assert/strict';
import {planMedakaCardEdits} from '../src/medaka-lineage-card-plan.mjs';
const gid='1519337502379475095',channel='1563764327037669416';
const sample={slug:'akari',name:'Akari',source_url:'https://medakazukan.net/0242_akari/',source_title:'Zukan',
 evidence_state:'breeder_or_publication_reported',parents_or_stages:['Kinagashi'],claim_limits:'Breeder report only',
 site_url:'https://aquapedia.app/medakapedia/strains/akari/'};
const m={schema_version:1,aquapedia_commit:'8f8408200ead67435490ed0ddeed0001b2288964',trees:[sample]};
const id1='1561210349406126220',id2='1561231823407816817',id3='1563765446459785279';
const r={guildId:gid,channelId:channel,aquapediaHead:m.aquapedia_commit,
 records:{akari:{revision:m.aquapedia_commit,
  original:{threadId:id1,messageId:id2,url:'https://discord.com/channels/'+gid+'/'+id1+'/'+id2},
  index:{channelId:channel,messageId:id3,url:'https://discord.com/channels/'+gid+'/'+channel+'/'+id3}
 }}};
test('plans exactly two in-place edits to existing verified message IDs',()=>{
 const p=planMedakaCardEdits(m,r);
 assert.equal(p.ready,1);assert.equal(p.held,0);
 assert.deepEqual(p.entries[0].targets.map(x=>x.messageId),[id2,id3]);
 assert.equal(p.entries[0].card.components[0].components.length,3);
 assert.equal(p.entries[0].status,'ready_to_edit_existing_only');
});
test('unknown or missing receipts never produce new Discord messages',()=>{
 const p=planMedakaCardEdits(m,{...r,records:{}});
 assert.equal(p.ready,0);assert.equal(p.held,1);assert.equal(p.entries[0].targets,undefined);
});
test('fails closed on wrong user guild, source SHA or bad destination IDs',()=>{
 assert.throws(()=>planMedakaCardEdits(m,{...r,guildId:'other'}),/mismatch/);
 assert.throws(()=>planMedakaCardEdits(m,{...r,records:{akari:{...r.records.akari,revision:'bad'}}}),/revision/);
 assert.throws(()=>planMedakaCardEdits(m,{...r,records:{akari:{...r.records.akari,index:{...r.records.akari.index,channelId:'1511111111111111111'}}}}),/receipt/);
});
