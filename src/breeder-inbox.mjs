import { mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';
export function createBreederInbox({ recipientIds, botId, outputDir }) {
  const allowed = new Set(recipientIds.map(String));
  return async function capture(message) {
    if (!message || message.guildId || message.author?.bot || !allowed.has(String(message.author?.id))) return false;
    if (botId && String(message.author?.id) === String(botId)) return false;
    if (!/^\d{17,20}$/.test(String(message.id ?? ''))) return false;
    await mkdir(outputDir, { recursive: true });
    const record = { messageId: String(message.id), authorId: String(message.author.id), receivedAt: message.createdAt?.toISOString?.() ?? new Date().toISOString(), content: String(message.content ?? ''), attachments: Array.from(message.attachments?.values?.() ?? []).map(a => ({ id: a.id, name: a.name })) };
    await appendFile(path.join(outputDir, 'breeder-inbox.jsonl'), JSON.stringify(record) + '\n', { encoding: 'utf8', mode: 0o600 });
    return true;
  };
}
