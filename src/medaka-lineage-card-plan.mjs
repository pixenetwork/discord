import {buildLineageCard} from './medaka-lineage-card.mjs';
const GUILD='1519337502379475095';
const INDEX='1563764327037669416';
const FORUM='1561189286399705128';
const LINEAGE_URL=RegExp('^https://discord\\.com/channels/'+GUILD+'/\\d{17,20}/\\d{17,20}$');
const SNOWFLAKE=/^\d{17,20}$/;
export function planMedakaCardEdits(manifest,receipts){
 if(manifest?.schema_version!==1||!Array.isArray(manifest?.trees)||!receipts?.records
   ||receipts.guildId!==GUILD||receipts.channelId!==INDEX
   ||receipts.aquapediaHead!==manifest.aquapedia_commit)throw Error('Manifest or prior receipts mismatch');
 const seen=new Set(),planned=[];
 for(const tree of manifest.trees){
  if(seen.has(tree.slug))throw Error('Duplicate tree slug');
  seen.add(tree.slug);
  const r=receipts.records[tree.slug];
  if(!r){planned.push({slug:tree.slug,status:'hold_no_verified_publication_receipt'});continue;}
  if(r.revision!==manifest.aquapedia_commit)throw Error('Source revision mismatch for '+tree.slug);
  const o=r.original, i=r.index;
  if(![o?.threadId,o?.messageId,i?.channelId,i?.messageId].every(x=>SNOWFLAKE.test(String(x??'')))
   ||i.channelId!==INDEX||!LINEAGE_URL.test(o.url??'')||!LINEAGE_URL.test(i.url??''))
    throw Error('Invalid receipt or Discord route for '+tree.slug);
  const name='aquapedia-medaka-'+tree.slug+'-picture-gene-tree.png';
  const card=buildLineageCard(tree,{fileName:name,forumUrl:'https://discord.com/channels/'+GUILD+'/'+o.threadId,revision:manifest.aquapedia_commit.slice(0,12)});
  planned.push({slug:tree.slug,status:'ready_to_edit_existing_only',
     card,targets:[
       {channelId:o.threadId,messageId:o.messageId,priorUrl:o.url},
       {channelId:i.channelId,messageId:i.messageId,priorUrl:i.url}
     ],pngFileName:name,sourceUrl:tree.source_url});
 }
 return {guildId:GUILD,channelId:INDEX,baseline:manifest.aquapedia_commit,
     ready:planned.filter(p=>p.status==='ready_to_edit_existing_only').length,
     held:planned.filter(p=>p.status!=='ready_to_edit_existing_only').length,entries:planned};
}
