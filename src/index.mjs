import { createServer } from 'node:http';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { loadConfig, assertDiscordConfig } from './config.mjs';
import { createStore } from './store.mjs';
import { createShopifyClient } from './shopify.mjs';
import { createCatalogService } from './catalog.mjs';
import { createResearchService } from './research.mjs';
import { createOrderService } from './orders.mjs';
import { handleInteraction, registerGuildCommands } from './commands.mjs';

const config = loadConfig();
assertDiscordConfig(config);

const store = createStore({ dataDir: config.runtime.dataDir });
const shopify = createShopifyClient(config.shopify);
const catalog = createCatalogService({ config, store, shopify });
const research = createResearchService({ jarvis: config.jarvis, aquapedia: config.aquapedia, store });
const orders = createOrderService({ config, store, shopify });
const deps = Object.freeze({ config, store, shopify, catalog, research, orders });

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

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

client.once(Events.ClientReady, async (readyClient) => {
  try {
    const guild = await aquaphoriaGuild();
    await registerGuildCommands(guild);
    console.log(`Aquaphoria Discord worker ready as ${readyClient.user.tag} in ${guild.name}`);
  } catch (error) {
    await logBotError(`Discord startup failed: ${error.stack ?? error.message}`);
  }
});

client.on(Events.InteractionCreate, (interaction) => {
  void handleInteraction(interaction, deps);
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
      return response.end(JSON.stringify({ ok: client.isReady(), service: 'aquaphoria-discord' }));
    }

    if (request.method === 'POST' && url.pathname === '/webhooks/shopify/orders-paid') {
      const rawBody = await readRawBody(request);
      const hmac = request.headers['x-shopify-hmac-sha256'];
      if (!shopify.verifyWebhook(rawBody, hmac)) {
        response.writeHead(401, { 'Content-Type': 'application/json' });
        return response.end(JSON.stringify({ ok: false, error: 'invalid_hmac' }));
      }

      const order = JSON.parse(rawBody.toString('utf8'));
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ ok: true }));

      void (async () => {
        try {
          const guild = await aquaphoriaGuild();
          await orders.routePaidOrder(guild, order);
        } catch (error) {
          await logBotError(`Shopify order routing failed for ${order?.name ?? order?.id ?? 'unknown order'}: ${error.stack ?? error.message}`);
        }
      })();
      return;
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
