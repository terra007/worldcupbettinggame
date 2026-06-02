-- World Cup 2026 Betting Pool — Neon Postgres schema
-- Run this in the Neon SQL Editor (app.neon.tech → your project → SQL Editor).

create table if not exists pool_config (
  id int primary key default 1,
  pool_name text not null default 'World Cup 2026 Pool',
  organizer_code text not null default '',
  constraint single_row check (id = 1)
);

create table if not exists players (
  name text primary key,
  joined_at timestamptz not null default now()
);

create table if not exists bets (
  player_name text not null,
  match_id text not null,
  home_score int not null,
  away_score int not null,
  primary key (player_name, match_id)
);

create table if not exists results (
  match_id text primary key,
  home_score int not null,
  away_score int not null
);
