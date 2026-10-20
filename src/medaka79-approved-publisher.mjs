import {readFileSync} from 'node:fs';
import {buildMedaka79Index, verifyMedaka79PublishedMessages}
  from './medaka79-research-index.mjs';

// Pure protocol module. The existing Jarvis/HostOps runtime must supply a
// signature-verifying authorizer, an exclusive lock, Discord I/O and an atomic
// receipt store. No credentials, timers, token fetches or automatic execution.
const EXPECTED_SOURCE_SHA='5e15684e2059f94a1c4c3c47ba67d723ec5b98ce13097efcf546bdd428e6e7f0';

export async function publishApprovedMedaka79({
  plan,job,authorizer,discord,receiptStore,lock,
}={}){
  if(!plan || plan.jobId!=='AQUAPEDIA-MEDAKA400-79-RESEARCH-V1'
    || plan.records!==79 || plan.parts?.length!==10
    || plan.sourceSha256!==EXPECTED_SOURCE_SHA
    || !Array.isArray(plan.photographs) || plan.photographs.length
    || plan.status!=='PROPOSED_FOR_APPROVED_PUBLISHER_ONLY'
    || plan.approvalRequired!==true){
    throw new Error('Pinned Medaka research source plan is invalid');
  }
  // Regenerate the exact approved messages from the repository-pinned source.
  // A caller cannot smuggle new claims behind a legitimate source SHA.
  const bytes=readFileSync(new URL('../resources/aquapedia-medaka79-20261020.json',import.meta.url));
  const source=buildMedaka79Index(JSON.parse(bytes),{rawSource:bytes});
  if(plan.starter!==source.starter
    || plan.threadName!==source.threadName
    || plan.guildId!==source.guildId || plan.forumId!==source.forumId
    || plan.parts.some((part,index)=>part.content!==source.parts[index].content
      || part.marker!==source.parts[index].marker
      || part.count!==source.parts[index].count
      || part.tier!==source.parts[index].tier)
    || JSON.stringify(plan.allowedMentions)!==JSON.stringify(source.allowedMentions)){
    throw new Error('Discord source-locked message content does not match approved research matrix');
  }
  if(typeof authorizer?.verifySignedApproval!=='function'){
    throw new Error('Verified signed publication authorization is required');
  }
  // The trusted runtime verifies signature, owner identity, expiry and scope.
  // Plain chat text, booleans, forged receipts or caller-supplied approval flags
  // must NEVER be treated as signature verification.
  const grant=await authorizer.verifySignedApproval(job);
  if(grant?.verified!==true
    || grant.jobId!==plan.jobId
    || grant.sourceSha256!==EXPECTED_SOURCE_SHA
    || grant.guildId!==plan.guildId
    || grant.forumId!==plan.forumId
    || grant.discordPublicationApproved!==true
    || grant.publicAudienceApproved!==true){
    throw new Error('Verified signed publication authorization missing or mismatched');
  }
  if(typeof lock?.acquire!=='function'
    || typeof receiptStore?.get!=='function'
    || typeof receiptStore?.save!=='function'
    || typeof discord?.getForumState!=='function'
    || typeof discord?.enumerateThreads!=='function'
    || typeof discord?.createThread!=='function'
    || typeof discord?.send!=='function'
    || typeof discord?.fetchMessage!=='function'
    || !discord.botId){
    throw new Error('Approved one-writer Discord publisher runtime unavailable');
  }

  const release=await lock.acquire(plan.jobId);
  if(typeof release!=='function')throw new Error('Exclusive Discord writer lock not obtained');
  try{
    const previous=await receiptStore.get(plan.jobId);
    if(previous)throw new Error('Publication receipt already exists; verify it in Discord before retrying');
    const forum=await discord.getForumState(plan.guildId,plan.forumId);
    if(forum?.guildId!==plan.guildId || forum?.forumId!==plan.forumId
      || forum.publicView!==true
      || forum.readMessageHistory!==true || forum.botMayPost!==true){
      throw new Error('Approved public Medaka forum access not verified');
    }
    const inventory=await discord.enumerateThreads(plan.forumId,{active:true,archived:true});
    if(inventory?.complete!==true || !Array.isArray(inventory.threads)){
      throw new Error('Complete active and archived Medaka thread history unavailable');
    }
    if(inventory.threads.some(t=>t.name===plan.threadName
      || String(t.name??'').includes('79 sourced Medaka')
      || String(t.name??'').includes('79 Medaka research'))){
      throw new Error('Possible duplicate Medaka research thread; reconcile before publishing');
    }

    const thread=await discord.createThread({
      forumId:plan.forumId, name:plan.threadName,
      content:plan.starter,allowedMentions:{parse:[]},flags:4096, // SuppressEmbeds
    });
    if(!thread?.threadId || !thread?.starterId){
      throw new Error('Discord starter post not verifiable');
    }
    const messageIds=[String(thread.starterId)];
    for(const part of plan.parts){
      const sent=await discord.send(thread.threadId,{
        content:part.content,allowedMentions:{parse:[]},flags:4096, // SuppressEmbeds
      });
      if(!sent?.id)throw new Error('Discord returned a reply without message ID');
      messageIds.push(String(sent.id));
    }
    const readbacks=[];
    for(const id of messageIds){
      readbacks.push(await discord.fetchMessage(thread.threadId,id));
    }
    if(!verifyMedaka79PublishedMessages(plan,readbacks,discord.botId)){
      throw new Error('Discord full-content bot-owned message readback mismatch; no completion receipt stored');
    }
    const receipt={
      jobId:plan.jobId,sourceSha256:plan.sourceSha256,
      guildId:plan.guildId,forumId:plan.forumId,
      threadId:String(thread.threadId),
      messageIds,entries:79,
      threadUrl:'https://discord.com/channels/'+plan.guildId+'/'+thread.threadId+'/'+thread.starterId,
      verifiedAt:new Date().toISOString(),
      verification:'eleven exact bot-owned Discord message readbacks',
    };
    // Only the authorized runtime's atomic and durable store may persist it.
    await receiptStore.save(receipt);
    return receipt;
  }finally{
    await release();
  }
}
