import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import worker from '../src/worker.js';

async function setup() {
 const db = new PGlite();
 await db.exec('create role anon; create role authenticated; create role service_role;');
 for (const file of ['schema.sql','005_bubble_baseline.sql','006_hype_shop.sql','007_workforce_funding.sql','008_production_upgrades.sql','009_deepseek_pricing.sql','011_rapid_clicks.sql']) {
  await db.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));
 }
 const call = async (action, payload = {}, visitor = 'factory') => (await db.query(
  'select public.community_bubble($1,$2,$3,$4) as data',
  [action,visitor,visitor,JSON.stringify({requestId:crypto.randomUUID(),...payload})])).rows[0].data;
 return {db,call};
}

test('data centers stack with chips; algorithm compounds, preserves partial cycles and prevents retroactive production', async () => {
 const {db,call} = await setup();
 try {
  let s = await call('bubble_state');
  for (const action of ['bubble_buy_center','bubble_buy_workspace','bubble_buy_algorithm']) await assert.rejects(call(action), /Not enough ARR/);
  await db.exec("update community.bubble_players set arr=1000000000,capacity=1000000,auto=2 where visitor='factory'");
  const rid = crypto.randomUUID();
  s = await call('bubble_buy_center',{requestId:rid});
  assert.equal(s.player.dataCenters,1);assert.equal(s.player.totalChips,130);assert.equal(s.player.auto,2);
  assert.equal(s.player.arr,1000000000-179200);
  s = await call('bubble_buy_center',{requestId:rid});
  assert.equal(s.player.dataCenters,1);assert.equal(s.duplicate,true);
  await assert.rejects(call('bubble_buy_algorithm',{requestId:rid}),/another action/);
  s = await call('bubble_buy_center');assert.equal(s.player.totalChips,258);
  await db.exec("update community.bubble_players set slop=0,auto_accrued_at=now()-interval '5 seconds' where visitor='factory'");
  s = await call('bubble_state');assert.equal(s.player.slop,258);
  const cash=s.player.arr, contribution=s.world.contributed;
  // Exactly one old 5s cycle plus 3s remaining. At new speed 3s becomes 2.4s.
  await db.exec('begin');
  await db.exec("update community.bubble_players set slop=0,auto_accrued_at=now()-interval '8 seconds' where visitor='factory'");
  s = await call('bubble_buy_algorithm');
  assert.equal(s.player.slop,258);assert.equal(s.player.productionInterval,4);
  assert.equal(s.shop.algorithmCost,700000);assert.equal(s.player.arr,cash-350000);
  const age=(await db.query("select extract(epoch from now()-auto_accrued_at)::float as age from community.bubble_players where visitor='factory'")).rows[0].age;
  assert.equal(age,2.4);
  await db.exec('commit');
  s = await call('bubble_buy_algorithm');assert.equal(s.player.productionInterval,3.2);assert.equal(s.shop.algorithmCost,1400000);
  assert.equal(s.world.contributed,contribution);
  await db.exec("update community.bubble_players set slop=0,auto_accrued_at=now()-interval '6.5 seconds' where visitor='factory'");
  s = await call('bubble_state');assert.equal(s.player.slop,516);
  s = await call('bubble_state');assert.equal(s.player.slop,516);
  // A newly purchased center cannot earn for the time before it existed.
  await db.exec('begin');
  await db.exec("update community.bubble_players set slop=0,auto_accrued_at=now()-interval '3.2 seconds' where visitor='factory'");
  s = await call('bubble_buy_center');assert.equal(s.player.slop,258);assert.equal(s.player.totalChips,386);
  s = await call('bubble_state');assert.equal(s.player.slop,258);
  await db.exec('commit');
  await db.exec("update community.bubble_players set capacity=100,slop=0,auto_accrued_at=now()-interval '1 day' where visitor='factory'");
  s = await call('bubble_state');assert.equal(s.player.slop,100);
  s = await call('bubble_flush');assert.equal(s.flushed,100);
  s = await call('bubble_state');assert.equal(s.player.slop,0);
  await db.exec("update community.bubble_players set algorithm_level=40 where visitor='factory'");
  s = await call('bubble_state');assert.equal(s.shop.algorithmCost,null);assert.ok(s.player.productionInterval>0);
  await assert.rejects(call('bubble_buy_algorithm'),/fully optimized/);
  await db.exec('set role anon');await assert.rejects(call('bubble_buy_center'));
 } finally {await db.close();}
});

