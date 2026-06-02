# World Cup 2026 Betting Pool

A self-hosted prediction pool for the 2026 FIFA World Cup. Friends/colleagues open one
link, pick a name, and predict scores. The organizer logs results and everyone shares a
live leaderboard.

- **Frontend:** a single static `index.html` (no build step).
- **Backend:** one serverless function `api/kv.js` storing shared data in **Upstash Redis**.
- **Per-device memory:** each person's own name is kept in their browser's `localStorage`.

Scoring: exact score **+5**, correct goal difference **+3**, correct winner/draw **+2**,
wrong **0**. Predictions lock automatically at kickoff. Kickoff times render in each
viewer's local timezone. 54 confirmed group-stage matches are included.

---

## What gets stored

| Key                | Meaning                                   |
|--------------------|-------------------------------------------|
| `player:<name>`    | one key per player (used to build roster) |
| `bets:<name>`      | that player's predictions (JSON)          |
| `results`          | final scores, set by the organizer (JSON) |
| `config`           | pool name + organizer code (JSON)         |

All of this lives in your own Redis store — nobody else can wipe it, and the link never
changes.

---

## Deploy in ~5 minutes

### 1. Put the code on GitHub
```bash
cd worldcup-2026-pool
git init
git add .
git commit -m "World Cup 2026 pool"
git branch -M main
git remote add origin https://github.com/<you>/worldcup-2026-pool.git
git push -u origin main
```
(Or just drag the folder into a new repo via GitHub's web uploader — `node_modules`
is git-ignored, so don't upload it.)

### 2. Import into Vercel
1. Go to **vercel.com → Add New → Project** and import the GitHub repo.
2. Framework preset: **Other** (it's static + serverless functions; no build needed).
3. Click **Deploy**. It will deploy, but the pool won't save yet — add storage next.

### 3. Add the database (Upstash Redis)
1. In your Vercel project, open the **Storage** tab → **Create / Connect Database**.
2. Choose **Upstash → Redis** from the Marketplace and connect it to this project.
   - The free plan (256 MB, 30k commands/day) is far more than this needs.
3. Vercel automatically injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` as env vars.
4. **Redeploy** the project (Deployments → ⋯ → Redeploy) so the function picks them up.

### 4. Share the URL
Send the deployment URL (e.g. `https://worldcup-2026-pool.vercel.app`) to your colleagues.
Anyone with the link can join, predict, and appear on the leaderboard — no account needed.

### 5. Become the organizer
Open the **Organizer** tab, set a pool name and a secret code, then log each final score
as games finish. The leaderboard recalculates for everyone instantly.

---

## Run locally (optional)
```bash
npm install
npm i -g vercel
vercel link            # link to your Vercel project
vercel env pull        # pulls KV_REST_API_URL / KV_REST_API_TOKEN into .env
vercel dev             # serves index.html + /api/kv at http://localhost:3000
```

## Notes
- Updating the app later just means pushing to GitHub — Vercel redeploys and the **same
  URL and the same data are kept**. (Unlike a Claude artifact, redeploying does *not* wipe
  the pool.)
- Identity is name-based (no logins), which is fine for a private pool among people you know.
- To reset the whole pool, clear the keys in the Upstash console.
