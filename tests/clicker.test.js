import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import worker from '../src/worker.js';
import {ClickerRoom} from '../src/clicker-room.js';
test('clicker totals are isolated, deduplicated, bounded and shared; combo expires',async()=>{
 const db=new PGlite();try{
 await db.exec('create role anon;create role authenticated;create role service_role;');
 for(const file of ['schema.sql','025_clicker.sql'])await db.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));
 const call=async(action,payload={},visitor='a')=>(await db.query('select public.community_clicker($1,$2,$3,$4) data',[action,visitor,'test',JSON.stringify(payload)])).rows[0].data;
 let p={requestId:crypto.randomUUID(),clicks:8,country:'US'};
 assert.equal((await call('clicker_click',p)).count,'8');assert.equal((await call('clicker_click',p)).count,'8');
 let next=await call('clicker_click',{...p,requestId:crypto.randomUUID(),clicks:2,country:'JP'},'b');assert.equal(next.count,'10');assert.equal(next.combo,10);assert.equal(next.online,2);assert.equal(next.countries.length,2);
 assert.equal((await db.query('select count(*) n from community.reactions')).rows[0].n,0);
 await assert.rejects(call('clicker_click',{...p,requestId:crypto.randomUUID(),clicks:41}));await assert.rejects(call('clicker_click',{clicks:-1}));
 await db.exec("update community.clicker_world set last_click=now()-interval '10 seconds'");
 next=await call('clicker_state');assert.equal(next.combo,0);assert.equal(next.best,10);
 next=await call('clicker_click',{...p,requestId:crypto.randomUUID(),clicks:1});assert.equal(next.combo,1);assert.equal(next.best,10);
 await db.exec('set role anon');await assert.rejects(call('clicker_state'));
 }finally{await db.close();}
});
test('domain routing serves separate homepages and preserves discussion URLs via redirects',async()=>{
 const env={ASSETS:{fetch:async r=>new Response(new URL(r.url).pathname)},CANONICAL_ORIGIN:'https://anthropicsucks.club'};
 assert.equal(await (await worker.fetch(new Request('https://fuckanthropic.club/'),env)).text(),'/clicker.html');
 assert.equal(await (await worker.fetch(new Request('https://fuckanthropic.club/index.html'),env)).text(),'/clicker.html');
 const redirect=await worker.fetch(new Request('https://fuckanthropic.club/posts/abc?x=1'),env);assert.equal(redirect.status,301);assert.equal(redirect.headers.get('Location'),'https://anthropicsucks.club/posts/abc?x=1');
 assert.match(await(await worker.fetch(new Request('https://fuckanthropic.club/sitemap.xml'),env)).text(),/https:\/\/fuckanthropic.club\//);
 assert.equal(await(await worker.fetch(new Request('https://anthropicsucks.club/'),env)).text(),'/index.html');
 const connected={...env,SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'test',VISITOR_SECRET:'test'};
 assert.equal((await worker.fetch(new Request('https://fuckanthropic.club/api/clicker_ws',{headers:{Origin:'https://evil.test'}}),connected)).status,403);
});
test('room fans out state and deduplicates multiple tabs in presence',async()=>{
 const sent=[[],[]];const sockets=sent.map((messages,i)=>({send:v=>messages.push(JSON.parse(v)),deserializeAttachment:()=>({visitor:'same',country:'US',bucket:Date.now(),hits:0}),serializeAttachment(){}}));
 const room=new ClickerRoom({getWebSockets:()=>sockets},{SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'test'});
 assert.equal(room.presence().online,1);const native=globalThis.fetch;
 try{globalThis.fetch=async()=>Response.json({count:'20',combo:20,best:20});await room.webSocketMessage(sockets[0],JSON.stringify({type:'click',clicks:2,requestId:crypto.randomUUID()}));assert.equal(sent[1][0].count,'20');assert.equal(sent[0][1].type,'ack');await room.webSocketMessage(sockets[0],JSON.stringify({type:'click',clicks:400}));assert.equal(sent[0].at(-1).type,'error');}finally{globalThis.fetch=native;}
});
