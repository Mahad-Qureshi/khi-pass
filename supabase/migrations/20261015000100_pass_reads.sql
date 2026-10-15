begin;

-- A claim-table SELECT can include a merchant's customers. Keep the customer
-- PASS view scoped to auth.uid() inside a narrow definer instead.
create function public.get_my_pass_details(p_claim_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pass jsonb; v_title text; v_merchant text; v_venue text;
begin
  v_pass := public.get_my_pass(p_claim_id);
  select d.title,m.business_name,v.name into v_title,v_merchant,v_venue
    from public.drops d
    join public.merchants m on m.id=d.merchant_id
    left join public.venues v on v.id=d.venue_id
    where d.id=(v_pass->>'drop_id')::uuid;
  return v_pass || jsonb_build_object('title',v_title,'merchant_name',v_merchant,'venue_name',v_venue);
end $$;

create function public.list_my_passes(p_limit integer default 20,p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_items jsonb; v_total bigint;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='AUTHENTICATION_REQUIRED'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 50 or p_offset is null or p_offset < 0 or p_offset > 10000 then
    raise exception using errcode='22023',message='INVALID_PAGINATION';
  end if;
  select count(*) into v_total from public.drop_claims where user_id=auth.uid();
  select coalesce(jsonb_agg(public.get_my_pass_details(c.id) order by c.claimed_at desc,c.id desc),'[]'::jsonb)
    into v_items from (
      select id,claimed_at from public.drop_claims where user_id=auth.uid()
      order by claimed_at desc,id desc limit p_limit offset p_offset
    ) c;
  return jsonb_build_object('items',v_items,'total',v_total);
end $$;

revoke all on function public.get_my_pass_details(uuid),public.list_my_passes(integer,integer) from public,anon,authenticated;
grant execute on function public.get_my_pass_details(uuid),public.list_my_passes(integer,integer) to authenticated;
commit;