test('workspace rolls favor 1–50, have high/low outcomes, obey capacity and cannot be forged or replayed', async () => {
 const {db,call}=await setup();
 try {
  let s=await call('bubble_make');assert.equal(s.produced,1);assert.equal(s.rollTier,null);
  await db.exec("update community.bubble_players set arr=10000,capacity=1000000 where visitor='factory'");
  const buy=crypto.randomUUID();
  s=await call('bubble_buy_workspace',{requestId:buy});assert.equal(s.player.arr,3000);assert.equal(s.player.workspace,true);
  s=await call('bubble_buy_workspace',{requestId:buy});assert.equal(s.player.arr,3000);assert.equal(s.duplicate,true);
  await assert.rejects(call('bubble_buy_workspace'),/already owned/);
  assert.equal(s.shop.workspaceCost,null);
  await db.exec('select setseed(0.314159)');
  let small=0, high=0, low=0, sum=1;
  for(let i=0;i<200;i++) {
   s=await call('bubble_make',{rolled:999999,produced:999999});
   assert.ok(s.rolled>=1 && s.rolled<=1000);assert.equal(s.produced,s.rolled);
   if(s.rolled<=50) small++;
   if(s.rolled>=251) {high++;assert.equal(s.rollTier,'high');}
   if(s.rolled<=10) {low++;assert.equal(s.rollTier,'low');}
   sum+=s.produced;assert.equal(s.player.slop,sum);
  }
  assert.ok(small>140 && small<195, `small roll count ${small}`);assert.ok(high>0);assert.ok(low>0);
  const rid=crypto.randomUUID();
  s=await call('bubble_make',{requestId:rid});const balance=s.player.slop;
  s=await call('bubble_make',{requestId:rid});assert.equal(s.player.slop,balance);assert.equal(s.rolled,0);assert.equal(s.produced,0);
  await db.exec("update community.bubble_players set slop=capacity-1 where visitor='factory'");
  s=await call('bubble_make');assert.equal(s.produced,1);assert.equal(s.overflow,s.rolled-1);assert.equal(s.player.slop,s.player.capacity);
  s=await call('bubble_make');assert.equal(s.produced,0);assert.equal(s.rolled,0);
 } finally {await db.close();}
});

test('production purchase API routes enforce POST and same-origin before reaching database', async () => {
 const env={SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'test',VISITOR_SECRET:'test'};
 for(const action of ['bubble_buy_center','bubble_buy_workspace','bubble_buy_algorithm']) {
  const url='https://anthropicsucks.club/api/'+action;
  assert.equal((await worker.fetch(new Request(url),env)).status,405);
  assert.equal((await worker.fetch(new Request(url,{method:'POST',headers:{Origin:'https://elsewhere.test'}}),env)).status,403);
  assert.equal((await worker.fetch(new Request(url,{method:'POST',headers:{Origin:'https://anthropicsucks.club','Content-Type':'text/plain'}}),env)).status,415);
 }
});


test('rapid generation batches preserve individual rolls, capacity, sale order and retry idempotency', async () => {
 const {db,call}=await setup();
 try {
  await call('bubble_state');
  await db.exec("update community.bubble_players set capacity=1000000 where visitor='factory'");
  const rid=crypto.randomUUID();
  let s=await call('bubble_make',{count:40,requestId:rid});
  assert.equal(s.produced,40);assert.equal(s.player.slop,40);assert.equal(s.outcomes.length,40);
  s=await call('bubble_make',{count:40,requestId:rid});
  assert.equal(s.duplicate,true);assert.equal(s.player.slop,40);assert.equal(s.produced,0);
  s=await call('bubble_flush');assert.equal(s.minted,2800);assert.equal(s.player.slop,0);
  for(const count of [0,41,-1,1.5,'10',null]) await assert.rejects(call('bubble_make',{count}),/click count/i);
  await db.exec("update community.bubble_players set workspace=true where visitor='factory'; select setseed(0.314159)");
  s=await call('bubble_make',{count:40,rolled:999999});
  assert.equal(s.outcomes.length,40);
  assert.equal(s.produced,s.outcomes.reduce((sum,r)=>sum+r.produced,0));
  for(const r of s.outcomes) assert.ok(r.rolled>=1 && r.rolled<=1000);
  if(s.outcomes.some(r=>r.rolled>=251)) assert.equal(s.rollTier,'high');
  await db.exec("update community.bubble_players set slop=capacity-1 where visitor='factory'");
  s=await call('bubble_make',{count:40});
  assert.equal(s.produced,1);assert.equal(s.player.slop,s.player.capacity);
  assert.equal(s.outcomes.filter(r=>r.rolled>0).length,1);
  s=await call('bubble_flush');assert.equal(s.minted,1000000*70*5);
 } finally {await db.close();}
});


