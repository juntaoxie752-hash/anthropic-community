import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('game rewards, idempotency, spending, cooldown, shared rescue and privacy',async()=>{
 const db=new PGlite();try{
 await db.exec('create role anon;create role authenticated;create role service_role;');
 for(const f of ['schema.sql','002_forum.sql','003_long_posts.sql','004_game.sql'])await db.exec(await readFile(new URL('../supabase/'+f,import.meta.url),'utf8'));
 const call=async(action,payload={},visitor='alice')=>(await db.query('select public.community_game($1,$2,$3,$4) as data',[action,visitor,visitor,JSON.stringify({requestId:crypto.randomUUID(),...payload})])).rows[0].data;
 let s=await call('game_state');assert.equal(s.player.poop,0);assert.equal(s.player.visitor,undefined);
 const id=crypto.randomUUID();s=await call('game_poke',{requestId:id});assert.equal(s.player.pokes,1);assert.equal(s.player.poop,1);
 s=await call('game_poke',{requestId:id});assert.equal(s.player.pokes,1);assert.equal(s.player.poop,1);assert.equal(s.duplicate,true);
 await assert.rejects(call('game_buy',{item:'lube'}),/Not enough/);
 await db.exec("update community.players set poop=1000,heat=98,last_poke=now()-interval '1 second' where visitor='alice'");
 s=await call('game_poke');assert.equal(s.event,'meltdown');assert.equal(s.player.bursts,1);assert.equal(s.player.heat,0);await assert.rejects(call('game_poke'),/Cooling down/);
 await db.exec("update community.players set cooldown_until=null where visitor='alice'");
 s=await call('game_buy',{item:'fiber'});assert.equal(s.player.fiber,1);
 const buy=crypto.randomUUID();s=await call('game_buy',{item:'lube',requestId:buy});const balance=s.player.poop;
 s=await call('game_buy',{item:'lube',requestId:buy});assert.equal(s.player.poop,balance);
 await db.exec("update community.game_world set jacket_support=4950;update community.players set poop=500 where visitor='alice'");
 s=await call('game_jacket');assert.equal(s.world.rescues,1);assert.equal(s.world.jacket_support,5000);assert.equal(s.player.rescue_contribution,50);assert.equal(s.player.poop,450);assert.equal(s.event,'rescued');assert.ok(s.world.rescue_until);
 const bob=await call('game_state',{},'bob');assert.equal(bob.world.rescues,1);assert.equal(bob.player.pokes,0);
 s=await call('game_poke',{},'bob');assert.equal(s.reward,2);assert.equal(s.player.pokes,1);
 await db.exec("update community.game_world set contributed=450");s=await call('game_contribute');assert.equal(s.event,'merged');assert.ok(s.world.bonus_until);
 await assert.rejects(call('game_name',{name:'<script>'}),/letters/);
 s=await call('game_name',{name:'Real-Poker'});assert.equal(s.player.name,'Real-Poker');assert.equal(s.boards.all[0].visitor,undefined);
 await db.exec("update community.players set auto=true,auto_remainder=0,last_sync=now()-interval '10 seconds',cooldown_until=null where visitor='alice'");
 s=await call('game_state');const earned=s.player.earned;assert.ok(earned>2);
 await db.exec("update community.players set last_sync=now()-interval '1 day' where visitor='alice'");s=await call('game_state');assert.equal(s.player.earned,earned);
 await db.exec('set role anon');await assert.rejects(call('game_state'));
 }finally{await db.close();}
});
