import { createHash, createPublicKey, verify } from 'node:crypto';

// The trusted key, signed records, and atomic receipt claim must come from the
// governed authorizer/store, never from the research result or Discord card.
const PRIVATE_CATEGORIES = new Set(['🔬・BREEDER RESEARCH', '🔬・BREEDER RESEARCH II']);

export function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((key) =>
      JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new TypeError('Unserializable authorization data');
  return encoded;
}

export function breederCardsDigest(cards) {
  return createHash('sha256').update(canonicalJson(cards)).digest('hex');
}

function verifiedEnvelope(envelope, publicKey, kind) {
  if (!envelope || typeof envelope !== 'object'
    || !envelope.payload || typeof envelope.signature !== 'string'
    || !/^[A-Za-z0-9+/]{86}==$/.test(envelope.signature)) return null;
  try {
    const key = createPublicKey(publicKey);
    if (key.asymmetricKeyType !== 'ed25519') return null;
    const bytes = Buffer.from('aquapedia-breeder-' + kind + '-v1\n' + canonicalJson(envelope.payload));
    return verify(null, bytes, key, Buffer.from(envelope.signature, 'base64')) ? envelope.payload : null;
  } catch { return null; }
}

function liveApproval(payload, now) {
  if (!payload || typeof payload !== 'object') return false;
  const issued = typeof payload.issuedAt === 'string' ? Date.parse(payload.issuedAt) : NaN;
  const expires = typeof payload.expiresAt === 'string' ? Date.parse(payload.expiresAt) : NaN;
  return Number.isFinite(issued) && Number.isFinite(expires)
    && issued <= now && expires > now && expires > issued;
}

// Explicit aliases only. Japanese-to-romaji transliteration is never guessed.
// Any normalization collision between different breeder records denies the batch.
function aliasKey(value) {
  return typeof value === 'string' ? value.normalize('NFKC').trim()
    .toLocaleLowerCase('en-US').replace(/[\s_.-]+/g, '') : '';
}

