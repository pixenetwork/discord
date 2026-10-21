import test from 'node:test';
import assert from 'node:assert/strict';
import { aquapediaDmCommand, createAquapediaDmController, formattedAquapediaDm } from '../src/breeder-dm.mjs';

const ids = { owner: '100000000000000001', other: '100000000000000002', breeder: '100000000000000003', guild: '100000000000000004' };

function fixture({ memberExists=true, auditExists=true, sendError=false }={}) {
  const sent=[], audits=[], replies=[];
  const member={ id:ids.breeder, user:{id:ids.breeder,tag:'SNRMedaka#0001',bot:false},
    async send(data){ if(sendError) throw new Error('Cannot send messages');sent.push(data);return {id:'200000000000000099',author:{id:'bot-id'}}; } };
  const audit={name:'🤖・bot-log',isTextBased:()=>true,permissionsFor:()=>({has:()=>false}),async send(data){audits.push(data);return {id:'receipt-'+audits.length};}};
  const guild={roles:{everyone:{id:'all'}},members:{async fetch(id){return memberExists && id===ids.breeder?member:null;}},
    channels:{cache:{find(fn){return auditExists && fn(audit)?audit:null;}}}};
  const deps={config:{discord:{ownerUserId:ids.owner,guildId:ids.guild}}};
  const command=(userId=ids.owner)=>({
    user:{id:userId},guild,guildId:ids.guild,
    commandName:'aquapedia-dm', isChatInputCommand:()=>true,isButton:()=>false,
    options:{getSubcommand:()=> 'draft', getUser:()=>member.user,getString:()=> 'Hello, I am verifying your Medaka strain history and would like permission to use credited photographs.'},
    async reply(data){this.lastReply=data;replies.push(data);},
  });
  const button=(customId,userId=ids.owner)=>({
    user:{id:userId},guild,guildId:ids.guild,
    customId, isChatInputCommand:()=>false,isButton:()=>true,
    async reply(data){this.lastReply=data;replies.push(data);},
    async update(data){this.lastUpdate=data;},
    async deferUpdate(){this.deferred=true;},
    async editReply(data){this.lastEdit=data;},
  });
  return {sent,audits,replies,deps,command,button};
}

test('slash command is guild-owned preview-only, with user picker and required message',()=>{
 const data=aquapediaDmCommand().toJSON();
 assert.equal(data.name,'aquapedia-dm');
 assert.equal(data.options[0].name,'draft');
 assert.equal(data.options[0].options[0].name,'recipient');
});
test('Aquapedia signature is always present and mass pings rejected',()=>{
 assert.match(formattedAquapediaDm('Hi! Please verify a medaka lineage.'),/https:\/\/aquapedia\.app\//);
 assert.throws(()=>formattedAquapediaDm('Hello @everyone, test message here.'),/Mass mentions/);
});
test('owner previews then confirms exact guild recipient, with private receipt and no automated retry', async()=>{
 const f=fixture();
 const c=createAquapediaDmController({now:()=>1000,makeId:()=> 'approved-1'});
 const draft=f.command();assert.equal(await c.handle(draft,f.deps),true);
 assert.equal(f.sent.length,0);
 assert.match(draft.lastReply.content,/NOT SENT/);
 assert.match(draft.lastReply.content,/aquapedia\.app/);
 assert.equal(draft.lastReply.ephemeral,true);
 const id=draft.lastReply.components[0].toJSON().components[0].custom_id;
 const confirm=f.button(id);
 assert.equal(await c.handle(confirm,f.deps),true);
 assert.equal(f.sent.length,1);
 assert.deepEqual(f.sent[0].allowedMentions,{parse:[]});
 assert.equal(f.audits.length,2);
 assert.match(f.audits[1].content,/200000000000000099/);
 assert.match(confirm.lastEdit.content,/confirmed/);
 const repeat=f.button(id);await c.handle(repeat,f.deps);
 assert.equal(f.sent.length,1);
 assert.match(repeat.lastReply.content,/already handled/);
});
test('unprivileged account cannot preview or click owner confirmation',async()=>{
 const f=fixture(), c=createAquapediaDmController({now:()=>1000,makeId:()=> 'approved-2'});
 const other=f.command(ids.other);await c.handle(other,f.deps);
 assert.match(other.lastReply.content,/restricted/);
 const draft=f.command();await c.handle(draft,f.deps);
 const id=draft.lastReply.components[0].toJSON().components[0].custom_id;
 const forged=f.button(id,ids.other);await c.handle(forged,f.deps);
 assert.equal(f.sent.length,0);
 assert.match(forged.lastReply.content,/restricted/);
});
test('cancel, expiry, missing audit channel, and missing guild member fail closed',async()=>{
 const f=fixture(), c=createAquapediaDmController({now:()=>1000,makeId:()=> 'cancel-1'});
 const draft=f.command();await c.handle(draft,f.deps);
 const cancelId=draft.lastReply.components[0].toJSON().components[1].custom_id;
 const cancel=f.button(cancelId);await c.handle(cancel,f.deps);assert.equal(f.sent.length,0);assert.match(cancel.lastUpdate.content,/canceled/);
 const clock={value:0};const c2=createAquapediaDmController({now:()=>clock.value,makeId:()=> 'expired-1'});
 const draft2=f.command();await c2.handle(draft2,f.deps);clock.value=301001;
 const sendId=draft2.lastReply.components[0].toJSON().components[0].custom_id;
 const expired=f.button(sendId);await c2.handle(expired,f.deps);assert.equal(f.sent.length,0);
 const noAudit=fixture({auditExists:false}),c3=createAquapediaDmController({now:()=>1000,makeId:()=> 'no-audit'});
 const draft3=noAudit.command();await c3.handle(draft3,noAudit.deps);
 const attempt=noAudit.button(draft3.lastReply.components[0].toJSON().components[0].custom_id);
 await c3.handle(attempt,noAudit.deps);assert.equal(noAudit.sent.length,0);assert.match(attempt.lastEdit.content,/audit channel unavailable/);
 const missing=fixture({memberExists:false}),c4=createAquapediaDmController({now:()=>1000});
 const denied=missing.command();await c4.handle(denied,missing.deps);
 assert.match(denied.lastReply.content,/not a verified member/);
});
test('Discord DM refusal never asserts confirmed delivery',async()=>{
 const f=fixture({sendError:true}),c=createAquapediaDmController({now:()=>1000,makeId:()=> 'privacy-1'});
 const draft=f.command();await c.handle(draft,f.deps);
 const pressed=f.button(draft.lastReply.components[0].toJSON().components[0].custom_id);
 await c.handle(pressed,f.deps);
 assert.equal(f.sent.length,0);
 assert.match(pressed.lastEdit.content,/did not confirm DM delivery/);
 assert.match(f.audits[1].content,/Delivery uncertain/);
});
