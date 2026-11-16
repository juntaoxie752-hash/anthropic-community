# Anthropic community

> 2026-11-16：泡沫游戏已上线，最新生产商店规则与迁移见 [Production upgrades](docs/production-upgrades.md)。以下旧状态说明为历史记录。

> 项目接手入口：[项目全量上下文与新游戏规划](docs/project-context-and-game-plan.md)。新版游戏目前只做方案，旧游戏已撤下；本文件下方包含历史发布记录，请以接手文档的状态区分为准。

同一套前端与 Cloudflare Worker API，两个域名共用 Supabase 数据。首屏根据用户提供的截图调整，评论区位于第二屏。

## 当前状态

- 已部署 Cloudflare Worker： https://anthropic-community.juntaoxie752.workers.dev
- 已连接 Soldy Help Center 项目 `tdhlpkvqarifoixynfkh`，三份数据库迁移已执行；不要重复执行。
- 线上已验证发帖、回复、点赞去重、Newest/Popular、服务端 HTML、结构化数据、站点地图和 404。跨站写入由 Worker 的 Origin 检查拦截；线上补充验证受本机网络中断影响。验证帖子已隐藏，数据库已确认，未永久删除。
- 本地数据库测试通过。浏览器已确认新版首页排版、分享按钮和两处公司文案；分享弹窗点击验收受浏览器控制连接不稳定影响。
- 两个正式域名已成功绑定同一 Worker，默认停放 A 记录已移除；部署版本 `e69b6f27-4062-404a-b961-83340aced968`。
- GoDaddy 的两次 Nameservers 修改均已提交并由用户完成邮箱验证，目标为 `brady.ns.cloudflare.com`、`wanda.ns.cloudflare.com`。
- 2026-11-15 新版发布后，两个正式域名 HTTPS 均已返回 200 和最新页面；fuckanthropic.club 首次检查曾遇握手失败，复查成功。
- 没有伪造点赞、评论、国家和在线人数。后台未连接时显示连接不可用。

## 开发与部署

1. `npm install`
2. 在选定的 Supabase 项目依次运行 `supabase/schema.sql`、`supabase/002_forum.sql` 和 `supabase/003_long_posts.sql`（一次性迁移）。
3. 将 `.env.example` 中的变量配置为 Cloudflare Worker secrets；本地开发放在忽略提交的 `.dev.vars`。
4. `npm test`、`npm run check`、`npm run dev`。
5. 登录 Cloudflare 后 `npm run deploy`，把 GoDaddy 中确认过的两个完整域名添加为同一 Worker 的自定义域名；修改 DNS 前检查已有记录。

Service role key 仅保留在 Worker。所有表位于私有 schema，启用 RLS，只允许服务端调用受限函数。访客使用 HttpOnly cookie，IP 仅经 HMAC 后用于限流；不存储原始 IP。评论以纯文本渲染。可通过数据库将 comments.hidden 设为 true 隐藏违规内容。

在线人数按最近 90 秒活跃访客统计，国家来自 Cloudflare 的国家代码。同一浏览器在不同域名有独立匿名身份，因此无法保证跨域名一人一赞；评论和总数本身全局共享。匿名限流是基础保护，公开推广前可补充 Turnstile。反应事件逐条保存，访问规模增大后应将聚合计数改为专用计数表。


## 帖子与 SEO

首页下方为 Reddit 风格帖子流，支持 Newest/Popular；帖子有标题、正文、点赞和回复数，详情页可回复。回复目前为帖子下的单层讨论。

- `/posts`：服务端渲染的分页帖子目录。
- `/posts/<uuid>/<title-slug>`：可直接访问的帖子详情，正文与回复直接输出 HTML。
- `/sitemap.xml`：sitemap 索引，每份 sitemap 最多 1000 篇帖子。
- `/robots.txt`：允许公开页面，排除 API。
- 默认 canonical 主域名为 `anthropicsucks.club`，另一域名共用内容并指向主域名；可通过 CANONICAL_ORIGIN 修改。
- 每个帖子输出 title、description、Open Graph 和 DiscussionForumPosting 结构化数据，隐藏帖子返回 404。数据库故障返回 503，不把错误页当成正常页面收录。
- 这些实现支持抓取，不保证搜索引擎收录或排名。

