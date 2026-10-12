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

function enabled(value) {
  return ['1', 'true', 'yes'].includes(clean(value).toLowerCase());
}

function csv(value) {
  return clean(value).split(',').map((item) => item.trim()).filter(Boolean);
}

function boundedInt(value, fallback, low, high) {
  const number = asInt(value, fallback);
  if (!Number.isSafeInteger(number) || number < low || number > high) {
    throw new Error('Safety configuration number out of bounds');
  }
  return number;
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
    memberSafety: Object.freeze({
      enabled: enabled(env.AQUAPHORIA_MEMBER_EVENTS_ENABLED),
      welcomeChannelId: clean(env.AQUAPHORIA_WELCOME_CHANNEL_ID),
      alertChannelId: clean(env.AQUAPHORIA_STAFF_ALERT_CHANNEL_ID),
      joinWindowSeconds: boundedInt(env.AQUAPHORIA_JOIN_WINDOW_SECONDS, 60, 15, 600),
      burstThreshold: boundedInt(env.AQUAPHORIA_JOIN_BURST_THRESHOLD, 25, 5, 500),
    }),
    moderation: Object.freeze({
      enabled: enabled(env.AQUAPHORIA_MODERATION_ENABLED),
      channelIds: csv(env.AQUAPHORIA_MODERATION_CHANNEL_IDS),
      alertChannelId: clean(env.AQUAPHORIA_STAFF_ALERT_CHANNEL_ID),
      blockedDomains: csv(env.AQUAPHORIA_BLOCKED_DOMAINS),
    }),
    activity: Object.freeze({
      name: clean(env.AQUAPHORIA_BOT_ACTIVITY_NAME),
    }),
    fivem: Object.freeze({
      enabled: enabled(env.AQUAPHORIA_FIVEM_ACTIVITY_ENABLED),
      matchTerms: csv(env.AQUAPHORIA_FIVEM_ACTIVITY_MATCHES || 'fivem'),
      optOutRoleId: clean(env.AQUAPHORIA_FIVEM_OPT_OUT_ROLE_ID),
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
  const validId = (s) => /^\d{17,20}$/.test(s);
  if (config.memberSafety.enabled && config.memberSafety.alertChannelId && !validId(config.memberSafety.alertChannelId)) {
    throw new Error('AQUAPHORIA_STAFF_ALERT_CHANNEL_ID must be a channel ID');
  }
  if (config.memberSafety.enabled && config.memberSafety.welcomeChannelId && !validId(config.memberSafety.welcomeChannelId)) {
    throw new Error('AQUAPHORIA_WELCOME_CHANNEL_ID must be a channel ID');
  }
  if (config.moderation.enabled && (!config.moderation.channelIds.length || !config.moderation.alertChannelId)) {
    throw new Error('Marketplace moderation requires explicit monitored channel IDs and a staff alert channel ID');
  }
  if (config.moderation.enabled && ![config.moderation.alertChannelId, ...config.moderation.channelIds].every(validId)) {
    throw new Error('Marketplace moderation channel IDs must be Discord IDs');
  }
  if (config.activity.name.length > 128) throw new Error('Bot activity name exceeds 128 characters');
  if (config.fivem.enabled && !validId(config.fivem.optOutRoleId)) {
    throw new Error('FiveM activity requires a configured opt-out Discord role ID');
  }
  if (config.fivem.enabled && (!config.fivem.matchTerms.length || config.fivem.matchTerms.some((s) => s.length < 3 || s.length > 64))) {
    throw new Error('FiveM presence match terms must each be between 3 and 64 characters');
  }
}
