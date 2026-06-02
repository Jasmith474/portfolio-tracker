export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const key = process.env.VITE_FMP_KEY
  if (!key) return res.status(500).json({ error: 'No FMP key' })
  const symbols = ['QQQM','SOXX','AVGO','MU','SMH','FNCMX','FSELX','VTI']
  try {
    const url = `https://financialmodelingprep.com/api/v3/quote/${symbols.join(',')}?apikey=${key}`
    const fmpRes = await fetch(url)
    if (!fmpRes.ok) throw new Error(`FMP ${fmpRes.status}`)
    const json = await fmpRes.json()
    const data = {}
    if (Array.isArray(json)) {
      json.forEach(q => {
        data[q.symbol] = { price: q.price, change: q.change, changePct: q.changesPercentage }
      })
    }
    res.setHeader('Cache-Control', 's-maxage=300')
    return res.status(200).json(data)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
