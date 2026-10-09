begin;
create table public.merchants (
  id uuid primary key default gen_random_uuid(),
  business_name text not null check (char_length(business_name) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 160),
  description text check (char_length(description) <= 20000),
  logo_url text check (char_length(logo_url) <= 2048),
  instagram_url text check (char_length(instagram_url) <= 2048),
  website_url text check (char_length(website_url) <= 2048),
  business_type text not null check (char_length(business_type) between 1 and 80),
  status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- Row policies do not hide individual columns. Keep internal contacts off discovery rows.
create table private.merchant_contacts (
  merchant_id uuid primary key references public.merchants(id) on delete cascade,
  contact_name text check (char_length(contact_name) <= 160),
  email text check (char_length(email) <= 254),
  phone text check (char_length(phone) <= 32),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.merchant_members (
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','manager','staff')),
  created_at timestamptz not null default now(),
  primary key (merchant_id, user_id)
);
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id),
  name text not null check (char_length(name) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 160),
  area_id uuid not null references public.areas(id),
  address text not null check (char_length(address) between 1 and 1000),
  google_maps_url text check (char_length(google_maps_url) <= 2048),
  latitude numeric(9,6) check (latitude between -90 and 90),
  longitude numeric(9,6) check (longitude between -180 and 180),
  phone text check (char_length(phone) <= 32),
  timezone text not null default 'Asia/Karachi' check (timezone = 'Asia/Karachi'),
  status text not null default 'draft' check (status in ('draft','pending_approval','published','rejected','archived')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, merchant_id),
  check ((latitude is null) = (longitude is null))
);
create table public.experiences (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id),
  venue_id uuid not null,
  category_id uuid not null references public.categories(id),
  title text not null check (char_length(title) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 200),
  description text not null check (char_length(description) between 1 and 20000),
  image_paths text[] not null default '{}' check (cardinality(image_paths) <= 10 and array_position(image_paths, null) is null),
  min_price numeric(12,2) not null default 0 check (min_price >= 0 and min_price <> 'NaN'::numeric),
  max_price numeric(12,2) check (max_price >= min_price and max_price <> 'NaN'::numeric),
  currency text not null default 'PKR' check (currency = 'PKR'),
  duration_minutes integer check (duration_minutes between 1 and 10080),
  min_group_size integer not null default 1 check (min_group_size > 0),
  max_group_size integer check (max_group_size >= min_group_size),
  minimum_age integer not null default 0 check (minimum_age between 0 and 100),
  setting text not null default 'indoor' check (setting in ('indoor','outdoor','mixed')),
  booking_required boolean not null default false,
  starts_at timestamptz, ends_at timestamptz,
  featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft','pending_approval','published','rejected','archived')),
  search_document tsvector generated always as (
    setweight(to_tsvector('simple'::regconfig, title), 'A') ||
    setweight(to_tsvector('simple'::regconfig, description), 'B')
  ) stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, merchant_id, venue_id),
  foreign key (venue_id, merchant_id) references public.venues(id, merchant_id),
  check ((starts_at is null and ends_at is null) or (starts_at is not null and ends_at is not null and ends_at > starts_at))
);
create table public.experience_vibes (
  experience_id uuid not null references public.experiences(id) on delete cascade,
  vibe_id uuid not null references public.vibes(id),
  primary key (experience_id, vibe_id)
);
-- Weekly local-time slots plus optional date validity; split overnight slots at midnight.
create table public.experience_schedules (
  id uuid primary key default gen_random_uuid(),
  experience_id uuid not null references public.experiences(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  opens_at time not null, closes_at time not null check (closes_at > opens_at),
  valid_from date, valid_until date,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (valid_until is null or valid_from is null or valid_until >= valid_from),
  unique nulls not distinct (experience_id, weekday, opens_at, closes_at, valid_from, valid_until)
);

do $$ declare t text; begin
  foreach t in array array['merchants','merchant_members','venues','experiences','experience_vibes','experience_schedules'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
  end loop;
end $$;
alter table private.merchant_contacts enable row level security;
revoke all on private.merchant_contacts from public, anon, authenticated;
commit;
