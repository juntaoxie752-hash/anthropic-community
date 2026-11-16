// Decorative workers represent owned upgrades, never extra production or posts.
// Cap visible sprites while keeping the actual owned count exact.
export function renderWorkforce(data, connected = true) {
  const get = id => document.getElementById(id);
  const chips = data.player.auto;
  const influencers = data.player.influencers ?? (data.player.double ? 1 : 0);
  const full = BigInt(data.player.slop) >= BigInt(data.player.capacity);
  const selling = influencers > 0 && connected;
  const computing = chips > 0 && !full && connected;
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
  get('influencer-workshop').dataset.mode = selling ? 'working' : influencers === 0 ? 'empty' : 'paused';
  get('chip-count').textContent = `${chips.toLocaleString('en-US')} NVIDIA B300 chip${chips === 1 ? '' : 's'}`;
  get('influencer-count').textContent = `${influencers.toLocaleString('en-US')} AI influencer${influencers === 1 ? '' : 's'}`;
  get('chip-work-state').textContent = !connected ? 'Reconnecting…' : chips === 0 ? 'Buy a cluster to start production.'
    : full ? 'Bowl full · compute paused' : `Working · +${chips.toLocaleString('en-US')} slop / 5s`;
  get('influencer-work-state').textContent = !connected ? 'Reconnecting…' : influencers === 0 ? 'Hire an influencer to start the hype.'
    : `Working & posting hype · ${data.player.saleMultiplier ?? 1 + influencers}× sales`;
  get('funding-round').textContent = data.player.fundingLabel ?? 'Seed';
  const amount = data.player.roundFunding;
  get('funding-amount').textContent = amount == null ? 'Loading round amount…'
    : BigInt(amount) === 0n ? 'Bootstrapped · $0'
    : `$${BigInt(amount).toLocaleString('en-US')} round`;
}
