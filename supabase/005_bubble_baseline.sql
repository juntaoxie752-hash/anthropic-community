-- Baseline recovered from production on 2026-11-16. For fresh installs only.
-- Existing production already has this schema; apply only 006 there.
begin;
create table community.bubble_players (
 visitor text primary key, slop bigint not null default 0 check(slop>=0),
 capacity integer not null default 10 check(capacity>=10), arr bigint not null default 0 check(arr>=0),
 contributed bigint not null default 0 check(contributed>=0), double boolean not null default false,
 auto integer not null default 0 check(auto>=0), auto_accrued_at timestamptz not null default now(), joined_at timestamptz not null default now()
);
create table community.bubble_world (id integer primary key check(id=1), contributed bigint not null default 0 check(contributed>=0), burst_at timestamptz);
insert into community.bubble_world(id) values(1);
create table community.bubble_requests (visitor text not null, request_id uuid not null, action text not null, created_at timestamptz not null default now(), primary key(visitor,request_id));
alter table community.bubble_players enable row level security;
alter table community.bubble_world enable row level security;
alter table community.bubble_requests enable row level security;
CREATE OR REPLACE FUNCTION public.community_bubble(action text, visitor text, network text, payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 p community.bubble_players;
 w community.bubble_world;
 t timestamptz := now();
 rid uuid;
 repeated boolean := false;
 produced bigint := 0;
 flushed bigint := 0;
 minted bigint := 0;
 goal constant bigint := 1400000000000;
 batch constant bigint := 10;
 rate constant bigint := 70;
 double_cost constant bigint := 2100;
 auto_cost constant bigint := 1400;
 bowl_cost constant bigint := 3500;
 result jsonb;
begin
 if action not in ('bubble_state', 'bubble_make', 'bubble_flush', 'bubble_buy_double', 'bubble_buy_auto', 'bubble_buy_bowl') then
  raise exception 'Unknown bubble action';
 end if;
 if visitor is null or network is null then raise exception 'Missing player'; end if;

 insert into community.bubble_players (visitor) values (visitor) on conflict do nothing;
 select * into p from community.bubble_players where bubble_players.visitor = community_bubble.visitor for update;
 select * into w from community.bubble_world where id = 1 for update;

 -- Synthesizers accrue 1 slop per 10 seconds each, even while the tab is closed.
 -- A full bowl stops the factory: overflow is wasted, never banked.
 if p.auto > 0 and p.slop < p.capacity then
  p.slop := least(p.capacity, p.slop + p.auto * floor(extract(epoch from (t - p.auto_accrued_at)) / 10)::bigint);
 end if;
 p.auto_accrued_at := t;

 if action <> 'bubble_state' then
  begin
   rid := (payload->>'requestId')::uuid;
  exception when invalid_text_representation then
   raise exception 'Missing request ID';
  end;
  if rid is null then raise exception 'Missing request ID'; end if;
  select exists(
   select 1 from community.bubble_requests r
   where r.visitor = community_bubble.visitor and r.request_id = rid
  ) into repeated;
  if not repeated then
   insert into community.bubble_requests (visitor, request_id, action)
   values (visitor, rid, action);
  end if;
 end if;

 if not repeated and action = 'bubble_buy_double' then
  if p.double then raise exception 'Already owned'; end if;
  if p.arr < double_cost then raise exception 'Not enough ARR'; end if;
  p.arr := p.arr - double_cost;
  p.double := true;
 elsif not repeated and action = 'bubble_buy_auto' then
  if p.arr < auto_cost then raise exception 'Not enough ARR'; end if;
  p.arr := p.arr - auto_cost;
  p.auto := p.auto + 1;
 elsif not repeated and action = 'bubble_buy_bowl' then
  if p.arr < bowl_cost then raise exception 'Not enough ARR'; end if;
  p.arr := p.arr - bowl_cost;
  p.capacity := p.capacity + 10;
 elsif not repeated and action = 'bubble_make' then
  if p.slop < p.capacity then
   produced := 1;
   p.slop := p.slop + produced;
  end if;
 elsif not repeated and action = 'bubble_flush' then
  flushed := least(batch, p.slop);
  if flushed > 0 then
   minted := case when flushed = batch then flushed * rate * 5 else flushed * rate end;
   if p.double then minted := minted * 2; end if;
   p.slop := p.slop - flushed;
   p.arr := p.arr + minted;
   p.contributed := p.contributed + minted;
   w.contributed := w.contributed + minted;
   if w.contributed >= goal and w.burst_at is null then w.burst_at := t; end if;
  end if;
 end if;

 update community.bubble_players
 set slop = p.slop, arr = p.arr, contributed = p.contributed, double = p.double, auto = p.auto, capacity = p.capacity, auto_accrued_at = p.auto_accrued_at
 where bubble_players.visitor = community_bubble.visitor;
 update community.bubble_world
 set contributed = w.contributed, burst_at = w.burst_at
 where id = 1;

 result := jsonb_build_object(
  'player', jsonb_build_object('slop', p.slop, 'arr', p.arr, 'contributed', p.contributed, 'double', p.double, 'auto', p.auto, 'capacity', p.capacity),
  'world', jsonb_build_object(
   'goal', goal, 'contributed', w.contributed, 'burst', w.burst_at is not null,
   'batch', batch, 'rate', rate, 'fullBatchBonus', 5, 'doubleCost', double_cost, 'autoCost', auto_cost, 'bowlCost', bowl_cost
  ),
  'produced', produced,
  'flushed', flushed,
  'minted', minted,
  'duplicate', repeated,
  'serverTime', t
 );
 return result;
end;
$function$
;
revoke all on function public.community_bubble(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.community_bubble(text,text,text,jsonb) to service_role;
commit;
