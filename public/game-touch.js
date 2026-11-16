// Cancel native double-tap handling for stationary taps within the game.
// Handle stationary single-finger button taps explicitly, including disabled ones.
// Swipes, editable fields and multi-touch gestures keep their native behavior.
export function installGameTouch(root) {
 let start = null, lastTap = null;
 const editable = target => target?.closest?.('input,textarea,select,[contenteditable="true"]');
 root.addEventListener('touchstart', event => {
  if (event.touches.length !== 1 || editable(event.target)) {start=null;lastTap=null;return;}
  const t=event.touches[0];
  start={x:t.clientX,y:t.clientY,id:t.identifier,time:event.timeStamp,target:event.target};
 }, {passive:true,capture:true});
 root.addEventListener('touchmove', event => {
  if (!start) return;
  const t=Array.from(event.touches).find(t=>t.identifier===start.id);
  if (event.touches.length!==1 || !t || Math.hypot(t.clientX-start.x,t.clientY-start.y)>10) start=null;
 }, {passive:true,capture:true});
 root.addEventListener('touchcancel', ()=>{start=null;lastTap=null;}, {passive:true,capture:true});
 root.addEventListener('touchend', event => {
  const tap=start;start=null;
  if (!tap || event.touches.length || editable(event.target) || event.timeStamp-tap.time>500) return;
  const t=Array.from(event.changedTouches).find(t=>t.identifier===tap.id);
  if (!t || Math.hypot(t.clientX-tap.x,t.clientY-tap.y)>10) return;
  const button=tap.target?.closest?.('button');
  if (button && root.contains(button)) {
   if (!event.cancelable) return;
   event.preventDefault(); // Suppress native zoom and the synthetic mouse click.
   if (!button.disabled) button.click(); // Exactly one regular action, preserving existing guards.
  } else if (lastTap && event.timeStamp-lastTap.time<350 && Math.hypot(t.clientX-lastTap.x,t.clientY-lastTap.y)<30) {
   event.preventDefault();
  }
  lastTap={x:t.clientX,y:t.clientY,time:event.timeStamp};
 }, {passive:false,capture:true});
 root.addEventListener('dblclick', event => {
  if (!editable(event.target)) event.preventDefault();
 }, {passive:false,capture:true});
}
if (typeof document!=='undefined') {
 const root=document.querySelector('.bubble-game');
 if (root) installGameTouch(root);
}
