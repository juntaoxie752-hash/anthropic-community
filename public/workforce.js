export const formatMultiplier = value => {
 const n=Number(value);
 return n<3 && n>2.999999 ? '<3' : n.toLocaleString('en-US',{maximumFractionDigits:6});
};
// Decorative workers represent owned upgrades, never extra production or posts.
// Cap visible sprites while keeping the actual owned count exact.
export const formatInterval = seconds => `${Number(seconds).toLocaleString('en-US', {maximumSignificantDigits: 3})}s`;

export function renderWorkforce(data, connected = true) {
  const get = id => document.getElementById(id);
  const centers = data.player.dataCenters ?? 0;
  const chips = data.player.totalChips ?? data.player.auto;
  const interval = data.player.productionInterval ?? 5;
  const influencers = data.player.influencers ?? (data.player.double ? 1 : 0);
  const full = BigInt(data.player.slop) >= BigInt(data.player.capacity);
  const paused = !!data.world?.autoPaused;
  const selling = influencers > 0 && connected && !paused;
  const computing = chips > 0 && !full && connected && !paused;
  const rig = get('chip-rig'), desks = get('influencer-desks');
  if (rig.dataset.count !== String(chips)) {
    rig.dataset.count = chips;
    rig.replaceChildren(...Array.from({length: Math.min(5, chips)}, (_, index) => {
      const unit = document.createElement('span');
      unit.className = 'compute-chip'; unit.style.setProperty('--worker', index);
      unit.innerHTML = '<span class="chip-core"><b>NVIDIA</b><small>B300</small><i></i></span><span class="compute-packet"></span>';
      return unit;
    }));
  }
  if (desks.dataset.count !== String(influencers)) {
    desks.dataset.count = influencers;
    desks.replaceChildren(...Array.from({length: Math.min(4, influencers)}, (_, index) => {
      const unit = document.createElement('span');
      unit.className = 'influencer-desk'; unit.style.setProperty('--worker', index);
      unit.innerHTML = '<span class="hype-post">AGI IS HERE!</span><span class="worker-head"></span><span class="worker-body"></span><span class="typing-hands"></span><span class="worker-laptop"><i></i></span>';
      return unit;
    }));
  }
  get('chip-workshop').dataset.mode = computing ? 'working' : chips === 0 ? 'empty' : 'paused';
  get('chip-workshop').style.setProperty('--compute-cycle', `${Math.max(.5, interval)}s`);
  get('compute-fleet').classList.toggle('has-center', centers > 0);
  get('data-center-art').hidden = centers === 0;
  get('data-center-badge').textContent = `×${centers.toLocaleString('en-US')}`;
  get('data-center-count').hidden = centers === 0;
  get('data-center-count').textContent = `${centers.toLocaleString('en-US')} data center${centers === 1 ? '' : 's'} · 128 B300 each`;
  get('chip-count').title = `${data.player.auto} individual chips + ${centers * 128} data center chips`;
  const perks = [];
  if (data.player.workspace) perks.push('AI native workspace active');
  if (data.player.algorithmLevel) perks.push(`DeepSeek level ${data.player.algorithmLevel}`);
  get('production-perks').hidden = !perks.length;
  get('production-perks').textContent = perks.join(' · ');
  get('influencer-workshop').dataset.mode = selling ? 'working' : influencers === 0 ? 'empty' : 'paused';
  get('chip-count').textContent = `${chips.toLocaleString('en-US')} NVIDIA B300 chip${chips === 1 ? '' : 's'}`;
  get('influencer-count').textContent = `${influencers.toLocaleString('en-US')} AI influencer${influencers === 1 ? '' : 's'}`;
  get('chip-work-state').textContent = !connected ? 'Reconnecting…' : paused ? 'Global outage · auto production paused' : chips === 0 ? 'Buy a cluster to start production.'
    : full ? 'Bowl full · compute paused' : `Working · +${chips.toLocaleString('en-US')} slop / ${formatInterval(interval)}`;
  get('influencer-work-state').textContent = !connected ? 'Reconnecting…' : paused ? 'Global outage · posting paused' : influencers === 0 ? 'Hire an influencer to start the hype.'
    : `Working & posting hype · ${formatMultiplier(data.player.saleMultiplier ?? 3 - 2 / 2 ** influencers)}× sales`;
  get('funding-round').textContent = data.player.fundingLabel ?? 'Seed';
  const amount = data.player.roundFunding;
  get('funding-amount').textContent = amount == null ? 'Loading round amount…'
    : BigInt(amount) === 0n ? 'Bootstrapped · $0'
    : `$${BigInt(amount).toLocaleString('en-US')} round`;
}
