# Aquaphoria optional privileged-intent features (candidate)

This implementation is under review. Do **not** enable privileged intents on the production bot until Discord has authorized the particular intents for this application. The current live worker remains unchanged.

## Scope and behavior

- **Guild Members**: `AQUAPHORIA_MEMBER_EVENTS_ENABLED=true` subscribes to joins and leaves of the configured `AQUAPHORIA_GUILD_ID`. Detects short join bursts and sends an alert at most once every five minutes to a designated private staff channel. When a known vendor joins or leaves, it sends a staff notice; roles are never automatically granted. An optional welcome channel posts a greeting on member join. No historical member roster is retained.
- **Message Content**: `AQUAPHORIA_MODERATION_ENABLED=true` subscribes to ordinary guild messages in only the channel IDs listed by `AQUAPHORIA_MODERATION_CHANNEL_IDS`. It checks for configured blocked domains, suspicious punycode, and common giveaway phishing. It posts **reasons and a link**, not raw message content, to the approved private staff alert channel. Staff review is required. It never automatically deletes messages, sanctions members, or stores message bodies in the app database.
- **Guild Presences**: `AQUAPHORIA_FIVEM_ACTIVITY_ENABLED=true` allows the bot to read members' visible Playing activity from Discord's in-memory presence cache, matched against `AQUAPHORIA_FIVEM_ACTIVITY_MATCHES` (default `fivem`). `/fivem online` provides a public aggregate count; `/fivem players` lists up to 15 member mentions to the server owner or Manage Server staff, **ephemerally**. No presence history is written to disk and no player-game activity is collected from external services.
- **Bot Rich Presence**: `AQUAPHORIA_BOT_ACTIVITY_NAME` sets the bot's own “Playing…” display without requiring Guild Presences.

All optional features default to **off**. They are scoped to one configured Discord guild, not all other Pixel Network communities. Bot authorization checks and private-channel permission checks remain in force.

## Limitations

The displayed count is **not** the actual FiveM game-server player count. It includes only visible Discord members whose activity matches the configured term; hidden/invisible Discord presences, unavailable activities, Discord privacy settings and incomplete initial presence cache can make the count lower than reality. An external, authenticated FiveM server endpoint would be needed to display authoritative server population.

At tens of thousands of Discord members, membership join bursts are held in a maximum 500-entry memory queue. FiveM activity snapshots traverse the Discord client's current in-memory presence cache when requested, rather than persisting or repeatedly polling player profiles. Message alerts are deduplicated within the current process.

## Configuration / activation

1. Obtain and confirm approval for each requested privileged intent in Discord's Developer Portal.
2. Test this branch in a **non-production Discord guild**; do not reuse production tokens or persistent data. Gather real screenshots or video of member join/leave, marketplace alert, and FiveM activity changing. Never portray mocked tests as live Discord evidence.
3. Set only the required feature flags and provide real staff-alert / monitored channel IDs. Ensure the alert channel is hidden from `@everyone`.
4. Verify terms, privacy notice, and community rules truthfully disclose moderation and presence access; provide a meaningful way to contact staff about privacy requests.
5. Run `npm run check`, `npm test`, then perform a governed deployment with a verified one-writer restart. Keep unrelated bots running.

## Discord review — Presence Intent

**Purpose:** Read members' Discord-visible current game activity to show whether FiveM is being played. Server managers can inspect a small list using `/fivem players`; members can use `/fivem online` for an aggregate observed count. The bot doesn't impersonate users, alter anyone's activity, track presence histories or use presence data for advertising. The feature depends on real-time `GuildPresences` gateway data. Discord slash commands without the intent cannot read arbitrary members' Playing activity.

**Evidence required before submission:** Screenshot/video of a real Discord user starting/stopping FiveM (or approved match term), followed by `/fivem online` count changing and staff-only `/fivem players` output; show user identity only with that test user's consent. Include the actual guild and bot. Test fixtures alone do not satisfy the application.

**Privacy disclosure:** In-memory, bounded by Discord's presence cache; neither persisted to the bot database nor sold or used for AI training. Users may control whether their activity is displayed using Discord's privacy/activity-sharing options; only server managers can request individually identifying lists. There is no independent account-level opt-out implemented by the bot.

## Discord review — other intents

**Server Members:** Actual join/leave gateway event handling for onboarding and vendor membership reconciliation, plus throttled burst warnings. Evidence should show a genuine test member entering/leaving a test guild and the private staff notices, with identifying information hidden from public sharing.

**Message Content:** Administrator-scoped phishing and fraudulent marketplace URL alerts in specifically configured sales channels. Ordinary slash commands cannot proactively screen incoming public marketplace messages. The demo must show a genuine ordinary test message and an alert, with no automatic enforcement. The current implementation retains no raw bodies in the bot's database. Channel restriction means users can avoid monitoring by posting outside the monitored channels, but **there is no per-user opt-out inside a monitored channel**. Answer any application yes/no opt-out question truthfully, not with assumed capabilities.

No submission should claim these features are already deployed until they have been enabled in a safe test guild and actual evidence exists.
