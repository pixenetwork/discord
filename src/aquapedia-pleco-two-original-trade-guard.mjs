import {PLECO_TWO_ORIGINAL_TRADE} from './aquapedia-pleco-two-original-trade.mjs';
const fail=s=>{throw Error('Pleco two original-trade guard: '+s)};
export function assessPlecoOriginalTradeIndex({plan,botId,guildId,thread,parent,messages}={}){
 const known=PLECO_TWO_ORIGINAL_TRADE[plan?.key];
 if(!known||known.threadId!==plan.threadId||known.threadName!==plan.threadName||
    !/^\d{17,20}$/.test(botId||'')||guildId!=='1519337502379475095')
   fail('unexpected target/bot/guild');
 if(thread?.id!==known.threadId||thread?.name!==known.threadName||
    thread.parent_id!=='1560931428680601630'||
    thread.thread_metadata?.archived!==false||thread.thread_metadata?.locked!==false||
    parent?.id!==thread.parent_id||parent?.type!==15)
   fail('thread id, forum or live archive status drifted');
 if((BigInt(parent.permission_overwrites?.find(x=>x.id===guildId)?.deny||0n)&1024n)!==0n)
   fail('source forum is private');
 if(!Array.isArray(messages)||messages.length===0||messages.length>=100)
   fail('incomplete message history; cannot suppress duplicates');
 if(messages.find(x=>x.id===thread.id)?.author?.id!==botId)
   fail('original forum thread not bot-owned');
 const marked=messages.filter(x=>x.content?.includes(plan.marker));
 if(marked.length>1)fail('multiple source markers');
 if(marked.length===1){
  if(marked[0].author?.id!==botId||marked[0].content!==plan.content)
   fail('tampered/foreign marker');
  return {mode:'adopt',messageId:marked[0].id};
 }
 if(messages.some(x=>x.content?.includes(plan.pageUrl)))
   fail('prior link already exists');
 return {mode:'create',messageId:null};
}
