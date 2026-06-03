import { neon } from "@neondatabase/serverless";
import { randomUUID } from "crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

type Score = { h: number; a: number };
type BetMap = Record<string, Score>;
type AllBetsMap = Record<string, BetMap>;

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
        const { name } = body as { name: string };
        await sql`INSERT INTO players (name) VALUES (${name}) ON CONFLICT (name) DO NOTHING`;
        return res.status(200).json({ ok: true });
      }

      if (action === "joinPool") {
        const { inviteCode, playerName } = body as { inviteCode: string; playerName: string };
        const code = (inviteCode || "").toUpperCase();
        const pools = await sql`SELECT id FROM pools WHERE invite_code = ${code}`;
        if (!pools.length) return res.status(404).json({ error: "Pool not found" });
        const poolId = pools[0].id as string;
        await sql`INSERT INTO players (name) VALUES (${playerName}) ON CONFLICT (name) DO NOTHING`;
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
        const { poolId, playerName, matchId, h, a } = body as { poolId: string; playerName: string; matchId: string; h: number; a: number };
        await sql`
          INSERT INTO bets (pool_id, player_name, match_id, home_score, away_score)
          VALUES (${poolId}, ${playerName}, ${matchId}, ${h}, ${a})
          ON CONFLICT (pool_id, player_name, match_id)
          DO UPDATE SET home_score = ${h}, away_score = ${a}`;
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
        await sql`INSERT INTO players (name) VALUES (${name}) ON CONFLICT (name) DO NOTHING`;
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
