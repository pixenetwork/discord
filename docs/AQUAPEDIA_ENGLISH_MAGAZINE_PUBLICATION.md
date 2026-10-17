# Aquapedia English publication forum — safe one-shot release

## Goal
Publish original English Aquapedia reading companions in the **public** `AQUAPEDIA` category under a **new, separate** Discord Forum named `magazines-articles`.

**Do not** move or expose the existing staff/vendor-only `translated-publications` Forum under `AQUAPEDIA RESEARCH`. This release creates an additive public forum only after verifying the parent is already public.

Two issue threads:
- **JMA Classification Manual (2025)**: 18 indexed research topics, https://aquapedia.app/magazines/jma-2025-english-notes/
- **Medaka Hyakka No. 21 (2025)**: 6 indexed research topics, https://aquapedia.app/magazines/medaka-hyakka-21-english-notes/

The messages are original English research summaries and links, **not** page-matched translations, photos, scans, or original magazine PDFs. The JMA page-layout English review PDFs stay private pending permission. Publisher-reported cross pedigrees and awards are not automatically verified.

## Deployment

Use the existing authorized bot token and `AQUAPHORIA_GUILD_ID` from its secure runtime environment. Do not paste, display, log, or commit credentials. The publisher uses **Discord REST only**, without a second Gateway login, server bot restart, or new Discord application.

On a machine with Node 20+ and the existing bot environment configured:

```powershell
npm ci
node tools/publish-magazine-companions.mjs --check
node tools/publish-magazine-companions.mjs --publish
```

`--check` is read-only and reports the existing public category, bot identity and forum ID, or a concrete blocker. `--publish` creates at most the single forum `magazines-articles` under the **existing public** AQUAPEDIA category, then creates/updates two issue threads. It refuses a restricted parent, ambiguous duplicate forum, duplicate thread name, or preexisting post not owned by this bot.

The first thread message contains all 18 anchored English JMA topic links; the second contains six Medaka Hyakka topic links. Both include source links, publisher/year, and rights caveats. All messages disable `allowedMentions` to prevent unintended pings.

**Completion gate:** the CLI must read both starter messages back through the Discord API and verify the bot author ID plus unique Aquapedia footer marker. Only then does it write `data/aquapedia-english-magazine-receipts.json` (ignored by git) with real forum/thread/message URLs. A network error after writing stops and requires manual inspection/re-run; it must never be assumed that a post failed. Re-running is idempotent: approved bot-owned thread starter messages are edited rather than duplicated.

## Local checks
```powershell
node --check src/magazine-publications.mjs
node --check tools/publish-magazine-companions.mjs
node --test test/magazine-publications.test.mjs
npm run check
npm test
```

## Current blocker
The desktop shell used to prepare this source did **not** have `DISCORD_TOKEN` or `AQUAPHORIA_GUILD_ID`. A bot already answered both `/health` and `/ready` with `ok:true` on `127.0.0.1:8790`, but that HTTP process exposes no authorized magazine publishing endpoint. Until the authenticated CLI runs and produces readback receipts, **zero Discord posts have been independently verified**. Do not confuse the passing simulated tests with actual Discord publication.
