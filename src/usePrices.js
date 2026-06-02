import { useState, useEffect } from 'react'

const FMP_KEY = import.meta.env.VITE_FMP_KEY
const CACHE_TTL = 300000

function getCached() {
  try {
    const raw = sessionStorage.getItem('prices_cache')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Date.now() - parsed.ts < CACHE_TTL) return parsed.data
  } catch(e) {}
  return null
}

function setCache(data) {
  try {
    sessionStorage.setItem('prices_cache', JSON.stringify({ ts: Date.now(), data: data }))
  } catch(e) {}
}

const DEMO = {
  QQQM:  { price: 306.53, change: 2.57,  changePct: 0.84 },
  SOXX:  { price: 574.82, change: 5.74,  changePct: 1.01 },
  AVGO:  { price: 460.53, change: 13.76, changePct: 3.08 },
  MU:    { price: 1037.48, change: 66.48, changePct: 6.84 },
  SMH:   { price: 238.90, change: 4.20,  changePct: 1.79 },
  FNCMX: { price: 342.99, change: 0.72,  changePct: 0.21 },
  FSELX: { price: 67.57,  change: -0.34, changePct: -0.50 },
  VTI:   { price: 272.40, change: 1.82,  changePct: 0.67 },
}

export function usePrices() {
  const [prices, setPrices] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(false)

  useEffect(function() {
    async function run() {
      const cached = getCached()
      if (cached) {
        setPrices(cached)
        setIsDemo(false)
        setLoading(false)
        return
      }
      if (!FMP_KEY) {
        setPrices(DEMO)
        setIsDemo(true)
        setLoading(false)
        return
      }
      try {
        const syms = ['QQQM','SOXX','AVGO','MU','SMH','FNCMX','FSELX','VTI']
        const pairs = await Promise.all(syms.map(async function(s) {
          const url = 'https://financialmodelingprep.com/stable/quote?symbol=' + s + '&apikey=' + FMP_KEY
          const res = await fetch(url)
          const json = await res.json()
          const q = Array.isArray(json) ? json[0] : json
          return [s, { price: q.price, change: q.change, changePct: q.changePercentage }]
        }))
        const data = Object.fromEntries(pairs)
        setCache(data)
        setPrices(data)
        setIsDemo(false)
      } catch(e) {
        setPrices(DEMO)
        setIsDemo(true)
      }
      setLoading(false)
    }
    run()
  }, [])

  return { prices: prices, loading: loading, isDemo: isDemo }
}