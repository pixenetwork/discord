import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMedaka79Index } from '../src/medaka79-research-index.mjs';

const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=readFileSync(path.join(base,'resources/aquapedia-medaka79-20261020.json'));
const plan=buildMedaka79Index(JSON.parse(source),{rawSource:source});
if (process.argv.includes('--json')) {
  process.stdout.write(JSON.stringify(plan,null,2)+'\n');
} else {
  process.stdout.write(JSON.stringify({
    id:plan.jobId,
    status:plan.status,
    approvalRequired:plan.approvalRequired,
    forumId:plan.forumId,
    guildId:plan.guildId,
    sourceSha256:plan.sourceSha256,
    records:plan.records,
    evidenceCounts:plan.counts,
    plannedMessages:1+plan.parts.length,
    messageLengths:[plan.starter.length,...plan.parts.map(x=>x.content.length)],
    websiteUrl:plan.websiteUrl,
    noPhotos:true,
    requiresLiveDiscordMessageReadback:true,
  },null,2)+'\n');
}
