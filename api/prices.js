export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const key = process.env.VITE_FMP_KEY
  if (!key) return res.status(500).json({ error: 'No FMP key' })
  const symbols = ['QQQM','SOXX','AVGO','MU','SMH','FNCMX','FSELX','VTI']
  try {
    const results = await Promise.all(
      symbols.map(async (sym) => {
        const url = `https://financialmodelingprep.com/stable/quote?symbol=${sym}&apikey=${key}`
        const r = await fetch(url)
        if (!r.ok) throw new Error(`FMP ${r.status} for ${sym}`)
        const json = await r.json()
        const q = Array.isArray(json) ? json[0] : json
        return [sym, { price: q?.price, change: q?.change, changePct: q?.changesPercentage }]
      })
    )
    const data = Object.fromEntries(results)
    res.setHeader('Cache-Control', 's-maxage=300')
    return res.status(200).json(data)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
