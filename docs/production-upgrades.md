# Production upgrades — 2026-11-16

The production shop and backend now include the following permanent upgrades. All prices use in-game “ARR”; none represent real purchases.

| Upgrade | Cost | Effect |
| --- | --- | --- |
| NVIDIA B300 Cluster | $1,400 per chip | One slop per production cycle |
| Data Center | $179,200 each | 128 additional B300 chips; 128 slop per cycle |
| AI native workspace | $7,000, once | Replace the one-slop click with a server-generated roll |
| DeepSeek Mystery Algorithm | $350,000 × 2^current level | Multiply the production interval by 0.8 per purchase |

A fleet's cycle starts at five seconds. After two algorithm purchases it is 3.2 seconds. Algorithm upgrades apply to all current and future individual chips and data centers. Level 40 is the numeric guardrail; the shop disables further purchases there. UI refresh is limited to at most once a second for fast fleets, but server accrual uses the actual interval. Decorative animation runs no faster than a half-second cycle.

Total chips = individually bought chips + 128 × data centers. Data centers are tracked separately, so their chips are never credited twice. Their illustration overlays the chip sprites; the number of visible chip sprites is capped at five, while the owned count remains exact.

Workspace rolls:

- 85%: uniformly distributed from 1 through 50.
- 12%: uniformly distributed from 51 through 250.
- 3%: uniformly distributed from 251 through 1,000.
- Rolls 1–10 show a red “CONTEXT COLLAPSE” effect; 251–1,000 show a gold “SLOP JACKPOT!” burst. Other rolls show a neutral output card.
- Actual credited slop is capped by remaining bowl space. The result states how much was credited and how much overflowed. A full bowl requires a sale before another roll.
- Reduced-motion preferences preserve the result text without shake or particles.

## Persistence and deployment

Apply `supabase/008_production_upgrades.sql` once after 007, then deploy the Worker and assets together. Migration 008 adds `data_centers`, `workspace`, and `algorithm_level`, and replaces `community_bubble`; it preserves existing balances, capacity, financing history, and contributions.

New same-origin POST routes: `/api/bubble_buy_center`, `/api/bubble_buy_workspace`, `/api/bubble_buy_algorithm`. Existing visitor cookies and request IDs provide identity and replay protection. Only the server draws random numbers, determines costs, and credits slop.

A purchase first settles existing production at the old interval. Algorithm purchases preserve partial cycle progress proportionally. Adding hardware starts a fresh cycle so new chips cannot earn retroactively. Full bowls do not bank overflow. Upgrades do not add to global contribution; only sales do.

`npm test` covers migration preservation, purchase accounting, stacked production, weighted random rolls, overflow, replay protection, API origin/method enforcement, and front-end purchase/effect rendering. The front-end tests also ensure an old background response cannot overwrite a newer purchase.

## Pricing and visual revision

Migration 009 raises only the DeepSeek base cost to $350,000 (still doubles each level); existing purchases remain intact. Apply once after 008. Workspace results use borderless floating Oxanium numbers with Space Mono labels, both self-hosted under SIL OFL. The blue DeepSeek silhouette is an SVG adapted from Lobe Icons (MIT).

## Community rewards and progress direction — 2026-11-16

Apply migration 010 once after 009. Sharing (copy succeeds or a platform button is clicked) credits $50M ARR once per anonymous visitor cookie on that domain. Opening the share dialog alone does not claim it. Each newly saved post credits $30M and reply $10M. Rewards add only spendable ARR, not lifetime sales or the global bubble. They are not retroactive. Database triggers and a unique reward ledger make content insertion and credit atomic; replayed writes do not earn again. Existing forum rate limits remain. Clearing cookies or using another browser/domain starts another anonymous identity; this is browser storage, not person-level verification.

The game footer has three reward shortcuts; the composer shows its reward, and the share dialog shows available/claimed state. Home-page cash refreshes after a share claim. Post/reply success messages survive navigation. First-visit API requests share one identity bootstrap to avoid competing cookies. Unchanged form retries reuse their request ID.

AI Bubble fills from its right edge toward the left, using the same underlying contribution ratio.
