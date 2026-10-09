begin;
-- Database ACLs and RLS both apply. No blanket authenticated ALL/table UPDATE grant.
grant usage on schema public to anon, authenticated;
grant usage on schema private to anon, authenticated;
grant execute on function private.is_admin(), private.is_merchant_member(uuid), private.has_merchant_role(uuid,text[]),
  private.merchant_is_public(uuid), private.venue_is_public(uuid), private.experience_is_public(uuid),
  private.drop_is_public(uuid), private.owns_plan(uuid), private.experience_merchant(uuid) to anon, authenticated;

create policy profiles_read on public.profiles for select to authenticated using (id=(select auth.uid()) or (select private.is_admin()));
create policy profiles_update on public.profiles for update to authenticated using (id=(select auth.uid())) with check (id=(select auth.uid()));
grant select on public.profiles to authenticated;
grant update(display_name,avatar_url,phone) on public.profiles to authenticated;

do $$ declare t text; begin
  foreach t in array array['areas','categories','vibes'] loop
    execute format('create policy reference_read on public.%I for select to anon, authenticated using (is_active or (select private.is_admin()))',t);
    execute format('create policy reference_insert on public.%I for insert to authenticated with check ((select private.is_admin()))',t);
    execute format('create policy reference_update on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))',t);
    execute format('create policy reference_delete on public.%I for delete to authenticated using ((select private.is_admin()))',t);
    execute format('grant select on public.%I to anon, authenticated',t);
    execute format('grant insert(name,slug,is_active,sort_order), update(name,slug,is_active,sort_order), delete on public.%I to authenticated',t);
  end loop;
end $$;

create policy merchants_read on public.merchants for select to anon, authenticated
  using (private.merchant_is_public(id) or private.is_merchant_member(id) or (select private.is_admin()));
create policy merchants_update on public.merchants for update to authenticated
  using (private.has_merchant_role(id,array['owner','manager']) or (select private.is_admin()))
  with check (private.has_merchant_role(id,array['owner','manager']) or (select private.is_admin()));
grant select on public.merchants to anon, authenticated;
grant update(business_name,slug,description,logo_url,instagram_url,website_url,business_type) on public.merchants to authenticated;
-- No INSERT/DELETE: onboarding and membership changes require trusted admin RPCs.
create policy merchant_members_read on public.merchant_members for select to authenticated
  using (user_id=(select auth.uid()) or private.has_merchant_role(merchant_id,array['owner','manager']) or (select private.is_admin()));
grant select on public.merchant_members to authenticated;

create policy venues_read on public.venues for select to anon, authenticated
  using (private.venue_is_public(id) or private.is_merchant_member(merchant_id) or (select private.is_admin()));
create policy venues_insert on public.venues for insert to authenticated
  with check (private.has_merchant_role(merchant_id,array['owner','manager']) or (select private.is_admin()));
create policy venues_update on public.venues for update to authenticated
  using (private.has_merchant_role(merchant_id,array['owner','manager']) or (select private.is_admin()))
  with check (private.has_merchant_role(merchant_id,array['owner','manager']) or (select private.is_admin()));
create policy venues_delete on public.venues for delete to authenticated
  using (status in ('draft','rejected') and (private.has_merchant_role(merchant_id,array['owner','manager']) or (select private.is_admin())));
grant select on public.venues to anon, authenticated;
grant insert(merchant_id,name,slug,area_id,address,google_maps_url,latitude,longitude,phone),
  update(name,slug,area_id,address,google_maps_url,latitude,longitude,phone),delete on public.venues to authenticated;

create policy experiences_read on public.experiences for select to anon, authenticated
  using (private.experience_is_public(id) or private.is_merchant_member(merchant_id) or (select private.is_admin()));
create policy experiences_insert on public.experiences for insert to authenticated
  with check (private.has_merchant_role(merchant_id,array['owner','manager']) or (select private.is_admin()));
create policy experiences_update on public.experiences for update to authenticated
  using (private.has_merchant_role(merchant_id,array['owner','manager']) or (select private.is_admin()))
  with check (private.has_merchant_role(merchant_id,array['owner','manager']) or (select private.is_admin()));
create policy experiences_delete on public.experiences for delete to authenticated
  using (status in ('draft','rejected') and (private.has_merchant_role(merchant_id,array['owner','manager']) or (select private.is_admin())));
grant select on public.experiences to anon, authenticated;
grant insert(merchant_id,venue_id,category_id,title,slug,description,image_paths,min_price,max_price,duration_minutes,min_group_size,max_group_size,minimum_age,setting,booking_required,starts_at,ends_at),
  update(venue_id,category_id,title,slug,description,image_paths,min_price,max_price,duration_minutes,min_group_size,max_group_size,minimum_age,setting,booking_required,starts_at,ends_at),delete on public.experiences to authenticated;

do $$ declare t text; begin
  foreach t in array array['experience_vibes','experience_schedules'] loop
    execute format('create policy experience_children_read on public.%I for select to anon, authenticated using (private.experience_is_public(experience_id) or private.is_merchant_member(private.experience_merchant(experience_id)) or (select private.is_admin()))',t);
    execute format('create policy experience_children_insert on public.%I for insert to authenticated with check (private.has_merchant_role(private.experience_merchant(experience_id),array[''owner'',''manager'']) or (select private.is_admin()))',t);
    execute format('create policy experience_children_update on public.%I for update to authenticated using (private.has_merchant_role(private.experience_merchant(experience_id),array[''owner'',''manager'']) or (select private.is_admin())) with check (private.has_merchant_role(private.experience_merchant(experience_id),array[''owner'',''manager'']) or (select private.is_admin()))',t);
    execute format('create policy experience_children_delete on public.%I for delete to authenticated using (private.has_merchant_role(private.experience_merchant(experience_id),array[''owner'',''manager'']) or (select private.is_admin()))',t);
    execute format('grant select on public.%I to anon, authenticated',t);
  end loop;
