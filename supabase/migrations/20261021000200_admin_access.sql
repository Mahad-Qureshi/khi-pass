begin;

-- PostgREST does not expose the private schema. Keep the authority lookup in
-- the database and return only the caller's own admin status.
create function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and private.is_admin();
$$;
revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

-- Lock in the same merchant -> content order as change_content_status before
-- checking the old state. A direct RPC caller cannot race the application UI's
-- transition check or write an unsupported business status. Preserve the
-- existing admin flows used by local data and review tools.
create or replace function public.admin_moderate_content(p_kind text,p_id uuid,p_status text,p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_table text; v_merchant uuid; v_old text;
begin
  perform private.require_admin();
  v_table := case p_kind when 'merchant' then 'merchants' when 'venue' then 'venues'
    when 'experience' then 'experiences' when 'drop' then 'drops' else null end;
  if v_table is null or p_id is null or p_status is null then
    raise exception using errcode='22023', message='INVALID_MODERATION_REQUEST';
  end if;
  if p_kind='merchant' then v_merchant := p_id;
  else execute format('select merchant_id from public.%I where id=$1',v_table) into v_merchant using p_id; end if;
  perform 1 from public.merchants where id=v_merchant for update;
  if not found then raise exception using errcode='P0001', message='CONTENT_NOT_FOUND'; end if;
  execute format('select status from public.%I where id=$1 for update',v_table) into v_old using p_id;
  if v_old is null then raise exception using errcode='P0001', message='CONTENT_NOT_FOUND'; end if;
  if p_status <> v_old and not (
    (p_kind='merchant' and (
      (v_old='pending' and p_status in ('approved','rejected')) or
      (v_old='approved' and p_status in ('pending','suspended','rejected')) or
      (v_old='suspended' and p_status in ('approved','pending')) or
      (v_old='rejected' and p_status in ('pending','approved'))
    )) or
    (p_kind in ('venue','experience') and (
      (v_old in ('draft','pending_approval') and p_status in ('published','rejected','archived')) or
      (v_old='published' and p_status in ('pending_approval','archived','rejected')) or
      (v_old in ('rejected','archived') and p_status in ('draft','pending_approval'))
    )) or
    (p_kind='drop' and (
      (v_old in ('draft','pending_approval') and p_status in ('scheduled','active','paused','rejected')) or
      (v_old in ('scheduled','active','paused','sold_out','expired') and
        p_status in ('draft','pending_approval','scheduled','active','paused','rejected')) or
      (v_old='rejected' and p_status in ('draft','pending_approval'))
    ))
  ) then raise exception using errcode='22023', message='INVALID_STATUS_TRANSITION'; end if;
  perform private.change_content_status(p_kind,p_id,p_status,true,p_reason);
end $$;

-- CREATE OR REPLACE preserves existing EXECUTE grants. Reassert the intended
-- exposed privilege and remove any accidental broad grant on this RPC.
revoke all on function public.admin_moderate_content(text,uuid,text,text) from public, anon;
grant execute on function public.admin_moderate_content(text,uuid,text,text) to authenticated;

commit;
