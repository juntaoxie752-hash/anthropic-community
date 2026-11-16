import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('shared wall persists reactions, sorts comments, and deduplicates likes', async () => {
 const db = new PGlite();
 try {
  await db.exec('create role anon; create role authenticated; create role service_role;');
  await db.exec(await readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'));
  const call = async (action,payload={},visitor='a') => (await db.query('select public.community_api($1,$2,$3,$4::jsonb) as result',[action,visitor,'network',JSON.stringify(payload)])).rows[0].result;
  const id = crypto.randomUUID();
  await call('react',{requestId:id});
  assert.equal((await call('react',{requestId:id})).reactions,1);
  await call('comment',{requestId:crypto.randomUUID(),name:'First',body:'First comment'});
  await call('comment',{requestId:crypto.randomUUID(),name:'Second',body:'Second comment'});
  // Give the sorting fixture distinct timestamps even on a fast local database.
  await db.exec("update community.comments set created_at=now()-interval '1 minute' where name='First'");
  const newest = await call('comments',{sort:'newest',page:0});
  assert.equal(newest.items[0].name,'Second');
  const first = newest.items[1].id;
  await call('like',{id:first,liked:true});
  assert.equal((await call('like',{id:first,liked:true})).likes,1);
  assert.equal((await call('comments',{sort:'popular',page:0})).items[0].name,'First');
  assert.equal((await call('like',{id:first,liked:true},'b')).likes,2);
  assert.equal((await call('like',{id:first,liked:false})).likes,1);
  const stats = await call('presence',{country:'US'});
  assert.equal(stats.comments,2); assert.equal(stats.reactions,1); assert.equal(stats.online,1);
  await assert.rejects(call('comment',{requestId:crypto.randomUUID(),name:'A',body:' '}));
  await db.exec('set role anon');
  await assert.rejects(call('comments',{sort:'newest',page:0}));
 } finally { await db.close(); }
});
