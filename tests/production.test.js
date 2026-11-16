import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import worker from '../src/worker.js';

async function setup() {
 const db = new PGlite();
 await db.exec('create role anon; create role authenticated; create role service_role;');
 for (const file of ['schema.sql','005_bubble_baseline.sql','006_hype_shop.sql','007_workforce_funding.sql','008_production_upgrades.sql','009_deepseek_pricing.sql']) {
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
