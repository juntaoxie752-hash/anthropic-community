# Burst Before the Bell — proposal v3

Full project context and consolidated handoff: [项目全量上下文与新游戏规划](project-context-and-game-plan.md).

Status: planning only, 2026-11-15. No production changes, migrations or deployments authorized for this iteration. All player-facing text is English. Numerical values below are tuning proposals, not verified economic facts or playtested balance.

## Concept

Turn AI slop into imaginary gold through a toilet called Super Intelligence. Inflate a shared speculative bubble until it bursts before the expected IPO bell. The joke is that the supposedly miraculous machine merely repackages waste as value. The game does not claim to affect an actual IPO or stock price.

Visible loop: Generate AI Slop → poop lands in toilet → Flush to Gold → gold flies into shared bubble → buy permanent tools → accelerate the loop.

## Research and uncertainty

- Google News RSS retrieved on 2026-11-15 lists Reuters (November 10), “EXCLUSIVE: Anthropic eyes $1.4 trillion IPO valuation in test of Wall Street's AI fervor,” and CNN (November 10), “Anthropic to seek $1.4 trillion valuation in blockbuster IPO.” These are retrieved headlines, not a full-text or filing verification. Treat $1.4T as a reported target valuation, not final market capitalization or cash raised.
- The same feed lists CNBC (November 10), “Anthropic sets IPO price range of $70 to $78, looks to start trading Nov. 19, sources say.” Treat November 19 as a reported expected date; no exact first-trade time verified. Do not use seconds implying official scheduling.
- Source feed: https://news.google.com/rss/search?q=Anthropic%20IPO%20valuation&hl=en-US&gl=US&ceid=US%3Aen
- Closest potato reference found: Potato Please, Golden Horn Studios, released November 3, 2026. Steam's official description explicitly describes collecting potatoes, peeling by hand, tossing into water, then bulk collection and automation. It does not establish that this is the exact viral game the user saw, nor that a cash-selling loop is part of it.
- Steam: https://store.steampowered.com/app/5266240/
- Official store data: https://store.steampowered.com/api/appdetails?appids=5266240&l=english

## First screen

Top: Expected IPO: Nov 19 · Reported date, subject to change. Until an exact time is confirmed, display days remaining to the reported date. If a precise game timer is needed, label it Game deadline separately and publish its timezone. Date changes update the displayed source/date; never erase contributions.

Center: one large translucent, increasingly unstable bubble containing the a/ mark and imaginary gold. Show simulated dollars / $1.4T and the player's contribution. New cracks at 25%, 50%, 75%, 90%; vigorous shake at 99%, with reduced-motion alternative. Bubble scaling uses a compressed visual curve so early contributions remain visible; the progress number remains exact.

Below: slop generator, visible poop drop, toilet, gold path into bubble. Large Generate AI Slop button, clickable toilet labeled Super Intelligence / Flush to Gold. Small Share button. Wallet strip: AI Slop and “ARR”. One shop labeled The Hype Store, with two simultaneously visible columns: Slop Factory and Super Intelligence. Never split these into separate tabs. On narrow screens use compact paired cards with expandable details. Keep Find your people and discussion immediately below the game.

## Two currencies, separate statistics

1. AI Slop: unprocessed inventory, earned by manual production and later automation; consumed by flushing.
2. “ARR”: spendable fictional money produced by flushing or explicitly designated event rewards; pays for permanent tools.

Every newly minted buck credits the wallet AND the player's lifetime contribution AND the shared bubble exactly once. Lifetime contribution and shared progress are statistics, not additional spendable currencies. Buying tools deducts wallet only, never reduces progress. No third token or separate donation currency.

Example: 100 slop at $70/slop creates $7,000. Slop falls by 100, wallet rises $7,000, player and global contributions each rise $7,000. A $2,100 upgrade leaves $4,900 in wallet while $7,000 remains credited to the bubble. Existing website reaction totals and previous game balances are not silently converted into new activity.

## Starting economy to prototype