## 本次更新

- 去掉界面中的装饰箭头；大反应按钮旁加入小 Share 按钮，帖子详情使用同一分享面板。
- 参考 ACE Music 分享交互：多平台、可编辑分享句子、复制链接及文案、系统分享。Facebook/LinkedIn 的官方入口只传链接，面板提示复制文案。
- 帖子与回复均支持 20,000 字符，前端、API 和数据库限制已同步。
- 首页两处文案均为 “Anthropic is an evil company.”。
- 四项自动化测试通过，包括 20,000 字符中文正文持久化、回复、SSR、超限拒绝和分享链接编码；部署检查通过。

- 点击主按钮立即触发手势上戳，180ms 后图标抖动并弹出 💩，沿抛物方向下落并清理；根据元素位置适配屏幕，减少动态效果偏好下改为短暂静态表情。两域名新脚本已验证返回。

## 2026-11-15 编辑内容发布

用户确认采用编辑整理方案后发布 25 篇英文讨论帖，统一署名 Editorial Desk · 编辑整理。3 篇引用已通过浏览器查看的近期 X 讨论，其余为已获取的官方公司政策分析。正文区分来源事实、编辑观点和讨论问题，并提供可点击 HTTPS 来源链接。没有创建假评论或假点赞。内容及来源存档见 editorial/。本批次部署版本：00e4d171-f3a1-4af1-8998-ba159adfca09。

## Game withdrawn — 2026-11-15

At the user's request, removed the game interface, shop, leaderboards, heat system and cooperative events from both domains. Restored the original reaction button, poop animation, sharing and discussion wall. Game API actions now return 404. Archived game release sources in `.deploy/game-paused/`; production game tables and earned data remain intact for a future redesign. Posts, replies, likes and genuine reaction totals are preserved.

Rollback deployment: `8cf2ad60-7e99-41e6-9389-154d9b46b7bd`. All five automated tests and deployment checks passed. Both domains serve the restored homepage and script; posts return 200 and withdrawn game endpoints return 404.

## Archived arcade game release

Deployed version: 1b4bb58b-8a3b-49fa-ab35-fb7172a84cb4. Migration 004_game.sql has been applied once to production. New private tables store players, idempotent requests and shared contribution goals. Points, purchases, heat, cooldowns and rewards are computed by the server. Service role only; RLS on all new tables. API retains same-origin and cookie protections. Network limit 240 actions/minute; individual pokes at most 5/second. These limits are basic abuse protection, not proof a visitor is human.

- Real global pokes retain previous totals; personal game scores begin at release. Today leaderboard resets at UTC midnight. Top 10 plus own rank.
- Heat increases 4/poke, reduced by Lube; 40/70 heat adds 25%/50% production. 100 heat triggers 40+10*fiber bonus and 8-second cooldown. Combo capped at 50, 2-second gap resets.
- Lube, Fiber (five levels), Enema Rush, Ice Pack, Auto-Poker, Golden Plunger. Auto income is 1 per 5 seconds of contiguous heartbeats, no catch-up after >15 seconds, no income in cooldown.
- DeepSeek whale appears for 20s per 90s; claim once for 15s double rewards.
- Open-source pool: 500 poop => 60s global 1.5x. Rescue Jensen: 5,000 poop => 5min global 2x. Each donation 50, balances and shared goals are transactionally locked. Personal rescue contributions and all-time rescues persist. Bonuses can stack and durations extend. Explicit satirical event label, no factual job-status claim.
- Browser/domain-scoped anonymous saves; no email account or cross-domain personal sync in this release. Both domains share boards and global goals.
- Native Chrome inspected layout. Tripo tool opened but repeated form input did not stick; shipped a locally authored jacket.svg illustration instead. No generated asset claimed.
- Automated PGlite test covers deduplication, spending, cooldown, permanent upgrades, shared rescue, boost propagation, leaderboard privacy and permission denial. Existing forum tests pass. Live smoke test made one real verification poke per domain and verified deduplication and insufficient-funds rejection.
