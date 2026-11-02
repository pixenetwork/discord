import { generateKeyPairSync, sign, createHash } from 'node:crypto';
import { canonicalJson, breederCardsDigest } from '../../src/breeder-forum-authorization.mjs';

const EXPECTED_SHA = 'a'.repeat(40);
function signed(payload, key, kind) {
  return {
    payload,
    signature: sign(null,
      Buffer.from('aquapedia-breeder-' + kind + '-v1\n' + canonicalJson(payload)),
      key).toString('base64'),
  };
}

export function signedBreederFixture(guild, originalResult, overrides = {}) {
  guild.id = guild.id || 'test-guild';
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const now = Date.now();
  const issuedAt = new Date(now - 60_000).toISOString();
  const expiresAt = new Date(now + 600_000).toISOString();
  const names = new Map([
    ['tarumi-medaka', { canonicalBreederKey: 'tarumi-medaka', aliases: ['Tarumi Medaka', '垂水メダカ'] }],
    ['Kondo-Toshitsugu-近藤利継', { canonicalBreederKey: 'kondo-toshitsugu', aliases: ['Kondo Toshitsugu', '近藤利継', 'Kondo-Toshitsugu-近藤利継'] }],
    ['wang-xin-jiangyu', { canonicalBreederKey: 'wang-xin', aliases: ['Wang Xin', '王鑫'] }],
    ['unknown-breeders', { canonicalBreederKey: 'unknown-breeders', aliases: [] }],
    ['old-breeder', { canonicalBreederKey: 'old-breeder', aliases: ['Old Breeder'] }],
    ['skyfish', { canonicalBreederKey: 'skyfish', aliases: ['Skyfish'] }],
    ['galactic-shrimps', { canonicalBreederKey: 'galactic-shrimps', aliases: ['Galactic Shrimps'] }],
  ]);
  const channels = [...guild.channels.cache.values()];
  const categories = channels.filter((c) => c.type === 4);
  const bindings = channels.filter((c) => c.type === 15 && names.has(c.name))
    .filter((c, i, all) => all.findIndex((x) => x.name === c.name) === i)
    .map((c) => {
      const category = categories.find((v) => v.id === c.parentId);
      return { ...names.get(c.name), forumName: c.name, forumId: c.id,
        categoryId: c.parentId, categoryName: category?.name ?? '🔬・BREEDER RESEARCH' };
    });
  const result = {
    ...originalResult,
    jobId: 'test-job',
    sourceHeadSha: EXPECTED_SHA,
    reviewReceiptId: 'test-receipt',
  };
  const allowlistData = {
    guildId: guild.id, issuedAt, expiresAt, bindings,
  };
  const receiptData = {
    guildId: guild.id, receiptId: result.reviewReceiptId,
    jobId: result.jobId, sourceHeadSha: EXPECTED_SHA,
    cardsSha256: breederCardsDigest(result.cards),
    allowlistSha256: createHash('sha256').update(canonicalJson(allowlistData)).digest('hex'),
    approvedBy: 'independent-governed-reviewer', decision: 'approved', issuedAt, expiresAt,
  };
  const finalAllowlistData = typeof overrides.allowlistTransform === 'function'
    ? overrides.allowlistTransform(allowlistData) : overrides.allowlistData ?? allowlistData;
  const allowlistEnvelope = signed(finalAllowlistData, privateKey, 'allowlist');
  const finalReceiptData = typeof overrides.receiptTransform === 'function'
    ? overrides.receiptTransform({ ...receiptData,
      allowlistSha256: createHash('sha256').update(canonicalJson(finalAllowlistData)).digest('hex') })
    : overrides.receiptData ?? { ...receiptData,
      allowlistSha256: createHash('sha256').update(canonicalJson(finalAllowlistData)).digest('hex') };
  const receiptEnvelope = signed(finalReceiptData, privateKey, 'receipt');
  let claimed = false;
  const authority = {
    publicKey, expectedSourceHeadSha: EXPECTED_SHA,
    async loadAllowlist() { return overrides.allowlistEnvelope ?? allowlistEnvelope; },
    async loadReviewReceipt() { return overrides.receiptEnvelope ?? receiptEnvelope; },
    async claimReceiptOnce(id, meta) {
      if (id !== result.reviewReceiptId) return false;
      if (!meta || meta.jobId !== result.jobId || meta.guildId !== guild.id
        || meta.cardsSha256 !== receiptData.cardsSha256
        || meta.sourceHeadSha !== receiptData.sourceHeadSha) return false;
      if (claimed) return false;
      claimed = true;
      return true;
    },
  };
  if (typeof guild.channels.fetch !== 'function') {
    guild.channels.fetch = async (id) => [...guild.channels.cache.values()].find((channel) => channel.id === id) ?? null;
  }
  return { guild, result, authority, receiptData, allowlistData, getClaimed: () => claimed };
}