- New player: 0 slop, $0. One press makes 1 slop, visually dropped within about 0.35 seconds. No need to wait for the animation before another valid press.
- Starter toilet: up to 10 slop per flush; can flush a partial batch. $70 per slop, 2-second cycle. User-selected IPO pricing reference; the retrieved report describes a proposed $70–$78 range, not a verified final offer price. Inventory beyond batch capacity remains available.
- First upgrade costs $1,400, attainable after 20 presses and two flushes. First automated producer costs $14,000. Target the first upgrade within 30–60 seconds and partial automation within 3–5 minutes; validate through playtesting.
- Manual and automated throughput are separately visible. Automation does not require holding a button; manual participation adds output and optional event interaction.
- Server validates inventory, cycle times and reward rates. Animation quantity can be capped without changing accounting. No offline catch-up for first release; clearly label automation as active-session production.

## One shop, two columns — proposed AI-themed abilities

User direction: one shop with two visible upgrade columns. All bought with “ARR”. These are AI-culture-inspired fictional mechanics, not claims about specific real incidents. Base conversion stays $70/slop; permanent tools improve quantity, timing, capacity and automation. Late-game prices and levels are pending balancing; old generic tool prices are superseded. Preserve the desired first-upgrade and automation pacing, not the previous named catalog.

Shop title: The Hype Store. Left: Slop Factory. Right: Super Intelligence. Each card shows a clear English name, visual, one-line joke, level, actual numerical next effect, cost, and Buy / Upgrade. Player sees current slop/sec and flush capacity/sec, with an honest bottleneck indicator. Row pairing is visual only; no requirement to buy both sides together.

| Tier | Slop Factory: production and bowel-themed tools | Super Intelligence: conversion and toilet tools |
|---|---|---|
| Starter | Prompt Lubricant — a prompt-shaped lubricant bottle; increases slop per manual press. Copy: Less friction. More fiction. | Context Window Cistern — a transparent tank full of context rolls; increases slop processed per flush. Copy: Now accepting your entire backlog. |
| Early automation | Agent Swarm Enema — tiny agents push plungers in parallel; permanent active-session automatic slop generation. Copy: A thousand agents. One terrible idea. | Agentic Auto-Flush — a robot hand autonomously flushes available slop; does not conjure inventory. Copy: No human in the poop. |
| Speed | Speculative Decoding Laxative — a two-chamber laxative bottle; stores extra pending slop during active play and releases it in a visible burst on the next manual press, with a cap. Pending units are counted once when released. Copy: It comes out before you finish asking. | Boardroom Ejector — a leather-jacket-wrapped plunger attached to an executive ejector chair; cartoon board members eject the chair and its piston pressure-flushes the toilet. Permanently reduces cycle duration (first proposed level: 2 seconds to 1 second). Copy: They kicked him out. You flush it down. Present as a fictional boardroom-coup meme, not verified employment news. |
| Open source | DeepSeek Open-Source Enema — a blue-whale-shaped enema pump releases model-weight-shaped fiber into open pipes; permanently increases automatic slop production. Its first proposed level doubles automatic output; later levels require balance testing. Copy: Open weights. Open bowels. This is an explicit DeepSeek-inspired game tool, not a claim that every DeepSeek model has the same license. | Distilled DeepFlush — a compact blue-whale toilet; opens a second processing lane so a manual batch can run while the auto lane is occupied. Both consume the same locked inventory. Copy: Smaller model. Bigger flush. |
| Scaling | Synthetic Data Feed Loop — a recycling food tube; each N units of slop actually consumed by flushing produces a smaller fixed number of new slop. Recycled slop cannot trigger recycling again. Copy: Yesterday’s output. Tomorrow’s training data. | MoE: Mixture of Excrements — multiple toilet bowls with a router; adds bounded parallel batch capacity. Routing itself grants no currency and cannot duplicate consumed inventory. Copy: Every expert is full of it. |
| Endgame | GPU Colon Cluster — leather-jacket-shaped cooling around a server/bowel rack; scalable automated production for factory-size output, matched to toilet capacity. Copy: Just add more compute. | Hyperscale Flush Center — a datacenter-sized toilet plant; scalable multi-lane throughput and automatic scheduling. Copy: A trillion-dollar exit strategy. |

Suggested first preview: Prompt Lubricant, Agent Swarm Enema, Context Window Cistern, Agentic Auto-Flush, Boardroom Ejector, and DeepSeek Open-Source Enema. Other cards are later unlock concepts until the core is fun. The first six need tested prices and prerequisites before implementation. Temporary events can separately award multipliers; do not disguise unit-price changes as permanent toilet upgrades.

