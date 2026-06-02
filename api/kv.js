import { neon } from "@neondatabase/serverless";

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (!sql) {
    return res.status(500).json({ error: "DATABASE_URL not set — add it in Vercel project settings." });
  }

  try {
    if (req.method === "GET") {
      const { action, player } = req.query;

      if (action === "config") {
        const rows = await sql`SELECT pool_name, organizer_code FROM pool_config WHERE id = 1`;
        return res.status(200).json(rows[0] || {});
      }

      if (action === "players") {
        const rows = await sql`SELECT name FROM players ORDER BY joined_at`;
        return res.status(200).json({ players: rows.map(r => r.name) });
      }

      if (action === "bets") {
        const rows = await sql`SELECT match_id, home_score, away_score FROM bets WHERE player_name = ${player}`;
        const bets = {};
        rows.forEach(r => { bets[r.match_id] = { h: r.home_score, a: r.away_score }; });
        return res.status(200).json({ bets });
      }

      if (action === "allbets") {
        const rows = await sql`SELECT player_name, match_id, home_score, away_score FROM bets`;
        const all = {};
        rows.forEach(r => {
          if (!all[r.player_name]) all[r.player_name] = {};
          all[r.player_name][r.match_id] = { h: r.home_score, a: r.away_score };
        });
        return res.status(200).json({ bets: all });
      }

      if (action === "results") {
        const rows = await sql`SELECT match_id, home_score, away_score FROM results`;
        const results = {};
        rows.forEach(r => { results[r.match_id] = { h: r.home_score, a: r.away_score }; });
        return res.status(200).json({ results });
      }

      return res.status(400).json({ error: "unknown action" });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
      const { action } = body;

      if (action === "saveConfig") {
        const { poolName, code } = body;
        await sql`
          INSERT INTO pool_config (id, pool_name, organizer_code) VALUES (1, ${poolName}, ${code})
          ON CONFLICT (id) DO UPDATE SET pool_name = ${poolName}, organizer_code = ${code}`;
        return res.status(200).json({ ok: true });
      }

      if (action === "addPlayer") {
        await sql`INSERT INTO players (name) VALUES (${body.name}) ON CONFLICT (name) DO NOTHING`;
        return res.status(200).json({ ok: true });
      }

      if (action === "saveBet") {
        const { playerName, matchId, h, a } = body;
        await sql`
          INSERT INTO bets (player_name, match_id, home_score, away_score) VALUES (${playerName}, ${matchId}, ${h}, ${a})
          ON CONFLICT (player_name, match_id) DO UPDATE SET home_score = ${h}, away_score = ${a}`;
        return res.status(200).json({ ok: true });
      }

      if (action === "saveResult") {
        const { matchId, h, a } = body;
        await sql`
          INSERT INTO results (match_id, home_score, away_score) VALUES (${matchId}, ${h}, ${a})
          ON CONFLICT (match_id) DO UPDATE SET home_score = ${h}, away_score = ${a}`;
        return res.status(200).json({ ok: true });
      }

      if (action === "clearResult") {
        await sql`DELETE FROM results WHERE match_id = ${body.matchId}`;
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: "unknown action" });
    }

    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
