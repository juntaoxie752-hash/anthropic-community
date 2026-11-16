-- Restore previously hidden players below $100B lifetime contribution.
-- Retain the exclusion record as an audit trail; player assets are untouched.
begin;
alter table community.bubble_board_exclusions add column if not exists restored_at timestamptz;
update community.bubble_board_exclusions e set restored_at=now()
 from community.bubble_players p where p.visitor=e.visitor
 and e.reason='top-ten-2026-11-16' and e.restored_at is null and p.contributed<100000000000;
create or replace function public.community_social(action text, visitor text, network text, payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare nickname text; result jsonb; hits integer;
begin
 if visitor is null or network is null then raise exception 'Missing visitor'; end if;
 if action not in ('bubble_board','bubble_name','bubble_events') then raise exception 'Unknown action'; end if;
 if action='bubble_events' then
  select jsonb_build_object('items',coalesce(jsonb_agg(e.details order by e.occurred_at desc,e.id),'[]'::jsonb)) into result
  from community.bubble_events e;
  return result;
 end if;
 if action='bubble_name' then
  nickname:=trim(coalesce(payload->>'name',''));
  if char_length(nickname) not between 2 and 24 or nickname !~ '^[A-Za-z0-9][A-Za-z0-9 _.-]*$' then
   raise exception 'Use 2–24 characters: letters, numbers, spaces, dots, hyphens or underscores.';
  end if;
  insert into community.limits as l(network,action,bucket) values(network,'bubble_name',date_trunc('minute',now()))
   on conflict on constraint limits_pkey do update set hits=case when l.bucket=date_trunc('minute',now()) then l.hits+1 else 1 end,bucket=date_trunc('minute',now()) returning l.hits into hits;
  if hits>10 then raise exception 'Too many name changes. Please wait a minute.'; end if;
  insert into community.bubble_players(visitor,display_name) values(visitor,nickname)
   on conflict on constraint bubble_players_pkey do update set display_name=excluded.display_name;
 end if;
 with ranked as (
  select p.visitor,coalesce(p.display_name,'Anonymous Slopper') as name,p.contributed,
   rank() over(order by p.contributed desc) as rank
  from community.bubble_players p where p.contributed>0 and not exists(select 1 from community.bubble_board_exclusions e where e.visitor=p.visitor and e.restored_at is null)
 ), leaders as (
  select r.rank,r.name,r.contributed,r.visitor=community_social.visitor as you
  from ranked r order by r.rank,r.name,r.visitor limit 50
 )
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(l)) from leaders l),'[]'::jsonb),
  'me',jsonb_build_object('name',(select display_name from community.bubble_players p where p.visitor=community_social.visitor),
   'contributed',coalesce((select contributed from community.bubble_players p where p.visitor=community_social.visitor),0),
   'excluded',exists(select 1 from community.bubble_board_exclusions e where e.visitor=community_social.visitor and e.restored_at is null),
   'rank',(select rank from ranked r where r.visitor=community_social.visitor))) into result;
 return result;
end;$$;
revoke all on function public.community_social(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.community_social(text,text,text,jsonb) to service_role;
commit;
