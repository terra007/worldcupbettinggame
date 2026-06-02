-- Run ONCE in Neon SQL Editor, AFTER schema.sql.
-- Replace both placeholder codes with your own secrets.

-- Max's admin code (used to grant/revoke pool-creation rights)
insert into site_config (key, value)
values ('admin_code', 'REPLACE_WITH_MAX_ADMIN_CODE')
on conflict (key) do update set value = excluded.value;

-- Max is the only one who can create pools by default
insert into pool_creators (name) values ('Max')
on conflict (name) do nothing;

insert into players (name) values ('Max')
on conflict (name) do nothing;