test('fictional world shock deducts $1T exactly once and preserves players and future sales', async () => {
 const {db,call}=await setup();
 try {
  await call('bubble_state');
  await db.exec("update community.bubble_players set arr=1000,contributed=2000,slop=1,auto=2 where visitor='factory'; update community.bubble_world set contributed=1500000000000,burst_at=now()");
  const sql=await readFile(new URL('../supabase/012_datacenter_event.sql',import.meta.url),'utf8');
  await db.exec(sql);
  let s=await call('bubble_state');
  assert.equal(s.world.contributed,500000000000);assert.equal(s.world.burst,false);
  assert.equal(s.world.event.loss,1000000000000);assert.equal(s.world.event.before,1500000000000);
  assert.equal(s.player.arr,1000);assert.equal(s.player.contributed,2000);assert.equal(s.player.auto,2);
  await db.exec(sql);s=await call('bubble_state');assert.equal(s.world.contributed,500000000000);
  s=await call('bubble_flush');assert.equal(s.world.contributed,500000000070);
  assert.equal(s.player.arr,1070);assert.equal(s.player.contributed,2070);
  // A lower initial balance floors at zero rather than becoming negative.
  await db.exec("update community.bubble_world set latest_event=null,contributed=100,burst_at=null");
  await db.exec(sql);s=await call('bubble_state');assert.equal(s.world.contributed,0);assert.equal(s.world.event.loss,100);
 } finally {await db.close();}
});


test('higher funding prices preserve owned rounds, charge quoted prices once and retain capacity growth', async () => {
 const {db,call}=await setup();
 try {
  await call('bubble_state');
  await db.exec("update community.bubble_players set arr=1000000000 where visitor='factory'");
  let s=await call('bubble_buy_bowl');
  const cash=s.player.arr;
  await db.exec(await readFile(new URL('../supabase/012_datacenter_event.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/015_funding_prices.sql',import.meta.url),'utf8'));
  s=await call('bubble_state');
  assert.equal(s.player.arr,cash);assert.equal(s.player.roundFunding,3500);assert.equal(s.player.fundingRound,1);
  assert.equal((await call('bubble_state',{},'new-player')).shop.fundingCost,3500);
  for(const [i,price] of [140000,1120000,17920000,573440000].entries()) {
   assert.equal(s.shop.fundingCost,price);
   const before=s.player.arr, id=crypto.randomUUID();
   s=await call('bubble_buy_bowl',{requestId:id});
   assert.equal(s.player.arr,before-price);assert.equal(s.player.roundFunding,price);
   assert.equal(s.player.capacity,10**(i+3));
   const saved=s.player.arr;
   s=await call('bubble_buy_bowl',{requestId:id});assert.equal(s.player.arr,saved);
  }
  assert.equal(s.shop.fundingCost,null);
  await assert.rejects(call('bubble_buy_bowl'),/already raised/);
  await db.exec("update community.bubble_players set funding_round=1,arr=139999 where visitor='new-player'");
  await assert.rejects(call('bubble_buy_bowl',{},'new-player'),/Not enough ARR/);
 }finally{await db.close();}
});


