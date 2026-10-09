-- Correct the SQL alias collision with the PL/pgSQL claim record.
-- Existing migrations and the reviewed function privileges remain unchanged.
begin;
create or replace function public.redeem_drop_code(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_claim uuid; v_merchant uuid; v_drop uuid; c public.drop_claims%rowtype; v_now timestamptz;
begin
  if auth.uid() is null then raise exception using errcode='42501', message='AUTHENTICATION_REQUIRED'; end if;
  if p_code is null or char_length(p_code) > 64 or upper(btrim(p_code)) !~ '^KHI-[A-F0-9]{32}$' then
    raise exception using errcode='P0001', message='PASS_NOT_REDEEMABLE';
  end if;
  select claimed.id,claimed.merchant_id,claimed.drop_id into v_claim,v_merchant,v_drop
    from private.claim_secrets s join public.drop_claims claimed on claimed.id=s.claim_id where s.redemption_code=upper(btrim(p_code));
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
commit;
