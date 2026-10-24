import {PLECO_THREE_DIRECT_DESCRIPTIONS} from './aquapedia-pleco-three-direct-descriptions.mjs';
const reject=why=>{throw Error('Pleco three direct-description guard: '+why)};
export function assessPlecoThreeDirectDescription({plan,botId,guildId,thread,parent,messages}={}){
 const p=PLECO_THREE_DIRECT_DESCRIPTIONS[plan?.key];
 if(!p||p.threadId!==plan.threadId||p.threadName!==plan.threadName||
    !/^\d{17,20}$/.test(botId||'')||guildId!=='1519337502379475095')
  reject('untrusted pilot, bot, or guild');
 if(thread?.id!==p.threadId||thread?.name!==p.threadName||
    thread?.parent_id!=='1560931428680601630'||
    thread?.thread_metadata?.archived!==false||thread?.thread_metadata?.locked!==false||
    parent?.id!==thread.parent_id||parent?.type!==15)
  reject('target not the same active existing public Pleco research forum thread');
 if((BigInt(parent.permission_overwrites?.find(x=>x.id===guildId)?.deny||0n)&1024n)!==0n)
  reject('forum not publicly visible');
 if(!Array.isArray(messages)||messages.length<1||messages.length>=100)
  reject('incomplete message sample');
 const starter=messages.find(x=>x.id===thread.id);
 if(!starter||starter.author?.id!==botId)reject('original thread not bot-owned');
 const matching=messages.filter(x=>x.content?.includes(plan.marker));
 if(matching.length>1)reject('duplicate marker');
 if(matching.length===1){
  if(matching[0].author?.id!==botId||matching[0].content!==plan.content)
   reject('foreign or altered source-index marker');
  return {mode:'adopt',messageId:matching[0].id};
 }
 if(messages.some(x=>x.content?.includes(plan.pageUrl)))
  reject('prior Pleco article link already present');
 return {mode:'create',messageId:null};
}
