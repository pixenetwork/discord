import { ActivityType, escapeMarkdown } from 'discord.js';

function normalized(value) {
  return String(value ?? '').normalize('NFKC').trim().toLowerCase();
}

export function matchesFiveMActivity(presence, matchTerms = ['fivem']) {
  if (!presence || presence.status === 'offline' || presence.status === 'invisible') return null;
  const terms = matchTerms.map(normalized).filter((term) => term.length >= 3);
  if (!terms.length) return null;
  for (const activity of presence.activities ?? []) {
    if (activity.type !== ActivityType.Playing) continue;
    const fields = [activity.name, activity.details, activity.state].map(normalized);
    if (terms.some((term) => fields.some((field) => field.includes(term)))) {
      return { name: String(activity.name ?? 'FiveM').slice(0, 80) };
    }
  }
  return null;
}

export function snapshotFiveMPlayers(guild, { matchTerms = ['fivem'], maxDisplayed = 15 } = {}) {
  const list = [];
  let observed = 0;
  const members = guild?.presences?.cache;
  if (!members || typeof members.values !== 'function') {
    return { observed: 0, players: [], available: false, examined: 0 };
  }
  let examined = 0;
  for (const presence of members.values()) {
    examined++;
    const activity = matchesFiveMActivity(presence, matchTerms);
    if (!activity) continue;
    observed++;
    const id = String(presence.userId ?? '');
    if (/^\d{17,20}$/.test(id) && list.length < maxDisplayed) {
      list.push({ userId: id, game: escapeMarkdown(activity.name) });
    }
  }
  return { observed, players: list, available: true, examined };
}

export function formatFiveMPlayers(snapshot) {
  const header = 'FiveM activity currently visible to this Discord bot: **' + snapshot.observed + '**';
  const lines = snapshot.players.map((row) => '<@' + row.userId + '> — ' + row.game);
  return [
    header,
    ...lines,
    ...(snapshot.observed > snapshot.players.length ? ['…and ' + (snapshot.observed - snapshot.players.length) + ' more.'] : []),
    '',
    '_Only Discord members with visible matching Playing activity are included. This is not the authoritative FiveM server player count, and the initial Discord presence cache may be incomplete._',
  ].join('\n').slice(0, 1900);
}
