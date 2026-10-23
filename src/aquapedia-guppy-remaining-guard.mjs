import {GUPPY_REMAINING_TOPIC_SPECS} from './aquapedia-guppy-remaining-index.mjs';
const refuse=why=>{throw Error('Guppy remaining release guard: '+why)};
export function assessRemainingGuppyPost({plan,botId,guildId,thread,parent,messages}={}){
 const spec=GUPPY_REMAINING_TOPIC_SPECS[plan?.topic];
 if(!spec||plan.threadId!==spec.threadId||plan.threadName!==spec.threadName||
    !/^\d{17,20}$/.test(botId||'')||!/^\d{17,20}$/.test(guildId||''))
  refuse('unverified source/identity');
 if(thread?.id!==spec.threadId||thread?.name!==spec.threadName||
   thread?.parent_id!=='1562195139353645146'||
   thread?.thread_metadata?.archived!==false||thread?.thread_metadata?.locked!==false||
   parent?.id!==thread.parent_id||parent?.type!==15)
  refuse('forum/thread changed from bot-owned public destination');
 const visibility=parent.permission_overwrites?.find(x=>x.id===guildId);
 if((BigInt(visibility?.deny||0n)&1024n)!==0n)refuse('thread parent inaccessible to general audience');
 if(!Array.isArray(messages)||!messages.length||messages.length>=100)
  refuse('incomplete thread history');
 const starter=messages.find(x=>x.id===spec.threadId);
 if(!starter||starter.author?.id!==botId)refuse('thread starter was not bot owned');
 const withMarker=messages.filter(m=>m.content?.includes(plan.marker));
 if(withMarker.length>1)refuse('ambiguous duplicate marker');
 if(withMarker.length===1){
  const old=withMarker[0];
  if(old.author?.id!==botId||old.content!==plan.content)refuse('marked post differs from verified source');
  return {mode:'adopt',existingId:old.id};
 }
 if(messages.some(m=>plan.entryUrls.some(url=>m.content?.includes(url))))
  refuse('one or more source links already present; cannot safely repeat');
 return {mode:'create',existingId:null};
}
