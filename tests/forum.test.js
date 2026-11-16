import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import worker from '../src/worker.js';
import {postPath} from '../src/forum.js';
test('forum migration preserves posts; replies, SEO routes, moderation and permissions work',async()=>{
 const db=new PGlite(); const nativeFetch=globalThis.fetch;
 try {
  await db.exec('create role anon; create role authenticated; create role service_role;');
  await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
  await db.query("insert into community.comments(request_id,visitor,name,body) values($1,'old','Legacy','Existing post')",[crypto.randomUUID()]);
  await db.exec(await readFile(new URL('../supabase/002_forum.sql',import.meta.url),'utf8'));
  const call=async(action,payload={},visitor='test')=>(await db.query('select public.community_forum($1,$2,$3,$4::jsonb) as result',[action,visitor,'network',JSON.stringify(payload)])).rows[0].result;
  assert.equal((await call('posts',{page:0})).items[0].title,'Existing post');
  const payload={title:'Why does Claude stop?',name:'Writer',body:'<script>alert("x")</script> My experience.',requestId:crypto.randomUUID()};
  const {id}=await call('create_post',payload);assert.equal((await call('create_post',payload)).id,id);
  const reply={id,name:'Reader',body:'A useful reply',requestId:crypto.randomUUID()};
  await call('reply',reply);await call('reply',reply);
  const data=await call('post',{id});assert.equal(data.post.replies,1);assert.equal(data.items[0].body,'A useful reply');
  assert.equal((await call('posts',{page:0})).items[0].id,id);
  await assert.rejects(call('reply',{...reply,id:crypto.randomUUID(),requestId:crypto.randomUUID()}));
  globalThis.fetch=async(url,options)=>{
   const {action,visitor,network,payload}=JSON.parse(options.body);
   const fn=String(url).endsWith('community_forum')?'community_forum':'community_api';
   return Response.json((await db.query(`select public.${fn}($1,$2,$3,$4::jsonb) as result`,[action,visitor,network,JSON.stringify(payload)])).rows[0].result);
  };
  const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test',VISITOR_SECRET:'test',ASSETS:{fetch:async()=>new Response(await readFile(new URL('../public/index.html',import.meta.url),'utf8'))}};
  const get=path=>worker.fetch(new Request('https://anthropicsucks.club'+path),env);
  const path=postPath(data.post);
  assert.equal((await get('/posts/'+id)).status,301);
  let res=await get(path);assert.equal(res.status,200);const html=await res.text();
  assert.match(html,/Why does Claude stop\?/);assert.match(html,/A useful reply/);assert.match(html,/DiscussionForumPosting/);assert.match(html,/https:\/\/anthropicsucks.club\/posts\//);assert.ok(!html.includes('<script>alert'));
  const home=await (await get('/')).text();assert.ok(home.includes(`href="${path}"`));assert.ok(!home.includes('<!--POSTS-->'));
  assert.match(await (await get('/sitemap-0.xml')).text(),/why-does-claude-stop/);
  assert.equal((await get('/posts/not-a-valid-id')).status,404);
  await db.query('update community.comments set hidden=true where id=$1',[id]);
  assert.equal((await get(path)).status,404);assert.ok(!(await (await get('/sitemap-0.xml')).text()).includes(id));
  await db.exec('set role anon');await assert.rejects(call('posts',{page:0}));
 }finally{globalThis.fetch=nativeFetch;await db.close();}
});
