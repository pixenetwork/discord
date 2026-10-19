import { randomUUID } from 'node:crypto';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from 'discord.js';

const PREFIX = 'aqdm';
const TTL_MS = 5 * 60 * 1000;
const MAX_PENDING = 30;
const PUBLIC_SITE = 'https://aquapedia.app/';

export function aquapediaDmCommand() {
  return new SlashCommandBuilder()
    .setName('aquapedia-dm')
    .setDescription('Owner-only Aquapedia breeder outreach with a verified recipient and confirmation')
    .addSubcommand((sub) => sub
      .setName('draft')
      .setDescription('Preview a Discord DM; nothing is sent until you click Confirm')
      .addUserOption((option) => option
        .setName('recipient')
        .setDescription('Exact Discord account in this server')
        .setRequired(true))
      .addStringOption((option) => option
        .setName('message')
        .setDescription('Your message to this breeder (Aquapedia signature added)')
        .setRequired(true)
        .setMinLength(10)
        .setMaxLength(1500)));
}

export function formattedAquapediaDm(value) {
  const message = String(value ?? '').trim();
  if (message.length < 10 || message.length > 1500) throw new Error('DM text must be 10–1500 characters.');
  if (/@everyone|@here/i.test(message)) throw new Error('Mass mentions are not permitted in Aquapedia DMs.');
  return message + '\n\n— Aquapedia Research\n' + PUBLIC_SITE;
}

function controls(id) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${PREFIX}:send:${id}`).setLabel('Confirm and send DM').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`${PREFIX}:cancel:${id}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
  )];
}

function isOwner(interaction, deps) {
  return Boolean(deps?.config?.discord?.ownerUserId &&
    interaction?.user?.id === deps.config.discord.ownerUserId &&
    interaction?.guildId === deps.config.discord.guildId);
}

function auditChannel(guild) {
  return guild?.channels?.cache?.find?.((channel) => channel.name === '🧾・audit-log' && channel.isTextBased()) ?? null;
}

export function createAquapediaDmController({ now = Date.now, makeId = randomUUID } = {}) {
  const pending = new Map();
  const prune = () => {
    for (const [id, draft] of pending) if (now() > draft.expiresAt || draft.state === 'done') pending.delete(id);
  };

  return Object.freeze({
    async handle(interaction, deps) {
      const button = interaction.isButton?.() && String(interaction.customId ?? '').startsWith(`${PREFIX}:`);
      const command = interaction.isChatInputCommand?.() && interaction.commandName === 'aquapedia-dm';
      if (!button && !command) return false;

      if (!isOwner(interaction, deps)) {
        await interaction.reply({ content: 'Aquapedia outreach is restricted to the server owner.', ephemeral: true });
        return true;
      }

      prune();
      if (command) {
        if (interaction.options.getSubcommand() !== 'draft') return true;
        if (pending.size >= MAX_PENDING) {
          await interaction.reply({ content: 'Too many pending previews. Wait for drafts to expire before creating more.', ephemeral: true });
          return true;
        }

        const selected = interaction.options.getUser('recipient', true);
        if (!selected?.id || selected.bot || selected.id === interaction.user.id) {
          await interaction.reply({ content: 'Select a real breeder account, not a bot or yourself.', ephemeral: true });
          return true;
        }
        // A Discord user-picker is not proof of guild membership. Resolve exactly by ID.
        const member = await interaction.guild.members.fetch(selected.id).catch(() => null);
        if (!member || member.id !== selected.id || member.user?.bot) {
          await interaction.reply({ content: 'Recipient is not a verified member of this Discord server. No DM prepared.', ephemeral: true });
          return true;
        }

        const content = formattedAquapediaDm(interaction.options.getString('message', true));
        const id = makeId();
        pending.set(id, {
          state: 'pending', ownerId: interaction.user.id, guildId: interaction.guildId,
          recipientId: member.id, recipientLabel: member.user?.tag ?? selected.tag ?? member.id,
          content, expiresAt: now() + TTL_MS,
        });
        await interaction.reply({
          content: `**Private DM preview — NOT SENT**\nRecipient: ${member.user?.tag ?? member.id} (ID: \`${member.id}\`)\n\n${content}\n\nConfirm within five minutes. This will be sent from the Discord bot, not your personal account.`,
          components: controls(id), ephemeral: true, allowedMentions: { parse: [] },
        });
        return true;
      }

      const [, action, id] = String(interaction.customId).split(':');
      const draft = pending.get(id);
      if (!draft || draft.state !== 'pending' || draft.expiresAt < now() ||
          draft.ownerId !== interaction.user.id || draft.guildId !== interaction.guildId) {
        await interaction.reply({ content: 'This preview is missing, expired, or already handled. Create a fresh draft if needed.', ephemeral: true });
        return true;
      }

      draft.state = 'done'; // claim before any await; never auto-retry an ambiguous delivery
      pending.delete(id);
      if (action === 'cancel') {
        await interaction.update({ content: 'Aquapedia DM canceled. Nothing was sent.', components: [] });
        return true;
      }
      if (action !== 'send') {
        await interaction.update({ content: 'Unknown action; nothing was sent.', components: [] });
        return true;
      }

      await interaction.deferUpdate();
      const member = await interaction.guild.members.fetch(draft.recipientId).catch(() => null);
      if (!member || member.id !== draft.recipientId || member.user?.bot) {
        await interaction.editReply({ content: 'Recipient could not be reverified. No DM sent.', components: [] });
        return true;
      }
      const audit = auditChannel(interaction.guild);
      if (!audit) {
        await interaction.editReply({ content: 'Required private audit channel unavailable. No DM sent.', components: [] });
        return true;
      }
      try {
        await audit.send({
          content: `📨 Aquapedia DM send attempt: recipient ID \`${draft.recipientId}\`, initiated by \`${draft.ownerId}\`, confirmation \`${id}\`.`,
          allowedMentions: { parse: [] },
        });
      } catch {
        await interaction.editReply({ content: 'Audit preflight failed. No DM sent.', components: [] });
        return true;
      }

      let sent;
      try {
        sent = await member.send({ content: draft.content, allowedMentions: { parse: [] } });
      } catch {
        await audit.send({
          content: `⚠️ Aquapedia DM attempt \`${id}\` did not return a successful send receipt. Delivery uncertain; do not retry blindly.`,
          allowedMentions: { parse: [] },
        }).catch(() => undefined);
        await interaction.editReply({ content: 'Discord did not confirm DM delivery (recipient privacy settings or network error). No automatic retry. Check before trying again.', components: [] });
        return true;
      }
      const receipt = `✅ Aquapedia DM confirmed to \`${draft.recipientId}\`: Discord message \`${sent.id}\` via bot \`${sent.author?.id ?? 'unknown'}\` (confirmation \`${id}\`).`;
      let auditSaved = true;
      try { await audit.send({ content: receipt, allowedMentions: { parse: [] } }); }
      catch { auditSaved = false; }
      await interaction.editReply({
        content: `${receipt}\n${auditSaved ? 'Private audit receipt recorded.' : '⚠️ Audit receipt could not be posted; preserve the message ID above.'}`,
        components: [], allowedMentions: { parse: [] },
      });
      return true;
    },
  });
}

// One controller per running worker; individual command interactions do not recreate pending drafts.
export const aquapediaDmController = createAquapediaDmController();
