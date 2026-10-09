begin;
create table public.drops (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id),
  venue_id uuid, experience_id uuid,
  title text not null check (char_length(title) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 200),
  description text not null check (char_length(description) between 1 and 20000),
  original_price numeric(12,2) check (original_price >= 0 and original_price <> 'NaN'::numeric),
  drop_price numeric(12,2) not null check (drop_price >= 0 and drop_price <> 'NaN'::numeric),
  currency text not null default 'PKR' check (currency = 'PKR'),
  discount_type text not null default 'fixed_price' check (discount_type in ('fixed_price','percentage','free')),
  starts_at timestamptz not null check (isfinite(starts_at)), ends_at timestamptz not null check (isfinite(ends_at) and ends_at > starts_at),
  claim_limit integer not null check (claim_limit > 0),
  -- Protected row-version revision ensures repeatable-read callers cannot oversell on a stale snapshot.
  claim_revision bigint not null default 0 check (claim_revision >= 0),
  per_user_limit integer not null default 1 check (per_user_limit > 0 and per_user_limit <= claim_limit),
  redemption_lifetime_seconds integer not null default 600 check (redemption_lifetime_seconds between 60 and 86400),
  redemption_ends_at timestamptz check (isfinite(redemption_ends_at) and redemption_ends_at >= ends_at),
  terms text not null check (char_length(terms) between 1 and 20000),
  status text not null default 'draft' check (status in ('draft','pending_approval','scheduled','active','sold_out','expired','paused','rejected')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (id, merchant_id), unique (id, merchant_id, venue_id),
  foreign key (venue_id, merchant_id) references public.venues(id, merchant_id),
  foreign key (experience_id, merchant_id, venue_id) references public.experiences(id, merchant_id, venue_id),
  check (experience_id is null or venue_id is not null),
  check (original_price is null or drop_price <= original_price),
  check (discount_type <> 'free' or drop_price = 0),
  check (discount_type <> 'percentage' or (original_price is not null and original_price > 0 and drop_price < original_price))
);
-- A claim is the pass and its redemption ledger: one row per issued pass, not three competing states.
create table public.drop_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  drop_id uuid not null, merchant_id uuid not null, venue_id uuid,
  request_id uuid not null,
  status text not null default 'pending' check (status in ('pending','redeemed','expired','cancelled')),
  price_snapshot numeric(12,2) not null check (price_snapshot >= 0 and price_snapshot <> 'NaN'::numeric),
  terms_snapshot text not null,
  claimed_at timestamptz not null default now(), expires_at timestamptz not null,
  redeemed_at timestamptz, cancelled_at timestamptz,
  redeemed_by uuid references auth.users(id) on delete set null,
  foreign key (drop_id, merchant_id) references public.drops(id, merchant_id),
  foreign key (drop_id, merchant_id, venue_id) references public.drops(id, merchant_id, venue_id),
  check (expires_at > claimed_at),
  check ((status = 'redeemed') = (redeemed_at is not null)),
  check ((status = 'cancelled') = (cancelled_at is not null)),
  check (redeemed_at is null or (redeemed_at >= claimed_at and redeemed_at < expires_at)),
  check (cancelled_at is null or cancelled_at >= claimed_at),
  unique (user_id, drop_id, request_id)
);
-- Do not let merchant dashboard queries enumerate customers' bearer redemption codes.
create table private.claim_secrets (
  claim_id uuid primary key references public.drop_claims(id) on delete cascade,
  redemption_code text not null unique check (redemption_code ~ '^KHI-[A-F0-9]{32}$')
);
alter table public.drops enable row level security;
alter table public.drop_claims enable row level security;
alter table private.claim_secrets enable row level security;
revoke all on public.drops, public.drop_claims, private.claim_secrets from public, anon, authenticated;
commit;
