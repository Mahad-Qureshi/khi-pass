begin;
-- All identity predicates read server-managed rows, never JWT user_metadata.
create function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from private.platform_admins a where a.user_id = (select auth.uid()));
$$;
create function private.is_merchant_member(p_merchant_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.merchant_members m where m.merchant_id=p_merchant_id and m.user_id=(select auth.uid()));
$$;
create function private.has_merchant_role(p_merchant_id uuid, p_roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.merchant_members mm join public.merchants m on m.id=mm.merchant_id
    where mm.merchant_id=p_merchant_id and mm.user_id=(select auth.uid()) and mm.role=any(p_roles) and m.status <> 'suspended');
$$;
create function private.merchant_is_public(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.merchants m where m.id=p_id and m.status='approved');
$$;
create function private.venue_is_public(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.venues v join public.areas a on a.id=v.area_id
    where v.id=p_id and v.status='published' and a.is_active and private.merchant_is_public(v.merchant_id));
$$;
create function private.experience_is_public(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.experiences e join public.categories c on c.id=e.category_id
    where e.id=p_id and e.status='published' and c.is_active and private.venue_is_public(e.venue_id));
$$;
create function private.drop_is_public(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.drops d where d.id=p_id and d.status in ('scheduled','active','sold_out')
    and d.ends_at > statement_timestamp() and private.merchant_is_public(d.merchant_id)
    and (d.venue_id is null or private.venue_is_public(d.venue_id))
    and (d.experience_id is null or private.experience_is_public(d.experience_id)));
$$;
create function private.owns_plan(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.plans p where p.id=p_id and p.owner_id=(select auth.uid()));
$$;
create function private.experience_merchant(p_id uuid) returns uuid language sql stable security definer set search_path = '' as $$
  select merchant_id from public.experiences where id=p_id;
$$;

-- Column grants deny direct changes to status, featured, identities and timestamps.
-- This additional trigger makes edits to approved content require a fresh review.
create function private.guard_content() returns trigger language plpgsql set search_path = '' as $$
begin
  if private.is_admin() then return NEW; end if;
  if TG_TABLE_NAME='drops' and TG_OP='UPDATE' then
    if NEW.claim_revision <> OLD.claim_revision then
      if NEW.claim_revision <> OLD.claim_revision+1 or
        (to_jsonb(NEW)-array['claim_revision','updated_at']) is distinct from (to_jsonb(OLD)-array['claim_revision','updated_at']) then
        raise exception using errcode='42501', message='PROTECTED_CLAIM_REVISION';
      end if;
      return NEW; -- Only the issuance RPC can write this column; keep publication status unchanged.
    end if;
  end if;
  if TG_TABLE_NAME='merchants' then
    if TG_OP='INSERT' and NEW.status <> 'pending' then raise exception using errcode='42501', message='MODERATION_REQUIRED'; end if;
    if TG_OP='UPDATE' then
      if NEW.status <> OLD.status and NEW.status <> 'pending' then raise exception using errcode='42501', message='MODERATION_REQUIRED'; end if;
      if NEW.status='approved' then NEW.status := 'pending'; end if;
    end if;
  elsif TG_TABLE_NAME='drops' then
    if TG_OP='INSERT' and NEW.status not in ('draft','pending_approval') then raise exception using errcode='42501', message='MODERATION_REQUIRED'; end if;
    if TG_OP='UPDATE' then
      if NEW.status <> OLD.status and NEW.status not in ('draft','pending_approval','paused') then raise exception using errcode='42501', message='MODERATION_REQUIRED'; end if;
      if NEW.status in ('active','scheduled','sold_out','expired','rejected') then NEW.status := 'pending_approval'; end if;
    end if;
  else
    if TG_OP='INSERT' and NEW.status not in ('draft','pending_approval') then raise exception using errcode='42501', message='MODERATION_REQUIRED'; end if;
    if TG_OP='UPDATE' then
      if NEW.status <> OLD.status and NEW.status not in ('draft','pending_approval','archived') then raise exception using errcode='42501', message='MODERATION_REQUIRED'; end if;
      if NEW.status in ('published','rejected') then NEW.status := 'pending_approval'; end if;
    end if;
  end if;
  return NEW;
end $$;

create function private.guard_drop_history() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_issued bigint; v_highest bigint;
begin
  select count(*) into v_issued from public.drop_claims c where c.drop_id=OLD.id;
  if v_issued > 0 and (NEW.merchant_id is distinct from OLD.merchant_id or NEW.venue_id is distinct from OLD.venue_id or NEW.experience_id is distinct from OLD.experience_id) then
    raise exception using errcode='23514', message='ISSUED_DROP_OWNERSHIP_IMMUTABLE';
  end if;
  if NEW.claim_limit < v_issued then raise exception using errcode='23514', message='CLAIM_LIMIT_BELOW_ISSUED_COUNT'; end if;
  if NEW.per_user_limit <> OLD.per_user_limit then
    select coalesce(max(n),0) into v_highest from (
      select count(*) n from public.drop_claims c where c.drop_id=OLD.id and c.user_id is not null group by c.user_id
    ) counted;
    if NEW.per_user_limit < v_highest then raise exception using errcode='23514', message='USER_LIMIT_BELOW_ISSUED_COUNT'; end if;
  end if;
  return NEW;
