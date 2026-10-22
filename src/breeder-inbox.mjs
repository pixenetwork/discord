import { mkdir, readFile, writeFile, rename, unlink, readdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const locks = new Map();
function exclusive(file, work) {
  const prior = locks.get(file) ?? Promise.resolve();
  const current = prior.catch(() => {}).then(work);
  locks.set(file, current);
  void current.finally(() => { if (locks.get(file) === current) locks.delete(file); }).catch(() => {});
  return current;
}
async function load(file) {
  try {
    const rows = JSON.parse(await readFile(file, 'utf8'));
    if (!Array.isArray(rows)) throw new Error('Invalid inbox format');
    return rows;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}
async function persist(file, rows) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = file + '.' + randomUUID() + '.tmp';
  try {
    await writeFile(temporary, JSON.stringify(rows, null, 2), { mode: 0o600, flag: 'wx' });
    await rename(temporary, file);
  } finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
}
export function pruneBreederInbox({ outputDir, now = Date.now }) {
  const file = path.join(outputDir, 'breeder-inbox.json');
  return exclusive(file, async () => {
    const names = await readdir(outputDir).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
    for (const name of names) {
      if (/^breeder-inbox\.json\.[\w-]+\.tmp$/.test(name)) await unlink(path.join(outputDir, name));
    }
    const records = await load(file);
    const keep = records.filter(row => Number(row.expiresAt) > now());
    if (keep.length !== records.length) await persist(file, keep);
    return records.length - keep.length;
  });
}
export function createBreederInbox({ recipientIds = [], outputDir, now = Date.now, retentionDays = 30 }) {
  const allowed = new Set(recipientIds.map(String));
  const file = path.join(outputDir, 'breeder-inbox.json');
  return async function capture(message) {
    if (!message || message.guildId || message.author?.bot) return false;
    if (!/^\d{17,20}$/.test(String(message.id ?? ''))) return false;
    const content = String(message.content ?? '').trim();
    const id = String(message.author.id);
    const stop = /^STOP AQUAPEDIA RECORDING$/i.test(content);
    const consent = /^I consent to Aquapedia storing my interview DMs for 30 days\.?$/i.test(content);
    return exclusive(file, async () => {
      const records = await load(file);
      const current = records.filter(row => Number(row.expiresAt) > now());
      const prior = current.find(row => row.authorId === id);
      if (!stop && !allowed.has(id)) return false;
      if (!stop && !consent && !prior) return false;
      let next = current;
      if (stop) next = current.filter(row => row.authorId !== id);
      if (consent && !prior) next.push({ authorId: id, expiresAt: now() + retentionDays * 86400000, messages: [] });
      if (!stop && !consent) {
        if (prior.messages.some(m => m.id === String(message.id))) return false;
        prior.messages.push({ id: String(message.id), time: message.createdAt?.toISOString?.() ?? new Date(now()).toISOString(), content: content.slice(0, 2000) });
      }
      await persist(file, next);
      return true;
    });
  };
}
