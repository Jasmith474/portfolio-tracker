// api/prices.js  –  Smith Portfolio price proxy
// Fetches current quotes + historical data for chart ranges
// Requires VITE_FMP_KEY environment variable in Vercel

const SYMBOLS = ['QQQM','SOXX','AVGO','MU','SMH','FNCMX','FSELX','VTI']
const BASE = 'https://financialmodelingprep.com/api/v3'

// How many calendar days back each range needs
const RANGE_DAYS = { '1W': 10, '1M': 35, '3M': 100, '6M': 190, '1Y': 370, 'ALL': 1500 }

function dateStr(daysBack) {
  const d = new Date()
  d.setDate(d.getDate() - daysBack)
  return d.toISOString().split('T')[0]
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  const key = process.env.VITE_FMP_KEY
  if (!key) return res.status(500).json({ error: 'Missing VITE_FMP_KEY' })

  const mode = req.query.mode || 'quotes'   // 'quotes' | 'history'
  const range = req.query.range || '3M'

  try {
    // ── MODE 1: current quotes (card prices) ─────────────────────────────────
    if (mode === 'quotes') {
      const url = `${BASE}/quote/${SYMBOLS.join(',')}?apikey=${key}`
      const r = await fetch(url)
      if (!r.ok) throw new Error(`FMP quotes ${r.status}`)
      const raw = await r.json()
      if (!Array.isArray(raw) || raw.length === 0) throw new Error('Empty quotes')

      const data = {}
      raw.forEach(q => {
        data[q.symbol] = {
          price:     q.price,
          change:    q.change,
          changePct: q.changesPercentage,
        }
      })

      res.setHeader('Cache-Control', 's-maxage=300')
      return res.status(200).json(data)
    }

    // ── MODE 2: historical OHLCV for chart ────────────────────────────────────
    if (mode === 'history') {
      const days = RANGE_DAYS[range] || 100
      const from = dateStr(days)
      const to   = dateStr(0)

      // Fetch all symbols in parallel
      const results = await Promise.all(
        SYMBOLS.map(async sym => {
          const url = `${BASE}/historical-price-full/${sym}?from=${from}&to=${to}&apikey=${key}`
          const r = await fetch(url)
          if (!r.ok) return [sym, []]
          const json = await r.json()
          // FMP returns { symbol, historical: [{date, open, high, low, close, volume},...] }
          // sorted newest-first — reverse to chronological
          const hist = (json.historical || []).reverse()
          return [sym, hist.map(d => ({ date: d.date, close: d.close }))]
        })
      )

      const data = Object.fromEntries(results)
      res.setHeader('Cache-Control', 's-maxage=3600') // history changes less often
      return res.status(200).json(data)
    }

    return res.status(400).json({ error: 'Invalid mode' })

  } catch (e) {
    console.error('prices handler error:', e.message)
    return res.status(500).json({ error: e.message })
  }
}