Optional bubble-flavored store milestones: Funding Round unlocks the next tier; Compute Arms Race unlocks factory scaling; Roadshow Mode changes the presentation near the deadline. These are game progression labels, not dated factual headlines. Keep Leather Jacket Coup and Blue Whale Release as limited events alongside their permanent shop tools. Buying tools never consumes the event or requires waiting for it. Event bonuses expire; purchased base abilities remain.

## Shared bubble and background funding

Shared goal G = $1,400,000,000,000, fixed for the round. Start at zero simulated bubble funding. Let P be real participant-generated contribution, E be once-only global event awards, and A be explicitly labeled simulated background funding. Progress = min(G, P + E + A). No fake players or fake individual contributions.

Suggested background funding: $35B per day, accrued smoothly server-side, cap $140B for the round. Display Today's simulated funding and distinguish it from Community generated. It therefore creates visible inevitability without finishing the round on its own or moving the win condition away from players.

At the user-selected $70 base rate, 20 billion slop fills the $1.4T target. With four days, $140B background funding and no event awards, participants need $1.26T, equivalent to 18 billion base-rate slop: 500 players averaging 36 million slop each, or 1,000 averaging 18 million. The starter upgrades alone cannot reasonably deliver this within a short round. A later factory-scale progression (thousands, then millions of slop per second), matching toilet throughput, and a rebalanced rescue goal are required before implementation. These are proposed next design steps, not approved or playtested late-game values. Keep $70 as the base conversion and show any temporary event multiplier separately. Do not secretly inflate progress or move the target during a round.

If official valuation changes, retain the published round target and show its source date. A later round can adopt a new target. If timing slips, show the revised reported date; the funding cap still applies. If date remains unconfirmed, show IPO date unconfirmed and run a separately labeled game round.

## Events

Events are fictional meme scenarios. News-inspired names do not assert that a real board ousted or attacked someone. Random personal events draw from active play; shared events use server-owned schedules and one shared outcome across both domains. Starting proposal: a personal event opportunity every 3–5 active minutes, 45-second presentation, rewards claimed once, same-category multipliers refresh rather than stack.

| Event | Visual and action | Reward proposal |
|---|---|---|
| Blue Whale Release | Toy blue whale breaks through a benchmark chart; collect its splash | Immediate $7,000, then 30 seconds of 3× conversion. Tag: Fictional meme event |
| Open Source Floodgates | Padlocks pop off pipes; shared plumbing opens | Immediate $3,500, then 60 seconds of 2× slop production |
| Benchmark Theater | Gold trophy on a toilet with absurdly rising chart | Immediate $14,000. No additional currency |
| Another Funding Round | Briefcase pours gold directly into bubble | Once-only global $10B; displayed as event funding, not credited to every visitor |
| The Leather Jacket Coup | A leather jacket on a chair surrounded by cartoon boardroom silhouettes | Starts the cooperative Rescue Jensen event below |

For personal payouts, minting also increments that participant's contribution once. Global awards enter E only and do not create spendable money for absent or unlimited anonymous accounts. All award sizes require tuning before implementation.

## Rescue Jensen — cooperative event

During a scheduled 30-minute event, collect $20B of new participant-generated “ARR” across both sites. The contribution is automatic when flushing; users keep their wallet credit and do not pay a second donation cost. Only flush-generated value during the window counts; exclude background funding and flat event bonuses to avoid self-completing cascades.

Show shared rescue progress and Your rescue contribution. At completion, free the jacket in a short animation, award a one-time $10B global funding bonus and unlock 2× conversion for everyone for five minutes. A late visitor sees the same remaining buff duration. If unmet, the event ends without subtracting any currency; future event schedules are visible. Do not carry old progress into an identically keyed event accidentally.

The boardroom scene is explicitly game fiction. No claim about Jensen Huang's real employment status is part of the event.

## Finishing the round

At $1.4T the bubble ruptures once globally; show Bubble burst before the bell! with contribution totals and a shareable receipt. Online participants see the animation; returning participants get a recap rather than a reset. Keep all personal tools, wallet and totals for a later decision about the next season.

If the reported IPO date arrives first, the timer changes to The bell rang. The bubble is still here. The same round continues until burst, retaining all progress. No automatic loss of balances. The fictional game outcome must never claim the actual IPO failed.

## Art direction and generation briefs

