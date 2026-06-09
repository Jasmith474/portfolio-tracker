// api/prices.js — Smith Portfolio price proxy
// Uses Yahoo Finance for both quotes and history (no API key required)

const SYMBOLS = ['QQQM','SOXX','AVGO','MU','SMH','FNCMX','FSELX','VTI']
const YF_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart'

// Map our range labels to Yahoo Finance range param
const YF_RANGE = {
  '1W': '5d',
  '1M': '1mo',
  '3M': '3mo',
  '6M': '6mo',
  '1Y': '1y',
  'ALL': '5y',
}

const HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0'
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  const mode  = req.query.mode  || 'quotes'
  const range = req.query.range || '3M'

  try {
    // ── MODE 1: current quotes (card prices) ─────────────────────────────────
    if (mode === 'quotes') {
      const results = await Promise.all(
        SYMBOLS.map(async sym => {
          const url = `${YF_BASE}/${sym}?interval=1d&range=1d`
          const r = await fetch(url, { headers: HEADERS })
          const json = await r.json()
          const meta = json.chart.result[0].meta
          const price     = meta.regularMarketPrice
          const prev      = meta.previousClose || meta.chartPreviousClose
          const change    = price - prev
          const changePct = (change / prev) * 100
          return [sym, { price, change, changePct }]
        })
      )
      const data = Object.fromEntries(results)
      res.setHeader('Cache-Control', 's-maxage=300')
      return res.status(200).json(data)
    }

    // ── MODE 2: historical OHLCV for chart ────────────────────────────────────
    if (mode === 'history') {
      const yfRange = YF_RANGE[range] || '3mo'

      const results = await Promise.all(
        SYMBOLS.map(async sym => {
          const url = `${YF_BASE}/${sym}?interval=1d&range=${yfRange}`
          const r = await fetch(url, { headers: HEADERS })
          const json = await r.json()
          const result = json.chart.result[0]
          const timestamps = result.timestamp || []
          const closes     = result.indicators.quote[0].close || []

          // Build [{date, close}] array, skip nulls
          const series = timestamps
            .map((ts, i) => ({
              date:  new Date(ts * 1000).toISOString().split('T')[0],
              close: closes[i]
            }))
            .filter(pt => pt.close != null)

          return [sym, series]
        })
      )

      const data = Object.fromEntries(results)
      res.setHeader('Cache-Control', 's-maxage=3600')
      return res.status(200).json(data)
    }

    return res.status(400).json({ error: 'Invalid mode' })

  } catch (e) {
    console.error('prices handler error:', e.message)
    return res.status(500).json({ error: e.message })
  }
}