end $$;

create function private.requeue_experience() returns trigger language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if TG_OP='DELETE' then v_id := OLD.experience_id; else v_id := NEW.experience_id; end if;
  if not private.is_admin() then
    update public.experiences set status='pending_approval' where id=v_id and status='published';
  end if;
  if TG_OP='DELETE' then return OLD; end if;
  return NEW;
end $$;
create function private.invalidate_deleted_participant_identity() returns trigger language plpgsql set search_path = '' as $$
begin
  if OLD.user_id is not null and NEW.user_id is null then
    NEW.participant_token_hash := extensions.digest(extensions.gen_random_bytes(32), 'sha256');
  end if;
  return NEW;
end $$;

-- Trigger names give guard -> timestamp ordering. No client-controlled created/updated dates.
do $$ declare t text; begin
  foreach t in array array['profiles','areas','categories','vibes','merchants','venues','experiences','experience_schedules','plans','plan_participants','plan_items','plan_votes'] loop
    execute format('create trigger z_touch_timestamps before insert or update on public.%I for each row execute function private.touch_timestamps()', t);
  end loop;
  foreach t in array array['merchants','venues','experiences','drops'] loop
    execute format('create trigger a_guard_content before insert or update on public.%I for each row execute function private.guard_content()', t);
  end loop;
end $$;
create trigger z_touch_timestamps before insert or update on public.drops for each row execute function private.touch_timestamps();
create trigger z_touch_timestamps before insert or update on private.merchant_contacts for each row execute function private.touch_timestamps();
create trigger b_guard_drop_history before update on public.drops for each row execute function private.guard_drop_history();
create trigger requeue_experience after insert or update or delete on public.experience_vibes for each row execute function private.requeue_experience();
create trigger requeue_experience after insert or update or delete on public.experience_schedules for each row execute function private.requeue_experience();
create trigger invalidate_deleted_identity before update on public.plan_participants for each row execute function private.invalidate_deleted_participant_identity();

create index merchant_members_by_user on public.merchant_members(user_id, merchant_id);
create index venues_by_merchant on public.venues(merchant_id);
create index venues_discovery_area on public.venues(area_id, id) where status='published';
create index venues_discovery_coordinates on public.venues(latitude, longitude) where status='published' and latitude is not null;
create index experiences_by_merchant on public.experiences(merchant_id);
create index experiences_by_venue on public.experiences(venue_id);
create index experiences_discovery_category_price on public.experiences(category_id, min_price, id) where status='published';
create index experiences_discovery_price on public.experiences(min_price, id) where status='published';
create index experiences_featured on public.experiences(created_at desc, id) where status='published' and featured;
create index experiences_event_dates on public.experiences(starts_at, ends_at) where status='published' and starts_at is not null;
create index experiences_search on public.experiences using gin(search_document) where status='published';
create index experience_vibes_by_vibe on public.experience_vibes(vibe_id, experience_id);
create index experience_schedules_lookup on public.experience_schedules(experience_id, weekday);
create index drops_by_merchant on public.drops(merchant_id, created_at desc);
create index drops_by_venue on public.drops(venue_id) where venue_id is not null;
create index drops_by_experience on public.drops(experience_id) where experience_id is not null;
create index drops_discovery_window on public.drops(status, ends_at, starts_at) where status in ('scheduled','active','sold_out');
create index drop_claims_inventory on public.drop_claims(drop_id, user_id);
create index drop_claims_by_user on public.drop_claims(user_id, claimed_at desc) where user_id is not null;
create index drop_claims_by_merchant on public.drop_claims(merchant_id, claimed_at desc);
create index drop_claims_by_venue on public.drop_claims(venue_id) where venue_id is not null;
create index drop_claims_pending_expiry on public.drop_claims(expires_at) where status='pending';
create index favorites_by_experience on public.favorites(experience_id);
create index plans_by_owner on public.plans(owner_id, updated_at desc);
create index plan_items_order on public.plan_items(plan_id, position, id);
create index plan_items_by_experience on public.plan_items(experience_id);
create index plan_votes_by_plan_item on public.plan_votes(plan_id, plan_item_id);
create index moderation_audit_entity on private.moderation_audit(entity_type, entity_id, created_at desc);
revoke all on all functions in schema private from public, anon, authenticated;
commit;
