-- One-time fictional event for the original leaders already hidden by migration 019.
-- Retain an internal pre-event snapshot for recovery; never expose visitor IDs publicly.
begin;
lock table community.bubble_players in share row exclusive mode;
lock table community.bubble_world in share row exclusive mode;
create table if not exists community.bubble_event_player_snapshots (
 event_id text not null, visitor text not null, snapshot jsonb not null,
 created_at timestamptz not null default now(), primary key(event_id,visitor)
);
alter table community.bubble_event_player_snapshots enable row level security;
do $$
declare affected integer; lost_cash numeric;
begin
 if not exists(select 1 from community.bubble_events where id='binance-hack-2026-11-16') then
  insert into community.bubble_event_player_snapshots(event_id,visitor,snapshot)
  select 'binance-hack-2026-11-16',p.visitor,to_jsonb(p)
  from community.bubble_players p join community.bubble_board_exclusions e using(visitor)
  where e.reason='top-ten-2026-11-16'
  order by p.contributed desc,coalesce(p.display_name,'Anonymous Slopper'),p.visitor limit 5;
  select count(*),sum((snapshot->>'arr')::numeric) into affected,lost_cash
   from community.bubble_event_player_snapshots where event_id='binance-hack-2026-11-16';
  if affected<>5 then raise exception 'Expected exactly five original leaders'; end if;
  update community.bubble_players p set arr=0,slop=0,auto=0,data_centers=0,auto_accrued_at=now()
   where exists(select 1 from community.bubble_event_player_snapshots s where s.event_id='binance-hack-2026-11-16' and s.visitor=p.visitor);
  update community.bubble_world set latest_event=jsonb_build_object(
   'id','binance-hack-2026-11-16','occurredAt',now(),'title','Binance Hack',
   'description','In this fictional game scenario, Binance is hacked. The five original leaderboard leaders lose their spendable ARR, stored AI Slop, B300 chips and data centers.',
   'disclaimer','Fictional game event, not a real-world news report. Only the five original leaders are affected. Other upgrades, AI Influencers, names, posts and lifetime contributions are preserved. Shared valuation is unchanged.',
   'icon','🔐','effect','5 ORIGINAL LEADERS · ASSETS RESET','displayValue','RESET',
   'historyImpact','5 original leaders · Cash, inventory & compute reset',
   'affectedPlayers',affected,'cashRemoved',lost_cash,
   'loss',0,'before',contributed,'after',contributed) where id=1;
 end if;
end;$$;
commit;
