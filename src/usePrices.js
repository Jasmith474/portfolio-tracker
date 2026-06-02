import { useState, useEffect } from 'react'

const CACHE_TTL = 5 * 60 * 1000

function getCached() {
  try {
    const raw = sessionStorage.getItem('prices_cache')
    if (!raw) return null
    const { ts, data } = JSON.parse(raw)
    if (Date.now() - ts < CACHE_TTL) return data
  } catch { }
  return null
}

function setCache(data) {
  try {
    sessionStorage.setItem('prices_cache', JSON.stringify({ ts: Date.now(), data }))
  } catch { }
}

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

function fallbackDemo() {
  const data = {}
  Object.entries(DEMO_PRICES).forEach(([id, p]) => { data[id] = p })
  return data
}

export function usePrices() {
  const [prices, setPrices] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(false)

  useEffect(() => {
    async function fetchPrices() {
      const cached = getCached()
      if (cached) { setPrices(cached); setIsDemo(false); setLoading(false); return }
      try {
        const res = await fetch('/api/prices')
        if (!res.ok) throw new Error(`Proxy error ${res.status}`)
        const data = await res.json()
        if (!data || data.error || Object.keys(data).length === 0) throw new Error(data?.error || 'Empty')
        setCache(data)
        setPrices(data)
        setIsDemo(false)
      } catch (e) {
        console.warn('Live prices unavailable:', e.message)
        setPrices(fallbackDemo())
        setIsDemo(true)
      } finally {
        setLoading(false)
      }
    }
    fetchPrices()
  }, [])

  return { prices, loading, isDemo }
}
