import {ensureSession} from './session.js';
import {renderWorkforce, formatInterval} from './workforce.js?v=outage-1';
const $ = (id) => document.getElementById(id);
async function api(path, data) {
  const response = await fetch(`/api/${path}`, {
    method: data ? 'POST' : 'GET',
    headers: data ? { 'Content-Type': 'application/json' } : {},
    body: data ? JSON.stringify(data) : undefined,
    signal: AbortSignal.timeout(12000),
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error || 'Could not connect. Please try again.');
    error.status = response.status;
    throw error;
  }
  return result;
}
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const DEFAULT_STATUS = 'Generate AI slop. Sell it as “super intelligence”. Inflate the bubble.';
let statusTimer;
function flashStatus(message) {
  $('game-status').textContent = message;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { if (ready) $('game-status').textContent = DEFAULT_STATUS; }, 4200);
}
const GOAL = 1_400_000_000_000n;
const RATE = 70n;
const SHOP = { auto: 1400n };
// User-selected Thursday target. 14:30 UTC is a game scheduling assumption, not a confirmed first-trade time.
const ipoDate = new Date('2026-11-19T14:30:00Z');

let ready = false;
let busy = false;
let state = null;
const actionQueue = [];

const money = (value) => {
  const amount = BigInt(value);
  const compact = [
    [1_000_000_000_000n, 'T'],
    [1_000_000_000n, 'B'],
    [1_000_000n, 'M'],
    [1_000n, 'K'],
  ].find(([size]) => amount >= size);
  if (!compact) return `$${amount.toLocaleString('en-US')}`;
  const [size, suffix] = compact;
  const scaled = Number(amount * 100n / size) / 100;
  return `$${scaled.toLocaleString('en-US', { maximumFractionDigits: 2 })}${suffix}`;
};
const exact = (value) => `$${BigInt(value).toLocaleString('en-US')}`;

function updateCountdown() {
  const left = Math.max(0, ipoDate - Date.now());
  const values = {
    'countdown-days': Math.floor(left / 86400000),
    'countdown-hours': Math.floor(left / 3600000) % 24,
    'countdown-mins': Math.floor(left / 60000) % 60,
    'countdown-secs': Math.floor(left / 1000) % 60,
  };
  for (const [id, value] of Object.entries(values)) $(id).textContent = String(value).padStart(2, '0');
  return left;
}

// The countdown ticks independently; balances are refreshed from the server.

let shownWorldEvent = null;
function showWorldEvent(event, replay = false) {
  if (!event?.id || (!replay && shownWorldEvent === event.id)) return;
  const key = `bubble-event-seen:${event.id}`;
  try {if (!replay && localStorage.getItem(key)) {shownWorldEvent = event.id; return;}} catch { /* Session-only dismissal if storage is blocked. */ }
  const dialog = $('world-event');
  if (!dialog || document.querySelector('dialog[open]')) return;
  shownWorldEvent = event.id;
  $('world-event-title').textContent = event.title || 'Data center down. Bubble deflated.';
  $('world-event-description').textContent = event.description || 'In this fictional game scenario, Iran bombs a data center. The AI bubble takes a massive hit.';
  dialog.querySelector('.world-event-art').textContent = event.icon || '🏢💥';
  dialog.querySelector('.world-event-impact').textContent = event.effect || 'Shared AI Bubble valuation';
  dialog.querySelector('.world-event-disclaimer').textContent = event.disclaimer || 'Game satire, not a real-world news report. Your cash, upgrades and lifetime contribution are unchanged.';
  $('world-event-loss').textContent = `−${money(event.loss)}`;
  $('world-event-values').textContent = `${money(event.before)} → ${money(event.after)}`;
  dialog.addEventListener('close', () => {try {localStorage.setItem(key, '1');} catch {}}, {once:true});
  $('world-event-close').onclick = () => dialog.close();
  dialog.showModal();
}

document.addEventListener('replay-world-event', e => showWorldEvent(e.detail, true));

