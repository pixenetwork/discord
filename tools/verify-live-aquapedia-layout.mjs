import { REST, Routes, ChannelType, PermissionFlagsBits } from 'discord.js';
import { layoutDefinition } from '../src/layout.mjs';

// Read-only live parity: no provisioning, edits, posts, archival, or permission changes.
// Supply DISCORD_TOKEN and AQUAPHORIA_GUILD_ID from the authorized existing bot runtime.
const guildId = process.env.AQUAPHORIA_GUILD_ID;
const token = process.env.DISCORD_TOKEN;
if (!token || guildId !== '1519337502379475095') throw new Error('Missing or unexpected authorized guild runtime');
const rest = new REST({ version: '10' }).setToken(token);
const [channels, roles] = await Promise.all([
  rest.get(Routes.guildChannels(guildId)),
  rest.get(Routes.guildRoles(guildId)),
]);
const everyoneRole = roles.find(role => role.id === guildId);
if (!everyoneRole) throw new Error('Missing @everyone role');
const byId = new Map(channels.map(channel => [channel.id, channel]));
const errors = [];
const required = layoutDefinition().filter(section => section.requireExisting);
const categoryNames = new Set();
const forumNames = new Set();
let forumsChecked = 0;
let textChannelsChecked = 0;
function publicRead(channel, parent = null) {
  let flags = BigInt(everyoneRole.permissions);
  for (const item of [parent, channel]) {
    if (!item) continue;
    const overwrite = item.permission_overwrites?.find(row => row.id === guildId);
    if (!overwrite) continue;
    flags = (flags & ~BigInt(overwrite.deny)) | BigInt(overwrite.allow);
  }
  return (flags & PermissionFlagsBits.ViewChannel) !== 0n
    && (flags & PermissionFlagsBits.ReadMessageHistory) !== 0n;
}
function expectedTags(forum) { return [...forum.tags.map(tag => tag.name)].sort(); }
for (const section of required) {
  if (categoryNames.has(section.category)) errors.push('Duplicate canonical spec ' + section.category);
  categoryNames.add(section.category);
  const category = byId.get(section.categoryId);
  if (!category || category.type !== ChannelType.GuildCategory || category.name !== section.category) {
    errors.push('Canonical category ID/name/type mismatch: ' + section.category);
    continue;
  }
  if (channels.filter(c => c.type === ChannelType.GuildCategory && c.name === section.category).length !== 1) {
    errors.push('Duplicate category name: ' + section.category);
  }
  if (!publicRead(category)) errors.push('Public category unreadable to @everyone: ' + section.category);
  for (const [name, topic] of section.channels) {
    const candidates = channels.filter(c => c.name === name);
    if (candidates.length !== 1 || candidates[0].type !== ChannelType.GuildText
      || candidates[0].parent_id !== category.id || candidates[0].topic !== topic) {
      errors.push('Intro channel drift: ' + name);
    }
    textChannelsChecked++;
  }
  for (const spec of section.forums ?? []) {
    if (forumNames.has(spec.name)) errors.push('Duplicate spec name: ' + spec.name);
    forumNames.add(spec.name);
    const forum = byId.get(spec.id);
    if (!forum || forum.name !== spec.name || forum.type !== ChannelType.GuildForum
      || forum.parent_id !== category.id) {
      errors.push('Protected forum ID/name/parent mismatch: ' + spec.name);
      continue;
    }
    if (channels.filter(c => c.name === spec.name).length !== 1) errors.push('Duplicate forum title: ' + spec.name);
    if (!publicRead(forum, category)) errors.push('Public forum unreadable to @everyone: ' + spec.name);
    if (forum.topic !== spec.topic) errors.push('Forum topic drift: ' + spec.name);
    const tags = forum.available_tags ?? [];
    const names = tags.map(tag => tag.name);
    if (new Set(names).size !== names.length
      || names.length !== spec.tags.length
      || JSON.stringify(names.sort()) !== JSON.stringify(expectedTags(spec))
      || tags.some(tag => !tag.id || tag.moderated !== false)) {
      errors.push('Forum tag drift: ' + spec.name);
    }
    forumsChecked++;
  }
}
const summary = {
  status: errors.length ? 'FAIL' : 'PASS',
  checkedAt: new Date().toISOString(),
  categoriesChecked: required.length,
  textChannelsChecked,
  forumsChecked,
  errors,
};
console.log('AQUAPEDIA_LIVE_LAYOUT_PARITY ' + JSON.stringify(summary));
if (errors.length) process.exitCode = 1;