export async function authorizePrivateBreederCards(guild, result, cards, authority) {
  const deny = (reason) => ({ ok: false, reason });
  if (!authority || typeof authority.loadAllowlist !== 'function'
    || typeof authority.loadReviewReceipt !== 'function'
    || typeof authority.claimReceiptOnce !== 'function'
    || typeof authority.publicKey !== 'string'
    || !/^[0-9a-f]{40}$/.test(String(authority.expectedSourceHeadSha ?? ''))) {
    return deny('breeder_binding_authority_unavailable');
  }
  const guildId = String(guild?.id ?? '');
  const receiptId = result?.reviewReceiptId;
  if (!guildId || typeof receiptId !== 'string' || !receiptId.trim()
    || !result?.jobId || !result?.sourceHeadSha) return deny('review_receipt_invalid');

  let allowlistEnvelope, receiptEnvelope;
  try {
    [allowlistEnvelope, receiptEnvelope] = await Promise.all([
      authority.loadAllowlist(guildId),
      authority.loadReviewReceipt(receiptId),
    ]);
  } catch { return deny('breeder_binding_authority_unavailable'); }

  const allowlist = verifiedEnvelope(allowlistEnvelope, authority.publicKey, 'allowlist');
  const receipt = verifiedEnvelope(receiptEnvelope, authority.publicKey, 'receipt');
  const now = Date.now();
  if (!allowlist || !liveApproval(allowlist, now)
    || String(allowlist.guildId) !== guildId || !Array.isArray(allowlist.bindings)) {
    return deny('breeder_allowlist_invalid');
  }
  if (!receipt || !liveApproval(receipt, now) || receipt.decision !== 'approved'
    || typeof receipt.approvedBy !== 'string' || !receipt.approvedBy.trim()
    || receipt.receiptId !== receiptId || String(receipt.guildId) !== guildId
    || receipt.jobId !== result.jobId
    || receipt.sourceHeadSha !== result.sourceHeadSha
    || receipt.sourceHeadSha !== authority.expectedSourceHeadSha
    || receipt.cardsSha256 !== breederCardsDigest(cards)
    || receipt.allowlistSha256 !== createHash('sha256').update(canonicalJson(allowlist)).digest('hex')) {
    return deny('review_receipt_invalid');
  }

  const channels = [...(guild?.channels?.cache?.values?.() ?? [])];
  const approvedForumsByCard = new Map();
  const forumByName = new Map();
  const breederByAlias = new Map();
  const forumIds = new Set();
  for (const binding of allowlist.bindings) {
    if (typeof binding?.canonicalBreederKey !== 'string' || !binding.canonicalBreederKey.trim()
      || typeof binding.forumName !== 'string' || !binding.forumName
      || typeof binding.forumId !== 'string' || !binding.forumId
      || typeof binding.categoryId !== 'string'
      || !PRIVATE_CATEGORIES.has(binding.categoryName)
      || !Array.isArray(binding.aliases)
      || forumByName.has(binding.forumName) || forumIds.has(binding.forumId)) {
      return deny('breeder_allowlist_ambiguous');
    }
    forumByName.set(binding.forumName, binding);
    forumIds.add(binding.forumId);
    for (const name of [binding.canonicalBreederKey, ...binding.aliases]) {
      const key = aliasKey(name);
      if (!key || (breederByAlias.has(key) && breederByAlias.get(key) !== binding)) {
        return deny('breeder_allowlist_ambiguous');
      }
      breederByAlias.set(key, binding);
    }
  }

  for (const card of cards) {
    if (!card || typeof card !== 'object') return deny('forum_binding_not_authorized');
    const breeder = card.entityType === 'breeder' ? card.name : card.breederName;
    if (Object.hasOwn(card, 'breederForumName')
      && (typeof card.breederForumName !== 'string' || !card.breederForumName.trim())) {
      return deny('forum_binding_not_authorized');
    }
    const requestedForum = typeof card.breederForumName === 'string' ? card.breederForumName.trim() : '';
    let binding;
    if (breeder == null || !String(breeder).trim()) {
      if (card.entityType === 'breeder' || requestedForum !== 'unknown-breeders'
        || card.breederIdentityStatus !== 'unverified') return deny('forum_binding_not_authorized');
      binding = forumByName.get('unknown-breeders');
      if (binding?.canonicalBreederKey !== 'unknown-breeders') return deny('forum_binding_not_authorized');
    } else {
      binding = breederByAlias.get(aliasKey(breeder));
      if (!binding || (requestedForum && requestedForum !== binding.forumName)
        || binding.canonicalBreederKey === 'unknown-breeders') {
        return deny('forum_binding_not_authorized');
      }
    }
    const matchingForum = channels.filter((c) => c.type === 15 && c.name === binding.forumName);
    const category = channels.filter((c) => c.type === 4 && c.id === binding.categoryId
      && c.name === binding.categoryName);
    if (matchingForum.length !== 1 || matchingForum[0].id !== binding.forumId
      || matchingForum[0].parentId !== binding.categoryId || category.length !== 1) {
      return deny('forum_binding_not_authorized');
    }
    approvedForumsByCard.set(card, {
      name: binding.forumName, id: binding.forumId, parentId: binding.categoryId,
    });
  }

  // The store must enforce an atomic, durable, one-use claim for this signed
  // approval. Fail closed when that integration is not implemented or available.
  try {
    const claimed = await authority.claimReceiptOnce(receiptId, {
      jobId: result.jobId, guildId, cardsSha256: receipt.cardsSha256,
      sourceHeadSha: receipt.sourceHeadSha,
    });
    if (claimed !== true) return deny('review_receipt_replayed_or_unavailable');
  } catch { return deny('review_receipt_replayed_or_unavailable'); }

  return { ok: true, approvedForumsByCard };
}