function render(next) {
  state = next;
  showWorldEvent(next.world.event);
  $('production-outage').hidden = !next.world.autoPaused;
  const contributed = BigInt(next.world.contributed);
  const ratio = Math.min(1, Number(contributed) / Number(GOAL));
  const slop = BigInt(next.player.slop);
  const arr = BigInt(next.player.arr);
  const multiplier = BigInt(next.player.saleMultiplier ?? (next.player.double ? 2 : 1));
  const influencers = next.player.influencers ?? (next.player.double ? 1 : 0);
  const round = next.player.fundingRound ?? 0;
  const capacity = BigInt(next.player.capacity ?? 10);
  const full = slop >= capacity;
  $('slop-balance').textContent = `${slop.toLocaleString('en-US')} / ${capacity.toLocaleString('en-US')}`;
  $('slop-balance').parentElement.classList.toggle('bowl-full', full);
  $('machine').classList.toggle('bowl-full', full);
  $('arr-balance').textContent = exact(arr);
  $('player-contribution').textContent = exact(next.player.contributed);
  $('bubble-progress').textContent = `${money(contributed)} / ${money(GOAL)}`;
  $('bubble-fill').style.width = `${ratio * 100}%`;
  $('bubble-shell').dataset.stage = ratio >= 0.9 ? 'critical' : ratio >= 0.5 ? 'strained' : 'forming';
  $('bubble-shell').classList.toggle('is-burst', next.world.burst);
  $('bubble-shell').setAttribute('aria-valuenow', (ratio * 100).toFixed(2));
  $('make-slop').disabled = !ready;
  // Keep sale taps available while generation is queued, even before its balance arrives.
  $('flush-slop').disabled = !ready || (slop === 0n && !busy && actionQueue.length === 0);
  $('flush-slop-label').disabled = $('flush-slop').disabled;
  $('flush-note').textContent = slop === 0n
    ? 'Flush me'
    : slop === capacity
      ? `Full! Flush ${slop} → ${exact(slop * RATE * 5n * multiplier)}`
      : `Flush ${slop} → ${exact(slop * RATE * multiplier)}`;
  $('toilet').classList.toggle('has-slop', slop > 0n);
  $('toilet').style.width = `${140 + round * 9}px`;
  $('toilet').style.height = `${166 + round * 7}px`;
  renderWorkforce(next, ready);
  const doubleBtn = $('buy-double');
  const influencerCost = next.shop ? next.shop.influencerCost : next.world.doubleCost;
  const influencerMaxed = influencerCost == null || (!next.shop && next.player.double);
  doubleBtn.classList.toggle('owned', influencerMaxed);
  doubleBtn.disabled = !ready || busy || influencerMaxed || arr < BigInt(influencerCost ?? 0);
  doubleBtn.querySelector('span').textContent = `Owned ×${influencers} · ${multiplier}× sale value. Each hire adds +1×.`;
  doubleBtn.querySelector('em').textContent = influencerMaxed ? 'Roster complete' : `Hire another · ${exact(influencerCost)}`;
  const autoBtn = $('buy-auto');
  autoBtn.disabled = !ready || busy || arr < SHOP.auto;
  const interval = next.player.productionInterval ?? 5;
  autoBtn.querySelector('span').textContent = `+1 slop / ${formatInterval(interval)}, hands-free.`;
  autoBtn.querySelector('em').textContent = next.player.auto > 0
    ? `Owned ×${next.player.auto} · buy again ${exact(SHOP.auto)}`
    : `Stackable · ${exact(SHOP.auto)}`;
  for (const [id, cost, owned, label] of [
    ['buy-center', next.shop?.centerCost, false, `Owned ×${next.player.dataCenters ?? 0} · build another`],
    ['buy-workspace', next.shop?.workspaceCost, !!next.player.workspace, 'Permanent'],
    ['buy-algorithm', next.shop?.algorithmCost, (next.player.algorithmLevel ?? 0) >= 40, `Level ${next.player.algorithmLevel ?? 0} · upgrade`],
  ]) {
    const button = $(id);
    button.disabled = !ready || busy || owned || cost == null || arr < BigInt(cost);
    button.classList.toggle('owned', owned);
    button.querySelector('em').textContent = owned ? (id === 'buy-workspace' ? 'Owned · active' : 'Fully optimized')
      : cost == null ? 'Loading price…' : `${label} · ${exact(cost)}`;
  }
  $('buy-center').querySelector('span').textContent = `128 B300 chips. +128 slop / ${formatInterval(interval)}. Includes all DeepSeek upgrades.`;
  $('buy-algorithm').querySelector('span').textContent = next.shop?.nextInterval == null
    ? `All B300 chips and data centers: ${formatInterval(interval)} per cycle.`
    : `All B300 chips & data centers: ${formatInterval(interval)} → ${formatInterval(next.shop.nextInterval)}. 20% shorter every level. Price doubles.`;
  const bowlBtn = $('buy-bowl');
  const fundingCost = next.shop ? next.shop.fundingCost : next.world.bowlCost;
  const fundingMaxed = fundingCost == null;
  bowlBtn.disabled = !ready || busy || fundingMaxed || arr < BigInt(fundingCost ?? 0);
  bowlBtn.classList.toggle('owned', fundingMaxed);
  bowlBtn.querySelector('b').textContent = next.shop ? `Funding · ${next.player.fundingLabel}` : 'Funding round';
  bowlBtn.querySelector('span').textContent = fundingMaxed
    ? `Series D · ${capacity.toLocaleString('en-US')} slop capacity.`
    : `${next.shop?.nextRound ?? 'Next round'}: ${capacity.toLocaleString('en-US')} → ${BigInt(next.shop?.nextCapacity ?? (capacity + 10n)).toLocaleString('en-US')} capacity`;
  bowlBtn.querySelector('em').textContent = fundingMaxed ? 'All rounds raised' : `Raise ${next.shop?.nextRound ?? 'next round'} · ${exact(fundingCost)}`;

}

