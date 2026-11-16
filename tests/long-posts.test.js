import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import worker from '../src/worker.js';
import {shareIntent} from '../public/share.js';

test('long posts and replies survive API, database and SSR; oversized bodies are rejected',async()=>{
 const db=new PGlite(),nativeFetch=globalThis.fetch;
 try{
  await db.exec('create role anon; create role authenticated; create role service_role;');
  for(const file of ['schema.sql','002_forum.sql','003_long_posts.sql'])await db.exec(await readFile(new URL('../supabase/'+file,import.meta.url),'utf8'));
  globalThis.fetch=async(url,options)=>{
   const p=JSON.parse(options.body),fn=String(url).endsWith('community_forum')?'community_forum':'community_api';
   try{return Response.json((await db.query(`select public.${fn}($1,$2,$3,$4::jsonb) as result`,[p.action,p.visitor,p.network,JSON.stringify(p.payload)])).rows[0].result);}
   catch(e){return Response.json({code:e.code,message:e.message},{status:400});}
  };
  const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test',VISITOR_SECRET:'test'};
  const api=(action,payload)=>worker.fetch(new Request('https://anthropicsucks.club/api/'+action,{method:'POST',headers:{Origin:'https://anthropicsucks.club','Content-Type':'application/json'},body:JSON.stringify(payload)}),env);
  const body='长'.repeat(20000),base={name:'Reader',body,requestId:crypto.randomUUID()};
  const post=await api('create_post',{...base,title:'Long company discussion'});assert.equal(post.status,200);const {id}=await post.json();
  const reply=await api('reply',{...base,id,requestId:crypto.randomUUID()});assert.equal(reply.status,200);
  const row=(await db.query('select body from community.comments where id=$1',[id])).rows[0];assert.equal(row.body,body);
  assert.equal((await api('create_post',{...base,title:'Too long',body:body+'字',requestId:crypto.randomUUID()})).status,400);
  assert.equal((await api('reply',{...base,id,body:body+'字',requestId:crypto.randomUUID()})).status,400);
  const html=await (await worker.fetch(new Request(`https://anthropicsucks.club/posts/${id}/long-company-discussion`),env)).text();assert.ok(html.includes(body));assert.match(html,/maxlength="20000"/);
  assert.equal((await api('reply',{...base,id,body:'x'.repeat(270000)})).status,413);
  await db.exec('set role anon');await assert.rejects(db.query("select public.community_forum('posts','a','a','{}')"));
 }finally{globalThis.fetch=nativeFetch;await db.close();}
});

test('share intents encode the message and current website or post URL',()=>{
 const url='https://fuckanthropic.club/posts/example',message='Company feedback & 中文?';
 const x=new URL(shareIntent('x',url,message));assert.equal(x.searchParams.get('url'),url);assert.equal(x.searchParams.get('text'),message);
 const wa=new URL(shareIntent('whatsapp',url,message));assert.equal(wa.searchParams.get('text'),message+'\n'+url);
 assert.equal(new URL(shareIntent('reddit',url,message)).searchParams.get('title'),message);
 assert.ok(shareIntent('messages',url,message,true).startsWith('sms:&body='));
 assert.equal(new URL(shareIntent('email',url,message)).searchParams.get('body'),message+'\n'+url);
});
