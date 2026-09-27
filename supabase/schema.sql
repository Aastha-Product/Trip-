-- Plan Pakka schema. Run once in the Supabase SQL editor.
-- All access goes through the Next.js server with the service-role key, so RLS
-- is enabled with no policies: the anon key cannot read or write anything.

create table if not exists public.trips (
  id             uuid primary key,
  name           text not null,
  coordinator    text not null,
  admin_key      text not null,
  window_start   date not null,
  window_end     date not null,
  expected_size  int check (expected_size between 2 and 30),
  ideas          text not null default '',
  gen_state      text not null default 'idle' check (gen_state in ('idle', 'running')),
  gen_dirty      boolean not null default false,
  gen_started_at timestamptz,
  gen_error      text,
  locked         jsonb,
  created_at     timestamptz not null default now()
);

create table if not exists public.members (
  id         uuid primary key,
  trip_id    uuid not null references public.trips(id) on delete cascade,
  name       text not null,
  edit_key   text not null,
  prefs      jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists members_trip_name_uniq on public.members(trip_id, lower(name));

create table if not exists public.results (
  trip_id    uuid primary key references public.trips(id) on delete cascade,
  payload    jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.votes (
  trip_id    uuid not null references public.trips(id) on delete cascade,
  target_id  text not null,
  member_id  uuid not null references public.members(id) on delete cascade,
  value      text not null check (value in ('yes', 'no')),
  updated_at timestamptz not null default now(),
  primary key (trip_id, target_id, member_id)
);

alter table public.trips   enable row level security;
alter table public.members enable row level security;
alter table public.results enable row level security;
alter table public.votes   enable row level security;
