-- Increasing-exponent financing costs: $3,500, $14,000, $112,000, $1,792,000, $57,344,000.
-- Existing capacity progression stays 10^n. Preserve old round amounts and balances.
begin;
alter table community.bubble_players add column round_funding bigint not null default 0 check(round_funding>=0);
-- Historical round sizes use the previous schedule; no retroactive charge.
update community.bubble_players set round_funding=case when funding_round=0 then 0 else 3500*power(10::numeric,funding_round-1)::bigint end;

create or replace function public.community_bubble(action text, visitor text, network text, payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 p community.bubble_players; w community.bubble_world; t timestamptz:=now();
 rid uuid; prior_action text; repeated boolean:=false;
 produced bigint:=0; flushed bigint:=0; minted bigint:=0; steps bigint; hits integer;
 goal constant bigint:=1400000000000; rate constant bigint:=70; auto_cost constant bigint:=1400;
 influencer_cost bigint; funding_cost bigint; next_capacity bigint;
 round_names text[]:=array['Seed','Series A','Series A+','Series B','Series C','Series D'];
begin
 if action not in ('bubble_state','bubble_make','bubble_flush','bubble_buy_double','bubble_buy_auto','bubble_buy_bowl') then raise exception 'Unknown bubble action'; end if;
 if visitor is null or network is null then raise exception 'Missing player'; end if;
 insert into community.bubble_players(visitor) values(visitor) on conflict do nothing;
 select * into p from community.bubble_players where bubble_players.visitor=community_bubble.visitor for update;

 if action<>'bubble_state' then
  rid:=(payload->>'requestId')::uuid;
  if rid is null then raise exception 'Missing request ID'; end if;
  select r.action into prior_action from community.bubble_requests r where r.visitor=community_bubble.visitor and r.request_id=rid;
  repeated:=found;
  if repeated and prior_action<>action then raise exception 'Request ID already used for another action'; end if;
  if not repeated then
   insert into community.limits as l(network,action,bucket) values(network,'bubble',date_trunc('minute',t))
    on conflict on constraint limits_pkey do update set hits=case when l.bucket=date_trunc('minute',t) then l.hits+1 else 1 end,bucket=date_trunc('minute',t) returning l.hits into hits;
   if hits>240 then raise exception 'Take a breath. Try again in a minute.'; end if;
   insert into community.bubble_requests(visitor,request_id,action) values(visitor,rid,action);
  end if;
 end if;

 -- Keep fractional production time; each NVIDIA B300 produces one slop every five seconds.
 steps:=greatest(0,floor(extract(epoch from (t-p.auto_accrued_at))/5))::bigint;
 if p.auto>0 and p.slop<p.capacity then
  p.slop:=least(p.capacity::numeric,p.slop::numeric+p.auto::numeric*steps)::bigint;
  p.auto_accrued_at:=p.auto_accrued_at+steps*interval '5 seconds';
 end if;
 if p.auto=0 or p.slop>=p.capacity then p.auto_accrued_at:=t; end if;

 influencer_cost:=2100*power(2::numeric,p.influencers)::bigint;
 funding_cost:=3500*power(2::numeric,p.funding_round*(p.funding_round+3)/2)::bigint;
 if not repeated and action='bubble_buy_double' then
  if p.influencers>=40 then raise exception 'Influencer roster is full'; end if;
  if p.arr<influencer_cost then raise exception 'Not enough ARR'; end if;
  p.arr:=p.arr-influencer_cost; p.influencers:=p.influencers+1; p.double:=true;
 elsif not repeated and action='bubble_buy_auto' then
  if p.arr<auto_cost then raise exception 'Not enough ARR'; end if;
  p.arr:=p.arr-auto_cost; p.auto:=p.auto+1;
  p.auto_accrued_at:=t;
 elsif not repeated and action='bubble_buy_bowl' then
  if p.funding_round>=5 then raise exception 'Series D already raised'; end if;
  if p.arr<funding_cost then raise exception 'Not enough ARR'; end if;
  p.arr:=p.arr-funding_cost; p.round_funding:=funding_cost; p.funding_round:=p.funding_round+1;
  p.capacity:=greatest(p.capacity,power(10::numeric,p.funding_round+1)::integer);
 elsif not repeated and action='bubble_make' then
  if p.slop<p.capacity then produced:=1; p.slop:=p.slop+1; end if;
 elsif not repeated and action='bubble_flush' then
  -- Every sale empties the current bowl. Only a genuinely full bowl gets 5x.
  flushed:=p.slop;
  if flushed>0 then
   minted:=flushed*rate*(1+p.influencers)*(case when flushed>=p.capacity then 5 else 1 end);
   p.slop:=0; p.arr:=p.arr+minted; p.contributed:=p.contributed+minted;
   update community.bubble_world set contributed=contributed+minted,
    burst_at=case when contributed+minted>=goal then coalesce(burst_at,t) else burst_at end where id=1;
  end if;
 end if;
 update community.bubble_players set slop=p.slop,arr=p.arr,contributed=p.contributed,double=p.double,auto=p.auto,
  capacity=p.capacity,auto_accrued_at=p.auto_accrued_at,influencers=p.influencers,funding_round=p.funding_round,round_funding=p.round_funding
  where bubble_players.visitor=community_bubble.visitor;
 select * into w from community.bubble_world where id=1;
 influencer_cost:=case when p.influencers<40 then 2100*power(2::numeric,p.influencers)::bigint end;
 funding_cost:=case when p.funding_round<5 then 3500*power(2::numeric,p.funding_round*(p.funding_round+3)/2)::bigint end;
 next_capacity:=case when p.funding_round<5 then greatest(p.capacity,power(10::numeric,p.funding_round+2)::bigint) end;
 return jsonb_build_object(
  'player',jsonb_build_object('slop',p.slop,'arr',p.arr,'contributed',p.contributed,'double',p.double,'auto',p.auto,'capacity',p.capacity,
   'influencers',p.influencers,'saleMultiplier',1+p.influencers,'fundingRound',p.funding_round,'fundingLabel',round_names[p.funding_round+1],'roundFunding',p.round_funding),
  'world',jsonb_build_object('goal',goal,'rate',rate,'batch',p.capacity,'fullBatchBonus',5,'contributed',w.contributed,'burst',w.burst_at is not null,
   'autoCost',auto_cost,'doubleCost',influencer_cost,'bowlCost',funding_cost,'economyVersion',3),
  'shop',jsonb_build_object('influencerCost',influencer_cost,'fundingCost',funding_cost,'nextCapacity',next_capacity,'nextRound',round_names[p.funding_round+2]),
  'produced',produced,'flushed',flushed,'minted',minted,'duplicate',repeated,'serverTime',t);
end;$$;
revoke all on function public.community_bubble(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.community_bubble(text,text,text,jsonb) to service_role;
commit;
