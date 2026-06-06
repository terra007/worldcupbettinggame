-- World Cup 2026 — multi-pool schema
-- Run ONCE in Neon SQL Editor (replaces previous schema).

create table if not exists site_config (
  key   text primary key,
  value text not null
);

create table if not exists pool_creators (
  name       text primary key,
  granted_at timestamptz not null default now()
);

create table if not exists players (
  name          text primary key,
  token         text unique,
  password_hash text,
  joined_at     timestamptz not null default now()
);
-- For existing databases run once:
-- ALTER TABLE players ADD COLUMN IF NOT EXISTS password_hash text;

create table if not exists pools (
  id             text primary key,
  name           text not null,
  invite_code    text unique not null,
  organizer_code text not null,
  owner_name     text not null,
  created_at     timestamptz not null default now()
);

create table if not exists pool_members (
  pool_id     text not null references pools(id) on delete cascade,
  player_name text not null,
  joined_at   timestamptz not null default now(),
  primary key (pool_id, player_name)
);

create table if not exists bets (
  pool_id     text not null references pools(id) on delete cascade,
  player_name text not null,
  match_id    text not null,
  home_score  int  not null,
  away_score  int  not null,
  primary key (pool_id, player_name, match_id)
);

create table if not exists match_names (
  pool_id  text not null references pools(id) on delete cascade,
  match_id text not null,
  home     text not null,
  away     text not null,
  primary key (pool_id, match_id)
);

create table if not exists results (
  pool_id    text not null references pools(id) on delete cascade,
  match_id   text not null,
  home_score int  not null,
  away_score int  not null,
  primary key (pool_id, match_id)
);

create table if not exists bonus_picks (
  pool_id     text not null references pools(id) on delete cascade,
  player_name text not null,
  question_id text not null,
  answer      text not null,
  primary key (pool_id, player_name, question_id)
);

create table if not exists bonus_results (
  pool_id     text not null references pools(id) on delete cascade,
  question_id text not null,
  answer      text not null,
  primary key (pool_id, question_id)
);
