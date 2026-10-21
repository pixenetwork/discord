import assert from 'node:assert/strict';

const token = process.env.DISCORD_TOKEN;
const app = process.env.DISCORD_APPLICATION_ID;
const guild = process.env.AQUAPHORIA_GUILD_ID;
if (!token || !app || !guild) throw new Error('Discord identity is not configured');
const url = 'https://discord.com/api/v10/applications/' +
  encodeURIComponent(app) + '/guilds/' + encodeURIComponent(guild) + '/commands';
const response = await fetch(url, {
  method: 'GET',
  headers: { Authorization: 'Bot ' + token },
  signal: AbortSignal.timeout(12000),
});
if (!response.ok) throw new Error('Discord read-only command check HTTP ' + response.status);
const commands = await response.json();
assert.ok(Array.isArray(commands), 'Unexpected Discord command list');
const queue = commands.find((command) => command.name === 'research-queue');
const research = commands.some((command) => command.name === 'research');
const restricted = queue?.default_member_permissions === '8';
console.log(JSON.stringify({
  guildCommands: commands.length,
  researchRegistered: research,
  researchQueueRegistered: Boolean(queue),
  administratorDefaultPermission: restricted,
}));
if (!queue || !research || !restricted) process.exitCode = 2;
