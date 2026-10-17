import { ChannelType, PermissionFlagsBits } from 'discord.js';

export const MAGAZINE_FORUM_NAME = 'magazines-articles';
export const MAGAZINE_FORUM_TOPIC =
  'Aquapedia original English reading guides for Japanese medaka and shrimp publications. Source attribution and rights notices are required; no unauthorized scans or translated page facsimiles.';

const JMA_ROOT = 'https://aquapedia.app/magazines/jma-2025-english-notes/';
const HYAKKA_ROOT = 'https://aquapedia.app/magazines/medaka-hyakka-21-english-notes/';
const HYAKKA_ORIGINAL = 'https://fliphtml5.com/hbjdg/000cover-ElTX/E-BOOK%E3%83%A1%E3%83%80%E3%82%AB%E7%99%BE%E8%8F%AF%E7%AC%AC21%E5%8F%B7/';

export const MAGAZINE_ISSUES = Object.freeze([
  {
    id: 'jma-classification-manual-5-2025',
    threadName: 'JMA Classification Manual (2025) — English reading guide',
    publisher: 'Japan Medaka Association (JMA)',
    title: 'JMA Classification Manual, 5th edition',
    year: 2025,
    url: JMA_ROOT,
    sourceUrl: 'https://jma-medaka.com/medaka-variety-classification-manual/',
    tagNames: ['Official JMA', 'Japanese'],
    topics: [
      ['Opening selections', 'intro'],
      ['Body colors, transparency, eyes', '17–36'],
      ['Eye variants', '37–38'],
      ['Glitter and external body light', '39–40'],
      ['Internal body light', '43–44'],
      ['Black marks and patterning', '47–48'],
      ['Classic long-finned forms', '54–55'],
      ['Additional fin variations', '56–57'],
      ['Hikari and Daruma', '58–60'],
      ['Fin color and blue peritoneum', '61–62'],
      ['Pigment and background response', '63–64'],
      ['Eyes, transparency and powder', '65–67'],
      ['Pigment deficiency', '68–69'],
      ['Aurora breeding lines', '70–71'],
      ['Aurora and multicolor naming', '72–73'],
      ['Classification FAQ 1–12', '74–75'],
      ['Classification FAQ 13–22', '76–77'],
      ['Classification FAQ 23–54', '78–84'],
    ],
    disclaimer: 'This is an original English study guide, NOT the translated JMA PDF. Private page-layout drafts are not redistributed without written adaptation/republication permission.',
  },
  {
    id: 'medaka-hyakka-21-2025',
    threadName: 'Medaka Hyakka No. 21 (2025) — English reading guide',
    publisher: 'Pisces Publishers',
    title: 'Medaka Hyakka No. 21 (メダカ百華 第21号)',
    year: 2025,
    url: HYAKKA_ROOT,
    sourceUrl: HYAKKA_ORIGINAL,
    tagNames: ['Magazine', 'Japanese'],
    topics: [
      ['Medakaya Savanna breeding lines', '72–75'],
      ['Musou side-view awards', '76, 78'],
      ['Musou top-view / Best in Show', '77'],
      ['Musou Daruma and aquarium results', '79'],
      ['Kikucha Medaka tricolor lines', '80–81'],
      ['Medakaya Lightning fin/color crosses', '82–83'],
    ],
    disclaimer: 'Original English research summaries, not a complete translated magazine. Breeding crosses and awards are publisher-reported; source pages should be checked for exact Japanese names.',
  },
]);

function buildTopicFields(issue) {
  const fields = [];
  for (let index = 0; index < issue.topics.length; index += 5) {
    const group = issue.topics.slice(index, index + 5);
    const value = group.map(([title, pages], off) =>
      `• [${title}](${issue.url}#section-${index + off + 1}) · pages ${pages}`).join('\n');
    if (value.length > 1024) throw Error('Discord embed topic field is too long');
    fields.push({ name: `English topics ${index + 1}–${index + group.length}`, value, inline: false });
  }
  return fields;
}

export function buildMagazinePayload(issue) {
  if (!MAGAZINE_ISSUES.includes(issue)) throw Error('Unknown publication');
  const content = `📚 **${issue.title} — English reading companion**\n` +
    `Original English research: ${issue.url}\n` +
    `Publisher: ${issue.publisher} · ${issue.year}\n` +
    'Read the indexed English subjects below. This is not a licensed full English facsimile.';
  const embed = {
    title: `AQUAPEDIA • ${issue.title}`,
    url: issue.url,
    description: `**Japanese original:** ${issue.sourceUrl}\n\n${issue.disclaimer}`,
    fields: buildTopicFields(issue),
    footer: { text: `Aquapedia • english-publication:${issue.id} • source-linked research` },
  };
  if (content.length > 2000 || embed.description.length > 4096 ||
      embed.fields.length > 25 || embed.title.length > 256) throw Error('Discord length limit exceeded');
  return { content, embeds: [embed], allowedMentions: { parse: [] } };
}

