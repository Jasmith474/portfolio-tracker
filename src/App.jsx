import { useState, useCallback, useEffect, useRef } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts'
import { usePrices } from './usePrices.js'
import { JORDAN_ACCOUNTS, EMILY_POSITIONS, TICKER_META } from './positions.js'
import { fmtCur, fmtGain, fmtPct, accountTotal } from './utils.js'

// ─── CHART HELPERS ────────────────────────────────────────────────────────────

// Convert raw historical price arrays into % return series aligned by date
function buildChartData(tickerIds, historyForRange) {
  if (!historyForRange) return []
  const ids = [...new Set([...tickerIds, 'VTI'])]

  // Find the union of dates across all tickers (use VTI as anchor since it's most consistent)
  const anchor = historyForRange['VTI'] || historyForRange[tickerIds[0]] || []
  if (anchor.length === 0) return []

  return anchor.map((pt, i) => {
    const row = { date: formatDate(pt.date) }
    ids.forEach(id => {
      const series = historyForRange[id]
      if (!series || series.length === 0) return
      // Align by index (all series cover same date range from API)
      const base = series[0]?.close || 1
      const cur  = series[Math.min(i, series.length - 1)]?.close || base
      row[id] = +(((cur - base) / base) * 100).toFixed(2)
    })
    return row
  })
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Compute return% for a ticker over a historical series
function seriesReturn(series) {
  if (!series || series.length < 2) return 0
  const base = series[0].close
  const end  = series[series.length - 1].close
  return ((end - base) / base) * 100
}

// ─── ALERT STORAGE ───────────────────────────────────────────────────────────
function loadAlerts() {
  try { return JSON.parse(localStorage.getItem('price_alerts') || '{}') } catch { return {} }
}
function saveAlerts(alerts) {
  try { localStorage.setItem('price_alerts', JSON.stringify(alerts)) } catch {}
}

// ─── COMPONENTS ──────────────────────────────────────────────────────────────
const TAG_STYLE = {
  CORE:      { bg: '#e8f0fe', color: '#1a73e8' },
  SATELLITE: { bg: '#e6f4ea', color: '#1e8e3e' },
  BROKERAGE: { bg: '#fef7e0', color: '#b06000' },
  BENCHMARK: { bg: '#f1f3f4', color: '#5f6368' },
}

function Pill({ label }) {
  const s = TAG_STYLE[label] || TAG_STYLE.SATELLITE
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: '0.07em',
      padding: '2px 7px', borderRadius: 99,
      background: s.bg, color: s.color,
      fontFamily: "'Roboto Mono', monospace"
    }}>{label}</span>
  )
}

function BeatBadge({ alpha, loading }) {
  if (loading) return (
    <span style={{
      fontSize: 10, fontWeight: 700, borderRadius: 6, padding: '2px 8px',
      background: '#f1f3f4', color: '#9aa0a6',
      fontFamily: "'Roboto Mono', monospace", whiteSpace: 'nowrap'
    }}>— vs VTI</span>
  )
  const beating = alpha >= 0
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, borderRadius: 6, padding: '2px 8px',
      background: beating ? '#e6f4ea' : '#fce8e6',
      color: beating ? '#1e8e3e' : '#c5221f',
      fontFamily: "'Roboto Mono', monospace", whiteSpace: 'nowrap'
    }}>
      {beating ? '▲' : '▼'} {Math.abs(alpha).toFixed(1)}% vs VTI
    </span>
  )
}

