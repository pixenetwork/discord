import {KOKO_SOURCE_PLAN} from './aquapedia-pleco-koko-source.mjs';
const fail=s=>{throw Error('Pleco koko thread check: '+s)};
export function assessPlecoKokoIndex({plan,botId,guildId,thread,parent,messages}={}){
 const known=plan?.key==='pana-koko'?KOKO_SOURCE_PLAN:null;
 if(!known||known.threadId!==plan.threadId||known.threadName!==plan.threadName||
   !/^\d{17,20}$/.test(botId||'')||guildId!=='1519337502379475095')
   fail('unexpected thread plan/guild');
 if(thread?.id!==known.threadId||thread?.name!==known.threadName||
   thread.parent_id!=='1560931428680601630'||thread.thread_metadata?.archived!==false||
   thread.thread_metadata?.locked!==false||parent?.id!==thread.parent_id||parent?.type!==15)
   fail('destination changed');
 if((BigInt(parent.permission_overwrites?.find(x=>x.id===guildId)?.deny||0n)&1024n)!==0n)
   fail('forum private');
 if(!Array.isArray(messages)||messages.length<1||messages.length>=100)
   fail('history window incomplete');
 if(messages.find(x=>x.id===thread.id)?.author?.id!==botId)
   fail('starter not authored by managed bot');
 const marked=messages.filter(x=>x.content?.includes(plan.marker));
 if(marked.length>1)fail('duplicate post markers');
 if(marked.length===1){
  const match=marked[0];
  if(match.author?.id!==botId||match.content!==plan.content)fail('post altered or not bot owned');
  return {mode:'adopt',messageId:match.id};
 }
 if(messages.some(x=>x.content?.includes(plan.pageUrl)))fail('prior site backlink');
 return {mode:'create',messageId:null};
}
