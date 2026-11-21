# Aquapedia published-research evidence (2026-10-21)

The canonical Aquaphoria Discord worker owns `data/aquaphoria-discord.json`. Never update that live file from a competing process: it includes private order, vendor, webhook and research state.

A separate immutable **`data/research-publication-evidence/<job-uuid>.json`** receipt links a queued research request to a verifiable public Aquapedia dossier and an authenticated Discord message. It does not change original status, impersonate Jarvis, retry a job, or certify a creator/lineage. A failed source, URL, forum, author, timestamp, or content read-back rejects the operation without saving evidence. Conflicting receipts are rejected; identical confirmations are idempotent.

Use the existing bot's `.env` only at runtime. Never copy credentials or live-state JSON into source control. Invoke `node --env-file=<existing-bot-env> tools/reconcile-externally-published-research.mjs --job <existing-UUID> --data-dir <existing-runtime-data-folder> --receipt <verified-publication-receipt-path>` once, in a supervised local operator session. This checks the site and Discord using read-only HTTP requests and writes only a scoped sidecar. Discord `/research-queue` remains owner-only and read-only, showing `queued (published; creator pending)` and the verified live URL rather than falsely declaring a Jarvis completion.

For Yoru, the original queued record is preserved. Site publication is independently documented but the original creator, parentage and fixation remain unknown. Reris must not be linked to Lecris without original Japanese spelling or primary confirmation; the eight older records remain unchanged.

Never auto-send messages, republish photos, fabricate lineage, or change owner identity. Evidence sidecars are local durable provenance, not a public breeder approval or data backup.
