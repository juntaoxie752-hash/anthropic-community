begin;
alter table community.comments drop constraint comments_body_check;
alter table community.comments add constraint comments_body_check check(char_length(body) between 1 and 20000);
alter table community.replies drop constraint replies_body_check;
alter table community.replies add constraint replies_body_check check(char_length(body) between 1 and 20000);
create or replace function public.community_forum(action text, visitor text, network text, payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; target uuid; n integer; page_num integer := least(100000,greatest(0,coalesce((payload->>'page')::integer,0)));
begin
 if action not in ('posts','post','create_post','reply','sitemap','sitemap_count') then raise exception 'Unknown action'; end if;
 if visitor is null or network is null then raise exception 'Missing visitor'; end if;
 if action in ('create_post','reply') then
  if char_length(trim(coalesce(payload->>'name',''))) not between 1 and 40 or char_length(trim(coalesce(payload->>'body',''))) not between 1 and 20000 then raise exception 'Use a name up to 40 characters and a message up to 20,000 characters.'; end if;
  insert into community.limits as l(network,action,bucket) values(network,'forum_write',date_trunc('minute',now()))
  on conflict on constraint limits_pkey do update set hits=case when l.bucket=date_trunc('minute',now()) then l.hits+1 else 1 end,bucket=date_trunc('minute',now()) returning hits into n;
  if n>5 then raise exception 'Too many posts or replies. Please wait a minute.'; end if;
 end if;
 if action='create_post' then
  if char_length(trim(coalesce(payload->>'title',''))) not between 1 and 160 then raise exception 'Add a title of up to 160 characters.'; end if;
  insert into community.comments as c(request_id,visitor,name,title,body) values((payload->>'requestId')::uuid,visitor,trim(payload->>'name'),trim(payload->>'title'),trim(payload->>'body'))
  on conflict(request_id) do update set title=c.title where c.visitor=community_forum.visitor returning id into target;
  if target is null then raise exception 'Invalid request'; end if;
  result:=jsonb_build_object('id',target);
 elsif action='reply' then
  target:=(payload->>'id')::uuid;
  perform 1 from community.comments where id=target and not hidden for share;
  if not found then raise exception 'Post not found'; end if;
  insert into community.replies(request_id,post_id,visitor,name,body) values((payload->>'requestId')::uuid,target,visitor,trim(payload->>'name'),trim(payload->>'body')) on conflict(request_id) do nothing;
  result:='{"ok":true}';
 elsif action='posts' then
  select jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb),'hasMore',(select count(*) from community.comments where not hidden)>(page_num+1)*20) into result from (
   select c.id,c.title,c.name,c.body,c.created_at,(select count(*) from community.likes l where l.comment_id=c.id) as likes,
   (select count(*) from community.replies r where r.post_id=c.id and not r.hidden) as replies,
   exists(select 1 from community.likes l where l.comment_id=c.id and l.visitor=community_forum.visitor) as liked
   from community.comments c where not c.hidden order by case when payload->>'sort'='popular' then (select count(*) from community.likes l where l.comment_id=c.id) else 0 end desc,c.created_at desc,c.id desc limit 20 offset page_num*20
  )t;
 elsif action='post' then
  target:=(payload->>'id')::uuid;
  select jsonb_build_object('post',to_jsonb(t)) into result from (
   select c.id,c.title,c.name,c.body,c.created_at,(select count(*) from community.likes l where l.comment_id=c.id) as likes,
   exists(select 1 from community.likes l where l.comment_id=c.id and l.visitor=community_forum.visitor) as liked,
   (select count(*) from community.replies r where r.post_id=c.id and not r.hidden) as replies
   from community.comments c where c.id=target and not c.hidden
  )t;
  if result is null then return '{"post":null}'::jsonb; end if;
  result:=result||jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(t)) from (
   select r.id,r.name,r.body,r.created_at from community.replies r where r.post_id=target and not r.hidden order by r.created_at,r.id limit 50 offset page_num*50
  )t),'[]'::jsonb),'hasMore',(result->'post'->>'replies')::bigint>(page_num+1)*50);
 elsif action='sitemap_count' then
  select jsonb_build_object('pages',greatest(1,ceil(count(*)/1000.0))) into result from community.comments where not hidden;
 else
  select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into result from (
   select c.id,c.title,c.created_at from community.comments c where not c.hidden order by c.created_at,c.id limit 1000 offset page_num*1000
  )t;
 end if;
 return result;
end; $$;
revoke all on function public.community_forum(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.community_forum(text,text,text,jsonb) to service_role;
commit;
