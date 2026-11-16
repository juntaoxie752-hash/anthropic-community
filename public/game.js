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
const SHOP = { auto: 1400n };
// User-selected Thursday target. 14:30 UTC is a game scheduling assumption, not a confirmed first-trade time.
const ipoDate = new Date('2026-11-19T14:30:00Z');

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

// The countdown ticks independently; balances are refreshed from the server.

function render(next) {
  state = next;
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
  $('make-slop').disabled = !ready || busy;
  $('flush-slop').disabled = !ready || busy || slop === 0n;
  $('flush-slop-label').disabled = $('flush-slop').disabled;
  $('flush-note').textContent = slop === 0n
    ? 'Flush me'
    : slop === capacity
      ? `Full! Flush ${slop} → ${exact(slop * RATE * 5n * multiplier)}`
      : `Flush ${slop} → ${exact(slop * RATE * multiplier)}`;
  $('toilet').classList.toggle('has-slop', slop > 0n);
  $('toilet').style.width = `${140 + round * 9}px`;
  $('toilet').style.height = `${166 + round * 7}px`;
  $('influencer-count').textContent = `${influencers} AI influencer${influencers === 1 ? '' : 's'} · ${multiplier}× sales`;
  const doubleBtn = $('buy-double');
  const influencerCost = next.shop ? next.shop.influencerCost : next.world.doubleCost;
  const influencerMaxed = influencerCost == null || (!next.shop && next.player.double);
  doubleBtn.classList.toggle('owned', influencerMaxed);
  doubleBtn.disabled = !ready || busy || influencerMaxed || arr < BigInt(influencerCost ?? 0);
  doubleBtn.querySelector('span').textContent = `Owned ×${influencers} · ${multiplier}× sale value. Each hire adds +1×.`;
  doubleBtn.querySelector('em').textContent = influencerMaxed ? 'Roster complete' : `Hire another · ${exact(influencerCost)}`;
  const autoBtn = $('buy-auto');
  autoBtn.disabled = !ready || busy || arr < SHOP.auto;
  autoBtn.querySelector('em').textContent = next.player.auto > 0
    ? `Owned ×${next.player.auto} · buy again ${exact(SHOP.auto)}`
    : `Stackable · ${exact(SHOP.auto)}`;
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

async function act(action) {
  if (!ready || busy) return;
  busy = true;
  if (action === 'bubble_make') {
    pokeImpact();
    // Immediate visual feedback; inventory is still credited only by the server.
    if (BigInt(state.player.slop) < BigInt(state.player.capacity)) setTimeout(pokeDrop, 160);
  }
  if (action === 'bubble_flush') flushAnimation();
  render(state);
  try {
    const next = await api(action, { requestId: crypto.randomUUID() });
    if (action === 'bubble_make' && !next.produced && !next.duplicate) overflowSplash();
    if (action === 'bubble_flush' && Number(next.minted) > 0) {
      goldBurst(Number(next.flushed));
      flyToBubble(next.minted);
      const flushed = BigInt(next.flushed);
      const total = BigInt(next.minted);
      const base = flushed * RATE;
      flashStatus(`${flushed.toLocaleString('en-US')} slop sold for ${exact(total)} of “ARR” · ${Number(total / base)}× total value.`);
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

setInterval(() => { if (!document.hidden && ready && !busy) { busy=true; api('bubble_state').then(render).catch(()=>{}).finally(()=>{busy=false;if(state)render(state);}); } },10000);
