/**
 * Local editorial artifact only. Uses a time-stamped public Discord
 * starter snapshot and revalidates every public Guppypedia catalog record.
 * Never connects to Discord or publishes any message.
 */
import fs from 'node:fs';
import {buildGuppyDiscordIndexPreview} from '../src/aquapedia-guppy-discord-index-preview.mjs';
const snapshot=JSON.parse(fs.readFileSync('test/fixtures/guppypedia-forum-starters-20261021.json','utf8'));
const pinned=JSON.parse(fs.readFileSync('test/fixtures/guppypedia-source-20261021.json','utf8'));
if(snapshot.guildActiveThreads!==898 || !/^2026-10-21T/.test(snapshot.guildActiveThreadsCapturedAt))
 throw Error('Guild capacity snapshot missing or unverified');
const res=await fetch('https://aquapedia.app/assets/catalog.json',{signal:AbortSignal.timeout(15000)});
if(!res.ok)throw Error('Public Guppypedia source HTTP '+res.status);
const live=(await res.json()).filter(x=>x.group==='guppy').map(x=>({name:x.name,slug:x.slug,url:x.url,group:x.group,type:x.type,status:x.status}));
if(JSON.stringify(pinned)!==JSON.stringify(live))throw Error('LIVE_SOURCE_DRIFT: refuse to render outdated Guppy preview');
const proposal=buildGuppyDiscordIndexPreview(live,snapshot.threads,{guildActiveThreads:snapshot.guildActiveThreads});
const header=[
'# Guppypedia → Discord proposed source index — NOT POSTED',
'',
'> Editorial review only. This file is an inert preview, not an approved publication, bot command, or signoff. It contains no image licenses or pedigree claims.',
'',
'- Live public catalog verified: '+live.length+' Guppy entries; '+proposal.recordsIndexed+' source-linked show-label records proposed; '+proposal.tradeRecordsHeld+' held trade and hybrid-related labels.',
'- Existing seven bot-owned public thread starters captured: '+snapshot.capturedAt+' (source messages read back).',
'- Active guild threads last captured: '+snapshot.guildActiveThreads+' at '+snapshot.guildActiveThreadsCapturedAt+' (safety limit below 950).',
'- Reuses only two existing thread IDs and requires a fresh permission/receipt preflight **if** a later publisher is separately approved.',
'- No new threads or Discord messages were created.',
'- Generated preview message count: '+proposal.messages.length+'.',
'',
'## Proposed Discord messages (do not send without editorial and public-audience approval)',
''
];
for(const [i,entry] of proposal.messages.entries()){
 header.push('### Draft '+(i+1)+' of '+proposal.messages.length+' — '+entry.group+' — <https://discord.com/channels/1519337502379475095/'+entry.threadId+'>','','```text',entry.content,'```','');
}
const dest='docs/operations/guppy-discord-index-preview-20261021.md';
if(fs.existsSync(dest))throw Error('Preview already exists; do not overwrite');
fs.writeFileSync(dest,header.join('\n')+'\n',{encoding:'utf8',flag:'wx'});
console.log('GUPPY_PREVIEW_VERIFIED '+JSON.stringify({sourceRows:live.length,held:proposal.tradeRecordsHeld,proposed:proposal.recordsIndexed,messages:proposal.messages.length,messageLengths:proposal.messages.map(x=>x.content.length),destinationThreads:[...new Set(proposal.messages.map(x=>x.threadId))],publicationAuthorized:proposal.publicationAuthorized,sourceWrites:0,discordWrites:0}));
