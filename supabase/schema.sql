begin;
create schema if not exists community;
create table community.comments (
 id uuid primary key default gen_random_uuid(), request_id uuid unique not null,
 visitor text not null, name text not null check(char_length(name) between 1 and 40),
 body text not null check(char_length(body) between 1 and 1000),
 created_at timestamptz not null default now(), hidden boolean not null default false
);
create table community.likes (comment_id uuid not null references community.comments(id) on delete cascade, visitor text not null, primary key(comment_id,visitor));
create table community.reactions (request_id uuid primary key, visitor text not null, created_at timestamptz not null default now());
create table community.presence (visitor text primary key, country text not null, seen_at timestamptz not null default now());
create table community.limits (network text not null, action text not null, bucket timestamptz not null, hits integer not null default 1, primary key(network,action));
create index on community.comments(created_at desc);
create index on community.presence(seen_at);
alter table community.comments enable row level security;
alter table community.likes enable row level security;
alter table community.reactions enable row level security;
alter table community.presence enable row level security;
alter table community.limits enable row level security;
create or replace function public.community_api(action text, visitor text, network text, payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
 n integer; cap integer; target uuid; desired boolean; result jsonb;
begin
 if action not in ('comments','presence','react','comment','like') then raise exception 'Unknown action'; end if;
 if visitor is null or network is null then raise exception 'Missing visitor'; end if;
 if action <> 'comments' then
   cap := case action when 'comment' then 5 when 'react' then 120 when 'like' then 120 else 240 end;
   insert into community.limits as l(network,action,bucket) values (network,action,date_trunc('minute',now()))
   on conflict on constraint limits_pkey do update set
     hits = case when l.bucket = date_trunc('minute',now()) then l.hits+1 else 1 end,
     bucket = date_trunc('minute',now()) returning hits into n;
   if n > cap then raise exception 'Too many requests. Please wait a minute.'; end if;
 end if;
 if action = 'presence' then
   insert into community.presence as p(visitor,country) values(visitor,coalesce(payload->>'country','XX'))
   on conflict on constraint presence_pkey do update set seen_at=now(),country=excluded.country;
   delete from community.presence where seen_at < now()-interval '5 minutes';
   select jsonb_build_object('reactions',(select count(*) from community.reactions),
     'comments',(select count(*) from community.comments where not hidden),
     'online',(select count(*) from community.presence where seen_at > now()-interval '90 seconds'),
     'countries',coalesce((select jsonb_agg(x) from (select country,count(*) as count from community.presence where seen_at > now()-interval '90 seconds' group by country order by count(*) desc limit 16)x),'[]'::jsonb)) into result;
 elsif action = 'react' then
   insert into community.reactions(request_id,visitor) values ((payload->>'requestId')::uuid,visitor) on conflict do nothing;
   select jsonb_build_object('reactions',count(*)) into result from community.reactions;
 elsif action = 'comment' then
   if char_length(trim(coalesce(payload->>'body',''))) not between 1 and 1000 or char_length(trim(coalesce(payload->>'name',''))) not between 1 and 40 then raise exception 'Use a name up to 40 characters and a comment up to 1000 characters.'; end if;
   insert into community.comments(request_id,visitor,name,body) values ((payload->>'requestId')::uuid,visitor,trim(payload->>'name'),trim(payload->>'body')) on conflict(request_id) do nothing;
   result := '{"ok":true}'::jsonb;
 elsif action = 'like' then
   begin target := (payload->>'id')::uuid; desired := (payload->>'liked')::boolean; exception when others then raise exception 'Invalid like'; end;
   perform 1 from community.comments where id=target and not hidden for update;
   if not found then raise exception 'Comment not found'; end if;
   if desired then insert into community.likes(comment_id,visitor) values(target,visitor) on conflict do nothing;
   else delete from community.likes l where l.comment_id=target and l.visitor=community_api.visitor; end if;
   select jsonb_build_object('likes',count(*),'liked',coalesce(desired,false)) into result from community.likes where comment_id=target;
 else
   select jsonb_build_object('items',coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb),
     'hasMore',(select count(*) from community.comments where not hidden) > ((payload->>'page')::integer+1)*20) into result
   from (select c.id,c.name,c.body,c.created_at,(select count(*) from community.likes l where l.comment_id=c.id) as likes,
     exists(select 1 from community.likes l where l.comment_id=c.id and l.visitor=community_api.visitor) as liked
     from community.comments c where not c.hidden
     order by case when payload->>'sort'='popular' then (select count(*) from community.likes l where l.comment_id=c.id) else 0 end desc,c.created_at desc,c.id desc
     limit 20 offset least(1000,greatest(0,coalesce((payload->>'page')::integer,0)))*20)t;
 end if;
 return result;
end; $$;
revoke all on schema community from public,anon,authenticated;
revoke all on function public.community_api(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.community_api(text,text,text,jsonb) to service_role;
commit;
