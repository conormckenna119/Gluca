# Boost reactions — Stage 9A

Boost is the only positive reaction exposed. `src/domain/reactions.ts` retains boost, love, celebrate, support and strength for later use; no picker, negative reactions or downvotes were added. Wording is centralized in `src/reaction-copy.ts` (`REACTION_WORDS`). The existing bolt artwork and shared BoostButton are reused in feed and detail cards.

Account posts use POST `/api/social/boost` with `{id, active}`. This is an explicit desired state, not a blind toggle. Session ownership, post visibility and mutual blocks are checked server-side. Self-Boosts are rejected. Migration 9 enforces one `(post_id,user_id)` reaction; counts and the current user's reaction are projected from those rows. The dedicated route writes only Boost; the other kinds are reserved by the schema.

The shared client immediately updates the in-memory post and restores its prior reaction on failure. A scope-bound cross-mount lock prevents duplicate rapid taps. Failed requests are not automatically replayed: the UI explains uncertainty and refreshes authoritative state, including a committed write whose response was lost. Server desired-state handling prevents duplicate records on retries. Counts reconcile across clients on refresh, browser resume/focus and a 30-second foreground check; this is eventual reconciliation, not a push/live guarantee.

Buttons have configurable action/count labels, an explicit pressed state, busy/disabled state and at least 44px targets. New Boosts pulse the bolt subtly unless reduced motion is requested. Own account posts show counts with a read-only label. Existing local fictional post reactions remain local and labelled; they no longer submit account achievement events.

A first genuine Boost may award the existing private Community Boost medal atomically. Repeat taps, remove/re-add cycles and notifications cannot duplicate it. Inbox previews contain no glucose values, post captions, comments or medical identity details. Repeated Boost/follow removal and addition does not repeatedly alert the author. No automatic sharing or private-post audience expansion.

Full endpoint, storage, privacy, testing and deployment notes: [SOCIAL_INTERACTIONS.md](SOCIAL_INTERACTIONS.md). Stage 9A changes neither Dexcom nor Story Studio rendering.
