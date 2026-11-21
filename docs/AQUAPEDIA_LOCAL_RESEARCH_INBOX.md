# Aquapedia local research queue — operator notes

The Aquaphoria Discord bot stores research jobs in its existing durable `DATA_DIR/aquaphoria-discord.json` file. When `JARVIS_RESEARCH_ENDPOINT` is unset, `/research` records an explicit `queued` job locally; it does **not** create a GitHub issue, research dossier, public post or claim the research completed.

## Safe owner visibility

Use **`/research-queue`** in the Aquaphoria Discord guild. The command is restricted to the configured Discord owner and responds ephemerally. It gives totals by status and up to 15 latest jobs without showing requester Discord IDs or other stored commerce information.

A `started (stale; needs review)` job indicates an earlier handoff that never recorded completion. This is **not** evidence that research failed, nor permission to retry a request automatically. Inspect source data and job receipts independently before requeuing, retrying, posting or changing any status.

## Connected mode

Only a verified, authenticated Jarvis research service that accepts the `createResearchService` request body may be set as `JARVIS_RESEARCH_ENDPOINT`; do not substitute the conversation-only AionOffice portal or guess localhost ports.

Publication still requires explicit completed research, editor and public-audience approvals, a source-backed record and the existing Discord forum/readback gates. Guppypedia's seven already-published guide threads are not reissued by this queue.

## Operations

The live JSON store contains orders, vendor state and webhook receipts as well as research jobs. **Never edit it manually while the bot runs.** Keep backup and current worker runtime untouched when diagnosing stuck jobs. The new status command is read-only; it does not write, retry or dispatch any job.
