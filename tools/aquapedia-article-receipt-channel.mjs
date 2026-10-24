// Resolve a historical bot-owned article receipt when its breeder thread
// was archived and therefore omitted from Discord's active-thread listing.
// Never redirect a receipt to an unrelated channel or auto-recreate a post.
export async function resolveArticleReceiptChannel({
 receipt, proposedChannel, defaultChannel, entry, guild,
 breederForums, getChannel, privateDestination, cleanName, allowedThreadTypes,
}){
 if(!receipt)return proposedChannel;
 if(!receipt.messageId||!receipt.channel)throw Error('Old receipt missing message ID or channel');
 if(receipt.channel===proposedChannel)return proposedChannel;
 if(!entry||entry.group==='shrimp'||proposedChannel!==defaultChannel)
  throw Error('Old receipt destination mismatch; manual reconciliation required');
 const thread=await getChannel(receipt.channel);
 if(!thread||thread.id!==receipt.channel||thread.guild_id!==guild
  ||!allowedThreadTypes.includes(thread.type)||thread.thread_metadata?.archived!==true)
  throw Error('Old receipt is not a verified archived guild thread');
 const forum=breederForums.find(x=>x.id===thread.parent_id);
 if(!forum||cleanName(thread.name)!==cleanName(entry.name))
  throw Error('Archived receipt forum or article name mismatch');
 privateDestination(forum);
 return thread.id;
}
