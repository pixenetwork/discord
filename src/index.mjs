import { createServer } from 'node:http';
import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { createBreederInbox } from './breeder-inbox.mjs';
import { loadConfig, assertDiscordConfig } from './config.mjs';
import { createStore } from './store.mjs';
import { createShopifyClient } from './shopify.mjs';
import { createCatalogService } from './catalog.mjs';
import { createCollectionService } from './collections.mjs';
import { createResearchService } from './research.mjs';
import { createOrderService } from './orders.mjs';
import { createGptController } from './gpt.mjs';
import { createPaidOrderWebhookHandler } from './webhook-handler.mjs';
import { handleInteraction, registerGuildCommands } from './commands.mjs';
import { provisionTranslatedPublicationsForum, provisionShrimpPublicResearchForum, provisionArowanaPublicResearchForum, provisionGuppyPublicResearchResources } from './layout.mjs';

const config = loadConfig();
assertDiscordConfig(config);

const store = createStore({ dataDir: config.runtime.dataDir });
const shopify = createShopifyClient(config.shopify);
const catalog = createCatalogService({ config, store, shopify });
const collections = createCollectionService({ shopify, store });
const research = createResearchService({ jarvis: config.jarvis, aquapedia: config.aquapedia, store });
const orders = createOrderService({ config, store, shopify });
const deps = Object.freeze({ config, store, shopify, catalog, collections, research, orders });
const gpt = createGptController(deps);

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages], partials: [Partials.Channel] });
const breederInbox = createBreederInbox({ recipientIds: ['1202839835849662465'], outputDir: 'C:\\Users\\duy\\aquapedia-ops-logs' });
client.on(Events.MessageCreate, (message) => { void breederInbox(message).catch((error) => console.error('Breeder inbox capture failed:', error.message)); });
// The supervisor monitors gateway liveness; full bootstrap readiness is checked separately.
let bootstrapComplete = false;
let bootstrapFailed = false;

async function aquaphoriaGuild() {
  return client.guilds.cache.get(config.discord.guildId) ?? client.guilds.fetch(config.discord.guildId);
}

async function logBotError(message) {
  console.error(message);
  if (!client.isReady()) return;
  const guild = await aquaphoriaGuild().catch(() => null);
  const channel = guild?.channels?.cache?.find((candidate) => candidate.name === '🤖・bot-log' && candidate.isTextBased());
  if (channel) await channel.send(`❌ ${String(message).slice(0, 1800)}`).catch(() => undefined);
}

const handlePaidOrderWebhook = createPaidOrderWebhookHandler({
  shopify,
  store,
  orders,
  getGuild: aquaphoriaGuild,
  logError: logBotError,
});

client.once(Events.ClientReady, async (readyClient) => {
  try {
    const guild = await aquaphoriaGuild();
    // Resolve the configured member via Discord before creating private permission overwrites.
    // A valid member may be absent from the Gateway's cold-start cache.
    await guild.members.fetch(config.discord.ownerUserId);
    await provisionTranslatedPublicationsForum(guild, { ownerUserId: config.discord.ownerUserId, store });
    // The shared public Shrimpapedia forum is safe to provision only if Aquapedia is already public.
    // Unlike the private publications forum, a missing/nonpublic category must not block worker startup.
    const publicShrimp = await provisionShrimpPublicResearchForum(guild).catch(() => ({ status: 'setup_unavailable' }));
    if (publicShrimp.status !== 'ready') console.warn(`Shrimpapedia public forum not provisioned: ${publicShrimp.status}`);
    const publicArowana = await provisionArowanaPublicResearchForum(guild).catch(() => ({ status: 'setup_unavailable' }));
    if (publicArowana.status !== 'ready') console.warn(`Arowanapedia public forum not provisioned: ${publicArowana.status}`);
    const publicGuppy = await provisionGuppyPublicResearchResources(guild).catch(() => ({ status: 'setup_unavailable' }));
    if (publicGuppy.status !== 'ready') console.warn(`Guppypedia public resources not provisioned: ${publicGuppy.status}`);
    await registerGuildCommands(guild);
    await gpt.register(guild);
    bootstrapComplete = true;
    console.log(`Aquaphoria Discord worker ready as ${readyClient.user.tag} in ${guild.name}`);
  } catch (error) {
    bootstrapFailed = true;
    await logBotError(`Discord startup failed: ${error.stack ?? error.message}`);
  }
});

client.on(Events.InteractionCreate, (interaction) => {
  void (async () => {
    const handledByGpt = await gpt.handle(interaction);
    if (!handledByGpt) await handleInteraction(interaction, deps);
  })().catch((error) => logBotError(`Interaction routing failed: ${error.stack ?? error.message}`));
});

client.on(Events.Error, (error) => {
  void logBotError(`Discord client error: ${error.stack ?? error.message}`);
});

async function readRawBody(request, maxBytes = 2 * 1024 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > maxBytes) throw Object.assign(new Error('Request body too large'), { statusCode: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    if (request.method === 'GET' && url.pathname === '/health') {
      response.writeHead(client.isReady() ? 200 : 503, { 'Content-Type': 'application/json' });
      return response.end(JSON.stringify({ ok: client.isReady(), initialized: bootstrapComplete, startupFailed: bootstrapFailed, service: 'aquaphoria-discord', gptConfigured: Boolean(config.openai.apiKey) }));
    }

    if (request.method === 'GET' && url.pathname === '/ready') {
      const ready = client.isReady() && bootstrapComplete;
      response.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json' });
      return response.end(JSON.stringify({ ok: ready, initialized: bootstrapComplete, startupFailed: bootstrapFailed, service: 'aquaphoria-discord' }));
    }

    if (request.method === 'POST' && url.pathname === '/webhooks/shopify/orders-paid') {
      const rawBody = await readRawBody(request);
      const hmac = request.headers['x-shopify-hmac-sha256'];
      const result = await handlePaidOrderWebhook({ rawBody, hmac });
      response.writeHead(result.statusCode, { 'Content-Type': 'application/json' });
      return response.end(JSON.stringify(result.body));
    }

    response.writeHead(404, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ ok: false, error: 'not_found' }));
  } catch (error) {
    const status = error.statusCode ?? 500;
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ ok: false, error: status === 500 ? 'internal_error' : error.message }));
    await logBotError(`HTTP worker error: ${error.stack ?? error.message}`);
  }
});

server.listen(config.runtime.port, () => {
  console.log(`Aquaphoria webhook/health server listening on :${config.runtime.port}`);
});

async function shutdown(signal) {
  console.log(`Received ${signal}; shutting down Aquaphoria Discord worker`);
  server.close();
  client.destroy();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

await client.login(config.discord.token);
