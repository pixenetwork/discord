import 'dotenv/config';

function asInt(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function loadConfig(env = process.env) {
  const markupPercent = asNumber(env.AQUAPHORIA_DEFAULT_MARKUP_PERCENT, 5);
  if (markupPercent < 0 || markupPercent > 100) {
    throw new Error('AQUAPHORIA_DEFAULT_MARKUP_PERCENT must be between 0 and 100');
  }

  const storeDomain = clean(env.SHOPIFY_STORE_DOMAIN).replace(/^https?:\/\//, '').replace(/\/$/, '');

  return Object.freeze({
    discord: Object.freeze({
      token: clean(env.DISCORD_TOKEN),
      applicationId: clean(env.DISCORD_APPLICATION_ID),
      guildId: clean(env.AQUAPHORIA_GUILD_ID),
      ownerUserId: clean(env.AQUAPHORIA_OWNER_USER_ID),
    }),
    runtime: Object.freeze({
      port: asInt(env.PORT, 8787),
      dataDir: clean(env.DATA_DIR) || './data',
    }),
    marketplace: Object.freeze({
      defaultMarkupPercent: markupPercent,
    }),
    shopify: Object.freeze({
      storeDomain,
      accessToken: clean(env.SHOPIFY_ADMIN_ACCESS_TOKEN),
      apiVersion: clean(env.SHOPIFY_API_VERSION) || '2026-07',
      webhookSecret: clean(env.SHOPIFY_WEBHOOK_SECRET),
      locationId: clean(env.SHOPIFY_LOCATION_ID),
    }),
    openai: Object.freeze({
      apiKey: clean(env.OPENAI_API_KEY),
      model: clean(env.OPENAI_MODEL) || 'gpt-5',
    }),
    jarvis: Object.freeze({
      researchEndpoint: clean(env.JARVIS_RESEARCH_ENDPOINT),
      apiKey: clean(env.JARVIS_RESEARCH_API_KEY),
    }),
    aquapedia: Object.freeze({
      githubToken: clean(env.AQUAPEDIA_GITHUB_TOKEN),
      repository: clean(env.AQUAPEDIA_REPOSITORY) || 'pixenetwork/aquapedia',
      branch: clean(env.AQUAPEDIA_BRANCH) || 'main',
    }),
  });
}

export function assertDiscordConfig(config) {
  const missing = [];
  if (!config.discord.token) missing.push('DISCORD_TOKEN');
  if (!config.discord.applicationId) missing.push('DISCORD_APPLICATION_ID');
  if (!config.discord.guildId) missing.push('AQUAPHORIA_GUILD_ID');
  if (!config.discord.ownerUserId) missing.push('AQUAPHORIA_OWNER_USER_ID');
  if (missing.length) throw new Error(`Missing required Discord configuration: ${missing.join(', ')}`);
}
