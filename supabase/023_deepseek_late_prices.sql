-- Escalate DeepSeek prices when the purchased upgrade crosses below three seconds; preserve owned levels.
begin;
create or replace function public.community_bubble(action text, visitor text, network text, payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 p community.bubble_players; w community.bubble_world; t timestamptz:=now();
 production_paused boolean;
 rid uuid; prior_action text; repeated boolean:=false;
 produced bigint:=0; flushed bigint:=0; minted bigint:=0; steps numeric; hits integer;
 interval_seconds numeric; total_chips bigint; algorithm_cost numeric;
 rolled integer:=0; roll_tier text:=null; bucket double precision;
 click_count integer:=1; click_index integer; click_roll integer; click_produced bigint;
 outcomes jsonb:='[]'::jsonb;
 center_cost numeric; workspace_cost constant bigint:=7000;
 goal constant bigint:=1400000000000; rate constant bigint:=70; auto_cost bigint;
 influencer_cost bigint; funding_cost bigint; next_capacity bigint;
 round_names text[]:=array['Seed','Series A','Series A+','Series B','Series C','Series D'];
begin
 if action not in ('bubble_state','bubble_make','bubble_flush','bubble_buy_double','bubble_buy_auto','bubble_buy_bowl','bubble_buy_center','bubble_buy_workspace','bubble_buy_algorithm') then raise exception 'Unknown bubble action'; end if;
 if action='bubble_make' then
  if payload ? 'count' and (jsonb_typeof(payload->'count')<>'number' or (payload->>'count') !~ '^[0-9]{1,2}$') then
   raise exception 'Invalid click count';
  end if;
  click_count:=coalesce((payload->>'count')::integer,1);
  if click_count<1 or click_count>40 then raise exception 'Click count must be between 1 and 40'; end if;
 end if;
 if visitor is null or network is null then raise exception 'Missing player'; end if;
 insert into community.bubble_players(visitor) values(visitor) on conflict do nothing;
 select * into p from community.bubble_players where bubble_players.visitor=community_bubble.visitor for update;
 select auto_paused into production_paused from community.bubble_world where id=1;

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

 -- Settle the old fleet at its old speed before a purchase; keep partial cycles.
 interval_seconds:=5*power(0.8::numeric,p.algorithm_level);
 total_chips:=p.auto::bigint+128::bigint*p.data_centers;
 steps:=greatest(0,floor(extract(epoch from (t-p.auto_accrued_at))/interval_seconds));
 if not production_paused and total_chips>0 and p.slop<p.capacity then
  p.slop:=least(p.capacity::numeric,p.slop::numeric+total_chips*steps)::bigint;
  p.auto_accrued_at:=p.auto_accrued_at+(steps*interval_seconds)::double precision*interval '1 second';
 end if;
 if production_paused or total_chips=0 or p.slop>=p.capacity then p.auto_accrued_at:=t; end if;
 auto_cost:=case when p.auto<64 then ceil(1400*power(1.5::numeric,p.auto))::bigint end;
 center_cost:=case when p.data_centers<32 then trunc(1792000*power(3::numeric,p.data_centers)) end;
 algorithm_cost:=case when p.algorithm_level<40 then case when p.algorithm_level<2 then 350000*power(2::numeric,p.algorithm_level) else 14000000*power(10::numeric,p.algorithm_level-2) end end;

 influencer_cost:=2100*power(2::numeric,p.influencers)::bigint;
 funding_cost:=3500*power(2::numeric,p.funding_round*(p.funding_round+3)/2)::bigint*(case when p.funding_round=0 then 1 else 10 end);
 if not repeated and action='bubble_buy_double' then
  if p.influencers>=40 then raise exception 'Influencer roster is full'; end if;
  if p.arr<influencer_cost then raise exception 'Not enough ARR'; end if;
  p.arr:=p.arr-influencer_cost; p.influencers:=p.influencers+1; p.double:=true;
 elsif not repeated and action='bubble_buy_auto' then
  if p.auto>=64 then raise exception 'Chip limit reached (64)'; end if;
  if p.arr<auto_cost then raise exception 'Not enough ARR'; end if;
  p.arr:=p.arr-auto_cost; p.auto:=p.auto+1;
  p.auto_accrued_at:=t;
 elsif not repeated and action='bubble_buy_center' then
  if p.data_centers>=32 then raise exception 'Data center limit reached (32)'; end if;
  if p.arr<center_cost then raise exception 'Not enough ARR'; end if;
  p.arr:=p.arr-center_cost; p.data_centers:=p.data_centers+1;
  p.auto_accrued_at:=t;
 elsif not repeated and action='bubble_buy_workspace' then
  if p.workspace then raise exception 'Workspace already owned'; end if;
  if p.arr<workspace_cost then raise exception 'Not enough ARR'; end if;
  p.arr:=p.arr-workspace_cost; p.workspace:=true;
 elsif not repeated and action='bubble_buy_algorithm' then
  if p.algorithm_level>=40 then raise exception 'Algorithm fully optimized'; end if;
  if p.arr<algorithm_cost then raise exception 'Not enough ARR'; end if;
  p.arr:=p.arr-algorithm_cost;
  -- Preserve fractional cycle progress without applying the new speed retroactively.
  p.auto_accrued_at:=t-(t-p.auto_accrued_at)*0.8;
  p.algorithm_level:=p.algorithm_level+1;
 elsif not repeated and action='bubble_buy_bowl' then
  if p.funding_round>=5 then raise exception 'Series D already raised'; end if;
  if p.arr<funding_cost then raise exception 'Not enough ARR'; end if;
  p.arr:=p.arr-funding_cost; p.round_funding:=funding_cost; p.funding_round:=p.funding_round+1;
  p.capacity:=greatest(p.capacity,power(10::numeric,p.funding_round+1)::integer);
 elsif not repeated and action='bubble_make' then
  for click_index in 1..click_count loop
   click_roll:=0; click_produced:=0;
   if p.slop<p.capacity then
    click_roll:=1;
    if p.workspace then
     -- Each click rolls independently, using the same probabilities as a single tap.
     bucket:=random();
     click_roll:=case when bucket<0.85 then 1+floor(random()*50)::integer
      when bucket<0.97 then 51+floor(random()*200)::integer
      else 251+floor(random()*750)::integer end;
     -- Preserve jackpots in a batch rather than letting the last low/full click hide them.
     if click_roll>=251 then roll_tier:='high';
     elsif roll_tier is distinct from 'high' then
      if click_roll>10 or roll_tier='normal' then roll_tier:='normal'; else roll_tier:='low'; end if;
     end if;
    end if;
    click_produced:=least(click_roll,p.capacity-p.slop); p.slop:=p.slop+click_produced;
    if p.slop>=p.capacity then p.auto_accrued_at:=t; end if;
   end if;
   rolled:=rolled+click_roll; produced:=produced+click_produced;
   outcomes:=outcomes||jsonb_build_array(jsonb_build_object('rolled',click_roll,'produced',click_produced));
  end loop;
 elsif not repeated and action='bubble_flush' then
  -- Every sale empties the current bowl. Only a genuinely full bowl gets 5x.
  flushed:=p.slop;
  if flushed>0 then
   minted:=floor(flushed::numeric*rate*(3-2/power(2::numeric,p.influencers))*(case when flushed>=p.capacity then 5 else 1 end))::bigint;
   p.slop:=0; p.arr:=p.arr+minted; p.contributed:=p.contributed+minted;
   update community.bubble_world set contributed=contributed+minted,
    burst_at=case when contributed+minted>=goal then coalesce(burst_at,t) else burst_at end where id=1;
  end if;
 end if;
 update community.bubble_players set slop=p.slop,arr=p.arr,contributed=p.contributed,double=p.double,auto=p.auto,
  capacity=p.capacity,auto_accrued_at=p.auto_accrued_at,influencers=p.influencers,funding_round=p.funding_round,round_funding=p.round_funding,
  data_centers=p.data_centers,workspace=p.workspace,algorithm_level=p.algorithm_level
  where bubble_players.visitor=community_bubble.visitor;
 select * into w from community.bubble_world where id=1;
 influencer_cost:=case when p.influencers<40 then 2100*power(2::numeric,p.influencers)::bigint end;
 funding_cost:=case when p.funding_round<5 then 3500*power(2::numeric,p.funding_round*(p.funding_round+3)/2)::bigint*(case when p.funding_round=0 then 1 else 10 end) end;
 next_capacity:=case when p.funding_round<5 then greatest(p.capacity,power(10::numeric,p.funding_round+2)::bigint) end;
 interval_seconds:=5*power(0.8::numeric,p.algorithm_level);
 total_chips:=p.auto::bigint+128::bigint*p.data_centers;
 auto_cost:=case when p.auto<64 then ceil(1400*power(1.5::numeric,p.auto))::bigint end;
 center_cost:=case when p.data_centers<32 then trunc(1792000*power(3::numeric,p.data_centers)) end;
 algorithm_cost:=case when p.algorithm_level<40 then case when p.algorithm_level<2 then 350000*power(2::numeric,p.algorithm_level) else 14000000*power(10::numeric,p.algorithm_level-2) end end;
 return jsonb_build_object(
  'player',jsonb_build_object('slop',p.slop,'arr',p.arr,'contributed',p.contributed,'double',p.double,'auto',p.auto,'capacity',p.capacity,
   'influencers',p.influencers,'saleMultiplier',3-2/power(2::numeric,p.influencers),'saleValue',floor(p.slop::numeric*rate*(3-2/power(2::numeric,p.influencers))*(case when p.slop>=p.capacity then 5 else 1 end))::text,'fundingRound',p.funding_round,'fundingLabel',round_names[p.funding_round+1],'roundFunding',p.round_funding,
   'dataCenters',p.data_centers,'workspace',p.workspace,'algorithmLevel',p.algorithm_level,
   'totalChips',total_chips,'productionInterval',interval_seconds),
  'world',jsonb_build_object('autoPaused',w.auto_paused,'event',w.latest_event,'goal',goal,'rate',rate,'batch',p.capacity,'fullBatchBonus',5,'contributed',w.contributed,'burst',w.burst_at is not null,
   'autoCost',auto_cost,'doubleCost',influencer_cost,'bowlCost',funding_cost,'economyVersion',5),
  'shop',jsonb_build_object('nextInfluencerBonus',case when p.influencers<40 then 1/power(2::numeric,p.influencers) end,'autoCost',auto_cost,'autoLimit',64,'centerLimit',32,'influencerCost',influencer_cost,'fundingCost',funding_cost,'nextCapacity',next_capacity,'nextRound',round_names[p.funding_round+2],
   'centerCost',center_cost::text,'workspaceCost',case when not p.workspace then workspace_cost end,
   'algorithmCost',trunc(algorithm_cost)::text,'nextInterval',case when algorithm_cost is not null then interval_seconds*0.8 end),
  'clickCount',click_count,'outcomes',outcomes,'rolled',rolled,'rollTier',roll_tier,'overflow',rolled-produced,'produced',produced,'flushed',flushed,'minted',minted,'duplicate',repeated,'serverTime',t);
end;$$;
revoke all on function public.community_bubble(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.community_bubble(text,text,text,jsonb) to service_role;
commit;
