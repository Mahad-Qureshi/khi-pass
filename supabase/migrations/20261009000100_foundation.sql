-- KHI PASS baseline. Apply in order to a Supabase PostgreSQL project, as postgres.
-- This migration set is intentionally not rerunnable; migration history prevents replay.
begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
-- Supabase normally installs pgcrypto here; do not silently tolerate a different schema.
do $$ begin
  if not exists (select 1 from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pgcrypto' and n.nspname='extensions') then
    raise exception 'pgcrypto must be installed in the extensions schema';
  end if;
end $$;
create schema private;
revoke all on schema private from public, anon, authenticated;

create function private.touch_timestamps() returns trigger
language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then NEW.created_at := clock_timestamp(); end if;
  NEW.updated_at := clock_timestamp();
  return NEW;
end $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 80),
  avatar_url text check (char_length(avatar_url) <= 2048),
  phone text check (char_length(phone) <= 32),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Admin authority is never a profile field or JWT user_metadata value.
create table private.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table private.moderation_audit (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('merchant','venue','experience','drop','membership')),
  entity_id uuid not null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  old_status text,
  new_status text,
  reason text check (char_length(reason) <= 2000),
  created_at timestamptz not null default now()
);

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.categories (like public.areas including defaults including constraints including indexes);
create table public.vibes (like public.areas including defaults including constraints including indexes);

create function private.bootstrap_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Ignore all user-supplied role/contact metadata; empty profiles are completed by their owner.
  insert into public.profiles(id) values (NEW.id);
  return NEW;
end $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function private.bootstrap_profile();
-- Covers pre-existing accounts without creating or changing any auth user.
insert into public.profiles(id) select id from auth.users;

alter table public.profiles enable row level security;
alter table public.areas enable row level security;
alter table public.categories enable row level security;
alter table public.vibes enable row level security;
alter table private.platform_admins enable row level security;
alter table private.moderation_audit enable row level security;
revoke all on public.profiles, public.areas, public.categories, public.vibes from public, anon, authenticated;
revoke all on private.platform_admins, private.moderation_audit from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
commit;
