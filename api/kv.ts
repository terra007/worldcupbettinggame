import { neon } from "@neondatabase/serverless";
import { randomUUID, createHash } from "crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

function hashPassword(name: string, password: string): string {
  return createHash("sha256").update(name.toLowerCase() + ":" + password + ":wm2026").digest("hex");
}

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

type Score = { h: number; a: number };
type BetMap = Record<string, Score>;
type AllBetsMap = Record<string, BetMap>;

// Derived from the same ISO strings as the frontend — no manual timestamp errors
const KICKOFFS: Record<string, number> = Object.fromEntries(([
  ["m01","2026-06-11T21:00:00Z"],["m02","2026-06-13T04:00:00Z"],
  ["m03","2026-06-13T22:00:00Z"],["m04","2026-06-13T22:00:00Z"],
  ["m05","2026-06-14T01:00:00Z"],["m06","2026-06-14T18:00:00Z"],
  ["m07","2026-06-14T21:00:00Z"],["m08","2026-06-14T23:00:00Z"],
  ["m09","2026-06-15T16:00:00Z"],["m10","2026-06-15T22:00:00Z"],
  ["m11","2026-06-15T22:00:00Z"],["m12","2026-06-16T04:00:00Z"],
  ["m13","2026-06-16T19:00:00Z"],["m14","2026-06-17T02:00:00Z"],
  ["m15","2026-06-17T07:00:00Z"],["m16","2026-06-17T21:00:00Z"],
  ["m17","2026-06-17T23:00:00Z"],["m18","2026-06-18T04:00:00Z"],
  ["m19","2026-06-19T01:00:00Z"],["m20","2026-06-19T03:00:00Z"],
  ["m21","2026-06-19T22:00:00Z"],["m22","2026-06-19T22:00:00Z"],
  ["m23","2026-06-20T01:00:00Z"],["m24","2026-06-20T20:00:00Z"],
  ["m25","2026-06-21T01:00:00Z"],["m26","2026-06-21T06:00:00Z"],
  ["m27","2026-06-21T16:00:00Z"],["m28","2026-06-21T22:00:00Z"],
  ["m29","2026-06-21T22:00:00Z"],["m30","2026-06-22T04:00:00Z"],
  ["m31","2026-06-22T18:00:00Z"],["m32","2026-06-23T00:00:00Z"],
  ["m33","2026-06-23T06:00:00Z"],["m34","2026-06-23T18:00:00Z"],
  ["m35","2026-06-23T20:00:00Z"],["m36","2026-06-23T23:00:00Z"],
  ["m37","2026-06-24T22:00:00Z"],["m38","2026-06-24T22:00:00Z"],
  ["m39","2026-06-24T22:00:00Z"],["m40","2026-06-25T03:00:00Z"],
  ["m41","2026-06-25T20:00:00Z"],["m42","2026-06-25T20:00:00Z"],
  ["m43","2026-06-26T00:00:00Z"],["m44","2026-06-26T05:00:00Z"],
  ["m45","2026-06-26T19:00:00Z"],["m46","2026-06-27T01:00:00Z"],
  ["m47","2026-06-27T02:00:00Z"],["m48","2026-06-27T06:00:00Z"],
  ["m49","2026-06-27T06:00:00Z"],["m50","2026-06-27T21:00:00Z"],
  ["m51","2026-06-27T21:00:00Z"],["m52","2026-06-27T23:30:00Z"],
  ["m53","2026-06-28T03:00:00Z"],["m54","2026-06-28T03:00:00Z"],
  ["m55","2026-07-04T22:00:00Z"],["m56","2026-07-05T02:00:00Z"],
  ["m57","2026-07-05T22:00:00Z"],["m58","2026-07-06T02:00:00Z"],
  ["m59","2026-07-06T22:00:00Z"],["m60","2026-07-07T02:00:00Z"],
  ["m61","2026-07-07T22:00:00Z"],["m62","2026-07-08T02:00:00Z"],
  ["m63","2026-07-08T22:00:00Z"],["m64","2026-07-09T02:00:00Z"],
  ["m65","2026-07-09T22:00:00Z"],["m66","2026-07-10T02:00:00Z"],
  ["m67","2026-07-10T22:00:00Z"],["m68","2026-07-11T02:00:00Z"],
  ["m69","2026-07-11T22:00:00Z"],["m70","2026-07-12T02:00:00Z"],
  ["m71","2026-07-13T22:00:00Z"],["m72","2026-07-14T02:00:00Z"],
  ["m73","2026-07-14T22:00:00Z"],["m74","2026-07-15T02:00:00Z"],
  ["m75","2026-07-15T22:00:00Z"],["m76","2026-07-16T02:00:00Z"],
  ["m77","2026-07-16T22:00:00Z"],["m78","2026-07-17T02:00:00Z"],
  ["m79","2026-07-18T22:00:00Z"],["m80","2026-07-19T02:00:00Z"],
  ["m81","2026-07-19T22:00:00Z"],["m82","2026-07-20T02:00:00Z"],
  ["m83","2026-07-22T23:00:00Z"],["m84","2026-07-23T23:00:00Z"],
  ["m85","2026-07-25T19:00:00Z"],["m86","2026-07-26T20:00:00Z"],
] as [string, string][]).map(([id, d]) => [id, new Date(d).getTime()]));

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

      // All bets without kickoff filter — used for the Pool Picks overview tab
      if (action === "poolbets") {
        const rows = await sql`
          SELECT player_name, match_id, home_score, away_score FROM bets WHERE pool_id = ${poolId}`;
        const all: AllBetsMap = {};
        rows.forEach(r => {
          const name = r.player_name as string;
          if (!all[name]) all[name] = {};
          all[name][r.match_id as string] = { h: r.home_score as number, a: r.away_score as number };
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
        const { name, password, token } = body as { name: string; password: string; token: string };
        if (!name || !token) return res.status(400).json({ error: "Name and token required" });
        if (!password) return res.status(400).json({ error: "Password required" });

        const hash = hashPassword(name, password);

        // SELECT — gracefully handle pre-migration DB (no password_hash column yet)
        const existing = await sql`SELECT token FROM players WHERE name = ${name}`;
        let storedHash: string | null = null;
        if (existing.length) {
          try {
            const pw = await sql`SELECT password_hash FROM players WHERE name = ${name}`;
            storedHash = (pw[0]?.password_hash as string | null) ?? null;
          } catch { /* column not yet added — treat as legacy */ }
        }

        if (!existing.length) {
          // New player — try with password_hash, fall back if column missing
          try {
            await sql`INSERT INTO players (name, token, password_hash) VALUES (${name}, ${token}, ${hash})`;
          } catch {
            await sql`INSERT INTO players (name, token) VALUES (${name}, ${token})`;
          }
          return res.status(200).json({ ok: true, token });
        }

        if (storedHash === null) {
          // Legacy player — claim the account; store password if column exists
          try {
            await sql`UPDATE players SET token = ${token}, password_hash = ${hash} WHERE name = ${name}`;
          } catch {
            await sql`UPDATE players SET token = ${token} WHERE name = ${name}`;
          }
          return res.status(200).json({ ok: true, token });
        }

        if (storedHash !== hash) {
          return res.status(403).json({ error: "Wrong password — try again" });
        }

        // Correct password — issue a fresh session token
        await sql`UPDATE players SET token = ${token} WHERE name = ${name}`;
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
