// src/usePrices.js
import { useState, useEffect, useCallback } from 'react'

const QUOTE_TTL   = 300_000   // 5 min
const HISTORY_TTL = 3_600_000 // 1 hour

// ── session cache helpers ─────────────────────────────────────────────────────
function readCache(key, ttl) {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const { ts, data } = JSON.parse(raw)
    if (Date.now() - ts < ttl) return data
  } catch {}
  return null
}
function writeCache(key, data) {
  try { sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })) } catch {}
}

// ── demo fallbacks ────────────────────────────────────────────────────────────
const DEMO_QUOTES = {
  QQQM:  { price: 491.52, change:  2.57, changePct:  0.84 },
  SOXX:  { price: 562.14, change:  5.74, changePct:  1.01 },
  AVGO:  { price: 392.16, change: 13.76, changePct:  3.08 },
  MU:    { price: 121.67, change:  1.48, changePct:  1.23 },
  SMH:   { price: 238.90, change:  4.20, changePct:  1.79 },
  FNCMX: { price: 342.99, change:  0.72, changePct:  0.21 },
  FSELX: { price:  67.57, change: -0.34, changePct: -0.50 },
  VTI:   { price: 272.40, change:  1.82, changePct:  0.67 },
}

// Build minimal demo history (flat line from cost-basis-ish prices)
function makeDemoHistory(range) {
  const days = { '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365, 'ALL': 730 }[range] || 90
  const starts = { QQQM: 296, SOXX: 536, AVGO: 426, MU: 74.97/0.13, SMH: 220, FNCMX: 342, FSELX: 65, VTI: 260 }
  const ends   = { QQQM: 491, SOXX: 562, AVGO: 392, MU: 121, SMH: 239, FNCMX: 343, FSELX: 67.5, VTI: 272 }

  const result = {}
  Object.keys(starts).forEach(sym => {
    const s = starts[sym], e = ends[sym]
    result[sym] = Array.from({ length: days }, (_, i) => {
      const t = i / (days - 1)
      const date = new Date()
      date.setDate(date.getDate() - (days - 1 - i))
      return { date: date.toISOString().split('T')[0], close: +(s + (e - s) * t).toFixed(2) }
    })
  })
  return result
}

// ── main hook ─────────────────────────────────────────────────────────────────
export function usePrices() {
  const [quotes,  setQuotes]  = useState(null)
  const [history, setHistory] = useState({})   // keyed by range string
  const [loadingQuotes,  setLoadingQuotes]  = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [isDemo, setIsDemo] = useState(false)

  // Fetch current quotes once on mount
  useEffect(() => {
    async function fetchQuotes() {
      const cached = readCache('quotes', QUOTE_TTL)
      if (cached) { setQuotes(cached); setIsDemo(false); setLoadingQuotes(false); return }

      try {
        const res = await fetch('/api/prices?mode=quotes')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!data || data.error || Object.keys(data).length === 0) throw new Error('Empty')
        writeCache('quotes', data)
        setQuotes(data)
        setIsDemo(false)
      } catch (e) {
        console.warn('Live quotes failed:', e.message)
        setQuotes(DEMO_QUOTES)
        setIsDemo(true)
      }
      setLoadingQuotes(false)
    }
    fetchQuotes()
  }, [])

  // Fetch historical data for a given range (called from App when range changes)
  const fetchHistory = useCallback(async (range) => {
    // Already have it cached in state?
    if (history[range]) return

    // Check session cache
    const cacheKey = `history_${range}`
    const cached = readCache(cacheKey, HISTORY_TTL)
    if (cached) { setHistory(prev => ({ ...prev, [range]: cached })); return }

    setLoadingHistory(true)
    try {
      const res = await fetch(`/api/prices?mode=history&range=${range}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (!data || data.error) throw new Error('Bad history response')
      writeCache(cacheKey, data)
      setHistory(prev => ({ ...prev, [range]: data }))
    } catch (e) {
      console.warn(`History fetch failed for ${range}:`, e.message)
      // Fall back to demo history so chart always renders
      setHistory(prev => ({ ...prev, [range]: makeDemoHistory(range) }))
    }
    setLoadingHistory(false)
  }, [history])

  return {
    prices: quotes,           // current quote data (cards)
    history,                  // { '1W': {...}, '3M': {...}, ... }
    fetchHistory,             // call this when range changes
    loading: loadingQuotes,
    loadingHistory,
    isDemo,
  }
}
