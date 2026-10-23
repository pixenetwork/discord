import {GUPPY_BASE_THREAD_ID,GUPPY_BASE_INDEX_MARKER} from './aquapedia-guppy-base-index-canary.mjs';
const reject=why=>{throw Error('Guppy canary guard: '+why)};
export function assessGuppySourceOnlyCanary({plan,botId,guildId,thread,parent,messages}={}){
 if(!plan||plan.threadId!==GUPPY_BASE_THREAD_ID||plan.marker!==GUPPY_BASE_INDEX_MARKER||
  !/^\d{17,20}$/.test(botId||'')||!/^\d{17,20}$/.test(guildId||''))
  reject('untrusted bot, message, or guild identity');
 if(thread?.id!==GUPPY_BASE_THREAD_ID||thread?.parent_id!=='1562195139353645146'||
  thread?.name!=='Guppypedia — Genetics and Lineage'||
  thread?.thread_metadata?.archived!==false||thread?.thread_metadata?.locked!==false||
  parent?.id!==thread.parent_id||parent?.type!==15)
  reject('target forum is missing, archived, locked, or renamed');
 const permissions=parent.permission_overwrites||[];
 if((BigInt(permissions.find(o=>o.id===guildId)?.deny||0n)&1024n)!==0n)
  reject('forum is private');
 if(!Array.isArray(messages)||messages.length<1||messages.length>=100)
  reject('recent message coverage insufficient');
 const starter=messages.find(x=>x?.id===thread.id);
 if(!starter||starter.author?.id!==botId)reject('existing thread starter not bot-authored');
 const matches=messages.filter(x=>x.content?.includes(GUPPY_BASE_INDEX_MARKER));
 if(matches.length>1)reject('multiple matching marker messages');
 if(matches.length===1){
  if(matches[0].author?.id!==botId||matches[0].content!==plan.content)
   reject('previous index marker owned by another person or altered');
  return {mode:'adopt',existingMessageId:matches[0].id};
 }
 if(messages.some(x=>x.content?.includes('https://aquapedia.app/guppypedia/entries/gup-001/')))
  reject('earlier source-index link already present without marker');
 return {mode:'create',existingMessageId:null};
}
