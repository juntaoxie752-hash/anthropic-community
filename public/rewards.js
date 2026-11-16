import {ensureSession} from './session.js';
let claiming;
export function displayShareReward(data) {
 document.querySelectorAll('[data-share-bonus]').forEach(el => {
  el.textContent = data.shareClaimed ? 'Claimed' : '+$50K';
  el.title = data.shareClaimed ? 'One-time share credits already received' : 'One-time share credits';
  el.classList.toggle('claimed',data.shareClaimed);
 });
 document.querySelectorAll('[data-share-reward]').forEach(el => {
  el.textContent = data.shareClaimed ? 'Share reward claimed' : 'First share +$50K';
  el.classList.toggle('claimed',data.shareClaimed);
 });
}
export async function rewardState() {
 await ensureSession();
 const res = await fetch('/api/reward_state',{signal:AbortSignal.timeout(12000)});
 if(!res.ok) throw new Error('Reward status unavailable.');
 const data=await res.json();displayShareReward(data);return data;
}
export function claimShareReward() {
 if(claiming) return claiming;
 claiming=(async()=>{
  await ensureSession();
  const res=await fetch('/api/reward_share',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(12000)});
  const data=await res.json();if(!res.ok)throw new Error(data.error||'Reward could not be claimed. Try again.');
  displayShareReward(data);
  document.dispatchEvent(new CustomEvent('reward-earned',{detail:data}));
  return data;
 })().finally(()=>{claiming=null;});
 return claiming;
}
if(typeof document!=='undefined') {
 rewardState().catch(()=>{});
 try {
  const earned=sessionStorage.getItem('community-earned');
  if(earned) {sessionStorage.removeItem('community-earned');const toast=document.getElementById('toast');if(toast){toast.textContent=earned;toast.hidden=false;setTimeout(()=>toast.hidden=true,6500);}}
 } catch {}
}
