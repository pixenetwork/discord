import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { acknowledgeUnsupportedAquaphoriaCommand } from '../src/unsupported-command.mjs';

const commandsSource = readFileSync(new URL('../src/commands.mjs', import.meta.url), 'utf8');

function makeInteraction(commandName) {
  return {
    commandName,
    deferred: false,
    replied: false,
    isChatInputCommand: () => true,
    async reply(payload) { this.replied = true; this.payload = payload; },
    async editReply(payload) { this.payload = payload; },
    async followUp(payload) { this.payload = payload; },
  };
}

test('stale /jarvishost is acknowledged without executing host operations', async () => {
  const interaction = makeInteraction('jarvishost');
  assert.equal(await acknowledgeUnsupportedAquaphoriaCommand(interaction), true);
  assert.equal(interaction.replied, true);
  assert.equal(interaction.payload.ephemeral, true);
  assert.match(interaction.payload.content, /Pixel Network HQ HostOps handler/);
  assert.match(interaction.payload.content, /No host action was performed/);
  assert.deepEqual(interaction.payload.allowedMentions, { parse: [] });
});

test('unrecognized slash commands are acknowledged instead of timing out', async () => {
  const interaction = makeInteraction('legacy-command');
  assert.equal(await acknowledgeUnsupportedAquaphoriaCommand(interaction), true);
  assert.equal(interaction.replied, true);
  assert.equal(interaction.payload.ephemeral, true);
  assert.match(interaction.payload.content, /not handled by the Aquaphoria Discord worker/);
});

test('deferred unsupported command edits its original response', async () => {
  const interaction = makeInteraction('jarvishost');
  interaction.deferred = true;
  await acknowledgeUnsupportedAquaphoriaCommand(interaction);
  assert.equal(interaction.replied, false);
  assert.match(interaction.payload.content, /No host action was performed/);
});

test('already-replied unsupported command uses a follow-up', async () => {
  const interaction = makeInteraction('legacy-command');
  interaction.replied = true;
  await acknowledgeUnsupportedAquaphoriaCommand(interaction);
  assert.match(interaction.payload.content, /not handled by the Aquaphoria Discord worker/);
});

test('non-chat interactions are left to their own handlers', async () => {
  const interaction = { commandName: 'legacy-command', isChatInputCommand: () => false };
  assert.equal(await acknowledgeUnsupportedAquaphoriaCommand(interaction), false);
});

test('Aquaphoria router handles /jarvishost before the Aquapedia-only guard', () => {
  const hostOpsRoute = commandsSource.indexOf("if (interaction.commandName === 'jarvishost')");
  const aquapediaOnlyGuard = commandsSource.indexOf("if (process.env.AQUAPEDIA_ONLY === 'true'");
  assert.ok(hostOpsRoute >= 0, 'missing explicit /jarvishost safe response route');
  assert.ok(aquapediaOnlyGuard >= 0, 'missing Aquapedia-only command guard');
  assert.ok(hostOpsRoute < aquapediaOnlyGuard, 'HostOps explanation must not be mislabeled as a commerce command');
});

test('Aquaphoria router sends all other unknown commands to the safe acknowledgement fallback', () => {
  const ticketRoute = commandsSource.indexOf("if (interaction.commandName === 'ticket')");
  const catchBlock = commandsSource.indexOf("} catch (error) {", ticketRoute);
  const fallback = commandsSource.indexOf("return await acknowledgeUnsupportedAquaphoriaCommand(interaction);", ticketRoute);
  assert.ok(ticketRoute >= 0, 'missing last supported command route');
  assert.ok(fallback > ticketRoute && fallback < catchBlock, 'missing unknown-command acknowledgement after supported routes');
});
