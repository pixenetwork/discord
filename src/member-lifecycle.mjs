import { PermissionFlagsBits } from 'discord.js';

const MAX_JOIN_SAMPLES = 500;
const ALERT_COOLDOWN_MS = 5 * 60_000;

export function trackJoinBurst(history, nowMs, { windowMs = 60_000, threshold = 25 } = {}) {
  if (!Array.isArray(history)) throw new TypeError('join history must be an array');
  const recent = history.filter((time) => Number.isFinite(time) && time > nowMs - windowMs && time <= nowMs);
  recent.push(nowMs);
  return { history: recent.slice(-MAX_JOIN_SAMPLES), burst: recent.length >= threshold, count: recent.length };
}

export function isPrivateStaffChannel(channel, guild) {
  if (!channel?.isTextBased?.() || !guild?.roles?.everyone) return false;
  const permission = channel.permissionsFor?.(guild.roles.everyone);
  return Boolean(permission && permission.has(PermissionFlagsBits.ViewChannel) === false);
}

export function createMemberLifecycle({ config, store, logError = () => {} }) {
  if (!config?.discord?.guildId || !config?.memberSafety) throw new TypeError('member lifecycle config missing');
  let history = [];
  let lastBurstAlert = 0;

  async function notifyStaff(guild, message) {
    const id = config.memberSafety.alertChannelId;
    if (!id) return false;
    const channel = guild.channels.cache.get(id) ?? await guild.channels.fetch(id).catch(() => null);
    if (!isPrivateStaffChannel(channel, guild)) {
      logError('Member alert skipped: designated channel is missing or publicly accessible');
      return false;
    }
    await channel.send({ content: message, allowedMentions: { parse: [] } });
    return true;
  }

  async function onJoin(member, nowMs = Date.now()) {
    if (!config.memberSafety.enabled || member?.guild?.id !== config.discord.guildId || member.user?.bot) return false;
    const guild = member.guild;
    const joined = trackJoinBurst(history, nowMs, {
      windowMs: config.memberSafety.joinWindowSeconds * 1000,
      threshold: config.memberSafety.burstThreshold,
    });
    history = joined.history;

    if (joined.burst && nowMs - lastBurstAlert >= ALERT_COOLDOWN_MS) {
      lastBurstAlert = nowMs;
      await notifyStaff(guild, 'Aquaphoria member safety: ' + joined.count + ' members joined within ' +
        config.memberSafety.joinWindowSeconds + ' seconds. Review recent joins for possible raid activity.');
    }

    const vendor = await store.getVendorByDiscordUser(member.id);
    if (vendor) {
      await notifyStaff(guild, 'Aquaphoria vendor ' + vendor.id +
        ' has rejoined. Staff verification is required before restoring private vendor access.');
    }

    const welcomeId = config.memberSafety.welcomeChannelId;
    if (welcomeId) {
      const channel = guild.channels.cache.get(welcomeId) ?? await guild.channels.fetch(welcomeId).catch(() => null);
      if (channel?.isTextBased?.()) {
        await channel.send({
          content: 'Welcome to Aquaphoria, <@' + member.id + '>! Please review our server rules and community guidance.',
          allowedMentions: { users: [member.id], roles: [], repliedUser: false },
        });
      }
    }
    return true;
  }

  async function onLeave(member) {
    if (!config.memberSafety.enabled || member?.guild?.id !== config.discord.guildId || member.user?.bot) return false;
    const vendor = await store.getVendorByDiscordUser(member.id);
    if (vendor) {
      await notifyStaff(member.guild, 'Aquaphoria vendor ' + vendor.id +
        ' left the server. Discord removes their membership roles automatically. Review vendor access before reapproval.');
    }
    return true;
  }

  return { onJoin, onLeave };
}
