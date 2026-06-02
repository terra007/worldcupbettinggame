-- World Cup 2026 Pool — organizer seed
-- Run this ONCE in the Neon SQL Editor, AFTER schema.sql.
-- Replace REPLACE_WITH_YOUR_CODE with a secret only you know.

INSERT INTO pool_config (id, pool_name, organizer_code)
VALUES (1, 'World Cup 2026 — Max', 'REPLACE_WITH_YOUR_CODE')
ON CONFLICT (id) DO UPDATE SET
  pool_name     = EXCLUDED.pool_name,
  organizer_code = EXCLUDED.organizer_code;

INSERT INTO players (name) VALUES ('Max')
ON CONFLICT (name) DO NOTHING;
