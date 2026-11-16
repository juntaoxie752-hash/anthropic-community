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
  let forcedRoll=900, pendingRead, resolveRead;
  window.fetch=async(url, options={})=>{
   const action=url.split('/').at(-1);
   if(action==='bubble_state' && pendingRead) return new Promise(resolve=>{resolveRead=()=>resolve({ok:true,json:async()=>structuredClone(pendingRead)});});
   data.produced=0;data.rolled=0;data.rollTier=null;
   if(action==='bubble_buy_center') {data.player.dataCenters++;data.player.totalChips+=128;data.player.arr-=data.shop.centerCost;}
   if(action==='bubble_buy_workspace') {data.player.workspace=true;data.player.arr-=7000;data.shop.workspaceCost=null;}
   if(action==='bubble_buy_algorithm') {data.player.algorithmLevel++;data.player.productionInterval*=.8;data.player.arr-=data.shop.algorithmCost;data.shop.algorithmCost*=2;data.shop.nextInterval=data.player.productionInterval*.8;}
   if(action==='bubble_make') {data.rolled=forcedRoll;data.produced=Math.min(forcedRoll,data.player.capacity-data.player.slop);data.overflow=data.rolled-data.produced;data.player.slop+=data.produced;data.rollTier=forcedRoll<=10?'low':'high';}
   return {ok:true,json:async()=>structuredClone(data)};
  };
  window.matchMedia=()=>({matches:false});
  const intervals=[];
  window.setInterval=(fn,delay)=>{intervals.push({fn,delay});return intervals.length;};
  window.setTimeout=()=>1;window.clearTimeout=()=>{};
  window.Element.prototype.getAnimations=()=>[];
  window.Element.prototype.animate=function(frames){this.dataset.animated='true';return {onfinish:null};};
  const workforce=(await readFile(new URL('../public/workforce.js',import.meta.url),'utf8')).replaceAll('export ','');
  const game=(await readFile(new URL('../public/game.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,'');
  const context=vm.createContext({window,document:window.document,fetch:window.fetch,matchMedia:window.matchMedia,
    setInterval:window.setInterval,setTimeout:window.setTimeout,clearTimeout:window.clearTimeout,crypto,BigInt,console,
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
  q('production-shop').close();q('make-slop').click();await nextTurn();
  assert.equal(window.document.querySelector('.workspace-result.high strong').textContent,'+900 slop');
  assert.equal(window.document.querySelectorAll('.workspace-spark').length,12);
  forcedRoll=3;q('make-slop').click();await nextTurn();
  assert.equal(window.document.querySelector('.workspace-result.low strong').textContent,'+3 slop');
  assert.match(q('game-status').textContent,/CONTEXT COLLAPSE/);
  // A background read arriving after a purchase must not revert the owned count.
  pendingRead=structuredClone(data);
  const poll=intervals.find(({delay})=>delay===250).fn;
  const pollPromise=poll();await nextTurn();
  q('buy-center').click();await nextTurn();assert.match(q('data-center-count').textContent,/2 data centers/);
  resolveRead();await pollPromise;assert.match(q('data-center-count').textContent,/2 data centers/);
 } finally {await window.happyDOM.close();}
});
