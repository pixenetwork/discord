import test from 'node:test';
import assert from 'node:assert/strict';
import { publishAquapediaCards, buildAquapediaPost } from '../src/aquapedia-posts.mjs';
import { PermissionFlagsBits } from 'discord.js';

const breeder = {
  id: 'shrimp-breeder-skyfish', entityType: 'breeder', organismGroup: 'shrimp',
  name: 'Skyfish / Leon Su', breeding: 'Line-selection documented',
  sources: ['https://aquapedia.app/shrimpapedia/breeders/skyfish-leon-su/'], photos: []
};
const contest = {
  id: 'shrimp-contest-tgisc', entityType: 'competition', organismGroup: 'shrimp',
  name: 'German International Shrimp Contest',
  message: 'Documented TGISC 2026 competition results, provisional creator attribution.',
  sources: ['https://aquapedia.app/shrimpapedia/competitions/german-international-shrimp-contest-tgisc/']
};

function fakeGuild({ visible = true, historyReadable = true, categoryName = '📚・AQUAPEDIA', forumName = '🦐・shrimp-research', activeCount = 0 } = {}) {
  const created = [];
  const category = { id: 'public-category', name: categoryName, type: 4 };
  const forum = {
    id: 'shrimp-forum', name: forumName, type: 15, parentId: category.id,
    permissionsFor(role) { return role?.id === 'everyone' ? { has: (flag) => flag === PermissionFlagsBits.ReadMessageHistory ? historyReadable : visible } : null; },
    threads: {
      async fetchActive() { return { threads: new Map() }; },
      async fetchArchived() { return { threads: new Map(), hasMore: false }; },
      async create({ name, message }) {
        const id = String(created.length + 1);
        const post = { id: 'message-' + id, author: { id: 'aquaphoria-bot' }, embeds: message.embeds };
        created.push({ name, message });
        return { id: 'thread-' + id, name, async fetchStarterMessage() { return post; } };
      },
    },
  };
  const guild = { roles: { everyone: { id: 'everyone' } }, client: { user: { id: 'aquaphoria-bot' } },
    channels: { cache: new Map([['cat', category], ['forum', forum]]) , async fetchActiveThreads(){return {threads:{size:activeCount}};} } };
  return { guild, created };
}

const approved = {
  status: 'completed', discordPublicationApproved: true, publicShrimpResearch: true,
  publicAudienceApproved: true, cards: [breeder, contest],
};

test('public shrimp batch creates two evidence-linked breeder/competition threads only in the Aquapedia forum', async () => {
  const { guild, created } = fakeGuild();
  const result = await publishAquapediaCards(guild, approved);
  assert.equal(result.posted, 2);
  assert.equal(result.receipts.length, 2);
  assert.match(created[0].name, /Skyfish/);
  assert.match(created[1].name, /German International/);
  assert.ok(created[1].message.content.includes('Documented TGISC'));
});

test('public shrimp route remains closed without explicit public-audience approval', async () => {
  const { guild, created } = fakeGuild();
  const result = await publishAquapediaCards(guild, { ...approved, publicAudienceApproved: false });
  assert.equal(result.posted, 0);
  assert.equal(created.length, 0);
});

test('public shrimp publishing refuses a forum that is not public to everyone', async () => {
  const { guild, created } = fakeGuild({ visible: false });
  const result = await publishAquapediaCards(guild, approved);
  assert.equal(result.posted, 0);
  assert.equal(created.length, 0);
});

test('public shrimp publishing refuses a forum outside the public Aquapedia category', async () => {
  const { guild, created } = fakeGuild({ categoryName: '🔬・AQUAPEDIA RESEARCH' });
  const result = await publishAquapediaCards(guild, approved);
  assert.equal(result.posted, 0);
  assert.equal(created.length, 0);
});

test('competition embed retains source citations and never calls its entrant the strain creator', () => {
  const payload = buildAquapediaPost(contest);
  assert.match(payload.embeds[0].title, /COMPETITION/);
  assert.match(JSON.stringify(payload), /aquapedia.app/);
  assert.doesNotMatch(JSON.stringify(payload), /original creator: German International/i);
});

test('public shrimp forum must allow everyone to read message history', async () => {
  const { guild, created } = fakeGuild({ historyReadable: false });
  const r = await publishAquapediaCards(guild, approved);
  assert.equal(r.posted, 0);
  assert.equal(created.length, 0);
});

test('different strains with identical display names have distinct stable public thread names', async () => {
  const { guild, created } = fakeGuild();
  const sameName = (id) => ({
    id, entityType: 'strain', organismGroup: 'shrimp', name: 'Blue Dream',
    breederName: 'Unverified origin', sources: ['https://aquapedia.app/shrimpapedia/'],
  });
  const r = await publishAquapediaCards(guild, { ...approved, cards: [sameName('strain-blue-1'), sameName('strain-blue-2')] });
  assert.equal(r.posted, 2);
  assert.equal(new Set(created.map(x => x.name)).size, 2);
});

test('competition citations never truncate complete valid source URLs', () => {
  const first = 'https://example.com/a/' + 'a'.repeat(320);
  const second = 'https://example.com/b/' + 'b'.repeat(320);
  const payload = buildAquapediaPost({ ...contest, sources: [first, second] });
  const values = payload.embeds[0].fields.map(x => x.value).join(' ');
  assert.ok(values.includes(first));
  assert.ok(values.includes(second));
});

test('oversized combined Discord embeds are rejected instead of rendered as publishable', () => {
  const big = 'Z'.repeat(520);
  const longURL = (n) => 'https://example.com/' + String(n) + '/' + 'a'.repeat(360);
  const massive = {
    ...breeder, name:'B'.repeat(155), summary:big, japaneseName:big,
    description:big, history:big, lineage:big, breeding:big, care:big, confidence:big,
    sources:[0,1,2,3,4].map(longURL),
    photos:[0,1,2].map(i=>({url:'https://example.com/photo'+i+'.jpg',reuseStatus:'licensed',credit:big})),
  };
  assert.throws(() => buildAquapediaPost(massive), /6000|embed.*limit/i);
});

test('public publisher fails closed if two IDs collide after shortening',async()=>{
 const {guild,created}=fakeGuild();
 const long='z'.repeat(70);
 const result=await publishAquapediaCards(guild,{...approved,cards:[
  {...breeder,id:long+'-1'},
  {...breeder,id:long+'-2'}
 ]});
 assert.equal(result.posted,0);
 assert.equal(created.length,0);
});

test('global active-thread ceiling stops the shrimp batch before any thread creation',async()=>{
 const {guild,created}=fakeGuild({activeCount:1000});
 const result=await publishAquapediaCards(guild,approved);
 assert.equal(result.posted,0);
 assert.equal(created.length,0);
 assert.equal(result.reason,'discord_thread_capacity_guard');
});
