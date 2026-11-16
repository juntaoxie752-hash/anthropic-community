import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('bubble migration preserves purchases; repeatable influencers, exponential rounds, accounting and replay safety', async () => {
 const db=new PGlite();
 try {
  await db.exec('create role anon; create role authenticated; create role service_role;');
  for(const file of ['schema.sql','005_bubble_baseline.sql']) await db.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));
  await db.exec("insert into community.bubble_players(visitor,arr,contributed,slop,capacity,double,auto) values('legacy',10000,50000,17,30,true,3); update community.bubble_world set contributed=50000;");
  await db.exec(await readFile(new URL('../supabase/006_hype_shop.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/007_workforce_funding.sql',import.meta.url),'utf8'));
  const call=async(action,payload={},visitor='alice')=>(await db.query('select public.community_bubble($1,$2,$3,$4) as data',[action,visitor,visitor,JSON.stringify({requestId:crypto.randomUUID(),...payload})])).rows[0].data;
  let s=await call('bubble_state',{},'legacy');
  assert.equal(s.player.arr,10000);assert.equal(s.player.slop,17);assert.equal(s.player.contributed,50000);assert.equal(s.world.contributed,50000);
  assert.equal(s.player.influencers,1);assert.equal(s.player.saleMultiplier,2);assert.equal(s.player.capacity,100);assert.equal(s.player.auto,3);
  assert.equal(s.player.visitor,undefined);assert.equal(s.player.roundFunding,3500);assert.equal(s.world.economyVersion,3);
  s=await call('bubble_state');assert.equal(s.player.roundFunding,0);assert.equal(s.player.fundingLabel,'Seed');assert.equal(s.player.capacity,10);assert.equal(s.shop.fundingCost,3500);
  await assert.rejects(call('bubble_buy_double'),/Not enough/);
  await db.exec("update community.bubble_players set arr=100000000 where visitor='alice'");
  const buy=crypto.randomUUID();s=await call('bubble_buy_double',{requestId:buy});
  const cash=s.player.arr;assert.equal(s.player.influencers,1);assert.equal(s.shop.influencerCost,4200);
  s=await call('bubble_buy_double',{requestId:buy});assert.equal(s.player.arr,cash);assert.equal(s.player.influencers,1);assert.equal(s.duplicate,true);
  await assert.rejects(call('bubble_buy_bowl',{requestId:buy}),/another action/);
  s=await call('bubble_buy_double');assert.equal(s.player.influencers,2);assert.equal(s.player.saleMultiplier,3);
  for(const [i,capacity] of [100,1000,10000,100000,1000000].entries()){
   const before=await call('bubble_state');
   s=await call('bubble_buy_bowl');assert.equal(s.player.capacity,capacity);assert.equal(s.player.fundingRound,i+1);
   assert.equal(before.player.arr-s.player.arr,[3500,14000,112000,1792000,57344000][i]);assert.equal(s.world.contributed,50000);
   assert.equal(s.player.roundFunding,before.shop.fundingCost);assert.equal(s.player.fundingLabel,['Series A','Series A+','Series B','Series C','Series D'][i]);
  }
  assert.equal(s.shop.fundingCost,null);assert.equal(s.shop.nextRound,null);await assert.rejects(call('bubble_buy_bowl'),/already raised/);
  await db.exec("update community.bubble_players set slop=1000000 where visitor='alice'");
  const sell=crypto.randomUUID(), before=await call('bubble_state');
  s=await call('bubble_flush',{requestId:sell});assert.equal(s.flushed,1000000);assert.equal(s.minted,1000000*70*5*3);assert.equal(s.player.slop,0);
  assert.equal(s.player.arr-before.player.arr,s.minted);assert.equal(s.player.contributed-before.player.contributed,s.minted);assert.equal(s.world.contributed-before.world.contributed,s.minted);
  const total=s.world.contributed;
  s=await call('bubble_flush',{requestId:sell});assert.equal(s.minted,0);assert.equal(s.world.contributed,total);
  await db.exec("update community.bubble_players set slop=7 where visitor='alice'");
  s=await call('bubble_flush');assert.equal(s.minted,7*70*3);
  // Polling every few seconds preserves fractional time; overflow isn't banked.
  await db.exec("update community.bubble_players set auto=3,slop=0,auto_accrued_at=now()-interval '12 seconds' where visitor='alice'");
  s=await call('bubble_state');assert.equal(s.player.slop,6);
  const remainder=(await db.query("select extract(epoch from now()-auto_accrued_at)::numeric as seconds from community.bubble_players where visitor='alice'")).rows[0].seconds;
  assert.ok(Number(remainder)>=2 && Number(remainder)<4);
  await db.exec("update community.bubble_players set auto_accrued_at=now()-interval '5 seconds' where visitor='alice'");
  s=await call('bubble_state');assert.equal(s.player.slop,9);
  s=await call('bubble_state');assert.equal(s.player.slop,9);
  await db.exec("update community.bubble_players set slop=capacity,auto_accrued_at=now()-interval '1 day' where visitor='alice'");
  await call('bubble_state');await call('bubble_flush');s=await call('bubble_state');assert.equal(s.player.slop,0);
  await db.exec('set role anon');await assert.rejects(call('bubble_state'));
 } finally {await db.close();}
});
