import crypto from 'node:crypto';

function slugify(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

function safeAquapediaPath(filePath) {
  const normalized = String(filePath ?? '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('..') || normalized.split('/').some((part) => part === '.' || part === '')) {
    throw new Error(`Unsafe Aquapedia path: ${filePath}`);
  }
  const allowedRoots = ['medaka/', 'shrimp/', 'data/', 'research/', 'sources/', 'docs/', 'schemas/'];
  if (!allowedRoots.some((root) => normalized.startsWith(root))) throw new Error(`Aquapedia path is outside an allowed root: ${normalized}`);
  return normalized;
}

function githubHeaders(token, includeContentType = false) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    ...(includeContentType ? { 'Content-Type': 'application/json' } : {}),
  };
}

export function createResearchService({ jarvis, aquapedia, store }) {
  async function writeAquapediaFile(filePath, content, message) {
    if (!aquapedia.githubToken) throw new Error('AQUAPEDIA_GITHUB_TOKEN is not configured');
    const [owner, repo] = aquapedia.repository.split('/');
    if (!owner || !repo) throw new Error('AQUAPEDIA_REPOSITORY must be owner/repo');

    const safePath = safeAquapediaPath(filePath);
    const encodedPath = safePath.split('/').map(encodeURIComponent).join('/');
    const endpoint = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;

    const existingResponse = await fetch(`${endpoint}?ref=${encodeURIComponent(aquapedia.branch)}`, {
      headers: githubHeaders(aquapedia.githubToken),
    });

    let existingSha = null;
    if (existingResponse.ok) {
      const existing = await existingResponse.json();
      if (Array.isArray(existing)) throw new Error(`Aquapedia path points to a directory: ${safePath}`);
      existingSha = existing.sha ?? null;
    } else if (existingResponse.status !== 404) {
      const payload = await existingResponse.json().catch(() => ({}));
      throw new Error(`Aquapedia lookup failed (${existingResponse.status}): ${payload.message ?? 'unknown error'}`);
    }

    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: githubHeaders(aquapedia.githubToken, true),
      body: JSON.stringify({
        message,
        branch: aquapedia.branch,
        content: Buffer.from(String(content), 'utf8').toString('base64'),
        ...(existingSha ? { sha: existingSha } : {}),
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Aquapedia write failed (${response.status}): ${payload.message ?? 'unknown error'}`);
    return payload.content?.html_url ?? null;
  }

  async function queueInAquapedia(job) {
    const date = new Date().toISOString().slice(0, 10);
    const path = `research/inbox/discord/${date}-${slugify(job.entityType)}-${slugify(job.name)}-${job.id.slice(0, 8)}.md`;
    const content = `# Discord research request\n\n- **Request ID:** ${job.id}\n- **Entity type:** ${job.entityType}\n- **Name:** ${job.name}\n- **Requested by Discord user:** ${job.requestedBy}\n- **Created:** ${job.createdAt}\n\n## Research requirements\n\n- Detect aliases/duplicates before creating a new record.\n- Prefer primary breeder, creator, official event, and Japanese sources.\n- Preserve conflicting attribution instead of silently selecting one claim.\n- Record Japanese name, romanization, English aliases, breeder/creator, lineage, release timing, phenotype/scale traits, source links, and confidence state when available.\n- Never turn unsupported AI inference into a verified Aquapedia fact.\n`;
    const url = await writeAquapediaFile(path, content, `research: queue ${job.entityType} ${job.name} from Discord`);
    return { path, url };
  }

  async function callJarvis(job) {
    if (!jarvis.researchEndpoint) return null;
    const response = await fetch(jarvis.researchEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(jarvis.apiKey ? { Authorization: `Bearer ${jarvis.apiKey}` } : {}),
      },
      body: JSON.stringify({
        requestId: job.id,
        source: 'aquaphoria-discord',
        entityType: job.entityType,
        name: job.name,
        requirements: {
          duplicateAliasDetection: true,
          sourceBacked: true,
          preferPrimaryJapaneseSources: true,
          preserveConflicts: true,
          aquapediaEvidenceLevels: true,
        },
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Jarvis research handoff failed (${response.status}): ${payload.error ?? payload.message ?? 'unknown error'}`);
    return payload;
  }

  return Object.freeze({
    async research({ entityType, name, requestedBy }) {
      if (!['strain', 'breeder'].includes(entityType)) throw new Error('Research type must be strain or breeder');
      if (!String(name ?? '').trim()) throw new Error('Research name is required');

      const job = {
        id: crypto.randomUUID(),
        entityType,
        name: String(name).trim(),
        requestedBy: String(requestedBy),
        status: 'started',
        createdAt: new Date().toISOString(),
      };
      await store.recordResearchJob(job);

      const result = await callJarvis(job);
      if (!result) {
        const queued = await queueInAquapedia(job);
        await store.recordResearchJob({ ...job, status: 'queued', aquapediaPath: queued.path, aquapediaUrl: queued.url });
        return { status: 'queued', jobId: job.id, ...queued };
      }

      const written = [];
      for (const file of result.files ?? []) {
        const path = safeAquapediaPath(file.path);
        const url = await writeAquapediaFile(path, file.content, file.message || `research: add ${entityType} ${job.name}`);
        written.push({ path, url });
      }

      const status = result.status ?? (written.length ? 'completed' : 'queued');
      await store.recordResearchJob({ ...job, status, resultSummary: result.summary ?? null, files: written });
      return {
        status,
        jobId: job.id,
        summary: result.summary ?? null,
        confidence: result.confidence ?? null,
        duplicateOf: result.duplicateOf ?? null,
        files: written,
      };
    },
  });
}
