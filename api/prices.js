export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const symbols = ['QQQM','SOXX','AVGO','MU','SMH','FNCMX','FSELX','VTI']
  try {
    const pairs = await Promise.all(symbols.map(async function(s) {
      const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + s + '?interval=1d&range=1d'
      const r = await fetch(url, { headers: { 'Accept': 'application/json' } })
      const json = await r.json()
      const meta = json.chart.result[0].meta
      const price = meta.regularMarketPrice
      const prev = meta.previousClose
      const change = price - prev
      const changePct = (change / prev) * 100
      return [s, { price: price, change: change, changePct: changePct }]
    }))
    const data = Object.fromEntries(pairs)
    res.setHeader('Cache-Control', 's-maxage=300')
    return res.status(200).json(data)
  } catch(e) {
    return res.status(500).json({ error: e.message })
  }
}