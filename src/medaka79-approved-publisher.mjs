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
  // Issue 2 fix: validate ALL injected runtime capabilities BEFORE consuming
  // the signed authorization grant so a misconfigured runtime fails immediately
  // without spending a potentially one-use signed approval token.
  if(typeof lock?.acquire!=='function'
    || typeof receiptStore?.get!=='function'
    || typeof receiptStore?.save!=='function'
    || typeof receiptStore?.savePartial!=='function'
    || typeof receiptStore?.loadPartial!=='function'
    || typeof discord?.getForumState!=='function'
    || typeof discord?.enumerateThreads!=='function'
    || typeof discord?.enumerateThreadMessages!=='function'
    || typeof discord?.createThread!=='function'
    || typeof discord?.send!=='function'
    || typeof discord?.fetchMessage!=='function'
    || !discord.botId){
    throw new Error('Approved one-writer Discord publisher runtime unavailable');
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

  const release=await lock.acquire(plan.jobId);
  if(typeof release!=='function')throw new Error('Exclusive Discord writer lock not obtained');
  try{
    const previous=await receiptStore.get(plan.jobId);
    if(previous)throw new Error('Publication receipt already exists; verify it in Discord before retrying');

    // Issue 1 fix: load any durable partial state saved by a prior interrupted
    // run. If a partial exists we resume into that already-created thread; the
    // duplicate-thread guard is bypassed for the known-in-progress thread so we
    // never accidentally create a second copy.
    const partial=await receiptStore.loadPartial(plan.jobId);

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

    let thread;
    let messageIds;
    if(partial){
      // A checkpoint is not authorization to write into an arbitrary Discord thread.
      // Fail closed rather than silently starting over with a corrupt partial receipt.
      if(partial.jobId!==plan.jobId || !/^[0-9]+$/.test(String(partial.threadId??''))
        || !Array.isArray(partial.messageIds) || partial.messageIds.length<1
        || partial.messageIds.length>plan.parts.length+1
        || partial.messageIds.some(id=>!/^[0-9]+$/.test(String(id)))
        || new Set(partial.messageIds.map(String)).size!==partial.messageIds.length){
        throw new Error('Invalid partial Medaka publication checkpoint; manual reconciliation required');
      }
      const knownThread=inventory.threads.find(t=>
        String(t.id??t.threadId??'')===String(partial.threadId)
        && t.name===plan.threadName);
      if(!knownThread){
        throw new Error('Partial Medaka publication thread not verified in target forum');
      }
      messageIds=partial.messageIds.map(String);
      // A Discord reply may have succeeded just before a crash or failed
      // checkpoint write. Reconcile the entire thread before any retry.
      const listed=await discord.enumerateThreadMessages(partial.threadId);
      if(listed?.complete!==true || !Array.isArray(listed.messages)){
        throw new Error('Complete partial Discord thread message history unavailable');
      }
      const knownIds=new Set(messageIds);
      const actualBotMessages=listed.messages.filter(message=>
        String(message?.author?.id)===String(discord.botId));
      if(actualBotMessages.length!==knownIds.size
        || actualBotMessages.some(message=>!knownIds.has(String(message.id)))){
        throw new Error('Uncheckpointed Discord thread message; manual reconciliation required');
      }
      const expected=[plan.starter,...plan.parts.map(part=>part.content)];
      for(let i=0;i<messageIds.length;i++){
        const existing=await discord.fetchMessage(partial.threadId,messageIds[i]);
        if(!existing){
          throw new Error('Discord message '+messageIds[i]+' could not be fetched after posting; partial state requires manual reconciliation');
        }
        if(String(existing.id)!==messageIds[i]
          || String(existing.author?.id)!==String(discord.botId)
          || existing.content!==expected[i]){
          throw new Error('Partial Medaka publication readback mismatch; manual reconciliation required');
        }
      }
      thread={threadId:String(partial.threadId),starterId:messageIds[0]};
    } else {
      // Fresh-start path: enforce the duplicate-thread guard before creating.
      if(inventory.threads.some(t=>t.name===plan.threadName
        || String(t.name??'').includes('79 sourced Medaka')
        || String(t.name??'').includes('79 Medaka research'))){
        throw new Error('Possible duplicate Medaka research thread; reconcile before publishing');
      }
      const created=await discord.createThread({
        forumId:plan.forumId, name:plan.threadName,
        content:plan.starter,allowedMentions:{parse:[]},flags:4096, // SuppressEmbeds
      });
      if(!created?.threadId || !created?.starterId){
        throw new Error('Discord starter post not verifiable');
      }
      thread=created;
      messageIds=[String(thread.starterId)];
      // Persist partial state immediately after thread creation so a crash
      // before the first reply can be resumed rather than creating a duplicate.
      await receiptStore.savePartial({
        jobId:plan.jobId,threadId:String(thread.threadId),messageIds:[...messageIds],
      });
    }

    // Send only the parts not yet present in the partial state.
    const partsToSend=plan.parts.slice(messageIds.length-1);
    for(const part of partsToSend){
      const sent=await discord.send(thread.threadId,{
        content:part.content,allowedMentions:{parse:[]},flags:4096, // SuppressEmbeds
      });
      if(!sent?.id)throw new Error('Discord returned a reply without message ID');
      messageIds.push(String(sent.id));
      // Issue 1 fix: persist updated partial state after every successful reply
      // so a crash mid-loop leaves a recoverable audit trail of sent IDs.
      await receiptStore.savePartial({
        jobId:plan.jobId,threadId:String(thread.threadId),messageIds:[...messageIds],
      });
    }

    // Issue 3 fix: explicit null-message readback diagnostics.
    // A null result from fetchMessage is surfaced as a distinct named error
    // rather than propagating silently into verifyMedaka79PublishedMessages.
    const readbacks=[];
    for(const id of messageIds){
      const msg=await discord.fetchMessage(thread.threadId,id);
      if(!msg)throw new Error('Discord message '+id+' could not be fetched after posting; partial state requires manual reconciliation');
      readbacks.push(msg);
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