function tick() {
  updateCountdown();
  if (!state) return;
  $('bubble-countdown').textContent = state.world.burst
    ? 'BURST'
    : `${money(GOAL)} target`;
}
setInterval(tick, 1000);

// Spring recoil echoes the reference; only poop is emitted from the logo.
function pokeImpact() {
  if (reducedMotion.matches) return;
  const hand = $('gesture'), logo = $('poke-stage').querySelector('.hero-logo');
  for (const el of [hand, logo]) el.getAnimations().filter(a => !a.animationName).forEach(a => a.cancel());
  hand.animate([
    {transform:'translateY(0) rotate(-6deg)'},
    {transform:'translateY(18px) rotate(-15deg)',offset:.18},
    {transform:'translateY(-64px) rotate(5deg) scale(1.12)',offset:.32},
    {transform:'translateY(-55px) rotate(-3deg)',offset:.46},
    {transform:'translateY(9px) rotate(-8deg)',offset:.72},
    {transform:'translateY(0) rotate(-6deg)'}
  ],{duration:520,easing:'cubic-bezier(.2,.8,.3,1)'});
  logo.animate([
    {transform:'scale(1)'},
    {transform:'scale(.65,1.12) rotate(-18deg)',offset:.2},
    {transform:'scale(1.23,.82) rotate(14deg)',offset:.46},
    {transform:'scale(.94,1.06) rotate(-5deg)',offset:.72},
    {transform:'scale(1)'}
  ],{delay:150,duration:450,easing:'ease-out'});
  const scene = $('poke-stage').querySelector('.action-visual');
  const ring = document.createElement('i'); ring.className='impact-ring'; ring.setAttribute('aria-hidden','true');
  ring.style.cssText='left:50%;top:65px;translate:-50% -50%'; scene.append(ring);
  const shock=ring.animate([{transform:'scale(.3)',opacity:0},{transform:'scale(.6)',opacity:.8,offset:.2},{transform:'scale(1.65)',opacity:0}],{delay:150,duration:420});
  shock.onfinish=()=>ring.remove();

}
function pokeDrop() {
  const logo=$('poke-stage').querySelector('.hero-logo'), machine=$('machine'), toilet=$('toilet');
  const bounds=machine.getBoundingClientRect(), origin=logo.getBoundingClientRect(), target=toilet.getBoundingClientRect();
  const poop=document.createElement('span');poop.className='slop-particle';poop.textContent='💩';poop.setAttribute('aria-hidden','true');
  poop.style.left=`${origin.left-bounds.left+origin.width/2}px`;poop.style.top=`${origin.top-bounds.top+origin.height/2}px`;machine.append(poop);
  const dx=target.left+target.width/2-origin.left-origin.width/2,dy=target.top+target.height*.53-origin.top-origin.height/2;
  if(reducedMotion.matches){setTimeout(()=>poop.remove(),400);return;}
  const flight=poop.animate([
    {transform:'translate(-50%,-50%) scale(.25)',opacity:0},
    {transform:`translate(calc(-50% + ${dx*.2}px),calc(-50% - 90px)) scale(1.35) rotate(-20deg)`,opacity:1,offset:.25},
    {transform:`translate(calc(-50% + ${dx*.72}px),calc(-50% + ${dy*.3-50}px)) scale(1.1) rotate(15deg)`,opacity:1,offset:.65},
    {transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.3)`,opacity:0}
  ],{duration:820,easing:'cubic-bezier(.3,.6,.4,1)'});
  flight.onfinish=()=>{poop.remove();toilet.animate([{transform:'scale(1)'},{transform:'scale(1.12,.9)'},{transform:'scale(1)'}],{duration:280});};
}
function flushAnimation() {
  const toilet=$('toilet');toilet.classList.remove('is-flushing');void toilet.offsetWidth;toilet.classList.add('is-flushing');
  clearTimeout(flushAnimation.timer);flushAnimation.timer=setTimeout(()=>toilet.classList.remove('is-flushing'),900);
}

// Full bowl: the poke still lands, but the slop splashes off the rim and is wasted.
function overflowSplash() {
  $('game-status').textContent = 'The bowl is full! Slop overflowed and went to waste. Flush first.';
  if (reducedMotion.matches) return;
  const machine = $('machine'), toilet = $('toilet');
  const bounds = machine.getBoundingClientRect();
  const origin = toilet.getBoundingClientRect();
  const splash = document.createElement('span');
  splash.className = 'slop-splash';
  splash.setAttribute('aria-hidden', 'true');
  splash.textContent = '💩';
  splash.style.left = `${origin.left - bounds.left + origin.width / 2}px`;
  splash.style.top = `${origin.top - bounds.top + 8}px`;
  machine.append(splash);
  const drift = (Math.random() * 2 - 1) * 40;
  const animation = splash.animate([
    { transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 },
    { transform: `translate(calc(-50% + ${drift}px),calc(-50% - 30px)) scale(1)`, opacity: 1, offset: 0.4 },
    { transform: `translate(calc(-50% + ${drift * 1.6}px),calc(-50% + 46px)) scale(.9) rotate(25deg)`, opacity: 0 },
  ], { duration: 750, easing: 'ease-in' });
  animation.onfinish = () => splash.remove();
}

function flyToBubble(amount) {
  const bubble = $('bubble-shell');
  const fly = document.createElement('span');
  fly.className = 'fly-money';
  fly.setAttribute('aria-hidden', 'true');
  fly.textContent = `+${exact(amount)}`;
  document.body.append(fly);
  const machine = $('toilet').getBoundingClientRect();
  const target = bubble.getBoundingClientRect();
  fly.style.left = `${machine.left + machine.width / 2}px`;
  fly.style.top = `${machine.top + machine.height / 2}px`;
  if (reducedMotion.matches) { setTimeout(() => fly.remove(), 900); return; }
  const dx = target.left + target.width / 2 - (machine.left + machine.width / 2);
  const dy = target.top + target.height / 2 - (machine.top + machine.height / 2);
  const animation = fly.animate([
    { transform: 'translate(-50%,-50%) scale(.8)', opacity: 0 },
    { transform: `translate(calc(-50% + ${dx * 0.35}px),calc(-50% + ${dy * 0.35}px - 40px)) scale(1.1)`, opacity: 1, offset: 0.3 },
    { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.7)`, opacity: 0.9 },
  ], { duration: 900, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'forwards' });
  animation.onfinish = () => fly.remove();
}

