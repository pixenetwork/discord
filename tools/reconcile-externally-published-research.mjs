import { readFile } from 'node:fs/promises';
import { createStore } from '../src/store.mjs';
import { reconcileExternalPublication } from '../src/research-publication-evidence.mjs';

// Manually invoked by an authorized operator on the existing Main PC.
// Writes an independent immutable evidence receipt, never the live worker JSON.
const args = process.argv.slice(2);
function arg(name) {
  const i = args.indexOf(name);
  if (i < 0 || !args[i + 1]) throw new Error('Missing required argument: ' + name);
  return args[i + 1];
}
const jobId = arg('--job');
const dataDir = arg('--data-dir');
const receiptPath = arg('--receipt');
const token = process.env.DISCORD_TOKEN;
const guildId = process.env.AQUAPHORIA_GUILD_ID;
if (!token || !guildId) throw new Error('Aquaphoria Discord bot environment is not configured');
const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
const store = createStore({ dataDir });
const result = await reconcileExternalPublication({
  store, jobId, receipt, discordToken: token, guildId,
  medakaForumId: '1561189286399705128',
});
console.log(JSON.stringify({
  jobId: result.jobId,
  originalJobStatus: (await store.getResearchJob(jobId)).status,
  evidenceStatus: result.evidenceStatus,
  siteUrl: result.siteUrl,
  discordThreadId: result.discordThreadId,
  recordedAt: result.recordedAt,
  nextStep: 'Original creator/parentage still requires breeder confirmation',
}));
