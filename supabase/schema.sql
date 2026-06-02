-- World Cup 2026 Betting Pool — Supabase schema
-- Run this in the Supabase SQL editor for your project.

-- Pool name and organizer code (single row, id always = 1)
create table if not exists pool_config (
  id int primary key default 1,
  pool_name text not null default 'World Cup 2026 Pool',
  organizer_code text not null default '',
  constraint single_row check (id = 1)
);

-- One row per player
create table if not exists players (
  name text primary key,
  joined_at timestamptz not null default now()
);

-- One row per player × match prediction
create table if not exists bets (
  player_name text not null,
  match_id text not null,
  home_score int not null,
  away_score int not null,
  primary key (player_name, match_id),
  constraint valid_bet_scores check (home_score >= 0 and away_score >= 0)
);

-- One row per finished match
create table if not exists results (
  match_id text primary key,
  home_score int not null,
  away_score int not null,
  constraint valid_result_scores check (home_score >= 0 and away_score >= 0)
);

-- ---------------------------------------------------------------
-- Row Level Security
-- Identity in this app is name-based (no Supabase Auth).
-- The anon key is intentionally public; the organizer "secret"
-- is enforced client-side (same trust level as the old Redis setup).
-- ---------------------------------------------------------------
alter table pool_config enable row level security;
alter table players    enable row level security;
alter table bets       enable row level security;
alter table results    enable row level security;

create policy "public_all_config"  on pool_config for all using (true) with check (true);
create policy "public_all_players" on players    for all using (true) with check (true);
create policy "public_all_bets"    on bets       for all using (true) with check (true);
create policy "public_all_results" on results    for all using (true) with check (true);