function AlertBadge({ ticker, livePrice, alerts, onSetAlert }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')
  const target = alerts[ticker]

  const triggered = target && livePrice && livePrice >= target
  const watching  = target && livePrice && livePrice < target

  const handleSave = () => {
    const n = parseFloat(val)
    if (!isNaN(n) && n > 0) onSetAlert(ticker, n)
    setEditing(false)
    setVal('')
  }

  const handleClear = (e) => {
    e.stopPropagation()
    onSetAlert(ticker, null)
  }

  if (editing) return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
      <input
        autoFocus
        type="number"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
        placeholder="Target $"
        style={{
          width: 80, padding: '3px 7px', borderRadius: 6, border: '1.5px solid #1a73e8',
          fontFamily: "'Roboto Mono', monospace", fontSize: 11, outline: 'none'
        }}
      />
      <button onClick={handleSave} style={{
        background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 6,
        padding: '3px 8px', fontSize: 11, cursor: 'pointer', fontWeight: 700
      }}>✓</button>
      <button onClick={() => setEditing(false)} style={{
        background: '#f1f3f4', color: '#5f6368', border: 'none', borderRadius: 6,
        padding: '3px 8px', fontSize: 11, cursor: 'pointer'
      }}>✕</button>
    </div>
  )

  if (triggered) return (
    <span
      onClick={e => { e.stopPropagation(); setEditing(true) }}
      style={{
        fontSize: 10, fontWeight: 700, borderRadius: 6, padding: '2px 8px',
        background: '#e6f4ea', color: '#1e8e3e', cursor: 'pointer',
        fontFamily: "'Roboto Mono', monospace", whiteSpace: 'nowrap',
        animation: 'alertPulse 1.5s infinite'
      }}>
      🎯 {fmtCur(target)} HIT
      <span onClick={handleClear} style={{ marginLeft: 4, opacity: 0.6 }}>✕</span>
    </span>
  )

  if (watching) return (
    <span
      onClick={e => { e.stopPropagation(); setEditing(true) }}
      style={{
        fontSize: 10, fontWeight: 700, borderRadius: 6, padding: '2px 8px',
        background: '#fef7e0', color: '#b06000', cursor: 'pointer',
        fontFamily: "'Roboto Mono', monospace", whiteSpace: 'nowrap'
      }}>
      🔔 {fmtCur(target)}
      <span onClick={handleClear} style={{ marginLeft: 4, opacity: 0.6 }}>✕</span>
    </span>
  )

  return (
    <span
      onClick={e => { e.stopPropagation(); setEditing(true) }}
      style={{
        fontSize: 10, fontWeight: 600, borderRadius: 6, padding: '2px 8px',
        background: '#f1f3f4', color: '#9aa0a6', cursor: 'pointer',
        fontFamily: "'Roboto Mono', monospace", whiteSpace: 'nowrap'
      }}>
      + Alert
    </span>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#fff', border: '1px solid #e8eaed', borderRadius: 10,
      padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      fontSize: 12, fontFamily: "'Roboto Mono', monospace", minWidth: 150
    }}>
      <div style={{ color: '#5f6368', marginBottom: 6, fontSize: 11 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{
          display: 'flex', justifyContent: 'space-between', gap: 12,
          color: p.dataKey === 'VTI' ? '#90a4ae' : p.color,
          fontWeight: 600, marginBottom: 2
        }}>
          <span>{p.dataKey}</span>
          <span>{p.value >= 0 ? '+' : ''}{p.value}%</span>
        </div>
      ))}
    </div>
  )
}

