/**
 * Explicitly governed one-time migration from historical public shrimp-guides
 * article messages to the dedicated private research-updates channel.
 *
 * This is NEVER called by ordinary --check or scheduled --apply runs.
 * The caller owns the shared publisher writer lease and has verified the
 * destination's direct @everyone ViewChannel deny.
 */
export const LEGACY_SHRIMP_GUIDES_CHANNEL='1557338244545519666';
export const PRIVATE_SHRIMP_UPDATES_CHANNEL='1563706401132646410';
export const PRIVATE_SHRIMP_MIGRATION_ROUTES=Object.freeze([
 '/shrimpapedia/breeders/',
 '/shrimpapedia/breeders/flip-aquatics-robert-lupton/',
]);

function matchingEmbed(received,wanted){
 const fields=received?.fields||[],desired=wanted?.fields||[];
 // Require an exact text-only card, never one with hidden legacy media.
 if(!received||!wanted
   ||['image','thumbnail','video','author','provider','timestamp'].some(k=>received[k]!==undefined)
   ||(received.type!==undefined&&received.type!=='rich'))return false;
 return received.title===wanted.title
  &&received.description===wanted.description&&received.url===wanted.url
  &&received.color===wanted.color&&received.footer?.text===wanted.footer?.text
  &&fields.length===desired.length
  &&desired.every((x,i)=>x.name===fields[i].name&&x.value===fields[i].value
   &&Boolean(x.inline)===Boolean(fields[i].inline));
}

export async function migratePrivateShrimpArticle({
 url,key,mark,old,targetChannel,rest,Routes,botId,payload,item,state,
 saveAtomically,now=()=>new Date().toISOString(),
}){
 if(!PRIVATE_SHRIMP_MIGRATION_ROUTES.includes(url)
   ||targetChannel!==PRIVATE_SHRIMP_UPDATES_CHANNEL
   ||old?.channel!==LEGACY_SHRIMP_GUIDES_CHANNEL||!old.messageId
   ||state.receipts?.[key]!==old||!state.pages?.[url])
  throw Error('PRIVATE_SHRIMP_MIGRATION_BLOCK unapproved URL, channel or historical receipt');
 if(!item?.digest||!payload?.content?.includes(mark)
   ||payload.embeds?.[0]?.url!=='https://aquapedia.app'+url)
  throw Error('PRIVATE_SHRIMP_MIGRATION_BLOCK missing sourced article payload');
 const previous=await rest.get(Routes.channelMessage(old.channel,old.messageId));
 if(!previous||previous.id!==old.messageId||previous.author?.id!==botId
   ||!previous.content?.includes(mark)
   ||!JSON.stringify(previous.embeds||[]).includes('https://aquapedia.app'+url))
  throw Error('PRIVATE_SHRIMP_MIGRATION_BLOCK historical Discord receipt failed readback');
 const recent=await rest.get(Routes.channelMessages(targetChannel),{
  query:new URLSearchParams({limit:'100'}),
 });
 if(!Array.isArray(recent))throw Error('PRIVATE_SHRIMP_MIGRATION_BLOCK cannot inspect private destination history');
 if(recent.some(m=>m.author?.id===botId&&m.content?.includes(mark)))
  throw Error('PRIVATE_SHRIMP_MIGRATION_BLOCK existing private post requires manual reconciliation');

 // A crash, timeout or 5xx after Discord accepts POST leaves pending. The
 // ordinary publisher also sees no messageId and cannot create a replacement.
 const priorReceipt={...old};
 state.receipts[key]={key,url,channel:targetChannel,messageId:null,
  status:'pending-migration',previousReceipt:priorReceipt,preparedAt:now()};
 saveAtomically(state); // Must succeed BEFORE any external POST.
 const accepted=await rest.post(Routes.channelMessages(targetChannel),{body:payload});
 if(!accepted?.id||accepted.id===old.messageId)
  throw Error('PRIVATE_SHRIMP_MIGRATION_BLOCK ambiguous private POST acknowledgment');
 const confirmed=await rest.get(Routes.channelMessage(targetChannel,accepted.id));
 if(!confirmed||confirmed.id!==accepted.id||confirmed.channel_id!==targetChannel
   ||confirmed.author?.id!==botId||confirmed.content!==payload.content
   ||(confirmed.attachments||[]).length
   ||!Array.isArray(confirmed.embeds)
   ||confirmed.embeds.length!==payload.embeds?.length
   ||!matchingEmbed(confirmed.embeds?.[0],payload.embeds?.[0]))
  throw Error('PRIVATE_SHRIMP_MIGRATION_BLOCK independent private readback mismatch');
 state.receipts[key]={key,url,channel:targetChannel,messageId:confirmed.id,
  digest:item.digest,action:'migrated-to-private',lastVerified:now(),
  previousReceipt:priorReceipt};
 state.pages[url]=item;
 state.totalPosted=(state.totalPosted||0)+1;
 state.lastScan=now();
 saveAtomically(state);
 return {url,channel:targetChannel,messageId:confirmed.id,oldMessageId:old.messageId,action:'migrated-to-private'};
}
