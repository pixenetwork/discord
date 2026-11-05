// Decide which existing article-notification destinations require private-channel preflight.
// All records are already-public article URLs, but Discord notifications remain private.
// Pre-existing receipts describe history; they do not imply a message was patched now.
export function articleWriteAction({previousReceipt,existingMessage,changed}){
 if(!changed)return 'unchanged';
 return existingMessage?'updated':'posted';
}

export const ARTICLE_UPDATE_HEADING='**AQUAPEDIA — UPDATED RESEARCH ARTICLE**';
function rawTextTagAt(lower,index,tag){
 if(!lower.startsWith('<'+tag,index))return false;
 const next=lower[index+tag.length+1];
 return next===undefined||next==='>'||next==='/'||/\s/.test(next);
}

function rawTextBlockEnd(lower,tag,from){
 const needle='</'+tag;
 let cursor=from;
 while(cursor<lower.length){
  const start=lower.indexOf(needle,cursor);
  if(start<0)return -1;
  let end=start+needle.length;
  const next=lower[end];
  if(next==='>'||/\s/.test(next||'')){
   while(end<lower.length&&/\s/.test(lower[end]))end++;
   if(lower[end]==='>')return end+1;
  }
  cursor=start+needle.length;
 }
 return -1;
}

export function normalizeArticleMainForDigest(value){
 const source=String(value??'');
 const lower=source.toLowerCase();
 let index=0;
 let output='';
 while(index<source.length){
  if(lower.startsWith('<!--',index)){
   const end=lower.indexOf('-->',index+4);
   if(end<0)throw Error('Unterminated article comment');
   index=end+3;
   continue;
  }
  let tag=null;
  if(rawTextTagAt(lower,index,'script'))tag='script';
  else if(rawTextTagAt(lower,index,'style'))tag='style';
  if(tag){
   const openEnd=lower.indexOf('>',index+tag.length+1);
   if(openEnd<0)throw Error('Unterminated '+tag+' block');
   const closeEnd=rawTextBlockEnd(lower,tag,openEnd+1);
   if(closeEnd<0)throw Error('Unterminated '+tag+' block');
   index=closeEnd;
   continue;
  }
  output+=source[index++];
 }
 return output.replace(/\s+/g,' ').trim();
}

export function normalizeAquapediaArticleName(name){
 return String(name??'').normalize('NFKC').split(/[\/|—–(]/)[0]
  .replace(/[^\p{L}\p{N}]/gu,'').toLocaleLowerCase();
}
export function acquireArticleWriterLock(fsApi,lockFile,metadata){
 let fd;
 try{
  fd=fsApi.openSync(lockFile,'wx');
  fsApi.writeSync(fd,JSON.stringify(metadata));
 }catch(err){
  if(fd!==undefined){
   try{fsApi.closeSync(fd);}finally{fsApi.unlinkSync(lockFile);}
  }
  throw err;
 }
 return ()=>{try{fsApi.closeSync(fd);}finally{fsApi.unlinkSync(lockFile);}};
}

export function guardArticleBulkChange(changedCount,totalPages){
 if(!Number.isInteger(changedCount)||!Number.isInteger(totalPages)
   ||totalPages<1||changedCount<0||changedCount>totalPages)
  throw Error('Invalid article scan counts');
 // Large, correlated HTML changes frequently reflect a renderer/template release.
 // Require separate review rather than sending a site-wide Discord notification burst.
 if(changedCount>=50&&changedCount/totalPages>0.20)
  throw Error('BULK_CHANGE_REVIEW_REQUIRED '+changedCount+'/'+totalPages+' article digests changed');
 return true;
}

export function requiredChannelKinds(changes,cap=50){
 if(!Array.isArray(changes))throw new Error('Expected changed-article array');
 if(!Number.isInteger(cap)||cap<1||cap>50)throw new Error('Invalid article batch cap');
 const kinds=new Set();
 for(const route of changes.slice(0,cap)){
  if(typeof route!=='string'||!/^\/(?:medakapedia|shrimpapedia)\/[a-z0-9/-]+\/$/.test(route))
   throw new Error('Unsupported article route in Discord privacy preflight');
  kinds.add(route.startsWith('/shrimpapedia/')?'shrimp':'research');
 }
 return ['research','shrimp'].filter(k=>kinds.has(k));
}
