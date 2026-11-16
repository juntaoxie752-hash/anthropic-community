const $ = (id) => document.getElementById(id);
async function api(path, data) {
  const response = await fetch(`/api/${path}`, {
    method: data ? 'POST' : 'GET',
    headers: data ? { 'Content-Type': 'application/json' } : {},
    body: data ? JSON.stringify(data) : undefined,
    signal: AbortSignal.timeout(12000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Could not connect. Please try again.');
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
const SHOP = { double: 2100n, auto: 1400n, bowl: 3500n };
// IPO date is a running joke, never confirmed.
const ipoDate = new Date();
ipoDate.setDate(ipoDate.getDate() + 30 + Math.floor(Math.random() * 60));

let ready = false;
let busy = false;
let state = null;

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

// Keep the shared pool number fresh between server syncs is not possible (it is
// global), but the per-second clock must never stall while the tab is open.

function render(next) {
  state = next;
  const contributed = BigInt(next.world.contributed);
  const ratio = contributed >= GOAL ? 1 : Number(contributed * 10000n / GOAL) / 10000;
  const visual = Math.sqrt(ratio);
  const slop = BigInt(next.player.slop);
  const arr = BigInt(next.player.arr);
  const multiplier = next.player.double ? 2n : 1n;
  const capacity = BigInt(next.player.capacity ?? 10);
  const full = slop >= capacity;
  $('slop-balance').textContent = `${slop.toLocaleString('en-US')} / ${capacity.toLocaleString('en-US')}`;
  $('slop-balance').parentElement.classList.toggle('bowl-full', full);
  $('machine').classList.toggle('bowl-full', full);
  $('arr-balance').textContent = exact(arr);
  $('player-contribution').textContent = exact(next.player.contributed);
  $('bubble-progress').textContent = `${money(contributed)} / ${money(GOAL)}`;
  $('bubble-fill').style.transform = `scaleX(${Math.max(0, Math.min(1, ratio)).toFixed(4)})`;
  $('bubble-shell').dataset.stage = ratio >= 0.9 ? 'critical' : ratio >= 0.5 ? 'strained' : 'forming';
  $('bubble-shell').classList.toggle('is-burst', next.world.burst);
  $('bubble-shell').setAttribute('aria-valuenow', (ratio * 100).toFixed(2));
  $('make-slop').disabled = !ready || busy;
  $('flush-slop').disabled = !ready || busy || slop === 0n;
  $('flush-slop-label').disabled = $('flush-slop').disabled;
  $('flush-note').textContent = slop === 0n
    ? 'Flush me'
    : slop === capacity
      ? `Full! Flush ${slop} → ${exact(slop * RATE * 5n * multiplier)}`
      : `Flush ${slop} → ${exact(slop * RATE * multiplier)}`;
  const doubleBtn = $('buy-double');
  doubleBtn.classList.toggle('owned', !!next.player.double);
  doubleBtn.disabled = !ready || busy || next.player.double || arr < SHOP.double;
  doubleBtn.querySelector('em').textContent = next.player.double ? 'Owned forever' : `Own it forever · ${exact(SHOP.double)}`;
  const autoBtn = $('buy-auto');
  autoBtn.disabled = !ready || busy || arr < SHOP.auto;
  autoBtn.querySelector('em').textContent = next.player.auto > 0
    ? `Owned ×${next.player.auto} · buy again ${exact(SHOP.auto)}`
    : `Stackable · ${exact(SHOP.auto)}`;
  const bowlBtn = $('buy-bowl');
  bowlBtn.disabled = !ready || busy || arr < SHOP.bowl;
  bowlBtn.querySelector('em').textContent = capacity > 10n
    ? `Bowl holds ${capacity.toLocaleString('en-US')} · +10 for ${exact(SHOP.bowl)}`
    : `+10 capacity · ${exact(SHOP.bowl)}`;
}

function tick() {
  updateCountdown();
  if (!state) return;
  $('round-status').textContent = state.world.burst
    ? 'The bubble burst. Everyone wins bragging rights.'
    : 'Expected IPO countdown · date unconfirmed';
  $('bubble-countdown').textContent = state.world.burst
    ? 'BURST'
    : `${money(GOAL)} target`;
}
setInterval(tick, 1000);

// The hand pokes the logo; one labeled AI Slop squeezes out and lands in the toilet.
function pokeDrop() {
  const gesture = $('gesture'), logo = $('poke-stage').querySelector('.hero-logo');
  const machine = $('machine'), toilet = $('toilet');
  gesture.getAnimations().forEach((animation) => animation.cancel());
  logo.getAnimations().forEach((animation) => animation.cancel());
  const calm = reducedMotion.matches;
  // Measure the gap so the fingertip reaches the logo at every screen size.
  const hand = gesture.getBoundingClientRect(), mark = logo.getBoundingClientRect();
  const reach = Math.max(0, hand.top - mark.bottom + mark.height * 0.28);
  if (!calm) gesture.animate([
    { transform: 'translateY(0)' },
    { transform: 'translateY(6px)', offset: 0.12 },
    { transform: `translateY(-${reach}px)`, offset: 0.3 },
    { transform: `translateY(-${reach}px)`, offset: 0.4 },
    { transform: 'translateY(0)' },
  ], { duration: 600, easing: 'ease-in-out' });
  setTimeout(() => {
    if (!calm) logo.animate([
      { transform: 'scale(1) rotate(0deg)' },
      { transform: 'scale(.86) rotate(-12deg)' },
      { transform: 'scale(1.12) rotate(10deg)' },
      { transform: 'scale(1) rotate(0deg)' },
    ], { duration: 380, easing: 'ease-out' });
    const bounds = machine.getBoundingClientRect();
    const origin = logo.getBoundingClientRect();
    const target = toilet.getBoundingClientRect();
    const poop = document.createElement('span');
    poop.className = 'slop-particle';
    poop.setAttribute('aria-hidden', 'true');
    poop.innerHTML = '<img src="/assets/slop.svg" alt="" onerror="this.outerHTML=\'💩\'"><b>AI Slop</b>';
    poop.style.left = `${origin.left - bounds.left + origin.width / 2}px`;
    poop.style.top = `${origin.top - bounds.top + origin.height / 2}px`;
    machine.append(poop);
    machine.querySelectorAll('.slop-particle').forEach((old, index, all) => { if (index < all.length - 4) old.remove(); });
    const endX = target.left - bounds.left + target.width / 2 - (origin.left - bounds.left + origin.width / 2);
    const endY = target.top - bounds.top + target.height * 0.55 - (origin.top - bounds.top + origin.height / 2);
    if (calm) { setTimeout(() => poop.remove(), 700); return; }
    const flight = poop.animate([
      { transform: 'translate(-50%,-50%) scale(.2)', opacity: 0 },
      { transform: `translate(calc(-50% + ${endX * 0.3}px),calc(-50% - 60px)) scale(1.08)`, opacity: 1, offset: 0.28 },
      { transform: `translate(calc(-50% + ${endX * 0.7}px),calc(-50% + ${endY * 0.55}px)) scale(1)`, opacity: 1, offset: 0.62 },
      { transform: `translate(calc(-50% + ${endX}px),calc(-50% + ${endY}px)) scale(.8)`, opacity: 0 },
    ], { duration: 1100, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' });
    flight.onfinish = () => {
      poop.remove();
      toilet.animate([
        { transform: 'scale(1)' },
        { transform: 'scale(1.06)' },
        { transform: 'scale(1)' },
      ], { duration: 240, easing: 'ease-out' });
    };
  }, calm ? 0 : 180);
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
  const machine = $('machine').getBoundingClientRect();
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

async function act(action) {
  if (!ready || busy) return;
  busy = true;
  render(state);
  try {
    const next = await api(action, { requestId: crypto.randomUUID() });
    if (action === 'bubble_make' && next.produced) pokeDrop();
    if (action === 'bubble_make' && !next.produced && !next.duplicate) overflowSplash();
    if (action === 'bubble_flush' && Number(next.minted) > 0) {
      goldBurst(Number(next.flushed));
      flyToBubble(next.minted);
      const flushed = BigInt(next.flushed);
      const total = BigInt(next.minted);
      const base = flushed * RATE;
      flashStatus(total > base
        ? `Full-bowl bonus! ${flushed} slop × ${exact(RATE)} × ${Number(total / base)} = ${exact(total)} “ARR”.`
        : `${flushed} slop became ${exact(total)} of “ARR”.`);
    }
    render(next);
  } catch (error) {
    $('game-status').textContent = error.message;
  } finally {
    busy = false;
    if (state) render(state);
  }
}

async function connect() {
  try {
    render(await api('bubble_state'));
    ready = true;
    $('game-status').textContent = DEFAULT_STATUS;
    render(state);
  } catch {
    ready = false;
    $('make-slop').disabled = true;
    $('flush-slop').disabled = true;
    $('game-status').textContent = 'The bubble is not connected yet.';
  }
}

$('make-slop').onclick = () => act('bubble_make');
$('flush-slop').onclick = () => act('bubble_flush');
$('flush-slop-label').onclick = () => act('bubble_flush');
$('buy-double').onclick = () => act('bubble_buy_double');
$('buy-auto').onclick = () => act('bubble_buy_auto');
$('buy-bowl').onclick = () => act('bubble_buy_bowl');
for (const id of ['production-shop', 'toilet-shop']) {
  const dialog = $(id);
  $(id === 'production-shop' ? 'open-production-shop' : 'open-toilet-shop').onclick = () => dialog.showModal();
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
}
for (const button of document.querySelectorAll('[data-close-shop]')) button.onclick = () => button.closest('dialog').close();
connect();
tick();
