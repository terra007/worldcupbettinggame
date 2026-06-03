import { neon } from "@neondatabase/serverless";
import { randomUUID } from "crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

type Score = { h: number; a: number };
type BetMap = Record<string, Score>;
type AllBetsMap = Record<string, BetMap>;

// Kickoff times (ms UTC) — used for server-side bet lock and allbets filtering
const KICKOFFS: Record<string, number> = {
  m01:1749675600000,m02:1749783600000,m03:1749859200000,m04:1749859200000,
  m05:1749869400000,m06:1749924000000,m07:1749934200000,m08:1749942000000,
  m09:1750003200000,m10:1750024800000,m11:1750024800000,m12:1750046400000,
  m13:1750100400000,m14:1750125600000,m15:1750143600000,m16:1750197600000,
  m17:1750204800000,m18:1750215600000,m19:1750294800000,m20:1750302000000,
  m21:1750377600000,m22:1750377600000,m23:1750388400000,m24:1750449600000,
  m25:1750467600000,m26:1750489200000,m27:1750521600000,m28:1750546800000,
  m29:1750546800000,m30:1750564800000,m31:1750604400000,m32:1750636800000,
  m33:1750658400000,m34:1750690800000,m35:1750697600000,m36:1750708800000,
  m37:1750809600000,m38:1750809600000,m39:1750809600000,m40:1750823400000,
  m41:1750888000000,m42:1750888000000,m43:1750900800000,m44:1750913400000,
  m45:1750964400000,m46:1751000400000,m47:1751004000000,m48:1751008800000,
  m49:1751008800000,m50:1751064000000,m51:1751064000000,m52:1751073000000,
  m53:1751084400000,m54:1751084400000,
  m55:1751752800000,m56:1751767200000,m57:1751839200000,m58:1751854800000,
  m59:1751925600000,m60:1751941200000,m61:1752012000000,m62:1752026400000,
  m63:1752098400000,m64:1752112800000,m65:1752184800000,m66:1752199200000,
  m67:1752271200000,m68:1752285600000,m69:1752357600000,m70:1752372000000,
  m71:1752530400000,m72:1752544800000,m73:1752616800000,m74:1752631200000,
  m75:1752703200000,m76:1752717600000,m77:1752789600000,m78:1752804000000,
  m79:1752962400000,m80:1752976800000,m81:1753048800000,m82:1753063200000,
  m83:1753228800000,m84:1753315200000,m85:1753466400000,m86:1753552800000,
};

