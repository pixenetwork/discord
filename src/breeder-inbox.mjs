import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
export async function pruneBreederInbox({ outputDir, now = Date.now }) {
 const file=path.join(outputDir, 'breeder-inbox.json');
 let records;
 try { records=JSON.parse(await readFile(file,'utf8')); } catch(e) { if(e.code==='ENOENT') return 0; throw e; }
 const keep=records.filter(r => Number(r.expiresAt)>now());
 if(keep.length!==records.length) await writeFile(file, JSON.stringify(keep,null,2), {mode:0o600});
 return records.length-keep.length;
}
export function createBreederInbox({ recipientIds = [], outputDir, now = Date.now, retentionDays = 30 }) {
 const allowed = new Set(recipientIds.map(String));
 return async function capture(message) {
  if (!message || message.guildId || message.author?.bot || !allowed.has(String(message.author?.id))) return false;
  if (!/^\d{17,20}$/.test(String(message.id ?? ''))) return false;
  const content=String(message.content ?? '').trim();
  await mkdir(outputDir,{recursive:true});
  const file=path.join(outputDir,'breeder-inbox.json');
  let records=[];
  try { records=JSON.parse(await readFile(file,'utf8')); } catch(e){ if(e.code!=='ENOENT') throw e; }
  records=records.filter(r=>r.authorId!==String(message.author.id) || Number(r.expiresAt)>now());
  const authorId=String(message.author.id);
  if (/^STOP AQUAPEDIA RECORDING$/i.test(content)) {
   records=records.filter(r=>r.authorId!==authorId);
  } else if (/^I consent to Aquapedia storing my interview DMs for 30 days\.?$/i.test(content)) {
   records=records.filter(r=>r.authorId!==authorId);
   records.push({authorId,expiresAt:now()+retentionDays*86400000,messages:[]});
  } else {
   const record=records.find(r=>r.authorId===authorId);
   if(!record) return false;
   if(record.messages.some(m=>m.id===String(message.id))) return false;
   record.messages.push({id:String(message.id),time:message.createdAt?.toISOString?.()??new Date(now()).toISOString(),content:content.slice(0,2000)});
  }
  await writeFile(file,JSON.stringify(records,null,2),{mode:0o600});
  return true;
 };
}
