/**
 * One-shot, REST-only Aquapedia magazine publisher.
 * No second Gateway login, no command registration, no bot restart, no token logging.
 * Run with --check (read-only) or --publish (create/update and verify receipts).
 */
import { Client, ClientUser, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { MAGAZINE_ISSUES, locatePublicMagazineForum, publishMagazineIssues } from '../src/magazine-publications.mjs';

dotenv.config();
const args = new Set(process.argv.slice(2));
const write = args.has('--publish');
const check = args.has('--check');
if ((write ? 1 : 0) + (check ? 1 : 0) !== 1) {
  console.error('Usage: node tools/publish-magazine-companions.mjs --check|--publish');
  process.exitCode = 2;
} else {
  const token = process.env.DISCORD_TOKEN;
  const guildId = process.env.AQUAPHORIA_GUILD_ID;
  if (!token || !guildId) {
    console.error('BLOCKED: DISCORD_TOKEN and AQUAPHORIA_GUILD_ID must be configured in the active operator environment. No posts sent.');
    process.exitCode = 3;
  } else {
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    try {
      client.rest.setToken(token);
      const identity = await client.rest.get('/users/@me');
      client.user = new ClientUser(client, identity);
      const guild = await client.guilds.fetch(guildId);
      if (!guild || guild.id !== guildId) throw Error('Guild identity mismatch');
      if (check) {
        const { parent, forum } = await locatePublicMagazineForum(guild, { createIfMissing: false });
        console.log(JSON.stringify({
          mode: 'check', guildId: guild.id, botId: client.user.id,
          publicParent: parent.id, existingForumId: forum?.id ?? null,
          sourceIssueCount: MAGAZINE_ISSUES.length,
          indexedTopicCount: MAGAZINE_ISSUES.reduce((n, issue) => n + issue.topics.length, 0),
          postsSent: 0,
        }, null, 2));
      } else {
        const receipt = await publishMagazineIssues(guild, { createForum: true });
        if (receipt.receipts.length !== MAGAZINE_ISSUES.length ||
            !receipt.receipts.every((row) => row.verified)) {
          throw Error('Discord readback incomplete; publication NOT certified');
        }
        const dir = resolve(process.cwd(), 'data');
        await mkdir(dir, { recursive: true });
        const file = resolve(dir, 'aquapedia-english-magazine-receipts.json');
        const temp = file + '.tmp';
        await writeFile(temp, JSON.stringify({
          ...receipt, at: new Date().toISOString(),
          liveSite: 'https://aquapedia.app/magazines/',
        }, null, 2), { encoding: 'utf8', mode: 0o600 });
        await rename(temp, file);
        console.log(JSON.stringify({
          status: 'verified', created: receipt.posted, updated: receipt.updated,
          issueCount: receipt.receipts.length, forumId: receipt.forumId,
          receipts: receipt.receipts,
          receiptFile: file,
        }, null, 2));
      }
    } catch (error) {
      console.error('BLOCKED: ' + String(error?.message ?? error).slice(0, 500));
      process.exitCode = 1;
    } finally {
      client.destroy();
    }
  }
}
