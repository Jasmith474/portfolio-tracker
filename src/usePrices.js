import { useState, useEffect } from 'react'
import { ALL_TICKERS } from './positions.js'

const FMP_KEY = import.meta.env.VITE_FMP_KEY || 'demo'
const CACHE_TTL = 5 * 60 * 1000 // 5 min cache

function getCached() {
  try {
    const raw = sessionStorage.getItem('prices_cache')
    if (!raw) return null
    const { ts, data } = JSON.parse(raw)
    if (Date.now() - ts < CACHE_TTL) return data
  } catch { /* ignore */ }
  return null
}

function setCache(data) {
  try {
    sessionStorage.setItem('prices_cache', JSON.stringify({ ts: Date.now(), data }))
  } catch { /* ignore */ }
}

// Fallback demo prices if no API key
const DEMO_PRICES = {
  QQQM:  { price: 306.53, change: 2.57,  changePct: 0.84 },
  SOXX:  { price: 574.82, change: 5.74,  changePct: 1.01 },
  AVGO:  { price: 460.53, change: 13.76, changePct: 3.08 },
  MU:    { price: 1037.48,change: 66.48, changePct: 6.84 },
  SMH:   { price: 238.90, change: 4.20,  changePct: 1.79 },
  FNCMX: { price: 342.99, change: 0.72,  changePct: 0.21 },
  FSELX: { price: 67.57,  change: -0.34, changePct: -0.50},
  VTI:   { price: 272.40, change: 1.82,  changePct: 0.67 },
}

// Historical return % since Apr 5 2025 (demo — replaced by live when API key present)
const DEMO_PERIOD_RETURNS = {
  QQQM:  3.49,
  SOXX:  7.76,
  AVGO:  8.17,
  MU:    79.90,
  SMH:   8.90,
  FNCMX: 0.21,
  FSELX: 4.50,
  VTI:   2.10,
}

export function usePrices() {
  const [prices, setPrices] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isDemo, setIsDemo] = useState(false)

  useEffect(() => {
    async function fetchPrices() {
      // Try cache first
      const cached = getCached()
      if (cached) { setPrices(cached); setLoading(false); return }

      if (FMP_KEY === 'demo') {
        // No API key — use demo data
        const demoData = {}
        ALL_TICKERS.forEach(id => {
          demoData[id] = {
            ...DEMO_PRICES[id],
            periodReturn: DEMO_PERIOD_RETURNS[id],
          }
        })
        setPrices(demoData)
        setIsDemo(true)
        setLoading(false)
        return
      }

      try {
        const symbols = ALL_TICKERS.join(',')
        const res = await fetch(
          `https://financialmodelingprep.com/api/v3/quote/${symbols}?apikey=${FMP_KEY}`
        )
        if (!res.ok) throw new Error(`FMP error ${res.status}`)
        const json = await res.json()

        const data = {}
        json.forEach(q => {
          data[q.symbol] = {
            price: q.price,
            change: q.change,
            changePct: q.changesPercentage,
            yearHigh: q.yearHigh,
            yearLow: q.yearLow,
            // FMP doesn't give period return directly — use ytd or compute from cost basis
            periodReturn: q.ytdReturn ?? null,
          }
        })
        setCache(data)
        setPrices(data)
      } catch (e) {
        console.error('FMP fetch failed, falling back to demo', e)
        const demoData = {}
        ALL_TICKERS.forEach(id => {
          demoData[id] = {
            ...DEMO_PRICES[id],
            periodReturn: DEMO_PERIOD_RETURNS[id],
          }
        })
        setPrices(demoData)
        setIsDemo(true)
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    fetchPrices()
  }, [])

  return { prices, loading, error, isDemo }
}