end $$;
grant insert(experience_id,vibe_id),delete on public.experience_vibes to authenticated;
grant insert(experience_id,weekday,opens_at,closes_at,valid_from,valid_until),
  update(weekday,opens_at,closes_at,valid_from,valid_until),delete on public.experience_schedules to authenticated;

create policy drops_read on public.drops for select to anon, authenticated
  using (private.drop_is_public(id) or private.is_merchant_member(merchant_id) or (select private.is_admin()));
create policy drops_insert on public.drops for insert to authenticated
  with check (private.has_merchant_role(merchant_id,array['owner','manager']) or (select private.is_admin()));
create policy drops_update on public.drops for update to authenticated
  using (private.has_merchant_role(merchant_id,array['owner','manager']) or (select private.is_admin()))
  with check (private.has_merchant_role(merchant_id,array['owner','manager']) or (select private.is_admin()));
create policy drops_delete on public.drops for delete to authenticated
  using (status in ('draft','rejected') and (private.has_merchant_role(merchant_id,array['owner','manager']) or (select private.is_admin())));
grant select on public.drops to anon, authenticated;
grant insert(merchant_id,venue_id,experience_id,title,slug,description,original_price,drop_price,discount_type,starts_at,ends_at,claim_limit,per_user_limit,redemption_lifetime_seconds,redemption_ends_at,terms),
  update(venue_id,experience_id,title,slug,description,original_price,drop_price,discount_type,starts_at,ends_at,claim_limit,per_user_limit,redemption_lifetime_seconds,redemption_ends_at,terms),delete on public.drops to authenticated;
create policy claims_read on public.drop_claims for select to authenticated
  using (user_id=(select auth.uid()) or private.is_merchant_member(merchant_id) or (select private.is_admin()));
-- Omit user_id, terms and staff identities from generic analytics reads. Owners use get_my_pass.
grant select(id,drop_id,merchant_id,venue_id,status,price_snapshot,claimed_at,expires_at,redeemed_at,cancelled_at) on public.drop_claims to authenticated;
-- Deliberately no INSERT/UPDATE/DELETE policies or privileges on claims/secrets.

create policy favorites_read on public.favorites for select to authenticated using (user_id=(select auth.uid()));
create policy favorites_insert on public.favorites for insert to authenticated with check (user_id=(select auth.uid()) and private.experience_is_public(experience_id));
create policy favorites_delete on public.favorites for delete to authenticated using (user_id=(select auth.uid()));
grant select,delete on public.favorites to authenticated;
grant insert(experience_id) on public.favorites to authenticated;

create policy plans_read on public.plans for select to authenticated using (owner_id=(select auth.uid()));
create policy plans_insert on public.plans for insert to authenticated with check (owner_id=(select auth.uid()));
create policy plans_update on public.plans for update to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
create policy plans_delete on public.plans for delete to authenticated using (owner_id=(select auth.uid()));
grant select,delete on public.plans to authenticated;
grant insert(title,starts_at,area_id,min_budget,max_budget,vibe_id,group_type,group_size,status,share_expires_at),
  update(title,starts_at,area_id,min_budget,max_budget,vibe_id,group_type,group_size,status,share_expires_at) on public.plans to authenticated;

create policy participants_read on public.plan_participants for select to authenticated
  using (user_id=(select auth.uid()) or private.owns_plan(plan_id));
create policy participants_remove on public.plan_participants for delete to authenticated using (private.owns_plan(plan_id));
grant select(id,plan_id,nickname,created_at,updated_at),delete on public.plan_participants to authenticated;
create policy items_read on public.plan_items for select to authenticated using (private.owns_plan(plan_id));
create policy items_insert on public.plan_items for insert to authenticated with check (private.owns_plan(plan_id) and private.experience_is_public(experience_id));
create policy items_update on public.plan_items for update to authenticated using (private.owns_plan(plan_id)) with check (private.owns_plan(plan_id));
create policy items_delete on public.plan_items for delete to authenticated using (private.owns_plan(plan_id));
grant select,delete on public.plan_items to authenticated;
grant insert(plan_id,experience_id,position),update(position) on public.plan_items to authenticated;
create policy votes_read on public.plan_votes for select to authenticated using (private.owns_plan(plan_id));
grant select on public.plan_votes to authenticated;
-- Anonymous callers have no direct plan/participant/vote table access; token-scoped RPCs only.

-- Expose only the narrow public RPC surface. Admin-named functions still validate trusted authority.
grant execute on function public.get_my_pass(uuid), public.claim_drop(uuid,uuid), public.redeem_drop_code(text), public.cancel_my_claim(uuid),
  public.admin_create_merchant(text,text,text,uuid), public.admin_set_merchant_member(uuid,uuid,text),
  public.get_merchant_contact(uuid), public.set_merchant_contact(uuid,text,text,text),
  public.merchant_set_content_status(text,uuid,text), public.admin_moderate_content(text,uuid,text,text), public.admin_set_experience_featured(uuid,boolean),
  public.merchant_claim_stats(uuid,timestamptz,timestamptz), public.rotate_plan_share_id(uuid) to authenticated;
grant execute on function public.get_drop_availability(uuid), public.get_shared_plan(text), public.join_shared_plan(text,text),
  public.cast_plan_vote(text,text,uuid,text) to anon, authenticated;
-- private.platform_admins, merchant_contacts, claim_secrets and moderation_audit have NO client policies/grants.
commit;