// ── Position Card ─────────────────────────────────────────────────────────────
function PositionCard({
  id, pos, livePrice, vtiReturnPct, historyForRange,
  selected, onToggle, showDollar, isEmily, alerts, onSetAlert,
  loadingHistory
}) {
  const meta = TICKER_META[id] || { name: id, color: '#5f6368', tag: 'SATELLITE' }
  const series = historyForRange?.[id]
  // Current value & all-time gain (from cost basis)
  let gain = 0, gainPct = 0, currentValue = 0, cost = 0
  if (pos && livePrice) {
    cost = pos.totalCost
    currentValue = pos.shares * livePrice
    gain = currentValue - cost
    gainPct = (gain / cost) * 100
  }

  // Range-based return for the vs VTI badge
  const rangeReturn = seriesReturn(series)
  const alpha = rangeReturn - (vtiReturnPct || 0)

  const alertTriggered = alerts[id] && livePrice && livePrice >= alerts[id]

  return (
    <div
      onClick={() => onToggle(id)}
      style={{
        background: alertTriggered ? '#f0fff4' : '#fff',
        border: `1.5px solid ${selected ? meta.color : alertTriggered ? '#1e8e3e' : '#e8eaed'}`,
        borderRadius: 14, padding: '14px 16px', cursor: 'pointer',
        transition: 'all 0.18s ease',
        boxShadow: selected ? `0 2px 14px ${meta.color}28` : '0 1px 3px rgba(0,0,0,0.06)',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {selected && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: meta.color, borderRadius: '14px 14px 0 0'
        }} />
      )}

      {/* Row 1: ticker + price */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
          <span style={{
            fontFamily: "'Roboto Mono', monospace", fontWeight: 700, fontSize: 14,
            color: selected ? meta.color : '#202124', letterSpacing: '0.03em'
          }}>{id}</span>
          <Pill label={meta.tag} />
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: "'Roboto Mono', monospace", fontWeight: 700, fontSize: 15, color: '#202124' }}>
            {livePrice ? fmtCur(livePrice) : '—'}
          </div>
          <div style={{
            fontFamily: "'Roboto Mono', monospace", fontSize: 11, fontWeight: 600,
            color: gainPct >= 0 ? '#1e8e3e' : '#c5221f'
          }}>{fmtPct(gainPct)}</div>
        </div>
      </div>

      {/* Row 2: name */}
      <div style={{ fontSize: 11, color: '#5f6368', paddingLeft: 18, marginBottom: showDollar ? 8 : 0 }}>
        {meta.name} · {meta.issuer}
      </div>

      {/* Row 3: dollar breakdown + badges */}
      {showDollar && cost > 0 && (
        <div style={{
          paddingLeft: 18, display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', flexWrap: 'wrap', gap: 6
        }}>
          <div>
            <div style={{ fontSize: 10, color: '#9aa0a6', fontFamily: "'Roboto Mono', monospace", marginBottom: 1 }}>
              {isEmily ? 'INVESTED → VALUE' : 'COST BASIS → VALUE'}
            </div>
            <div style={{ fontFamily: "'Roboto Mono', monospace", fontWeight: 700, fontSize: 13 }}>
              <span style={{ color: gain >= 0 ? '#1e8e3e' : '#c5221f' }}>{fmtGain(gain)}</span>
              <span style={{ color: '#9aa0a6', fontWeight: 400, fontSize: 11 }}>
                {' '}({fmtCur(cost)} → {fmtCur(currentValue)})
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <BeatBadge alpha={alpha} loading={loadingHistory && !series} />
            <AlertBadge
              ticker={id} livePrice={livePrice}
              alerts={alerts} onSetAlert={onSetAlert}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Account Section ───────────────────────────────────────────────────────────
function AccountSection({
  label, accountNum, positions, prices, vtiReturnPct, historyForRange,
  selected, onToggle, showDollar, alerts, onSetAlert, loadingHistory
}) {
  const [open, setOpen] = useState(true)
  const total = accountTotal(positions, prices)

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '8px 16px', cursor: 'pointer'
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#202124' }}>{label}</div>
          <div style={{ fontSize: 10, color: '#9aa0a6', fontFamily: "'Roboto Mono', monospace" }}>#{accountNum}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: "'Roboto Mono', monospace", fontWeight: 700, fontSize: 13, color: '#202124' }}>
            {fmtCur(total.totalValue)}
          </div>
          <div style={{
            fontFamily: "'Roboto Mono', monospace", fontSize: 11, fontWeight: 600,
            color: total.gain >= 0 ? '#1e8e3e' : '#c5221f'
          }}>
            {fmtGain(total.gain)} ({fmtPct(total.gainPct)})
          </div>
        </div>
      </div>

      {open && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {positions.map(pos => (
            <PositionCard
              key={`${label}-${pos.id}`}
              id={pos.id} pos={pos}
              livePrice={prices?.[pos.id]?.price}
              vtiReturnPct={vtiReturnPct}
              historyForRange={historyForRange}
              selected={selected.includes(pos.id)}
              onToggle={onToggle}
              showDollar={showDollar}
              alerts={alerts} onSetAlert={onSetAlert}
              loadingHistory={loadingHistory}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Add Position Form ─────────────────────────────────────────────────────────
function AddPositionForm({ onClose, onAdd }) {
  const [ticker,    setTicker]    = useState('')
  const [shares,    setShares]    = useState('')
  const [costPer,   setCostPer]   = useState('')
  const [acct,      setAcct]      = useState('individual')
  const [error,     setError]     = useState('')

  const handleSubmit = () => {
    const t = ticker.toUpperCase().trim()
    const sh = parseFloat(shares)
    const cp = parseFloat(costPer)
    if (!t) return setError('Enter a ticker symbol')
    if (isNaN(sh) || sh <= 0) return setError('Enter valid shares')
    if (isNaN(cp) || cp <= 0) return setError('Enter valid cost per share')
    onAdd({ ticker: t, shares: sh, costPerShare: cp, totalCost: sh * cp, account: acct })
    onClose()
  }

  const field = (label, value, onChange, opts = {}) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: '#9aa0a6', fontFamily: "'Roboto Mono', monospace", marginBottom: 4, letterSpacing: '0.08em' }}>
        {label}
      </div>
      <input
        type={opts.type || 'text'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={opts.placeholder || ''}
        style={{
          width: '100%', padding: '9px 12px', borderRadius: 8,
          border: '1.5px solid #e8eaed', fontFamily: "'Roboto Mono', monospace",
          fontSize: 13, outline: 'none', boxSizing: 'border-box',
          background: '#fafafa'
        }}
      />
    </div>
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      zIndex: 999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
    }} onClick={onClose}>
      <div
        style={{
          background: '#fff', borderRadius: '20px 20px 0 0',
          padding: '20px 20px 36px', width: '100%', maxWidth: 480,
          boxShadow: '0 -4px 24px rgba(0,0,0,0.15)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#202124' }}>Add Position</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9aa0a6' }}>✕</button>
        </div>

        {field('TICKER SYMBOL', ticker, setTicker, { placeholder: 'e.g. NVDA' })}
        {field('SHARES', shares, setShares, { type: 'number', placeholder: '10.5' })}
        {field('COST PER SHARE ($)', costPer, setCostPer, { type: 'number', placeholder: '500.00' })}

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: '#9aa0a6', fontFamily: "'Roboto Mono', monospace", marginBottom: 4, letterSpacing: '0.08em' }}>
            ACCOUNT
          </div>
          <select
            value={acct} onChange={e => setAcct(e.target.value)}
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 8,
              border: '1.5px solid #e8eaed', fontFamily: "'Roboto Mono', monospace",
              fontSize: 13, outline: 'none', background: '#fafafa', boxSizing: 'border-box'
            }}
          >
            <option value="individual">Individual TOD</option>
            <option value="brokerageLink">BrokerageLink 401k</option>
            <option value="brokerageLinkRoth">BrokerageLink Roth</option>
            <option value="hsa">HSA</option>
          </select>
        </div>

        {shares && costPer && !isNaN(parseFloat(shares)) && !isNaN(parseFloat(costPer)) && (
          <div style={{
            background: '#e8f0fe', borderRadius: 8, padding: '8px 12px',
            fontFamily: "'Roboto Mono', monospace", fontSize: 12, color: '#1a73e8',
            marginBottom: 14
          }}>
            Total cost: {fmtCur(parseFloat(shares) * parseFloat(costPer))}
          </div>
        )}

        {error && (
          <div style={{ color: '#c5221f', fontSize: 12, marginBottom: 10, fontFamily: "'Roboto Mono', monospace" }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          style={{
            width: '100%', padding: '13px', borderRadius: 10, border: 'none',
            background: '#1a73e8', color: '#fff', fontWeight: 700, fontSize: 14,
            cursor: 'pointer', fontFamily: "'Google Sans', sans-serif"
          }}
        >
          Add to Portfolio
        </button>

        <div style={{
          marginTop: 10, fontSize: 10, color: '#9aa0a6', textAlign: 'center',
          fontFamily: "'Roboto Mono', monospace"
        }}>
          Note: positions added here are session-only. Update positions.js to persist.
        </div>
      </div>
    </div>
  )
}

// ── Household Banner ──────────────────────────────────────────────────────────
function HouseholdBanner({ prices, vtiReturnPct, historyForRange, loadingHistory }) {
  const jordanAllPositions = Object.values(JORDAN_ACCOUNTS).flatMap(a => a.positions)
  const jTotal = accountTotal(jordanAllPositions, prices)

  const emilyTotal = accountTotal(EMILY_POSITIONS, prices)

  const householdValue   = jTotal.totalValue + emilyTotal.value
  const householdCost    = jTotal.totalCost  + emilyTotal.cost
  const householdGain    = householdValue - householdCost
  const householdGainPct = (householdGain / householdCost) * 100
  const alpha            = householdGainPct - (vtiReturnPct || 0)

  return (
    <div style={{
      background: '#fff', border: '1.5px solid #e8eaed', borderRadius: 16,
      padding: '16px 18px', margin: '12px 16px 0',
      boxShadow: '0 1px 4px rgba(0,0,0,0.07)'
    }}>
      <div style={{
        fontSize: 10, fontFamily: "'Roboto Mono', monospace", color: '#9aa0a6',
        letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12
      }}>
        Household · All Accounts
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
        {[
          { label: 'Total Value',  val: fmtCur(householdValue),    color: '#202124' },
          { label: 'Total Gain',   val: fmtGain(householdGain),    color: householdGain >= 0 ? '#1e8e3e' : '#c5221f' },
          { label: 'Jordan Total', val: fmtCur(jTotal.totalValue),  color: '#1a73e8' },
          { label: 'Emily Total',  val: `~${fmtCur(emilyTotal.value)}`, color: '#9c27b0' },
        ].map(item => (
          <div key={item.label}>
            <div style={{ fontSize: 10, color: '#9aa0a6', fontFamily: "'Roboto Mono', monospace", marginBottom: 2 }}>
              {item.label}
            </div>
            <div style={{ fontFamily: "'Roboto Mono', monospace", fontWeight: 700, fontSize: 15, color: item.color }}>
              {item.val}
            </div>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 12, paddingTop: 10, borderTop: '1px solid #f1f3f4',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div style={{ fontSize: 11, color: '#5f6368' }}>
          Blended return: <strong style={{ color: householdGainPct >= 0 ? '#1e8e3e' : '#c5221f' }}>
            {fmtPct(householdGainPct)}
          </strong>
        </div>
        <BeatBadge alpha={alpha} loading={loadingHistory} />
      </div>
    </div>
  )
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
const RANGES = ['1W', '1M', '3M', '6M', '1Y', 'ALL']

export default function App() {
  const { prices, history, fetchHistory, loading, loadingHistory, isDemo } = usePrices()
  const [tab,         setTab]         = useState('jordan')
  const [range,       setRange]       = useState('3M')
  const [selected,    setSelected]    = useState(['QQQM', 'SOXX', 'AVGO'])
  const [showDollar,  setShowDollar]  = useState(true)
  const [alerts,      setAlerts]      = useState(loadAlerts)
  const [showAddForm, setShowAddForm] = useState(false)
  const [extraPositions, setExtraPositions] = useState({
    individual: [], brokerageLink: [], brokerageLinkRoth: [], hsa: []
  })

  // Fetch history whenever range changes
  useEffect(() => { fetchHistory(range) }, [range, fetchHistory])

  const historyForRange = history[range] || null
  const vtiReturnPct    = seriesReturn(historyForRange?.['VTI'])

  const toggleTicker = useCallback(id => {
    setSelected(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }, [])

  const switchTab = t => {
    setTab(t)
    setSelected(t === 'jordan' ? ['QQQM', 'SOXX', 'AVGO'] : ['QQQM', 'SOXX', 'SMH'])
  }

  const handleSetAlert = (ticker, price) => {
    setAlerts(prev => {
      const next = { ...prev }
      if (price === null) delete next[ticker]
      else next[ticker] = price
      saveAlerts(next)
      return next
    })
  }

  const handleAddPosition = ({ ticker, shares, costPerShare, totalCost, account }) => {
    setExtraPositions(prev => ({
      ...prev,
      [account]: [...(prev[account] || []), { id: ticker, shares, costPerShare, totalCost }]
    }))
  }

  // Merge static + session-added positions
  const mergedAccounts = Object.fromEntries(
    Object.entries(JORDAN_ACCOUNTS).map(([key, acct]) => [
      key,
      {
        ...acct,
        positions: [...acct.positions, ...(extraPositions[key] || [])]
      }
    ])
  )

  // Chart
  const jordanTickers = ['QQQM', 'SOXX', 'AVGO', 'MU', 'FNCMX', 'FSELX']
  const emilyTickers  = ['QQQM', 'SOXX', 'SMH']
  const activeTickers = tab === 'jordan' ? jordanTickers : emilyTickers
  const visible       = activeTickers.filter(id => selected.includes(id))
  const chartData     = (visible.length && historyForRange)
    ? buildChartData(visible, historyForRange)
    : []

  const TABS = [
    { key: 'jordan',    label: 'Jordan',    accent: '#1a73e8' },
    { key: 'emily',     label: 'Emily 👸🏼',  accent: '#9c27b0' },
    { key: 'household', label: 'Household', accent: '#0f9d58' },
  ]

  // Count triggered alerts for header badge
  const triggeredCount = Object.entries(alerts).filter(
    ([ticker, target]) => prices?.[ticker]?.price >= target
  ).length

  return (
    <div style={{
      minHeight: '100vh', background: '#f8f9fa',
      fontFamily: "'Google Sans', sans-serif",
      maxWidth: 480, margin: '0 auto', paddingBottom: 40
    }}>

      {/* ── HEADER ── */}
      <div style={{
        background: '#fff', padding: '18px 16px 0',
        borderBottom: '1px solid #e8eaed', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        position: 'sticky', top: 0, zIndex: 100
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#202124', letterSpacing: '-0.2px' }}>
              📈 Smith Portfolio
            </div>
            <div style={{ fontSize: 11, color: '#9aa0a6', fontFamily: "'Roboto Mono', monospace", marginTop: 1 }}>
              {isDemo ? 'DEMO PRICES' : 'LIVE · FMP'} · V2026.06
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {(loading || loadingHistory) && (
              <div style={{
                width: 8, height: 8, borderRadius: '50%', background: '#fbbc04',
                animation: 'pulse 1.2s infinite'
              }} />
            )}
            {triggeredCount > 0 && (
              <span style={{
                background: '#ea4335', color: '#fff', borderRadius: 99,
                fontSize: 10, fontWeight: 700, padding: '2px 7px',
                fontFamily: "'Roboto Mono', monospace"
              }}>
                🔔 {triggeredCount}
              </span>
            )}
            <button
              onClick={() => setShowAddForm(true)}
              style={{
                background: '#e8f0fe', border: 'none', borderRadius: 8,
                padding: '5px 11px', fontSize: 11, fontWeight: 700,
                cursor: 'pointer', color: '#1a73e8',
                fontFamily: "'Roboto Mono', monospace"
              }}
            >+ ADD</button>
            <button
              onClick={() => setShowDollar(p => !p)}
              style={{
                background: showDollar ? '#e8f0fe' : '#f1f3f4',
                border: 'none', borderRadius: 8, padding: '5px 12px',
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                color: showDollar ? '#1a73e8' : '#5f6368',
                fontFamily: "'Roboto Mono', monospace"
              }}
            >$ {showDollar ? 'ON' : 'OFF'}</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex' }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => switchTab(t.key)}
              style={{
                flex: 1, padding: '10px 0', border: 'none', background: 'transparent',
                borderBottom: tab === t.key ? `3px solid ${t.accent}` : '3px solid transparent',
                fontFamily: "'Google Sans', sans-serif",
                fontWeight: tab === t.key ? 700 : 500,
                fontSize: 13, color: tab === t.key ? t.accent : '#5f6368',
                cursor: 'pointer', transition: 'all 0.15s'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── HOUSEHOLD TAB ── */}
      {tab === 'household' && (
        <>
          <HouseholdBanner
            prices={prices}
            vtiReturnPct={vtiReturnPct}
            historyForRange={historyForRange}
            loadingHistory={loadingHistory}
          />
          {Object.entries(mergedAccounts).map(([key, acct]) => (
            <AccountSection
              key={key}
              label={acct.label} accountNum={acct.accountNum}
              positions={acct.positions} prices={prices}
              vtiReturnPct={vtiReturnPct}
              historyForRange={historyForRange}
              selected={selected} onToggle={toggleTicker}
              showDollar={showDollar}
              alerts={alerts} onSetAlert={handleSetAlert}
              loadingHistory={loadingHistory}
            />
          ))}
          <div style={{ padding: '8px 16px 4px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#9c27b0', padding: '8px 0 0' }}>
              Emily 👸🏼 · BrokerageLink
            </div>
          </div>
          <div style={{ padding: '4px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {EMILY_POSITIONS.map(pos => (
              <PositionCard
                key={`emily-${pos.id}`}
                id={pos.id} pos={pos}
                livePrice={prices?.[pos.id]?.price}
                vtiReturnPct={vtiReturnPct}
                historyForRange={historyForRange}
                selected={selected.includes(pos.id)}
                onToggle={toggleTicker}
                showDollar={showDollar}
                isEmily
                alerts={alerts} onSetAlert={handleSetAlert}
                loadingHistory={loadingHistory}
              />
            ))}
          </div>
        </>
      )}

      {/* ── JORDAN / EMILY TABS ── */}
      {tab !== 'household' && (
        <>
          {/* Chart card */}
          <div style={{
            background: '#fff', border: '1.5px solid #e8eaed', borderRadius: 16,
            margin: '12px 16px 0', padding: '16px 8px 12px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              paddingLeft: 12, paddingRight: 12, marginBottom: 12
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#202124' }}>
                Return % vs VTI
                {loadingHistory && (
                  <span style={{ fontSize: 10, color: '#9aa0a6', marginLeft: 8, fontFamily: "'Roboto Mono', monospace" }}>
                    loading…
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {RANGES.map(r => (
                  <button key={r} onClick={() => setRange(r)} style={{
                    padding: '4px 10px', borderRadius: 99, border: 'none',
                    background: range === r ? '#e8f0fe' : 'transparent',
                    color: range === r ? '#1a73e8' : '#5f6368',
                    fontFamily: "'Roboto Mono', monospace", fontWeight: 700,
                    fontSize: 11, cursor: 'pointer', transition: 'all 0.15s'
                  }}>{r}</button>
                ))}
              </div>
            </div>

            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={210}>
                <LineChart data={chartData} margin={{ top: 4, right: 12, left: -14, bottom: 0 }}>
                  <XAxis dataKey="date"
                    tick={{ fill: '#9aa0a6', fontSize: 9, fontFamily: "'Roboto Mono', monospace" }}
                    tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis
                    tick={{ fill: '#9aa0a6', fontSize: 9, fontFamily: "'Roboto Mono', monospace" }}
                    tickLine={false} axisLine={false}
                    tickFormatter={v => `${v >= 0 ? '+' : ''}${v}%`} />
                  <ReferenceLine y={0} stroke="#e8eaed" />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="VTI" stroke="#bdc1c6"
                    strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                  {visible.map(id => (
                    <Line key={id} type="monotone" dataKey={id}
                      stroke={TICKER_META[id]?.color || '#5f6368'}
                      strokeWidth={2.5} dot={false}
                      activeDot={{ r: 5, fill: TICKER_META[id]?.color }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{
                height: 210, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#bdc1c6', fontFamily: "'Roboto Mono', monospace", fontSize: 12,
                flexDirection: 'column', gap: 8
              }}>
                {loadingHistory
                  ? <><div style={{ fontSize: 20 }}>⏳</div><div>Loading price history…</div></>
                  : <div>Tap a ticker card to overlay on chart</div>
                }
              </div>
            )}

            {/* Legend */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', paddingLeft: 14, marginTop: 8 }}>
              {[...visible, 'VTI'].map(id => (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{
                    width: id === 'VTI' ? 14 : 8,
                    height: id === 'VTI' ? 0 : 8,
                    borderRadius: id === 'VTI' ? 0 : '50%',
                    background: id === 'VTI' ? 'transparent' : TICKER_META[id]?.color,
                    borderTop: id === 'VTI' ? '2px dashed #bdc1c6' : 'none'
                  }} />
                  <span style={{
                    fontFamily: "'Roboto Mono', monospace", fontSize: 10,
                    color: id === 'VTI' ? '#9aa0a6' : '#5f6368',
                    fontWeight: id === 'VTI' ? 400 : 600
                  }}>{id}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Ticker cards */}
          {tab === 'jordan' ? (
            Object.entries(mergedAccounts).map(([key, acct]) => (
              <AccountSection
                key={key}
                label={acct.label} accountNum={acct.accountNum}
                positions={acct.positions} prices={prices}
                vtiReturnPct={vtiReturnPct}
                historyForRange={historyForRange}
                selected={selected} onToggle={toggleTicker}
                showDollar={showDollar}
                alerts={alerts} onSetAlert={handleSetAlert}
                loadingHistory={loadingHistory}
              />
            ))
          ) : (
            <div style={{ padding: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{
                fontSize: 11, fontWeight: 600, color: '#9aa0a6',
                letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4
              }}>
                Emily · BrokerageLink
              </div>
              {EMILY_POSITIONS.map(pos => (
                <PositionCard
                  key={pos.id} id={pos.id} pos={pos}
                  livePrice={prices?.[pos.id]?.price}
                  vtiReturnPct={vtiReturnPct}
                  historyForRange={historyForRange}
                  selected={selected.includes(pos.id)}
                  onToggle={toggleTicker}
                  showDollar={showDollar}
                  isEmily
                  alerts={alerts} onSetAlert={handleSetAlert}
                  loadingHistory={loadingHistory}
                />
              ))}
            </div>
          )}

          {/* VTI benchmark row */}
          <div style={{
            margin: '14px 16px 0', background: '#fff',
            border: '1.5px solid #e8eaed', borderRadius: 14,
            padding: '12px 16px', display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#bdc1c6' }} />
              <div>
                <div style={{ fontFamily: "'Roboto Mono', monospace", fontWeight: 600, fontSize: 13, color: '#5f6368' }}>VTI</div>
                <div style={{ fontSize: 11, color: '#9aa0a6' }}>Benchmark · Broad Market · {range}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: "'Roboto Mono', monospace", fontWeight: 700, fontSize: 14, color: '#202124' }}>
                {prices?.VTI ? fmtCur(prices.VTI.price) : '—'}
              </div>
              <div style={{
                fontFamily: "'Roboto Mono', monospace", fontSize: 11,
                color: vtiReturnPct >= 0 ? '#1e8e3e' : '#c5221f', fontWeight: 600
              }}>
                {loadingHistory ? '—' : fmtPct(vtiReturnPct)}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Footer */}
      <div style={{
        margin: '14px 16px 0', padding: '10px 14px',
        background: isDemo ? '#fef7e0' : '#e6f4ea',
        border: `1px solid ${isDemo ? '#fde293' : '#a8d5b5'}`,
        borderRadius: 10, fontSize: 10,
        color: isDemo ? '#a07a00' : '#1e6b3a',
        fontFamily: "'Roboto Mono', monospace", lineHeight: 1.6
      }}>
        {isDemo
          ? '⚠ Demo prices · Add VITE_FMP_KEY to Vercel env for live data'
          : `✓ Live prices via FMP · Quotes refresh every 5 min · History refreshes hourly · vs VTI reflects ${range} window`}
      </div>

      {/* Add Position Modal */}
      {showAddForm && (
        <AddPositionForm
          onClose={() => setShowAddForm(false)}
          onAdd={handleAddPosition}
        />
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes alertPulse { 0%,100%{opacity:1} 50%{opacity:0.7} }
      `}</style>
    </div>
  )
}