test('global outage resets valuation once, preserves players and stops all automatic accrual while manual play works', async () => {
 const {db,call}=await setup();
 try {
  await call('bubble_state');
  for(const f of ['012_datacenter_event.sql','014_leaderboard_events.sql','015_funding_prices.sql']) await db.exec(await readFile(new URL('../supabase/'+f,import.meta.url),'utf8'));
  await db.exec("update community.bubble_players set arr=1234567,slop=12,contributed=987,auto=10,data_centers=2,capacity=1000,funding_round=2,algorithm_level=3,influencers=2,workspace=true,auto_accrued_at=now()-interval '1 day' where visitor='factory'; update community.bubble_world set contributed=1500000000000,burst_at=now()");
  const before=(await db.query("select * from community.bubble_players where visitor='factory'")).rows[0];
  const sql=await readFile(new URL('../supabase/016_global_outage.sql',import.meta.url),'utf8');
  await db.exec(sql);
  assert.deepEqual((await db.query("select * from community.bubble_players where visitor='factory'")).rows[0],before);
  let s=await call('bubble_state');assert.equal(s.world.contributed,0);assert.equal(s.world.burst,false);assert.equal(s.world.autoPaused,true);
  assert.equal(s.player.slop,12);assert.equal(s.player.arr,1234567);assert.equal(s.player.contributed,987);
  assert.equal(s.world.event.id,'microsoft-outage-2026-11-16');
  await db.exec("update community.bubble_players set auto_accrued_at=now()-interval '1 day' where visitor='factory'");
  s=await call('bubble_state');assert.equal(s.player.slop,12);
  s=await call('bubble_buy_center');assert.equal(s.player.dataCenters,3);
  s=await call('bubble_make');assert.ok(s.produced>0);
  s=await call('bubble_flush');assert.ok(s.minted>0);const total=s.world.contributed;
  await db.exec(sql);s=await call('bubble_state');assert.equal(s.world.contributed,total);assert.equal(s.player.slop,0);
  assert.equal((await db.query("select count(*)::int n from community.bubble_events where id='microsoft-outage-2026-11-16'")).rows[0].n,1);
 } finally {await db.close();}
});


test('Neo Cloud resets compute once, resumes production and enforces escalating prices and fleet limits', async () => {
 const {db,call}=await setup();
 try {
  await call('bubble_state');
  for(const f of ['012_datacenter_event.sql','014_leaderboard_events.sql','015_funding_prices.sql','016_global_outage.sql'])await db.exec(await readFile(new URL('../supabase/'+f,import.meta.url),'utf8'));
  await db.exec("update community.bubble_players set auto=10,data_centers=3,arr=10000000,slop=7,contributed=123,workspace=true,algorithm_level=2,influencers=3,funding_round=2,capacity=1000,display_name='Keep Me',auto_accrued_at=now()-interval '1 day' where visitor='factory'");
  const sql=await readFile(new URL('../supabase/017_neo_cloud.sql',import.meta.url),'utf8');await db.exec(sql);
  let s=await call('bubble_state');
  assert.equal(s.player.auto,0);assert.equal(s.player.dataCenters,0);assert.equal(s.world.autoPaused,false);
  assert.equal(s.player.arr,10000000);assert.equal(s.player.slop,7);assert.equal(s.player.contributed,123);
  assert.equal(s.player.workspace,true);assert.equal(s.player.algorithmLevel,2);assert.equal(s.player.influencers,3);assert.equal(s.player.fundingRound,2);
  assert.equal((await db.query("select display_name from community.bubble_players where visitor='factory'")).rows[0].display_name,'Keep Me');
  assert.equal(s.shop.autoCost,1400);assert.equal(s.shop.centerCost,179200);
  const rid=crypto.randomUUID();s=await call('bubble_buy_auto',{requestId:rid});assert.equal(s.player.arr,9998600);assert.equal(s.shop.autoCost,2100);
  s=await call('bubble_buy_auto',{requestId:rid});assert.equal(s.player.auto,1);assert.equal(s.player.arr,9998600);
  s=await call('bubble_buy_auto');assert.equal(s.shop.autoCost,3150);
  s=await call('bubble_buy_center');assert.equal(s.shop.centerCost,358400);
  const cash=s.player.arr;s=await call('bubble_buy_center');assert.equal(s.player.arr,cash-358400);assert.equal(s.shop.centerCost,716800);
  await db.exec(sql);s=await call('bubble_state');assert.equal(s.player.auto,2);assert.equal(s.player.dataCenters,2);
  await db.exec("update community.bubble_players set slop=0,auto_accrued_at=now()-interval '3.3 seconds' where visitor='factory'");
  s=await call('bubble_state');assert.equal(s.player.slop,258);
  await db.exec("update community.bubble_players set auto=64,data_centers=32 where visitor='factory'");
  s=await call('bubble_state');assert.equal(s.shop.autoCost,null);assert.equal(s.shop.centerCost,null);
  await assert.rejects(call('bubble_buy_auto'),/Chip limit/);await assert.rejects(call('bubble_buy_center'),/Data center limit/);
  assert.equal((await db.query("select count(*)::int n from community.bubble_events where id='neo-cloud-implosion-2026-11-16'")).rows[0].n,1);
 } finally {await db.close();}
});
