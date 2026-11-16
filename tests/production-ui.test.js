import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import vm from 'node:vm';
import {setImmediate as nextTurn} from 'node:timers/promises';

test('production UI renders purchases, capacity-aware rolls, effects, interval labels and ignores stale polls', async () => {
 const window=new Window({url:'http://localhost:8789',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
 try {
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  window.document.write(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,''));
  const q=id=>window.document.getElementById(id);
  const data={
   player:{slop:60,capacity:100000,arr:1000000,contributed:3000000,auto:30,influencers:6,saleMultiplier:7,
    fundingRound:4,fundingLabel:'Series C',roundFunding:1792000,dataCenters:0,totalChips:30,workspace:false,algorithmLevel:0,productionInterval:5},
   world:{contributed:0,burst:false},
   shop:{influencerCost:134400,fundingCost:57344000,nextCapacity:1000000,nextRound:'Series D',centerCost:179200,workspaceCost:7000,algorithmCost:350000,nextInterval:4},
   produced:0,rolled:0,rollTier:null,duplicate:false,overflow:0
  };
  let forcedRoll=900, pendingRead, resolveRead, holdWrite, releaseWrite, failWrite=false, loseResponse=false;
  const writes=[], seen=new Set();
  window.fetch=async(url, options={})=>{
   const action=url.split('/').at(-1);
   if(action==='bubble_state' && pendingRead) return new Promise(resolve=>{resolveRead=()=>resolve({ok:true,json:async()=>structuredClone(pendingRead)});});
   if(options.method==='POST') {
    writes.push({action,...JSON.parse(options.body)});
    if(holdWrite) {holdWrite=false;await new Promise(resolve=>{releaseWrite=resolve;});}
    if(failWrite) {failWrite=false;return {ok:false,status:400,json:async()=>({error:'Rejected action'})};}
   }
   const requestId=options.body && JSON.parse(options.body).requestId;
   if(requestId && seen.has(requestId)) return {ok:true,json:async()=>({...structuredClone(data),duplicate:true,produced:0,rolled:0})};
   if(requestId) seen.add(requestId);
   data.produced=0;data.rolled=0;data.rollTier=null;
   const count=options.body ? (JSON.parse(options.body).count ?? 1) : 1;
   if(action==='bubble_buy_center') {data.player.dataCenters++;data.player.totalChips+=128;data.player.arr-=data.shop.centerCost;}
   if(action==='bubble_buy_workspace') {data.player.workspace=true;data.player.arr-=7000;data.shop.workspaceCost=null;}
   if(action==='bubble_buy_algorithm') {data.player.algorithmLevel++;data.player.productionInterval*=.8;data.player.arr-=data.shop.algorithmCost;data.shop.algorithmCost*=2;data.shop.nextInterval=data.player.productionInterval*.8;}
   if(action==='bubble_make' && data.player.slop<data.player.capacity) {data.rolled=forcedRoll*count;data.produced=Math.min(forcedRoll*count,data.player.capacity-data.player.slop);data.overflow=data.rolled-data.produced;data.player.slop+=data.produced;data.rollTier=forcedRoll<=10?'low':'high';}
   if(action==='bubble_flush') {data.player.arr+=data.player.slop*70;data.player.slop=0;}
   if(loseResponse && requestId) {loseResponse=false;throw new Error('Lost response');}
   return {ok:true,json:async()=>structuredClone(data)};
  };
  window.matchMedia=()=>({matches:false});
  const intervals=[];
  window.setInterval=(fn,delay)=>{intervals.push({fn,delay});return intervals.length;};
  window.setTimeout=(fn,delay)=>{if([350,400,800].includes(delay))queueMicrotask(fn);return 1;};window.clearTimeout=()=>{};
  window.Element.prototype.getAnimations=()=>[];
  window.Element.prototype.animate=function(frames){this.dataset.animated='true';return {onfinish:null};};
  const workforce=(await readFile(new URL('../public/workforce.js',import.meta.url),'utf8')).replaceAll('export ','');
  const game=(await readFile(new URL('../public/game.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/gm,'');
  const context=vm.createContext({window,document:window.document,fetch:window.fetch,matchMedia:window.matchMedia,
    localStorage:window.localStorage,ensureSession:async()=>({}),setInterval:window.setInterval,setTimeout:window.setTimeout,clearTimeout:window.clearTimeout,crypto,BigInt,console,
    AbortSignal,Element:window.Element,queueMicrotask,structuredClone});
  vm.runInContext(workforce+'\n'+game,context);
  await nextTurn();
  assert.match(q('chip-work-state').textContent,/30 slop \/ 5s/);
  assert.equal(q('data-center-art').hidden,true);
  assert.equal(q('make-slop').disabled,false);
  assert.match(window.document.querySelector('.slop-saas-banner').textContent,/Super Intelligence/);
  assert.ok(q('flush-note').closest('.toilet-readout'));
  q('open-production-shop').click();assert.equal(q('production-shop').open,true);
  q('buy-center').click();await nextTurn();
  assert.equal(q('data-center-art').hidden,false);assert.match(q('data-center-count').textContent,/1 data center/);
  assert.match(q('chip-count').textContent,/158 NVIDIA/);assert.equal(q('chip-rig').children.length,5);
  q('buy-algorithm').click();await nextTurn();
  assert.match(q('chip-work-state').textContent,/158 slop \/ 4s/);assert.match(q('buy-center').textContent,/128 slop \/ 4s/);
  assert.match(q('buy-algorithm').textContent,/4s → 3.2s/);
  q('buy-workspace').click();await nextTurn();assert.equal(q('buy-workspace').disabled,true);
  assert.match(q('production-perks').textContent,/workspace active/);
  q('production-shop').close();q('make-slop').click();
  assert.match(window.document.querySelector('.workspace-result.pending').textContent,/Generating/);
  await nextTurn();
  assert.equal(window.document.querySelector('.workspace-result.high strong').textContent,'+900 slop');
  assert.equal(window.document.querySelectorAll('.workspace-spark').length,12);
  forcedRoll=3;q('make-slop').click();await nextTurn();
  assert.equal(window.document.querySelector('.workspace-result.low strong').textContent,'+3 slop');
  assert.match(q('game-status').textContent,/CONTEXT COLLAPSE/);
  data.player.slop=data.player.capacity;
  q('make-slop').click();await nextTurn();
  assert.match(window.document.querySelector('.workspace-result.low').textContent,/Sell slop first/);
  // Rapid taps stay enabled, animate immediately and batch behind an in-flight write.
  data.player.slop=0;forcedRoll=1;holdWrite=true;
  const before=writes.length;
  q('make-slop').click();
  for(let i=0;i<12;i++) q('make-slop').click();
  assert.equal(q('make-slop').disabled,false);
  assert.equal(q('gesture').dataset.animated,'true');
  q('flush-slop-label').click();
  q('make-slop').click();q('make-slop').click();
  assert.equal(writes.length,before+1);
  releaseWrite();await nextTurn();
  assert.deepEqual(writes.slice(before).map(x=>[x.action,x.count]),[
   ['bubble_make',1],['bubble_make',12],['bubble_flush',undefined],['bubble_make',2]
  ]);
  assert.equal(data.player.slop,2);
  assert.equal(new Set(writes.slice(before).map(x=>x.requestId)).size,4);
  // Rejected writes cancel dependent work and release the controls.
  holdWrite=true;failWrite=true;const failureStart=writes.length;
  q('make-slop').click();q('flush-slop-label').click();q('make-slop').click();
  releaseWrite();await nextTurn();
  assert.equal(writes.length,failureStart+1);
  assert.match(q('game-status').textContent,/Pending taps cancelled/);
  assert.equal(q('make-slop').disabled,false);
  // A lost response retries the same request ID without crediting a second time.
  const retryStart=writes.length, slopBefore=data.player.slop;
  loseResponse=true;q('make-slop').click();await nextTurn();
  assert.equal(writes.length,retryStart+2);
  assert.equal(writes[retryStart].requestId,writes[retryStart+1].requestId);
  assert.equal(data.player.slop,slopBefore+1);
  // One-time event modal shows a fictional label and persists dismissal.
  const shock={id:'test-shock',loss:1000000000000,before:1500000000000,after:500000000000};
  data.world.event=shock;
  q('make-slop').click();await nextTurn();
  assert.equal(q('world-event').open,true);
  assert.match(q('world-event').textContent,/FICTIONAL GAME EVENT/);
  assert.equal(q('world-event-loss').textContent,'−$1T');
  assert.equal(q('world-event-values').textContent,'$1.5T → $500B');
  q('world-event-close').click();await nextTurn();
  assert.equal(window.localStorage.getItem('bubble-event-seen:test-shock'),'1');
  q('make-slop').click();await nextTurn();assert.equal(q('world-event').open,false);
  // A background read arriving after a purchase must not revert the owned count.
  pendingRead=structuredClone(data);
  const poll=intervals.find(({delay})=>delay===250).fn;
  const pollPromise=poll();await nextTurn();
  q('buy-center').click();await nextTurn();assert.match(q('data-center-count').textContent,/2 data centers/);
  resolveRead();await pollPromise;assert.match(q('data-center-count').textContent,/2 data centers/);
 } finally {await window.happyDOM.close();}
});
