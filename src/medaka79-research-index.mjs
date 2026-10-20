import crypto from 'node:crypto';

export const MEDAKA79_FORUM_ID = '1561189286399705128';
export const MEDAKA79_GUILD_ID = '1519337502379475095';
export const MEDAKA79_SITE_URL = 'https://aquapedia.app/medakapedia/research/medaka400-source-intake/';
export const MEDAKA79_THREAD_NAME = 'RESEARCH INTAKE — 79 sourced Medaka names (unverified)';
export const MEDAKA79_STARTER_MARKER = '[AQUAPEDIA-MEDAKA79-INTRO-V1]';
const TIERS = [
  ['A_referenced_breeding_stock_cross', 'A', 23, 'Source-reported breeding stocks; not verified individual parents'],
  ['B_family_selection_or_phenotype_relation', 'B', 40, 'Source-reported selections and phenotype families'],
  ['C_phenotype_only_origins_unreported', 'C', 16, 'Origins not documented; parents unknown'],
];
const ALLOWED_HOSTS = new Set(['medakazukan.net', 'www.medakazukan.net', 'medakanoyakata.muragon.com']);

function safe(value, max = 140) {
  const text = String(value ?? '').replace(/[\r\n\t]/g, ' ').replace(/[@`*_~|<>]/g, ' ').trim();
  if (!text || text.length > max) throw new Error('Invalid source-research display text');
  return text;
}

export function buildMedaka79Index(matrix, { rawSource } = {}) {
  if (!matrix || !Array.isArray(matrix.records) || matrix.records.length !== 79
    || matrix.summary?.total_named_candidates !== 79
    || matrix.summary?.world_new_strains !== 0
    || matrix.summary?.publicly_published_this_PR !== 0) {
    throw new Error('The 79-name research matrix or provisional status changed');
  }
  const names = new Set();
  const groups = new Map(TIERS.map(([key]) => [key, []]));
  for (const item of matrix.records) {
    const id = String(item.id ?? '');
    if (!/^[a-z0-9-]{2,100}$/.test(id) || names.has(id) || !groups.has(item.origin_evidence_tier)) {
      throw new Error('Unknown tier, missing record ID, or duplicate Medaka research candidate');
    }
    names.add(id);
    const url = new URL(String(item.primary_source_url ?? 'https://invalid.invalid'));
    if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)
      || url.username || url.password || !url.pathname) {
      throw new Error('Unapproved or unsafe specialist research source URL');
    }
    if (item.photo_rights !== 'NOT_GRANTED'
      || item.authenticated_standalone_bloodline !== false
      || item.requires_independent_review !== true
      || item.commercial_genotype !== 'UNKNOWN'
      || item.dominance !== 'UNKNOWN') {
      throw new Error('Research record was improperly upgraded to a verified lineage or reusable photograph');
    }
    const year = Number.isInteger(item.creation_year_source_claim)
      ? String(item.creation_year_source_claim) : 'year unverified';
    groups.get(item.origin_evidence_tier).push({
      id,
      label: safe(item.name, 110),
      creator: item.creator_attributed ? safe(item.creator_attributed, 120) : 'creator not documented',
      year,
      url: url.href,
    });
  }
  const counts = Object.fromEntries(TIERS.map(([key, short, expected]) => {
    const records = groups.get(key);
    if (records.length !== expected) throw new Error('Evidence-tier counts diverge from verified research');
    return [short, records.length];
  }));
  const starter = [
    '📚 **Medaka research intake: 79 source-listed names (unverified)**',
    '**Status: RESEARCH UNDER REVIEW.** These are provisional source-listed names and forms, NOT 79 newly authenticated independent strains or proven founder crosses.',
    '**Evidence groups:** A = 23 breeder/specialist-reported breeding-stock cases; B = 40 selections/phenotype families; C = 16 with undocumented origins.',
    'All 79 require independent identity and alias review. Their third-party images are not cleared for reuse; no fish photographs are reposted.',
    '**Aquapedia research directory:** ' + MEDAKA79_SITE_URL,
    '**Original research dossier:** https://github.com/pixenetwork/aquapedia/pull/160',
    'Reported stock does not prove parental identities, alleles, dominant/recessive inheritance or genotype.',
    MEDAKA79_STARTER_MARKER,
  ].join('\n');
  if (starter.length > 1900) throw new Error('Starter exceeds Discord content limits');
  const parts = [];
  let index = 0;
  for (const [key, letter, expected, title] of TIERS) {
    const entries = groups.get(key);
    for (let start = 0; start < entries.length; start += 8) {
      index += 1;
      const group = entries.slice(start, start + 8);
      const marker = '[AQUAPEDIA-MEDAKA79-PART-' + String(index).padStart(2, '0') + ']';
      const lines = group.map((item, j) =>
        '**' + (start + j + 1) + '. ' + item.label + '** — ' + item.creator + '; ' + item.year + '\n' + item.url);
      const content = [
        '🧬 **Tier ' + letter + ' — ' + title + ' (part ' + (Math.floor(start / 8) + 1) + ')**',
        '*Research only: not a verified independent pedigree or Mendelian genotype.*',
        '', ...lines, marker,
      ].join('\n');
      if (content.length > 1900 || content.includes('@everyone') || content.includes('@here')) {
        throw new Error('Unsafe or oversized Discord research index post');
      }
      parts.push({ tier: letter, marker, count: group.length, content });
    }
  }
  if (parts.length !== 10 || parts.reduce((sum, part) => sum + part.count, 0) !== 79) {
    throw new Error('Discord research-index parts are incomplete');
  }
  return {
    jobId: 'AQUAPEDIA-MEDAKA400-79-RESEARCH-V1',
    status: 'PROPOSED_FOR_APPROVED_PUBLISHER_ONLY',
    approvalRequired: true,
    forumId: MEDAKA79_FORUM_ID,
    guildId: MEDAKA79_GUILD_ID,
    threadName: MEDAKA79_THREAD_NAME,
    records: 79,
    counts,
    sourceSha256: rawSource ? crypto.createHash('sha256').update(rawSource).digest('hex') : null,
    starter,
    parts,
    allowedMentions: { parse: [] },
    photographs: [],
    websiteUrl: MEDAKA79_SITE_URL,
  };
}

export function verifyMedaka79PublishedMessages(plan, messages, botId) {
  if (!plan || !Array.isArray(messages) || !botId
    || messages.length !== plan.parts.length + 1) return false;
  const expected = [MEDAKA79_STARTER_MARKER, ...plan.parts.map(part => part.marker)];
  const ids = new Set();
  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i];
    if (!message?.id || ids.has(message.id) || message.author?.id !== botId
      || !message.content?.includes(expected[i])) return false;
    ids.add(message.id);
  }
  return true;
}
