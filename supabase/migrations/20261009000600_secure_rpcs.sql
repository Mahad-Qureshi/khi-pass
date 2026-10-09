begin;
-- All elevated RPCs have a fixed empty search_path and derive identity from auth.uid().
create function private.require_admin() returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_admin() then raise exception using errcode='42501', message='ADMIN_REQUIRED'; end if;
end $$;

create function public.get_my_pass(p_claim_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.drop_claims%rowtype; v_code text;
begin
  if auth.uid() is null then raise exception using errcode='42501', message='AUTHENTICATION_REQUIRED'; end if;
  select * into c from public.drop_claims where id=p_claim_id and user_id=auth.uid();
  if not found then raise exception using errcode='42501', message='PASS_NOT_AVAILABLE'; end if;
  select redemption_code into v_code from private.claim_secrets where claim_id=c.id;
  return jsonb_build_object('id',c.id,'drop_id',c.drop_id,'merchant_id',c.merchant_id,'venue_id',c.venue_id,
    'status',case when c.status='pending' and c.expires_at <= clock_timestamp() then 'expired' else c.status end,
    'redemption_code',case when c.status='pending' and c.expires_at > clock_timestamp() then v_code else null end,
    'claimed_at',c.claimed_at,'expires_at',c.expires_at,'redeemed_at',c.redeemed_at,'cancelled_at',c.cancelled_at,
    'price',c.price_snapshot,'terms',c.terms_snapshot);
end $$;

create function public.claim_drop(p_drop_id uuid, p_request_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid(); v_merchant uuid; v_request uuid := coalesce(p_request_id,gen_random_uuid());
  d public.drops%rowtype; v_existing uuid; v_claim uuid; v_total bigint; v_user_total bigint;
  v_now timestamptz; v_expiry timestamptz; v_code text;
begin
  if v_user is null then raise exception using errcode='42501', message='AUTHENTICATION_REQUIRED'; end if;
  select merchant_id into v_merchant from public.drops where id=p_drop_id;
  if not found then raise exception using errcode='P0001', message='DROP_NOT_CLAIMABLE'; end if;
  -- Consistent lock order: merchant -> Drop -> claim. Suspension cannot race issuance.
  perform 1 from public.merchants where id=v_merchant and status='approved' for share;
  if not found then raise exception using errcode='P0001', message='DROP_NOT_CLAIMABLE'; end if;
  select * into d from public.drops where id=p_drop_id for update;
  if not found or d.merchant_id <> v_merchant then raise exception using errcode='P0001', message='DROP_NOT_CLAIMABLE'; end if;
  -- Retry keys are scoped to the authenticated user and Drop, never client ownership.
  select id into v_existing from public.drop_claims where drop_id=d.id and user_id=v_user and request_id=v_request;
  if found then return public.get_my_pass(v_existing); end if;
  v_now := clock_timestamp(); -- Sample after waiting for locks, not at transaction start.
  if d.status not in ('scheduled','active') or v_now < d.starts_at or v_now >= d.ends_at
    or (d.venue_id is not null and not private.venue_is_public(d.venue_id))
    or (d.experience_id is not null and not private.experience_is_public(d.experience_id)) then
    raise exception using errcode='P0001', message='DROP_NOT_CLAIMABLE';
  end if;
  -- Mutate the locked row version: higher isolation must retry rather than count a stale snapshot.
  update public.drops set claim_revision=claim_revision+1 where id=d.id;
  -- Every writer uses the same Drop row lock. Never restore inventory on cancellation/expiry.
  select count(*), count(*) filter (where user_id=v_user) into v_total,v_user_total
    from public.drop_claims where drop_id=d.id;
  if v_total >= d.claim_limit then raise exception using errcode='P0001', message='DROP_SOLD_OUT'; end if;
  if v_user_total >= d.per_user_limit then raise exception using errcode='P0001', message='USER_CLAIM_LIMIT_REACHED'; end if;
  v_expiry := least(v_now + make_interval(secs => d.redemption_lifetime_seconds), coalesce(d.redemption_ends_at,d.ends_at));
  v_code := 'KHI-' || upper(encode(extensions.gen_random_bytes(16),'hex'));
  insert into public.drop_claims(user_id,drop_id,merchant_id,venue_id,request_id,price_snapshot,terms_snapshot,claimed_at,expires_at)
    values(v_user,d.id,d.merchant_id,d.venue_id,v_request,d.drop_price,d.terms,v_now,v_expiry) returning id into v_claim;
  insert into private.claim_secrets(claim_id,redemption_code) values(v_claim,v_code);
  return public.get_my_pass(v_claim);
end $$;

create function public.redeem_drop_code(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_claim uuid; v_merchant uuid; v_drop uuid; c public.drop_claims%rowtype; v_now timestamptz;
begin
  if auth.uid() is null then raise exception using errcode='42501', message='AUTHENTICATION_REQUIRED'; end if;
  if p_code is null or char_length(p_code) > 64 or upper(btrim(p_code)) !~ '^KHI-[A-F0-9]{32}$' then
    raise exception using errcode='P0001', message='PASS_NOT_REDEEMABLE';
  end if;
  select c.id,c.merchant_id,c.drop_id into v_claim,v_merchant,v_drop
    from private.claim_secrets s join public.drop_claims c on c.id=s.claim_id where s.redemption_code=upper(btrim(p_code));
  if not found or not private.has_merchant_role(v_merchant,array['owner','manager','staff']) then
    raise exception using errcode='P0001', message='PASS_NOT_REDEEMABLE';
  end if;
  perform 1 from public.merchants where id=v_merchant and status='approved' for share;
  if not found then raise exception using errcode='P0001', message='PASS_NOT_REDEEMABLE'; end if;
  -- Lock the membership until commit so revoked staff cannot complete a redemption.
  perform 1 from public.merchant_members where merchant_id=v_merchant and user_id=auth.uid() and role in ('owner','manager','staff') for share;
  if not found then raise exception using errcode='P0001', message='PASS_NOT_REDEEMABLE'; end if;
  perform 1 from public.drops where id=v_drop and merchant_id=v_merchant and status in ('scheduled','active','sold_out','expired') for share;
  if not found then raise exception using errcode='P0001', message='PASS_NOT_REDEEMABLE'; end if;
  select * into c from public.drop_claims where id=v_claim for update;
  v_now := clock_timestamp();
  if not found or c.status <> 'pending' or c.expires_at <= v_now or c.merchant_id <> v_merchant or c.drop_id <> v_drop then
    raise exception using errcode='P0001', message='PASS_NOT_REDEEMABLE';
  end if;
  update public.drop_claims set status='redeemed',redeemed_at=v_now,redeemed_by=auth.uid() where id=c.id;
  return jsonb_build_object('id',c.id,'drop_id',c.drop_id,'merchant_id',c.merchant_id,'venue_id',c.venue_id,'status','redeemed','redeemed_at',v_now);
end $$;

create function public.cancel_my_claim(p_claim_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.drop_claims%rowtype; v_now timestamptz;
begin
  if auth.uid() is null then raise exception using errcode='42501', message='AUTHENTICATION_REQUIRED'; end if;
  select * into c from public.drop_claims where id=p_claim_id and user_id=auth.uid() for update;
  if not found then raise exception using errcode='42501', message='PASS_NOT_AVAILABLE'; end if;
  v_now := clock_timestamp();
  if c.status='pending' then
    if c.expires_at <= v_now then update public.drop_claims set status='expired' where id=c.id;
    else update public.drop_claims set status='cancelled',cancelled_at=v_now where id=c.id; end if;
  end if;
  return public.get_my_pass(c.id);
end $$;

create function public.get_drop_availability(p_drop_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d public.drops%rowtype; v_remaining bigint; v_now timestamptz := clock_timestamp();
begin
  if not private.drop_is_public(p_drop_id) then return null; end if;
  select * into d from public.drops where id=p_drop_id;
  select greatest(d.claim_limit-count(*),0) into v_remaining from public.drop_claims where drop_id=d.id;
  return jsonb_build_object('remaining',v_remaining,'claimable',d.status in ('scheduled','active') and v_now >= d.starts_at and v_now < d.ends_at and v_remaining > 0);
end $$;

-- No direct merchant creation or membership mutation from authenticated clients.
create function public.admin_create_merchant(p_business_name text,p_slug text,p_business_type text,p_owner_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform private.require_admin();
  insert into public.merchants(business_name,slug,business_type) values(p_business_name,p_slug,p_business_type) returning id into v_id;
  insert into private.merchant_contacts(merchant_id) values(v_id);
  insert into public.merchant_members(merchant_id,user_id,role) values(v_id,p_owner_id,'owner');
  insert into private.moderation_audit(entity_type,entity_id,actor_id,action,new_status) values('merchant',v_id,auth.uid(),'create','pending');
  return v_id;
end $$;
create function public.admin_set_merchant_member(p_merchant_id uuid,p_user_id uuid,p_role text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  perform 1 from public.merchants where id=p_merchant_id for update;
  if not found then raise exception using errcode='P0001', message='MERCHANT_NOT_FOUND'; end if;
  if p_role is not null and p_role not in ('owner','manager','staff') then raise exception using errcode='22023', message='INVALID_MEMBERSHIP_ROLE'; end if;
  if exists(select 1 from public.merchant_members where merchant_id=p_merchant_id and user_id=p_user_id and role='owner')
    and p_role is distinct from 'owner' and (select count(*) from public.merchant_members where merchant_id=p_merchant_id and role='owner') <= 1 then
    raise exception using errcode='23514', message='LAST_OWNER_REQUIRED';
  end if;
  if p_role is null then delete from public.merchant_members where merchant_id=p_merchant_id and user_id=p_user_id;
  else insert into public.merchant_members(merchant_id,user_id,role) values(p_merchant_id,p_user_id,p_role)
    on conflict(merchant_id,user_id) do update set role=excluded.role; end if;
  insert into private.moderation_audit(entity_type,entity_id,actor_id,action,new_status,reason)
    values('membership',p_merchant_id,auth.uid(),'set_member',p_role,'User: ' || p_user_id::text);
end $$;

create function public.get_merchant_contact(p_merchant_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not (private.is_admin() or private.has_merchant_role(p_merchant_id,array['owner','manager'])) then
    raise exception using errcode='42501', message='MERCHANT_ACCESS_REQUIRED';
  end if;
  return (select jsonb_build_object('contact_name',contact_name,'email',email,'phone',phone) from private.merchant_contacts where merchant_id=p_merchant_id);
end $$;
create function public.set_merchant_contact(p_merchant_id uuid,p_contact_name text,p_email text,p_phone text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not (private.is_admin() or private.has_merchant_role(p_merchant_id,array['owner','manager'])) then
    raise exception using errcode='42501', message='MERCHANT_ACCESS_REQUIRED';
  end if;
  insert into private.merchant_contacts(merchant_id,contact_name,email,phone) values(p_merchant_id,p_contact_name,p_email,p_phone)
    on conflict(merchant_id) do update set contact_name=excluded.contact_name,email=excluded.email,phone=excluded.phone;
end $$;

create function private.change_content_status(p_kind text,p_id uuid,p_status text,p_admin boolean,p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_table text; v_merchant uuid; v_old text;
begin
  if auth.uid() is null then raise exception using errcode='42501', message='AUTHENTICATION_REQUIRED'; end if;
  if p_admin then perform private.require_admin(); end if;
  v_table := case p_kind when 'merchant' then 'merchants' when 'venue' then 'venues' when 'experience' then 'experiences' when 'drop' then 'drops' else null end;
  if v_table is null then raise exception using errcode='22023', message='INVALID_CONTENT_KIND'; end if;
  if p_kind='merchant' then v_merchant:=p_id;
  else execute format('select merchant_id from public.%I where id=$1',v_table) into v_merchant using p_id; end if;
  perform 1 from public.merchants where id=v_merchant for update;
  if not found then raise exception using errcode='P0001', message='CONTENT_NOT_FOUND'; end if;
  execute format('select status from public.%I where id=$1 for update',v_table) into v_old using p_id;
  if v_old is null then raise exception using errcode='P0001', message='CONTENT_NOT_FOUND'; end if;
  if not p_admin then
    if not private.has_merchant_role(v_merchant,array['owner','manager']) then raise exception using errcode='42501', message='MERCHANT_ACCESS_REQUIRED'; end if;
    if p_status is null or not (
      (p_kind='merchant' and p_status='pending') or
      (p_kind in ('venue','experience') and p_status in ('draft','pending_approval','archived')) or
      (p_kind='drop' and p_status in ('draft','pending_approval','paused'))
    ) then raise exception using errcode='42501', message='MODERATION_REQUIRED'; end if;
  end if;
  execute format('update public.%I set status=$1 where id=$2',v_table) using p_status,p_id;
  insert into private.moderation_audit(entity_type,entity_id,actor_id,action,old_status,new_status,reason)
    values(p_kind,p_id,auth.uid(),case when p_admin then 'moderate' else 'submit_or_hide' end,v_old,p_status,p_reason);
end $$;
create function public.merchant_set_content_status(p_kind text,p_id uuid,p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin perform private.change_content_status(p_kind,p_id,p_status,false); end $$;
create function public.admin_moderate_content(p_kind text,p_id uuid,p_status text,p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin perform private.change_content_status(p_kind,p_id,p_status,true,p_reason); end $$;

create function public.admin_set_experience_featured(p_id uuid,p_featured boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  if p_featured is null then raise exception using errcode='22023', message='INVALID_FEATURED_VALUE'; end if;
  update public.experiences set featured=p_featured where id=p_id;
  if not found then raise exception using errcode='P0001', message='CONTENT_NOT_FOUND'; end if;
  insert into private.moderation_audit(entity_type,entity_id,actor_id,action,reason)
    values('experience',p_id,auth.uid(),'feature','featured=' || p_featured::text);
end $$;
create function public.merchant_claim_stats(p_merchant_id uuid,p_from timestamptz,p_until timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not (private.is_admin() or private.has_merchant_role(p_merchant_id,array['owner','manager','staff'])) then
    raise exception using errcode='42501', message='MERCHANT_ACCESS_REQUIRED';
  end if;
  if p_from is null or p_until is null or p_until <= p_from then raise exception using errcode='22023', message='INVALID_DATE_RANGE'; end if;
  return (select jsonb_build_object('issued',count(*),'redeemed',count(*) filter(where status='redeemed'),
    'cancelled',count(*) filter(where status='cancelled'),
    'expired',count(*) filter(where status='expired' or (status='pending' and expires_at <= clock_timestamp())),
    'pending',count(*) filter(where status='pending' and expires_at > clock_timestamp()))
    from public.drop_claims where merchant_id=p_merchant_id and claimed_at >= p_from and claimed_at < p_until);
end $$;

-- Share readers receive explicit JSON fields, not raw plan rows or user identities.
create function public.get_shared_plan(p_share_id text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.plans%rowtype; v_items jsonb; v_participants jsonb;
begin
  if p_share_id is null or p_share_id !~ '^[a-f0-9]{64}$' then return null; end if;
  select * into p from public.plans where share_id=p_share_id and status in ('shared','closed')
    and (share_expires_at is null or share_expires_at > clock_timestamp());
  if not found then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'experience_id',i.experience_id,'position',i.position,
    'yes',(select count(*) from public.plan_votes v where v.plan_item_id=i.id and v.vote='yes'),
    'maybe',(select count(*) from public.plan_votes v where v.plan_item_id=i.id and v.vote='maybe'),
    'no',(select count(*) from public.plan_votes v where v.plan_item_id=i.id and v.vote='no')) order by i.position,i.id),'[]'::jsonb)
    into v_items from public.plan_items i where i.plan_id=p.id and private.experience_is_public(i.experience_id);
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'nickname',nickname) order by created_at,id),'[]'::jsonb)
    into v_participants from public.plan_participants where plan_id=p.id;
  return jsonb_build_object('id',p.id,'title',p.title,'starts_at',p.starts_at,'area_id',p.area_id,'min_budget',p.min_budget,
    'max_budget',p.max_budget,'vibe_id',p.vibe_id,'group_type',p.group_type,'group_size',p.group_size,'status',p.status,
    'items',v_items,'participants',v_participants);
end $$;

create function public.join_shared_plan(p_share_id text,p_nickname text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p public.plans%rowtype; v_participant uuid; v_token text; v_nickname text := btrim(p_nickname);
begin
  if p_share_id is null or p_share_id !~ '^[a-f0-9]{64}$' then raise exception using errcode='P0001', message='PLAN_NOT_OPEN'; end if;
  if v_nickname is null or char_length(v_nickname) not between 1 and 40 then raise exception using errcode='22023', message='INVALID_NICKNAME'; end if;
  select * into p from public.plans where share_id=p_share_id for update;
  if not found or p.status <> 'shared' or (p.share_expires_at is not null and p.share_expires_at <= clock_timestamp()) then
    raise exception using errcode='P0001', message='PLAN_NOT_OPEN';
  end if;
  v_token := encode(extensions.gen_random_bytes(32),'hex');
  if auth.uid() is not null then
    select id into v_participant from public.plan_participants where plan_id=p.id and user_id=auth.uid();
  end if;
  if v_participant is not null then
    update public.plan_participants set nickname=v_nickname,participant_token_hash=extensions.digest(v_token,'sha256') where id=v_participant;
  else
    if (select count(*) from public.plan_participants where plan_id=p.id) >= 100 then raise exception using errcode='P0001', message='PLAN_PARTICIPANT_LIMIT'; end if;
    insert into public.plan_participants(plan_id,user_id,nickname,participant_token_hash)
      values(p.id,auth.uid(),v_nickname,extensions.digest(v_token,'sha256')) returning id into v_participant;
  end if;
  return jsonb_build_object('participant_id',v_participant,'participant_token',v_token);
end $$;

create function public.cast_plan_vote(p_share_id text,p_participant_token text,p_item_id uuid,p_vote text) returns void
language plpgsql security definer set search_path = '' as $$
declare p public.plans%rowtype; v_participant uuid;
begin
  if p_vote is null or p_vote not in ('yes','maybe','no') then raise exception using errcode='22023', message='INVALID_VOTE'; end if;
  if p_share_id is null or p_share_id !~ '^[a-f0-9]{64}$' or p_participant_token is null or p_participant_token !~ '^[a-f0-9]{64}$' then
    raise exception using errcode='42501', message='PLAN_VOTE_NOT_ALLOWED';
  end if;
  select * into p from public.plans where share_id=p_share_id for update;
  if not found or p.status <> 'shared' or (p.share_expires_at is not null and p.share_expires_at <= clock_timestamp()) then
    raise exception using errcode='42501', message='PLAN_VOTE_NOT_ALLOWED';
  end if;
  select id into v_participant from public.plan_participants
    where plan_id=p.id and participant_token_hash=extensions.digest(p_participant_token,'sha256')
    and (user_id is null or user_id=auth.uid()) for update;
  if not found or not exists(select 1 from public.plan_items i where i.id=p_item_id and i.plan_id=p.id and private.experience_is_public(i.experience_id)) then
    raise exception using errcode='42501', message='PLAN_VOTE_NOT_ALLOWED';
  end if;
  insert into public.plan_votes(plan_id,participant_id,plan_item_id,vote) values(p.id,v_participant,p_item_id,p_vote)
    on conflict(participant_id,plan_item_id) do update set vote=excluded.vote;
end $$;
create function public.rotate_plan_share_id(p_plan_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare v_share text;
begin
  if auth.uid() is null or not private.owns_plan(p_plan_id) then raise exception using errcode='42501', message='PLAN_OWNER_REQUIRED'; end if;
  update public.plans set share_id=encode(extensions.gen_random_bytes(32),'hex') where id=p_plan_id and owner_id=auth.uid() returning share_id into v_share;
  return v_share;
end $$;
-- Revoke default function EXECUTE before any RPC is deliberately exposed in the next migration.
revoke all on all functions in schema private from public, anon, authenticated;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('get_my_pass','claim_drop','redeem_drop_code','cancel_my_claim','get_drop_availability',
      'admin_create_merchant','admin_set_merchant_member','get_merchant_contact','set_merchant_contact','merchant_set_content_status',
      'admin_moderate_content','admin_set_experience_featured','merchant_claim_stats','get_shared_plan','join_shared_plan','cast_plan_vote','rotate_plan_share_id') loop
    execute format('revoke all on function %s from public, anon, authenticated', f.signature);
  end loop;
end $$;
commit;
