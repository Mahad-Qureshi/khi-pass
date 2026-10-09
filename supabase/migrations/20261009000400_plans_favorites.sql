begin;
create table public.favorites (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  experience_id uuid not null references public.experiences(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, experience_id)
);
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  share_id text not null default encode(extensions.gen_random_bytes(32), 'hex') unique check (share_id ~ '^[a-f0-9]{64}$'),
  title text not null check (char_length(title) between 1 and 200),
  starts_at timestamptz, area_id uuid references public.areas(id),
  min_budget numeric(12,2) check (min_budget >= 0 and min_budget <> 'NaN'::numeric),
  max_budget numeric(12,2) check (max_budget >= 0 and max_budget <> 'NaN'::numeric),
  vibe_id uuid references public.vibes(id),
  group_type text check (group_type in ('solo','couple','friends','family','group')),
  group_size integer check (group_size between 1 and 100),
  status text not null default 'draft' check (status in ('draft','shared','closed','archived')),
  share_expires_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (max_budget is null or min_budget is null or max_budget >= min_budget)
);
create table public.plan_participants (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  nickname text not null check (char_length(btrim(nickname)) between 1 and 40),
  participant_token_hash bytea not null check (octet_length(participant_token_hash) = 32),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (plan_id, id), unique (plan_id, participant_token_hash)
);
create unique index plan_participants_signed_in_unique on public.plan_participants(plan_id, user_id) where user_id is not null;
create table public.plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  experience_id uuid not null references public.experiences(id),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (plan_id, id), unique (plan_id, experience_id)
);
create table public.plan_votes (
  plan_id uuid not null,
  participant_id uuid not null,
  plan_item_id uuid not null,
  vote text not null check (vote in ('yes','maybe','no')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key (participant_id, plan_item_id),
  foreign key (plan_id, participant_id) references public.plan_participants(plan_id, id) on delete cascade,
  foreign key (plan_id, plan_item_id) references public.plan_items(plan_id, id) on delete cascade
);

do $$ declare t text; begin
  foreach t in array array['favorites','plans','plan_participants','plan_items','plan_votes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
  end loop;
end $$;
commit;
