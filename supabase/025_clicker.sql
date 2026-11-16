begin;
create table community.clicker_world(id boolean primary key default true check(id), total bigint not null default 0, combo bigint not null default 0, best bigint not null default 0, last_click timestamptz);
insert into community.clicker_world(id) values(true);
create table community.clicker_requests(request_id uuid primary key, visitor text not null, created_at timestamptz not null default now());
create table community.clicker_presence(visitor text primary key, country text not null, seen_at timestamptz not null default now());
create index on community.clicker_presence(seen_at);
alter table community.clicker_world enable row level security;
alter table community.clicker_requests enable row level security;
alter table community.clicker_presence enable row level security;
create or replace function public.community_clicker(action text, visitor text, network text, payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare w community.clicker_world; n integer; hits integer; inserted integer; t timestamptz:=clock_timestamp();
begin
 if action not in ('clicker_state','clicker_click') or visitor is null or network is null then raise exception 'Invalid request'; end if;
 insert into community.limits as l(network,action,bucket) values(network,action,date_trunc('minute',t)) on conflict on constraint limits_pkey do update set hits=case when l.bucket=date_trunc('minute',t) then l.hits+1 else 1 end,bucket=date_trunc('minute',t) returning l.hits into hits;
 if hits>600 then raise exception 'Too many requests. Please wait a minute.'; end if;
 insert into community.clicker_presence as p(visitor,country,seen_at) values(visitor,case when payload->>'country' ~ '^[A-Z]{2}$' then payload->>'country' else 'XX' end,t) on conflict on constraint clicker_presence_pkey do update set seen_at=excluded.seen_at,country=excluded.country;
 select * into w from community.clicker_world where id=true for update;
 if action='clicker_click' then
  n:=(payload->>'clicks')::integer;
  if n is null or n<1 or n>40 or payload->>'requestId' is null then raise exception 'Invalid click batch'; end if;
  insert into community.clicker_requests(request_id,visitor) values((payload->>'requestId')::uuid,visitor) on conflict do nothing;
  get diagnostics inserted=row_count;
  if inserted>0 then
   w.total:=w.total+n;
   w.combo:=case when w.last_click>t-interval '4.5 seconds' then w.combo+n else n end;
   w.best:=greatest(w.best,w.combo);w.last_click:=t;
   update community.clicker_world set total=w.total,combo=w.combo,best=w.best,last_click=t where id=true;
  end if;
 end if;
 return jsonb_build_object('count',w.total::text,'combo',case when w.last_click>t-interval '4.5 seconds' then w.combo else 0 end,'best',w.best,'lastClick',w.last_click,'serverTime',t,'online',(select count(*) from community.clicker_presence where seen_at>t-interval '90 seconds'),'countries',coalesce((select jsonb_agg(x) from(select country,count(*) as count from community.clicker_presence where seen_at>t-interval '90 seconds' group by country order by count(*) desc limit 32)x),'[]'::jsonb));
end;$$;
revoke all on function public.community_clicker(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.community_clicker(text,text,text,jsonb) to service_role;
commit;