function randomCode(len = 7): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (!sql) return res.status(500).json({ error: "DATABASE_URL not set." });

  try {
    // ── GET ──────────────────────────────────────────────────────────────
    if (req.method === "GET") {
      const { action, player, poolId, code } = req.query as Record<string, string>;

      if (action === "creators") {
        const rows = await sql`SELECT name FROM pool_creators ORDER BY granted_at`;
        return res.status(200).json({ creators: rows.map(r => r.name) });
      }

      if (action === "pools") {
        const rows = await sql`
          SELECT p.id, p.name, p.invite_code, p.owner_name
          FROM pools p JOIN pool_members m ON m.pool_id = p.id
          WHERE m.player_name = ${player} ORDER BY p.created_at DESC`;
        return res.status(200).json({ pools: rows });
      }

      if (action === "poolByCode") {
        const rows = await sql`
          SELECT id, name, owner_name, invite_code
          FROM pools WHERE invite_code = ${(code || "").toUpperCase()}`;
        if (!rows.length) return res.status(404).json({ error: "Pool not found" });
        return res.status(200).json(rows[0]);
      }

      if (action === "members") {
        const rows = await sql`
          SELECT player_name FROM pool_members WHERE pool_id = ${poolId} ORDER BY joined_at`;
        return res.status(200).json({ players: rows.map(r => r.player_name) });
      }

      if (action === "bets") {
        const rows = await sql`
          SELECT match_id, home_score, away_score FROM bets
          WHERE pool_id = ${poolId} AND player_name = ${player}`;
        const bets: BetMap = {};
        rows.forEach(r => { bets[r.match_id as string] = { h: r.home_score as number, a: r.away_score as number }; });
        return res.status(200).json({ bets });
      }

      if (action === "allbets") {
        // Only expose bets for matches that have already kicked off — prevents peeking
        const now = Date.now();
        const rows = await sql`
          SELECT player_name, match_id, home_score, away_score FROM bets WHERE pool_id = ${poolId}`;
        const all: AllBetsMap = {};
        rows.forEach(r => {
          const matchId = r.match_id as string;
          const kickoff = KICKOFFS[matchId];
          if (kickoff && now < kickoff) return; // hide bets for future matches
          const name = r.player_name as string;
          if (!all[name]) all[name] = {};
          all[name][matchId] = { h: r.home_score as number, a: r.away_score as number };
        });
        return res.status(200).json({ bets: all });
      }

      if (action === "matchNames") {
        const rows = await sql`
          SELECT match_id, home, away FROM match_names WHERE pool_id = ${poolId}`;
        const names: Record<string, {h: string; a: string}> = {};
        rows.forEach(r => { names[r.match_id as string] = { h: r.home as string, a: r.away as string }; });
        return res.status(200).json({ names });
      }

      if (action === "results") {
        const rows = await sql`
          SELECT match_id, home_score, away_score FROM results WHERE pool_id = ${poolId}`;
        const results: BetMap = {};
        rows.forEach(r => { results[r.match_id as string] = { h: r.home_score as number, a: r.away_score as number }; });
        return res.status(200).json({ results });
      }

      return res.status(400).json({ error: "unknown action" });
    }

    // ── POST ─────────────────────────────────────────────────────────────
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
      const { action } = body as { action: string };

      if (action === "register") {
        const { name, token } = body as { name: string; token: string };
        if (!name || !token) return res.status(400).json({ error: "name and token required" });

        const existing = await sql`SELECT token FROM players WHERE name = ${name}`;
        if (existing.length) {
          const stored = existing[0].token as string | null;
          if (stored === null) {
            // Legacy player with no token — claim it (one-time migration window)
            await sql`UPDATE players SET token = ${token} WHERE name = ${name}`;
            return res.status(200).json({ ok: true, token });
          }
          if (stored === token) return res.status(200).json({ ok: true, token });
          return res.status(409).json({ error: "Name already taken — choose a different one" });
        }

        await sql`INSERT INTO players (name, token) VALUES (${name}, ${token})`;
        return res.status(200).json({ ok: true, token });
      }

      if (action === "joinPool") {
        const { inviteCode, playerName } = body as { inviteCode: string; playerName: string };
        const code = (inviteCode || "").toUpperCase();
        const pools = await sql`SELECT id FROM pools WHERE invite_code = ${code}`;
        if (!pools.length) return res.status(404).json({ error: "Pool not found" });
        const poolId = pools[0].id as string;
        await sql`INSERT INTO players (name, token) VALUES (${playerName}, ${null}) ON CONFLICT (name) DO NOTHING`;
        await sql`INSERT INTO pool_members (pool_id, player_name) VALUES (${poolId}, ${playerName}) ON CONFLICT DO NOTHING`;
        return res.status(200).json({ ok: true });
      }

      if (action === "createPool") {
        const { name, organizerCode, ownerName } = body as { name: string; organizerCode: string; ownerName: string };
        const allowed = await sql`SELECT name FROM pool_creators WHERE name = ${ownerName}`;
        if (!allowed.length) return res.status(403).json({ error: "Not allowed to create pools" });
        const id = randomUUID();
        const inviteCode = randomCode(7);
        await sql`
          INSERT INTO pools (id, name, invite_code, organizer_code, owner_name)
          VALUES (${id}, ${name}, ${inviteCode}, ${organizerCode}, ${ownerName})`;
        await sql`INSERT INTO pool_members (pool_id, player_name) VALUES (${id}, ${ownerName}) ON CONFLICT DO NOTHING`;
        return res.status(200).json({ poolId: id, inviteCode });
      }

      if (action === "verifyOrgCode") {
        const { poolId, code } = body as { poolId: string; code: string };
        const rows = await sql`SELECT id FROM pools WHERE id = ${poolId} AND organizer_code = ${code}`;
        return res.status(200).json({ valid: rows.length > 0 });
      }

      if (action === "saveBet") {
        const { poolId, playerName, playerToken, matchId, h, a } =
          body as { poolId: string; playerName: string; playerToken: string; matchId: string; h: number; a: number };

        // Verify player token
        const player = await sql`SELECT token FROM players WHERE name = ${playerName}`;
        if (!player.length) return res.status(404).json({ error: "Player not found" });
        if (player[0].token !== playerToken) return res.status(403).json({ error: "Invalid token — reload the app" });

        // Server-side kickoff lock
        const kickoff = KICKOFFS[matchId];
        if (kickoff && Date.now() >= kickoff) {
          return res.status(403).json({ error: "Predictions locked — match has started" });
        }

        await sql`
          INSERT INTO bets (pool_id, player_name, match_id, home_score, away_score)
          VALUES (${poolId}, ${playerName}, ${matchId}, ${h}, ${a})
          ON CONFLICT (pool_id, player_name, match_id)
          DO UPDATE SET home_score = ${h}, away_score = ${a}`;
        return res.status(200).json({ ok: true });
      }

      if (action === "saveMatchName") {
        const { poolId, matchId, home, away, code } = body as { poolId: string; matchId: string; home: string; away: string; code: string };
        const ok = await sql`SELECT id FROM pools WHERE id = ${poolId} AND organizer_code = ${code}`;
        if (!ok.length) return res.status(403).json({ error: "Wrong organizer code" });
        await sql`
          INSERT INTO match_names (pool_id, match_id, home, away)
          VALUES (${poolId}, ${matchId}, ${home}, ${away})
          ON CONFLICT (pool_id, match_id)
          DO UPDATE SET home = ${home}, away = ${away}`;
        return res.status(200).json({ ok: true });
      }

      if (action === "saveResult") {
        const { poolId, matchId, h, a, code } = body as { poolId: string; matchId: string; h: number; a: number; code: string };
        const ok = await sql`SELECT id FROM pools WHERE id = ${poolId} AND organizer_code = ${code}`;
        if (!ok.length) return res.status(403).json({ error: "Wrong organizer code" });
        await sql`
          INSERT INTO results (pool_id, match_id, home_score, away_score)
          VALUES (${poolId}, ${matchId}, ${h}, ${a})
          ON CONFLICT (pool_id, match_id)
          DO UPDATE SET home_score = ${h}, away_score = ${a}`;
        return res.status(200).json({ ok: true });
      }

      if (action === "clearResult") {
        const { poolId, matchId, code } = body as { poolId: string; matchId: string; code: string };
        const ok = await sql`SELECT id FROM pools WHERE id = ${poolId} AND organizer_code = ${code}`;
        if (!ok.length) return res.status(403).json({ error: "Wrong organizer code" });
        await sql`DELETE FROM results WHERE pool_id = ${poolId} AND match_id = ${matchId}`;
        return res.status(200).json({ ok: true });
      }

      if (action === "verifyAdminCode") {
        const { code } = body as { code: string };
        const rows = await sql`SELECT value FROM site_config WHERE key = 'admin_code' AND value = ${code}`;
        return res.status(200).json({ valid: rows.length > 0 });
      }

      if (action === "grantCreator") {
        const { name, adminCode } = body as { name: string; adminCode: string };
        const valid = await sql`SELECT value FROM site_config WHERE key = 'admin_code' AND value = ${adminCode}`;
        if (!valid.length) return res.status(403).json({ error: "Invalid admin code" });
        await sql`INSERT INTO players (name, token) VALUES (${name}, ${null}) ON CONFLICT (name) DO NOTHING`;
        await sql`INSERT INTO pool_creators (name) VALUES (${name}) ON CONFLICT (name) DO NOTHING`;
        return res.status(200).json({ ok: true });
      }

      if (action === "revokeCreator") {
        const { name, adminCode } = body as { name: string; adminCode: string };
        const valid = await sql`SELECT value FROM site_config WHERE key = 'admin_code' AND value = ${adminCode}`;
        if (!valid.length) return res.status(403).json({ error: "Invalid admin code" });
        if (name === "Max") return res.status(400).json({ error: "Cannot revoke Max" });
        await sql`DELETE FROM pool_creators WHERE name = ${name}`;
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: "unknown action" });
    }

    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: msg });
  }
}
