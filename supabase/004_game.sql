begin;
create table community.players (
 visitor text primary key, name text not null, pokes bigint not null default 0, today date not null default (now() at time zone 'UTC')::date, today_pokes bigint not null default 0,
 poop bigint not null default 0 check(poop>=0), earned bigint not null default 0, heat numeric not null default 0 check(heat between 0 and 100), combo integer not null default 0, best_combo integer not null default 0, bursts integer not null default 0,
 fiber integer not null default 0 check(fiber between 0 and 5), auto boolean not null default false, last_sync timestamptz not null default now(), auto_remainder numeric not null default 0,
 last_poke timestamptz, cooldown_until timestamptz, lube_until timestamptz, rush_until timestamptz, whale_until timestamptz, gpu_until timestamptz,
 whale_cycle bigint not null default -1, jacket_cycle bigint not null default -1, rescue_contribution bigint not null default 0, joined_at timestamptz not null default now()
);
create table community.game_requests (visitor text not null, request_id uuid not null, action text not null, created_at timestamptz not null default now(), primary key(visitor,request_id));
create table community.game_world (id integer primary key check(id=1), contributed bigint not null default 0, jacket_support bigint not null default 0, fork_support bigint not null default 0, rescues integer not null default 0, rescue_until timestamptz, bonus_until timestamptz);
insert into community.game_world(id) values(1);
create index on community.players(pokes desc);
create index on community.players(today,today_pokes desc);
alter table community.players enable row level security;
alter table community.game_requests enable row level security;
alter table community.game_world enable row level security;
create or replace function public.community_game(action text, visitor text, network text, payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare p community.players; w community.game_world; t timestamptz:=now(); day date:=(now() at time zone 'UTC')::date;
 rid uuid; repeated boolean:=false; n integer; cost integer; reward bigint:=0; auto_gain bigint:=0; elapsed numeric; multiplier numeric:=1; item text:=payload->>'item'; event text:=''; cycle bigint:=floor(extract(epoch from now())/600); phase integer:=floor(extract(epoch from now()))::bigint%600;
 wc bigint:=floor(extract(epoch from now())/90); wp integer:=floor(extract(epoch from now()))::bigint%90; result jsonb; board jsonb; rank_all bigint; rank_today bigint;
begin
 if action not in ('game_state','game_poke','game_buy','game_whale','game_contribute','game_jacket','game_name') then raise exception 'Unknown game action'; end if;
 if visitor is null or network is null then raise exception 'Missing player'; end if;
 insert into community.players(visitor,name) values(visitor,'Poker-'||left(md5(visitor),6)) on conflict do nothing;
 select * into p from community.players where players.visitor=community_game.visitor for update;
 if p.today<>day then p.today:=day;p.today_pokes:=0;end if;
 if action<>'game_state' then
  rid:=(payload->>'requestId')::uuid; if rid is null then raise exception 'Missing request ID';end if;
  select exists(select 1 from community.game_requests r where r.visitor=community_game.visitor and r.request_id=rid) into repeated;
  if not repeated then
   insert into community.limits as l(network,action,bucket) values(network,'game',date_trunc('minute',t)) on conflict on constraint limits_pkey do update set hits=case when l.bucket=date_trunc('minute',t) then l.hits+1 else 1 end,bucket=date_trunc('minute',t) returning hits into n;
   if n>240 then raise exception 'Take a breath. Try again in a minute.';end if;
   insert into community.game_requests values(visitor,rid,action,t);
  end if;
 end if;
 -- No offline production: only contiguous heartbeats (at most 15 seconds apart) count.
 elapsed:=greatest(0,extract(epoch from t-p.last_sync));
 if p.auto and elapsed<=15 then
  elapsed:=greatest(0,extract(epoch from t-greatest(p.last_sync,coalesce(p.cooldown_until,p.last_sync))));
  p.auto_remainder:=p.auto_remainder+elapsed;
  auto_gain:=floor(p.auto_remainder/5);p.auto_remainder:=mod(p.auto_remainder,5);
 else p.auto_remainder:=0;end if;
 p.poop:=p.poop+auto_gain;p.earned:=p.earned+auto_gain;
 p.heat:=greatest(0,p.heat-greatest(0,extract(epoch from t-greatest(p.last_sync,coalesce(p.last_poke+interval '2 seconds',p.last_sync))))*(0.25+p.fiber*0.25));
 if p.last_poke is null or t-p.last_poke>interval '2 seconds' then p.combo:=0;end if;
 p.last_sync:=t;
 select * into w from community.game_world where id=1;
 if not repeated and action='game_poke' then
  if p.cooldown_until>t then raise exception 'Cooling down. Let the bubble recover.';end if;
  if p.last_poke>t-interval '200 milliseconds' then raise exception 'Maximum 5 pokes per second.';end if;
  insert into community.reactions(request_id,visitor) values(rid,visitor) on conflict do nothing;
  if not found then raise exception 'Request already used';end if;
  p.pokes:=p.pokes+1;p.today_pokes:=p.today_pokes+1;p.combo:=least(50,p.combo+1);p.best_combo:=greatest(p.best_combo,p.combo);p.last_poke:=t;
  if p.heat>=70 then multiplier:=1.5;elsif p.heat>=40 then multiplier:=1.25;end if;
  if p.lube_until>t then multiplier:=multiplier*2;end if;
  if p.whale_until>t then multiplier:=multiplier*2;end if;
  if w.rescue_until>t then multiplier:=multiplier*2;end if;
  if w.bonus_until>t then multiplier:=multiplier*1.5;end if;
  reward:=ceil((1+p.fiber)*multiplier)+floor(p.combo/10);
  p.heat:=least(100,p.heat+(case when p.lube_until>t then 2 else 4 end)*(case when p.rush_until>t then 3 else 1 end));
  if p.heat>=100 then
   reward:=reward+40+10*p.fiber;p.bursts:=p.bursts+1;p.heat:=0;p.combo:=0;p.cooldown_until:=t+interval '8 seconds';p.rush_until:=null;event:='meltdown';
  end if;
  p.poop:=p.poop+reward;p.earned:=p.earned+reward;
 elsif not repeated and action='game_buy' then
  cost:=case item when 'lube' then 40 when 'fiber' then 120*(p.fiber+1) when 'rush' then 100 when 'ice' then 25 when 'auto' then 250 when 'plunger' then 60 else null end;
  if cost is null then raise exception 'Unknown item';end if;
  if p.poop<cost then raise exception 'Not enough poop yet. Keep poking.';end if;
  if item='fiber' and p.fiber>=5 then raise exception 'Fiber is maxed out';end if;
  if item='auto' and p.auto then raise exception 'Auto-Poker already owned';end if;
  if item='lube' and p.lube_until>t or item='rush' and p.rush_until>t then raise exception 'That boost is already active';end if;
  if item in ('lube','rush','plunger') and p.cooldown_until>t then raise exception 'Wait for cooldown to finish';end if;
  if item='ice' and p.heat<1 then raise exception 'Already chilled';end if;
  if item='plunger' and (p.bursts<3 or p.heat<70) then raise exception 'Unlock after 3 meltdowns; use at 70+ heat';end if;
  p.poop:=p.poop-cost;
  case item
   when 'lube' then p.lube_until:=t+interval '30 seconds';
   when 'fiber' then p.fiber:=p.fiber+1;
   when 'rush' then p.rush_until:=t+interval '10 seconds';
   when 'ice' then p.heat:=greatest(0,p.heat-45);p.combo:=0;
   when 'auto' then p.auto:=true;p.auto_remainder:=0;
   when 'plunger' then reward:=80+10*p.fiber;p.poop:=p.poop+reward;p.earned:=p.earned+reward;p.bursts:=p.bursts+1;p.heat:=0;p.combo:=0;p.cooldown_until:=t+interval '3 seconds';p.rush_until:=null;event:='controlled';
  end case;
 elsif not repeated and action='game_whale' then
  if wp>=20 or p.whale_cycle=wc then raise exception 'The whale has sailed. Watch for the next one.';end if;
  p.whale_cycle:=wc;p.whale_until:=t+interval '15 seconds';event:='whale';
 elsif not repeated and action in ('game_contribute','game_jacket') then
  if p.poop<50 then raise exception 'You need 50 poop to contribute';end if;
  p.poop:=p.poop-50;
  select * into w from community.game_world where id=1 for update;
  if action='game_jacket' then
   w.jacket_support:=w.jacket_support+50;p.rescue_contribution:=p.rescue_contribution+50;event:='rescue_contribution';
   if w.jacket_support%5000=0 then w.rescues:=w.rescues+1;w.rescue_until:=greatest(t,coalesce(w.rescue_until,t))+interval '5 minutes';event:='rescued';end if;
  else w.contributed:=w.contributed+50;event:='contributed';end if;
  if action='game_contribute' and w.contributed%500=0 then w.bonus_until:=greatest(t,coalesce(w.bonus_until,t))+interval '60 seconds';event:='merged';end if;
  update community.game_world set contributed=w.contributed,jacket_support=w.jacket_support,fork_support=w.fork_support,bonus_until=w.bonus_until,rescues=w.rescues,rescue_until=w.rescue_until where id=1;
 elsif not repeated and action='game_name' then
  if coalesce(payload->>'name','') !~ '^[A-Za-z0-9_-]{3,20}$' then raise exception 'Use 3–20 letters, numbers, underscores or hyphens';end if;
  p.name:=payload->>'name';
 end if;
 update community.players set name=p.name,pokes=p.pokes,today=p.today,today_pokes=p.today_pokes,poop=p.poop,earned=p.earned,heat=p.heat,combo=p.combo,best_combo=p.best_combo,bursts=p.bursts,fiber=p.fiber,auto=p.auto,last_sync=p.last_sync,auto_remainder=p.auto_remainder,last_poke=p.last_poke,cooldown_until=p.cooldown_until,lube_until=p.lube_until,rush_until=p.rush_until,whale_until=p.whale_until,gpu_until=p.gpu_until,whale_cycle=p.whale_cycle,jacket_cycle=p.jacket_cycle,rescue_contribution=p.rescue_contribution where players.visitor=community_game.visitor;
 select count(*)+1 into rank_all from community.players x where x.pokes>p.pokes;
 select count(*)+1 into rank_today from community.players x where x.today=day and x.today_pokes>p.today_pokes;
 select jsonb_build_object('all',coalesce((select jsonb_agg(to_jsonb(x)) from (select name,pokes,players.visitor=community_game.visitor as me from community.players where pokes>0 order by pokes desc,joined_at limit 10)x),'[]'::jsonb),'today',coalesce((select jsonb_agg(to_jsonb(x)) from (select name,today_pokes as pokes,players.visitor=community_game.visitor as me from community.players where today=day and today_pokes>0 order by today_pokes desc,joined_at limit 10)x),'[]'::jsonb)) into board;
 result:=jsonb_build_object('player',(to_jsonb(p)-'visitor'-'auto_remainder')||jsonb_build_object('rank_all',rank_all,'rank_today',rank_today),'world',to_jsonb(w)-'id','boards',board,'reactions',(select count(*) from community.reactions),'serverTime',t,'reward',reward,'event',event,'duplicate',repeated,'whaleAvailable',wp<20 and p.whale_cycle<>wc,'jacketAvailable',phase<180 and p.jacket_cycle<>cycle,'whaleNext',90-wp,'jacketNext',600-phase);
 return result;
end;$$;
revoke all on function public.community_game(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.community_game(text,text,text,jsonb) to service_role;
commit;
