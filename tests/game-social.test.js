import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {Window} from 'happy-dom';
import vm from 'node:vm';
import {setImmediate as nextTurn} from 'node:timers/promises';
import worker from '../src/worker.js';

test('board ranks sales, hides identity, saves names and archives immutable events without charging again',async()=>{
 const db=new PGlite();
 try {
  await db.exec('create role anon;create role authenticated;create role service_role');
  for(const file of ['schema.sql','005_bubble_baseline.sql','006_hype_shop.sql','007_workforce_funding.sql','008_production_upgrades.sql','009_deepseek_pricing.sql','011_rapid_clicks.sql','012_datacenter_event.sql','014_leaderboard_events.sql'])await db.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));
  const call=async(action,payload={},visitor='alice')=>(await db.query('select public.community_social($1,$2,$3,$4) as data',[action,visitor,visitor,JSON.stringify(payload)])).rows[0].data;
  assert.equal((await call('bubble_board')).me.rank,null);
  await call('bubble_name',{name:'Slop Master'});
  await assert.rejects(call('bubble_name',{name:'<script>alert(1)</script>'}),/Use 2/);
  await db.exec("update community.bubble_players set contributed=100,arr=999999 where visitor='alice'; insert into community.bubble_players(visitor,contributed) values('bob',200),('carol',100)");
  let s=await call('bubble_board');assert.equal(s.items[0].contributed,200);assert.equal(s.me.rank,2);
  assert.equal(s.items.find(p=>p.you).name,'Slop Master');assert.equal(s.items[0].visitor,undefined);
  s=await call('bubble_events');assert.equal(s.items.length,1);
  const balance=(await db.query('select contributed from community.bubble_world')).rows[0].contributed;
  await call('bubble_events');assert.equal((await db.query('select contributed from community.bubble_world')).rows[0].contributed,balance);
  await db.query("update community.bubble_world set latest_event=$1",[JSON.stringify({id:'second-event',occurredAt:'2026-11-17T00:00:00Z',title:'Test event',loss:5,before:10,after:5})]);
  s=await call('bubble_events');assert.equal(s.items.length,2);assert.equal(s.items[0].id,'second-event');
  // Hide a fixed snapshot of the top ten, never repeatedly skip the next ten.
  await db.exec("insert into community.bubble_players(visitor,contributed,arr) select 'leader-'||i,1000+i,777 from generate_series(1,12) as i");
  const cleanup=await readFile(new URL('../supabase/019_board_cleanup.sql',import.meta.url),'utf8');
  await db.exec(cleanup);
  s=await call('bubble_board');assert.equal(s.items[0].contributed,1002);assert.equal(s.items[0].rank,1);
  assert.equal((await db.query('select count(*)::int n from community.bubble_board_exclusions')).rows[0].n,10);
  const hidden=await call('bubble_board',{},'leader-12');assert.equal(hidden.me.excluded,true);assert.equal(hidden.me.contributed,1012);assert.equal(hidden.me.rank,null);
  await db.exec(cleanup);assert.equal((await call('bubble_board')).items[0].contributed,1002);
  assert.equal((await db.query("select arr from community.bubble_players where visitor='leader-12'")).rows[0].arr,777);
  await db.exec('set role anon');await assert.rejects(call('bubble_board'));await assert.rejects(db.query('select * from community.bubble_events'));
 }finally{await db.close();}
});

test('social routes require correct methods and origin',async()=>{
 const env={SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'test',VISITOR_SECRET:'test'};
 assert.equal((await worker.fetch(new Request('https://example.com/api/bubble_name'),env)).status,405);
 assert.equal((await worker.fetch(new Request('https://example.com/api/bubble_name',{method:'POST',headers:{Origin:'https://elsewhere.test'}}),env)).status,403);
 for(const a of ['bubble_board','bubble_events'])assert.equal((await worker.fetch(new Request('https://example.com/api/'+a,{method:'POST'}),env)).status,405);
});

test('board UI saves public names safely and event history reopens the selected event',async()=>{
 const w=new Window({settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
 try {
  w.document.write((await readFile(new URL('../public/index.html',import.meta.url),'utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,''));
  const q=id=>w.document.getElementById(id);let saved, replay;
  w.document.addEventListener('replay-world-event',e=>replay=e.detail);
  const board={items:[{rank:1,name:'<img src=x>',contributed:100,you:true}],me:{rank:1,name:'Player',contributed:100}};
  const fetch=async(url,opt)=>({ok:true,json:async()=>{
   if(url.endsWith('bubble_name')){saved=JSON.parse(opt.body).name;return board;}
   if(url.endsWith('bubble_events'))return {items:[{id:'event',occurredAt:'2026-11-16T00:00:00Z',loss:1000000000000}]};
   return board;
  }});
  vm.runInContext((await readFile(new URL('../public/game-social.js',import.meta.url),'utf8')).replace(/^import[^\n]*\n/gm,''),vm.createContext({document:w.document,ensureSession:async()=>{},fetch,AbortSignal,CustomEvent:w.CustomEvent}));
  q('open-leaderboard').click();await nextTurn();assert.equal(q('leaderboard-dialog').open,true);
  assert.equal(q('leaderboard-rows').querySelector('img'),null);assert.match(q('personal-rank').textContent,/#1/);
  q('player-name').value='New Name';q('player-name-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await nextTurn();assert.equal(saved,'New Name');
  q('leaderboard-dialog').close();q('open-events').click();await nextTurn();
  q('event-history').querySelector('button').click();assert.equal(q('events-dialog').open,false);assert.equal(replay.id,'event');
 }finally{await w.happyDOM.close();}
});