Unified stylized 3D clay-toy aesthetic: tactile ceramic, comically soft poop, warm gold, blue whale, black leather jacket; strong simple silhouettes readable at phone sizes. Transparent or uncluttered compositions; UI text rendered separately in HTML. No realistic feces, injuries, fake news photography, or baked-in numerical labels.

Priority assets: slop generator/poop sprite, ceramic starter toilet, gold flush transformation, upgrade toilet, blue whale event card, leather jacket boardroom event card, open-source pipes event card. Bubble itself should be animated with native graphics so cracks, progress and resize remain responsive.

Common prompt prefix: "Stylized 3D clay-toy game illustration, tactile miniature materials, playful absurdist satire, readable silhouette, soft studio lighting, uncluttered composition, no lettering, no watermark."

1. Toilet: "A pristine oversized ceramic toilet as a ridiculous superintelligence machine; a small playful poop-shaped clay toy enters the bowl, shiny gold nuggets emerge along a curved pipe; three-quarter view; distinguish input and output."
2. Whale: "A friendly cobalt-blue toy whale bursting through a paper benchmark chart with blank graph shapes, splashes and gold nuggets suspended around it; centered event-card composition."
3. Jacket: "A black miniature leather jacket draped on an executive chair in the center of an absurd boardroom; oversized shadowy board-member chess pieces surround the chair; a loose golden ribbon cage opens as a visual rescue motif; clearly fictional cartoon, no realistic portrait or violence."
4. Open source: "A branching toy plumbing network with open padlocks and unrolled blank blueprint sheets, gold nuggets flowing through transparent blue pipes; cheerful release of pressure."

Selected generation provider (explicit user instruction): https://vast-material.tripo3d.com/ai-generate. Blue-whale test task 58909 completed and was visually checked in the provider UI, verifying the submission-to-result pipeline. The image has not been downloaded into this project or integrated into the website. Leather-jacket artwork has not been submitted. The user explicitly requested stopping further generation after pipeline verification. Historical native Chrome input delays and tab-switch interruptions are documented in the generation log; do not treat them as evidence that the successful task never ran. Do not submit more assets or switch providers without a new user request.

## Scope for the first playable preview

One processing loop; two balances; one two-column shop with six initial tools; one shared bubble; one background-funding rule; blue-whale personal event; cooperative jacket event; existing sharing and discussion retained. Defer hemorrhoids, additional currencies, prestige resets and elaborate rankings to avoid burying this new core loop. First verify that generating, watching a pile form, flushing and buying one upgrade is satisfying before expanding the event pool.

Before release: verify first-party IPO details where available; choose honest timer labeling; playtest starter progression; check double-claim/duplicate-flush protection, negative balance prevention, concurrent completion, cross-domain shared progress, offline boundaries, reduced motion and mobile layout. This document itself does not authorize deployment.

## Revision note: $70 per slop

User selected $70 as the base conversion rate. Starter tool prices and personal flat event awards were scaled by 70 / 1,000,000 to retain their relative early-game purchasing power. Permanent conversion upgrades now improve throughput instead of changing the base unit price. The $1.4T shared goal is retained. Global funding and rescue amounts remain provisional and need a complete late-game balance pass; they are not launch-ready. Production remains unchanged.

## Revision note: unified shop

Replaced the generic eight-item catalog with a two-column AI-themed concept catalog. These names and abilities are proposals; no new gameplay has been implemented or deployed. Tripo generation path verified with completed blue-whale test task 58909; user requested stopping further generation after verification. Leather-jacket artwork is not submitted.

## Revision note: DeepSeek and the boardroom in permanent tools

The two memes now have explicit permanent shop items: DeepSeek Open-Source Enema in the production column, and Boardroom Ejector in the toilet column. Their proposed starting effects are 2× automatic slop and half flush-cycle duration respectively; price and progression remain untested. Neither changes the $70 base conversion rate.

The previously requested global Rescue Jensen event remains. All players can contribute with ordinary flushing. On a successful rescue, everyone receives the existing five-minute conversion bonus; owners of Boardroom Ejector additionally see a rescued-jacket cosmetic state, without an extra reward multiplier or gameplay gate. The permanent ejector works before any rescue. Boardroom expulsion is explicitly fictional satire unless independently verified; artwork uses the jacket, chair and cartoon board pieces rather than fabricated news imagery.
