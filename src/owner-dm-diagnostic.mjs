import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

// An intentionally content-free, owner-only diagnostic. Never stores inbound text.
export function ownerDmDiagnosticCommand() {
  return new SlashCommandBuilder()
    .setName('aq-dm-test')
    .setDescription('Owner-only Discord direct message delivery test')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
}

function safeDiscordErrorCode(error) {
  const code = error?.code;
  return typeof code === 'number' && Number.isSafeInteger(code)
    ? String(code)
    : 'UNKNOWN';
}

export function createOwnerDmDiagnostic({ ownerUserId, onStatus = () => {} }) {
  if (!/^\d{17,20}$/.test(String(ownerUserId ?? ''))) {
    throw new Error('Valid owner Discord user ID required for DM diagnostic');
  }
  const ownerId = String(ownerUserId);

  return Object.freeze({
    async handleIncoming(message) {
      if (!message || message.guildId != null || message.author?.bot) return false;
      if (String(message.author?.id) !== ownerId) return false;
      if (String(message.content ?? '').trim().toUpperCase() !== 'AQ-DM-TEST') return false;

      try {
        await message.reply({
          content: 'Aquapedia DM test received and acknowledged. This diagnostic did not record your message.',
          allowedMentions: { parse: [], repliedUser: false },
        });
        onStatus('OWNER_DM_INBOUND_ACK_OK');
      } catch (error) {
        onStatus('OWNER_DM_INBOUND_ACK_FAILED', safeDiscordErrorCode(error));
      }
      return true;
    },

    async handleCommand(interaction) {
      if (!interaction?.isChatInputCommand?.() || interaction.commandName !== 'aq-dm-test') return false;
      if (String(interaction.user?.id) !== ownerId) {
        await interaction.reply({
          content: 'This diagnostic is restricted to the Aquaphoria owner.',
          ephemeral: true,
        });
        return true;
      }

      await interaction.deferReply({ ephemeral: true });
      try {
        await interaction.user.send({
          content: 'Aquapedia owner-only DM delivery test. Reply with AQ-DM-TEST to verify bot reception. This does not enroll you in breeder interview recording.',
          allowedMentions: { parse: [] },
        });
        onStatus('OWNER_DM_OUTBOUND_ACCEPTED');
        await interaction.editReply('Discord accepted the test DM. Reply in the bot DM with AQ-DM-TEST to check the return path.');
      } catch (error) {
        const code = safeDiscordErrorCode(error);
        onStatus('OWNER_DM_OUTBOUND_FAILED', code);
        await interaction.editReply('Discord did not accept the test DM (error code: ' + code + '). Check privacy, blocking, and shared-server settings.');
      }
      return true;
    },
  });
}
