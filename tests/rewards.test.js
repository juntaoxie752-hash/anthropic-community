import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import worker from '../src/worker.js';

test('rewards are once per share visitor and once per actual post/reply insert; no retroactive credit or contribution inflation',async()=>{
 const db=new PGlite();
 try {
  await db.exec('create role anon; create role authenticated; create role service_role;');
  for(const f of ['schema.sql','002_forum.sql','003_long_posts.sql','005_bubble_baseline.sql','006_hype_shop.sql','007_workforce_funding.sql','008_production_upgrades.sql','009_deepseek_pricing.sql'])await db.exec(await readFile(new URL('../supabase/'+f,import.meta.url),'utf8'));
  const call=async(fn,action,payload={},visitor='alice')=>(await db.query(`select public.${fn}($1,$2,$3,$4) data`,[action,visitor,visitor,JSON.stringify(payload)])).rows[0].data;
  const forum=(a,p,v)=>call('community_forum',a,p,v);
  const reward=(a,v)=>call('community_rewards',a,{},v);
  const old={title:'Existing',body:'Existing post',name:'Reader',requestId:crypto.randomUUID()};
  await forum('create_post',old);
  await db.exec(await readFile(new URL('../supabase/010_community_rewards.sql',import.meta.url),'utf8'));
  assert.equal((await reward('reward_state')).arr,0);
  assert.equal((await forum('create_post',old)).reward,0);
  let s=await reward('reward_share');assert.equal(s.reward,50000000);assert.equal(s.arr,50000000);assert.equal(s.shareClaimed,true);
  s=await reward('reward_share');assert.equal(s.reward,0);assert.equal(s.arr,50000000);
  assert.equal((await reward('reward_state','bob')).shareClaimed,false);
  assert.equal((await reward('reward_share','bob')).reward,50000000);
  const post={...old,title:'New post',requestId:crypto.randomUUID()};
  const created=await forum('create_post',post);assert.equal(created.reward,30000000);
  assert.equal((await forum('create_post',post)).reward,0);
  await assert.rejects(forum('create_post',post,'bob'),/Invalid request/);
  assert.equal((await reward('reward_state')).arr,80000000);
  const reply={id:created.id,name:'Reader',body:'New reply',requestId:crypto.randomUUID()};
  // Separate network rate limits are existing behavior; reset only in this test fixture.
  await db.exec('delete from community.limits');
  assert.equal((await forum('reply',reply)).reward,10000000);
  assert.equal((await forum('reply',reply)).reward,0);
  await assert.rejects(forum('reply',reply,'bob'),/Invalid request/);
  assert.equal((await forum('reply',{...reply,requestId:crypto.randomUUID()})).reward,10000000);
  assert.equal((await reward('reward_state')).arr,100000000);
  const before=(await db.query('select count(*)::int n from community.reward_claims')).rows[0].n;
  await assert.rejects(forum('reply',{...reply,id:crypto.randomUUID(),requestId:crypto.randomUUID()}),/Post not found/);
  assert.equal((await db.query('select count(*)::int n from community.reward_claims')).rows[0].n,before);
  const bubble=await call('community_bubble','bubble_state');
  assert.equal(bubble.player.contributed,0);assert.equal(bubble.world.contributed,0);
  await db.exec('set role anon');await assert.rejects(reward('reward_share'));
  await assert.rejects(db.query("select community.credit_reward('alice','share','forged',50000000)"));
 } finally {await db.close();}
});

test('reward endpoints enforce read/write methods and same origin',async()=>{
 const env={SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'test',VISITOR_SECRET:'test'};
 assert.equal((await worker.fetch(new Request('https://example.com/api/reward_share'),env)).status,405);
 assert.equal((await worker.fetch(new Request('https://example.com/api/reward_share',{method:'POST',headers:{Origin:'https://attacker.test'}}),env)).status,403);
 assert.equal((await worker.fetch(new Request('https://example.com/api/reward_state',{method:'POST'}),env)).status,405);
});