function receiptMarker(issue) {
  return `Aquapedia • english-publication:${issue.id} •`;
}

async function getAllThreads(forum) {
  const active = await forum.threads.fetchActive();
  const threads = [...active.threads.values()];
  let before;
  for (let n = 0; n < 25; n++) {
    const page = await forum.threads.fetchArchived(before ?
      { limit: 100, before } : { limit: 100 });
    const batch = [...page.threads.values()];
    threads.push(...batch);
    if (!page.hasMore) return threads;
    const last = batch.at(-1);
    const cursor = last?.archivedAt ?? (last?.archiveTimestamp && new Date(last.archiveTimestamp));
    if (!(cursor instanceof Date) || Number.isNaN(cursor.getTime()) ||
        (before && cursor.getTime() >= before.getTime())) {
      throw Error('Archived thread enumeration incomplete; refusing duplicate creation');
    }
    before = cursor;
  }
  throw Error('Archive scan exceeded 25 pages; refusing duplicate creation');
}

export async function locatePublicMagazineForum(guild, { createIfMissing = false } = {}) {
  await guild.channels.fetch();
  await guild.roles.fetch();
  const channels = [...guild.channels.cache.values()];
  const parent = channels.find((channel) =>
    channel.type === ChannelType.GuildCategory && /AQUAPEDIA$/iu.test(channel.name));
  if (!parent) throw Error('Public AQUAPEDIA category not found; do not create an unapproved parallel category');
  const visibleToEveryone = guild.roles.everyone.permissionsIn(parent)
    .has(PermissionFlagsBits.ViewChannel);
  if (!visibleToEveryone) throw Error('AQUAPEDIA category is private; public posting blocked');
  const collisions = channels.filter((c) =>
    c.name === MAGAZINE_FORUM_NAME && c.type === ChannelType.GuildForum);
  if (collisions.some((c) => c.parentId !== parent.id) || collisions.length > 1) {
    throw Error('Ambiguous magazines-articles forum; manual reconciliation required');
  }
  let forum = collisions[0] ?? null;
  if (!forum && createIfMissing) {
    forum = await guild.channels.create({
      name: MAGAZINE_FORUM_NAME,
      type: ChannelType.GuildForum,
      parent: parent.id,
      topic: MAGAZINE_FORUM_TOPIC,
      reason: 'Approved public Aquapedia original-English magazine reading desk',
    });
  }
  if (!forum) return { parent, forum: null };
  if (!guild.roles.everyone.permissionsIn(forum).has(PermissionFlagsBits.ViewChannel)) {
    throw Error('Magazine forum is not publicly visible; refusing publication');
  }
  return { parent, forum };
}

export async function publishMagazineIssues(guild, { createForum = false } = {}) {
  const botId = guild.client?.user?.id;
  if (!botId) throw Error('Discord bot identity unavailable');
  const { forum, parent } = await locatePublicMagazineForum(guild, { createIfMissing: createForum });
  if (!forum) return { posted: 0, updated: 0, receipts: [], blocker: 'Public forum not provisioned' };
  const receipts = [];
  let created = 0;
  let updated = 0;
  for (const issue of MAGAZINE_ISSUES) {
    // Always re-enumerate before a write: safe even across repeated CLI runs.
    const threads = await getAllThreads(forum);
    const candidates = threads.filter((thread) => thread.name === issue.threadName);
    if (candidates.length > 1) throw Error(`Duplicate pre-existing threads: ${issue.threadName}`);
    let thread = candidates[0] ?? null;
    const payload = buildMagazinePayload(issue);
    let message;
    if (thread) {
      if (thread.ownerId !== botId) throw Error(`Existing publication thread is not owned by bot: ${issue.id}`);
      message = await thread.fetchStarterMessage();
      if (message?.author?.id !== botId ||
        !message.embeds?.some((embed) => embed.footer?.text?.startsWith(receiptMarker(issue)))) {
        throw Error(`Existing post has no verified Aquapedia publication marker: ${issue.id}`);
      }
      if (thread.archived) await thread.setArchived(false);
      await message.edit(payload);
      updated++;
    } else {
      thread = await forum.threads.create({
        name: issue.threadName,
        message: payload,
        reason: 'Approved Aquapedia original English issue companion',
      });
      created++;
    }
    // Read back from the API. On readback failure stop; never retry blindly.
    const readback = await thread.fetchStarterMessage();
    if (!readback?.id || readback.author?.id !== botId ||
      !readback.embeds?.some((embed) => embed.footer?.text?.startsWith(receiptMarker(issue)))) {
      throw Error(`Publication may have posted, but readback verification failed: ${issue.id}`);
    }
    receipts.push({
      issueId: issue.id,
      forumId: forum.id,
      threadId: thread.id,
      messageId: readback.id,
      url: `https://discord.com/channels/${guild.id}/${thread.id}/${readback.id}`,
      verified: true,
    });
  }
  return { posted: created, updated, receipts, forumId: forum.id, parentId: parent.id };
}
