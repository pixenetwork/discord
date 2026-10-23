const deny=reason=>{throw Error('Cory source-only guard: '+reason)};
export function assessCorySourceOnlyTarget({plan,botId,guildId,thread,parent,messages}={}){
 if(!plan||!/^\d{17,20}$/.test(botId||'')||!/^\d{17,20}$/.test(guildId||'')||
  !/^\d{17,20}$/.test(plan.threadId||''))
  deny('invalid bot/target');
 if(thread?.id!==plan.threadId||thread?.name!==plan.threadName||
  thread?.parent_id!=='1560887812910350339'||
  thread?.thread_metadata?.archived!==false||thread?.thread_metadata?.locked!==false||
  parent?.id!==thread.parent_id||parent?.type!==15)
  deny('thread is archived, locked, renamed or outside original Cory forum');
 if((BigInt(parent.permission_overwrites?.find(x=>x.id===guildId)?.deny||0n)&1024n)!==0n)
  deny('public parent visibility is denied');
 if(!Array.isArray(messages)||messages.length<1||messages.length>=100)
  deny('message history incomplete');
 const starter=messages.find(m=>m.id===plan.threadId);
 if(!starter||starter.author?.id!==botId)deny('thread not started by managed bot');
 const marked=messages.filter(m=>m.content?.includes(plan.marker));
 if(marked.length>1)deny('multiple posts with receipt marker');
 if(marked.length===1){
  if(marked[0].author?.id!==botId||marked[0].content!==plan.content)deny('marker altered or author mismatch');
  return {mode:'adopt',messageId:marked[0].id};
 }
 if(messages.some(m=>m.content?.includes(plan.pageUrl)))deny('article already linked in this thread');
 return {mode:'create',messageId:null};
}
