# Discord privileged-intent application — jarvis aquaphoria

**Application ID:** `1535522109571203152`
**Repository:** `pixenetwork/discord`
**Candidate:** `feature/aquaphoria-member-moderation-20261011` (draft PR #18)

**Status: NOT SUBMITTED.** This is a truthful draft for Discord's Request Additional Intents form. The bot's current production runtime does not yet use these features. Evidence must be collected from real Discord testing before submitting the form. Discord currently rejects enabling new Presence Intent on this already high-reach application.

## Application Details — What does your application do?

Jarvis Aquaphoria operates community support, Aquapedia research assistance, vendor approval and marketplace/order workflows in a Discord community. Existing interactions are primarily slash commands. We are developing three additional opt-in gateway features in PR #18 to support a large community: join/leave event-driven onboarding and vendor-access reviews, designated marketplace-channel anti-phishing alerts, and an on-demand view of users whose Discord game activities show FiveM.

The candidate features are disabled by default and limited to a specifically configured community; they are **not yet active in production**. The message moderation design is human-review-only, and presence observations are kept in Discord's in-memory gateway cache, not written to the bot's database.

Code and test design: https://github.com/pixenetwork/discord/pull/18

## Public Privacy Policy?

**Yes**, published at https://aquaphoria.shop/policies/privacy-policy .

Verify that the published version actually discloses the intended member, message and presence data handling before live rollout. A published policy URL alone doesn't prove disclosures are sufficiently specific.

## Server Members Intent — Why?

We need member join/leave gateway events for timely onboarding, configurable welcome messages, vendor-authorization follow-ups, and rate-limited unusual join-burst alerts. Slash commands do not emit join/leave events automatically. The candidate handler uses `GUILD_MEMBER_ADD` and `GUILD_MEMBER_REMOVE`, references only the configured guild, and alerts authorized staff without automatically restoring vendor roles. The last 500 join timestamps are used in-memory for a bounded burst window; there is no historical member roster stored.

**Are you storing any API Data off-platform?** No member-event history is persistently stored in the proposed handler. In-memory event processing is performed by the bot's server, and staff alerts are posted to private Discord channels. Verify implementation and data access policies before final answer.

**Evidence URL:** REQUIRED — not yet available. Record a real, consented member join and leave in a test Discord server with the handler enabled; show the staff-only join alert and vendor review notice. Don't substitute unit-test output or simulations as actual Discord evidence.

## Guild Presences Intent — Why?

We need members' Discord-visible `Playing` activities to power two user-initiated FiveM commands: `/fivem online`, which shows a current aggregate of Discord members visibly playing FiveM, and `/fivem players`, which privately shows a capped list to authorized server managers. Slash command interaction payloads cannot include all members' currently shared game activities. The candidate reads Discord's presence cache at the time of request, does not persist presence history, and shows an explicit warning that this is **not** a definitive FiveM server player count. No automatic collection, profiling or advertising is performed.

**Can users opt out of having presence data tracked?** **Yes, in the proposed implementation:** `/fivem hide` applies a dedicated opt-out Discord role, and the bot excludes those members from both counts and staff-only member lists. `/fivem show` removes that role. Members can also control Discord's own activity-sharing settings. The bot does not persist presence history or the opt-out roster locally. This privacy feature is implemented in PR #18 but **has not been demonstrated live or deployed**, so application claims must remain explicitly prospective until demonstrated.

**Are you storing user activity data off-platform?** No persistent off-platform storage in the candidate. Activity is read from the Discord.js in-memory presence cache, not written to a database.

**Evidence URL:** REQUIRED — not yet available. Show a consenting tester starting/stopping FiveM while the original application is authorized to receive presence events, followed by the real Discord `/fivem online` and staff-only `/fivem players` responses. A mock response or code screenshot is not genuine live evidence. **Current blocker:** Discord rejects enabling this new intent because this application has crossed its high-user-count threshold. Ask Discord Developer Support whether they accept code and a controlled test-app demonstration, or provide an approved test mechanism; don't create or substitute a different production bot without authorization.

## Message Content Intent — Why?

We need to review ordinary human-authored messages in specific admin-configured marketplace channels for blocked links, phishing-style giveaways and brand-impersonation links. These patterns can occur without any slash command or mention to the bot; slash commands alone cannot provide preventative monitoring of publicly posted marketplace messages. The candidate analyzes only selected channels, posts a reason and a link to a designated **private** staff channel, doesn't store original text in the bot datastore, and takes no automatic sanctions. Moderators make enforcement decisions.

**Can users opt out of having message content tracked?** No per-user opt-out is implemented within an admin-monitored channel. Members may use unmonitored channels; clear community notice is still necessary. Answer **No** for a per-user opt-out unless an actual feature is added.

**Are you storing message content off-platform?** The candidate does not persist raw message bodies outside Discord; they are processed in memory in the bot runtime. Do not falsely claim the message content never leaves Discord's servers during processing.

**Will message content be used to train ML/AI models?** **No.** This candidate runs deterministic rules and doesn't submit raw messages to AI model training.

**Evidence URL:** REQUIRED — not yet available. Record a real test marketplace message containing a safe, controlled test URL and a genuine human-review alert in a private Discord channel. Make sure the test is confined to an explicitly monitored channel.

## Submission checklist

- [x] Repo change proposed in PR #18; optional flags default off.
- [x] Candidate unit tests passed locally.
- [x] Confirmed the current application is blocked from enabling additional Presence Intent until review.
- [ ] Validate policy/community-rule notices and bot-level data practices.
- [ ] Obtain Discord-approved path for producing Presence evidence for high-reach bot.
- [ ] Perform live test-guild demonstration of Guild Members and Message Content handlers, with correct bot permissions.
- [ ] Perform live Presence demonstration if Discord grants an authorized testing path.
- [ ] Upload genuine screenshots/video somewhere accessible to Discord and paste exact URLs into each required field.
- [ ] Submit the filled form and preserve the Discord confirmation/receipt.

Do not check the final certification until the statements and required evidence are verified. This draft must never be passed off as an already-deployed implementation.
