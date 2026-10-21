import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function readPublicationEvidence(evidenceDir, jobId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(jobId))) throw new Error('Invalid research ID');
  try {
    return JSON.parse(await readFile(path.join(evidenceDir, String(jobId) + '.json'), 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

export async function writePublicationEvidence(evidenceDir, jobId, evidence) {
  if (!/^[0-9a-f-]{36}$/i.test(String(jobId))) throw new Error('Invalid research ID');
  if (evidence?.evidenceStatus !== 'published_creator_pending' ||
      !/^https:\/\/aquapedia\.app\/medakapedia\/strains\/[a-z0-9-]+\/$/.test(evidence.siteUrl ?? '') ||
      !/^\d{15,22}$/.test(String(evidence.discordThreadId)) ||
      !/^\d{15,22}$/.test(String(evidence.discordMessageId))) {
    throw new Error('Evidence missing a validated site URL or Discord receipt');
  }

  const isSame = (value) => value?.siteUrl === evidence.siteUrl &&
    value.discordThreadId === evidence.discordThreadId &&
    value.discordMessageId === evidence.discordMessageId &&
    value.evidenceStatus === evidence.evidenceStatus;
  const old = await readPublicationEvidence(evidenceDir, jobId);
  if (old) {
    if (!isSame(old)) throw new Error('Conflicting publication evidence');
    return old;
  }

  await mkdir(evidenceDir, { recursive: true });
  const record = {
    jobId, evidenceStatus: evidence.evidenceStatus, siteUrl: evidence.siteUrl,
    discordThreadId: evidence.discordThreadId, discordMessageId: evidence.discordMessageId,
    publicationBotId: evidence.publicationBotId, source: evidence.source,
    remainingResearch: evidence.remainingResearch, recordedAt: new Date().toISOString(),
  };
  const filename = path.join(evidenceDir, String(jobId) + '.json');
  try {
    await writeFile(filename, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    const raced = await readPublicationEvidence(evidenceDir, jobId);
    if (!isSame(raced)) throw new Error('Conflicting concurrent publication evidence');
    return raced;
  }
  return record;
}
