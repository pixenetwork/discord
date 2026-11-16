const HOSTOPS_NOTICE = 'Host operations are not executed by the Aquaphoria Discord worker. The Pixel Network HQ HostOps handler must be online to process /jarvishost. No host action was performed.';
const UNKNOWN_NOTICE = 'This command is not handled by the Aquaphoria Discord worker. Check the registered Aquaphoria commands or contact the server owner.';

export async function acknowledgeUnsupportedAquaphoriaCommand(interaction) {
  if (!interaction?.isChatInputCommand?.()) return false;

  const content = interaction.commandName === 'jarvishost' ? HOSTOPS_NOTICE : UNKNOWN_NOTICE;
  const payload = { content, ephemeral: true, allowedMentions: { parse: [] } };

  if (interaction.deferred) await interaction.editReply(payload);
  else if (interaction.replied) await interaction.followUp(payload);
  else await interaction.reply(payload);
  return true;
}
