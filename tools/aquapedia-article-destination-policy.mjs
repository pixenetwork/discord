// Decide which existing article-notification destinations require private-channel preflight.
// All records are already-public article URLs, but Discord notifications remain private.
// Pre-existing receipts describe history; they do not imply a message was patched now.
export function articleWriteAction({previousReceipt,existingMessage,changed}){
 if(!changed)return 'unchanged';
 return existingMessage?'updated':'posted';
}

export const ARTICLE_UPDATE_HEADING='**AQUAPEDIA — UPDATED RESEARCH ARTICLE**';
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