function goldBurst(count) {
  if (reducedMotion.matches) return;
  const machine = $('machine'), toilet = $('toilet');
  const bounds = machine.getBoundingClientRect();
  const origin = toilet.getBoundingClientRect();
  for (let index = 0; index < Math.min(6, count); index += 1) {
    const gold = document.createElement('span');
    gold.className = 'drop-gold';
    gold.textContent = '✦';
    gold.setAttribute('aria-hidden', 'true');
    gold.style.left = `${origin.left - bounds.left + origin.width / 2}px`;
    gold.style.top = `${origin.top - bounds.top + 12}px`;
    machine.append(gold);
    const drift = (Math.random() * 2 - 1) * 70;
    const animation = gold.animate([
      { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
      { transform: `translate(calc(-50% + ${drift}px),calc(-50% - ${70 + Math.random() * 40}px)) scale(1.1)`, opacity: 1, offset: 0.5 },
      { transform: `translate(calc(-50% + ${drift * 1.4}px),calc(-50% - ${130 + Math.random() * 50}px)) scale(.9)`, opacity: 0 },
    ], { duration: 800, easing: 'ease-out' });
    animation.onfinish = () => gold.remove();
  }
}

function workspaceNotice(title, message, tier = 'normal') {
  const scene = $('poke-stage').querySelector('.action-visual');
  scene.querySelector('.workspace-result')?.remove();
  const result = document.createElement('div');
  result.className = `workspace-result ${tier}`;
  const label = document.createElement('small'), amount = document.createElement('strong');
  label.textContent = title; amount.textContent = message;
  result.append(label, amount); scene.append(result);
  return result;
}
function workspaceResult(next) {
  if (!next.player.workspace || next.duplicate) return;
  if (!next.rolled) {
    const notice = workspaceNotice('WORKSPACE PAUSED', 'Sell slop first', 'low');
    setTimeout(() => notice.remove(), 2400);
    return;
  }
  const stage = $('poke-stage'), tier = next.rollTier;
  const title = tier === 'high' ? 'SLOP JACKPOT!' : tier === 'low' ? 'CONTEXT COLLAPSE' : 'WORKSPACE OUTPUT';
  const result = workspaceNotice(`${title}${next.clickCount > 1 ? ` ×${next.clickCount}` : ''}`, `+${next.produced.toLocaleString('en-US')} slop`, tier);
  const overflow = next.overflow ? ` · Rolled ${next.rolled}, ${next.overflow} overflowed. Upgrade your bowl.` : '';
  flashStatus(`${title} · +${next.produced} slop${overflow}`);
  setTimeout(() => result.remove(), 2400);
  if (reducedMotion.matches) return;
  result.animate(tier === 'low'
    ? [{transform:'translateX(0)'},{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'translateX(0)'}]
    : [{transform:'scale(.6)',opacity:0},{transform:'scale(1.12)',opacity:1},{transform:'scale(1)',opacity:1}],
  {duration:450,easing:'ease-out'});
  if (tier === 'high') {
    for (let i = 0; i < 12; i++) {
      const spark = document.createElement('i'); spark.className = 'workspace-spark'; spark.setAttribute('aria-hidden','true');
      stage.querySelector('.action-visual').append(spark);
      const angle = i * Math.PI / 6;
      spark.animate([{transform:'translate(-50%,-50%)',opacity:1},
        {transform:`translate(calc(-50% + ${Math.cos(angle)*100}px),calc(-50% + ${Math.sin(angle)*75}px)) rotate(160deg)`,opacity:0}],
      {duration:900,easing:'ease-out'}).onfinish = () => spark.remove();
    }
  }
}

// Visual feedback is immediate; only confirmed responses change balances.
function act(action) {
  if (!ready) return;
  const isPlay = action === 'bubble_make' || action === 'bubble_flush';
  if (!isPlay && busy) return;
  actionRevision += 1;
  if (action === 'bubble_make') {
    pokeImpact();
    if (state.player.workspace && !$('poke-stage').querySelector('.workspace-result:not(.pending)')) {
      workspaceNotice('AI NATIVE WORKSPACE', 'Generating…', 'pending');
    }
    if (BigInt(state.player.slop) < BigInt(state.player.capacity)) setTimeout(pokeDrop, 160);
  }
  if (action === 'bubble_flush') flushAnimation();
  // Coalesce only adjacent, unsent generate taps. Never move a tap across a sale.
  const tail = actionQueue.at(-1);
  if (action === 'bubble_make' && tail?.action === action && tail.count < 40) tail.count += 1;
  else actionQueue.push({action, count: 1, requestId: crypto.randomUUID()});
  void drainActions();
}

async function submitAction(item) {
  // A retry must reuse the ID: a lost response must never produce or sell twice.
  for (let attempt = 0; ; attempt += 1) {
    try { return await api(item.action, {requestId:item.requestId, ...(item.action === 'bubble_make' ? {count:item.count} : {})}); }
    catch (error) {
      if (attempt >= 2 || (error.status && error.status < 500)) throw error;
      await new Promise(resolve => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
}

async function drainActions() {
  if (busy) return;
  busy = true;
  render(state);
  try {
    while (actionQueue.length) {
      const item = actionQueue.shift();
      const next = await submitAction(item);
      if (item.action === 'bubble_make') {
        if (!next.produced && !next.duplicate) overflowSplash();
        workspaceResult(next);
        if (next.duplicate) $('poke-stage').querySelector('.workspace-result.pending')?.remove();
      }
      if (item.action === 'bubble_flush' && Number(next.minted) > 0) {
        goldBurst(Number(next.flushed));
        flyToBubble(next.minted);
        const flushed = BigInt(next.flushed), total = BigInt(next.minted);
        flashStatus(`${flushed.toLocaleString('en-US')} slop sold for ${exact(total)} of “ARR” · ${Number(total / (flushed * RATE))}× total value.`);
      }
      render(next);
      // Leave a short batching window under sustained tapping, below the API request limit.
      await new Promise(resolve => setTimeout(resolve, 350));
    }
  } catch (error) {
    // Stop dependent sales/purchases after an uncertain or rejected action.
    actionQueue.length = 0;
    if (state.player.workspace) {
      const notice = workspaceNotice('TRY AGAIN', 'Sync interrupted', 'low');
      setTimeout(() => notice.remove(), 2400);
    }
    flashStatus(`${error.message} Pending taps cancelled. Balances will refresh.`);
    lastPoll = 0;
  } finally {
    busy = false;
    if (state) render(state);
  }
}

async function connect() {
  try {
    await ensureSession();
    render(await api('bubble_state'));
    ready = true;
    $('game-status').textContent = DEFAULT_STATUS;
    render(state);
  } catch {
    ready = false;
    $('make-slop').disabled = true;
    $('flush-slop').disabled = true;
    $('game-status').textContent = 'The bubble is not connected yet.';
    if (state) renderWorkforce(state, false);
  }
}

$('make-slop').onclick = () => act('bubble_make');
$('flush-slop').onclick = () => act('bubble_flush');
$('flush-slop-label').onclick = () => act('bubble_flush');
$('buy-double').onclick = () => act('bubble_buy_double');
$('buy-auto').onclick = () => act('bubble_buy_auto');
$('buy-center').onclick = () => act('bubble_buy_center');
$('buy-workspace').onclick = () => act('bubble_buy_workspace');
$('buy-algorithm').onclick = () => act('bubble_buy_algorithm');
$('buy-bowl').onclick = () => act('bubble_buy_bowl');
for (const id of ['production-shop', 'toilet-shop']) {
  const dialog = $(id);
  $(id === 'production-shop' ? 'open-production-shop' : 'open-toilet-shop').onclick = () => dialog.showModal();
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
}
for (const button of document.querySelectorAll('[data-close-shop]')) button.onclick = () => button.closest('dialog').close();
connect();
tick();

// Refresh at the production cadence, at most once a second for very fast fleets.
// Polling does not lock the action buttons. Ignore a read overtaken by a purchase/click.
let polling = false, lastPoll = 0, actionRevision = 0;
setInterval(async () => {
  const delay = Math.max(1000, Math.min(5000, (state?.player.productionInterval ?? 5) * 1000));
  if (document.hidden || !ready || busy || polling || Date.now() - lastPoll < delay) return;
  polling = true; lastPoll = Date.now();
  const revision = actionRevision;
  try { const next = await api('bubble_state'); if (!busy && revision === actionRevision) render(next); }
  catch { /* The next foreground poll retries; server balances remain authoritative. */ }
  finally { polling = false; }
}, 250);

// Read the authoritative balance after a share reward; invalidate earlier polls.
document.addEventListener('reward-earned', async () => {
 actionRevision += 1;
 if (busy) {lastPoll=0;return;}
 const revision=actionRevision;
 try {const next=await api('bubble_state');if(!busy && actionRevision===revision)render(next);} catch {lastPoll=0;}
});
