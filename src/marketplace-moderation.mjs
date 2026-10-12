import { isPrivateStaffChannel } from './member-lifecycle.mjs';

const LINK_RE = /https?:\/\/[^\s<>]+/gi;
const MAX_DEDUP = 500;

function hostname(url) {
  try { return new URL(url).hostname.toLowerCase().replace(/\.$/, ''); }
  catch { return null; }
}

export function detectMarketplaceRisks(content, { blockedDomains = [] } = {}) {
  if (typeof content !== 'string' || !content) return [];
  const reasons = new Set();
  const normalized = content.normalize('NFKC');
  const blocked = blockedDomains.map((s) => s.toLowerCase().trim()).filter(Boolean);

  for (const match of normalized.matchAll(LINK_RE)) {
    const host = hostname(match[0]);
    if (!host) continue;
    if (blocked.some((domain) => host === domain || host.endsWith('.' + domain))) {
      reasons.add('Administrator-blocked link');
    }
    if (host.startsWith('xn--') || host.includes('.xn--')) reasons.add('Punycode link review');
    if (/^(?:discord|steam|paypal)[a-z0-9-]*(?:verify|login|gift|free|nitro)[a-z0-9-]*\.(?:xyz|top|click|icu|zip)$/i.test(host)) {
      reasons.add('Possible brand-impersonation link');
    }
  }

  if (/\b(?:free\s+nitro|claim\s+(?:your\s+)?(?:free\s+)?nitro|discord\s+gift)\b/i.test(normalized) &&
      /https?:\/\//i.test(normalized)) {
    reasons.add('Unexpected gift promotion link');
  }
  return [...reasons];
}

export function createMarketplaceModeration({ config, logError = () => {} }) {
  if (!config?.discord?.guildId || !config?.moderation) throw new TypeError('moderation config missing');
  const recentMessages = new Set();

  async function onMessage(message) {
    const settings = config.moderation;
    if (!settings.enabled || !message?.guild || message.guild.id !== config.discord.guildId ||
        message.author?.bot || !settings.channelIds.includes(String(message.channelId))) return false;
    if (!settings.alertChannelId || !message.id || !message.author?.id) return false;

    const reasons = detectMarketplaceRisks(message.content ?? '', { blockedDomains: settings.blockedDomains });
    if (!reasons.length || recentMessages.has(message.id)) return false;
    recentMessages.add(message.id);
    if (recentMessages.size > MAX_DEDUP) recentMessages.delete(recentMessages.values().next().value);

    const alert = message.guild.channels.cache.get(settings.alertChannelId) ??
      await message.guild.channels.fetch(settings.alertChannelId).catch(() => null);
    if (!isPrivateStaffChannel(alert, message.guild)) {
      logError('Moderation alert skipped: designated channel is missing or publicly accessible');
      return false;
    }

    const link = /^https:\/\/discord\.com\/channels\/\d+\/\d+\/\d+$/.test(message.url ?? '') ? message.url : '';
    await alert.send({
      content: 'Aquaphoria marketplace safety: ' + reasons.join(', ') +
        '. Author ID: ' + message.author.id + '. ' +
        (link ? 'Review message: ' + link : 'Review the original moderated channel.') +
        ' Human review required; no automatic enforcement.',
      allowedMentions: { parse: [] },
    });
    return true;
  }

  return { onMessage };
}
