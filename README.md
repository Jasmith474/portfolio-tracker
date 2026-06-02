# Smith Portfolio Tracker

Personal tech & semiconductor portfolio tracker for Jordan + Emily.

## What's in here

- **Jordan**: Individual TOD, BrokerageLink (401k), BrokerageLink Roth, HSA
- **Emily**: BrokerageLink (QQQM, SOXX, SMH)
- **Household**: Combined view with VTI benchmark comparison
- Live prices via FMP API (falls back to demo data without a key)

---

## Deploy in 3 steps

### Step 1 — Get a free FMP API key (2 min)
1. Go to https://financialmodelingprep.com/developer/docs
2. Sign up for free (250 calls/day — more than enough)
3. Copy your API key

### Step 2 — Add your API key
1. Rename `.env.example` to `.env`
2. Replace `your_fmp_api_key_here` with your actual key

### Step 3 — Deploy to Vercel (5 min)
1. Create account at https://github.com (if you don't have one)
2. Create account at https://vercel.com (sign in with GitHub)
3. Push this folder to a new GitHub repo:
   ```
   git init
   git add .
   git commit -m "init"
   git remote add origin https://github.com/YOUR_USERNAME/portfolio-tracker.git
   git push -u origin main
   ```
4. In Vercel: "Add New Project" → import your repo → **add environment variable**:
   - Key: `VITE_FMP_KEY`
   - Value: your FMP key
5. Click Deploy → your app is live at `your-project.vercel.app`

### Pin to iPhone home screen
1. Open the Vercel URL in Safari
2. Tap the Share button (box with arrow)
3. Tap "Add to Home Screen"
4. Name it "Portfolio" → Add
Done — it opens fullscreen like a native app.

---

## Running locally (optional)
```
npm install
npm run dev
```
Open http://localhost:5173

---

## Updating positions
Edit `src/positions.js` — the `JORDAN_ACCOUNTS` and `EMILY_POSITIONS` objects.
Commit and push → Vercel auto-redeploys.
