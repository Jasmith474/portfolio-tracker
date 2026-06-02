import { useState, useCallback } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts'
import { usePrices } from './usePrices.js'
import { JORDAN_ACCOUNTS, EMILY_POSITIONS, TICKER_META } from './positions.js'
import { fmtCur, fmtGain, fmtPct, positionStats, accountTotal, vtiAlpha } from './utils.js'

// ─── DEMO CHART DATA (sparkline-style, Apr 5 → Jun 1) ───────────────────────
function seeded(seed) {
  let s = seed
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 }
}
function makeSeries(startPrice, trendPct, vol, days, seed) {
  const rand = seeded(seed)
  const start = new Date('2025-04-05')
  let price = startPrice
  return Array.from({ length: days }, (_, i) => {
    price = Math.max(price * (1 + (trendPct + (rand() - 0.47) * vol) / 100), startPrice * 0.75)
    const d = new Date(start); d.setDate(d.getDate() + i)
    return {
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      price: +price.toFixed(2), i
    }
  })
}

const CHART_SEEDS = {
  QQQM: { trend: 0.19, vol: 1.2, seed: 11 },
  SOXX: { trend: 0.26, vol: 1.6, seed: 22 },
  AVGO: { trend: 0.38, vol: 2.1, seed: 33 },
  MU:   { trend: 0.55, vol: 3.0, seed: 44 },
  SMH:  { trend: 0.31, vol: 1.8, seed: 55 },
  FNCMX:{ trend: 0.15, vol: 1.1, seed: 66 },
  FSELX:{ trend: 0.22, vol: 1.4, seed: 77 },
  VTI:  { trend: 0.09, vol: 0.9, seed: 88 },
}

const DAYS = 57

// Pre-compute normalized chart series (% return from day 0)
const CHART_SERIES = {}
Object.entries(CHART_SEEDS).forEach(([id, cfg]) => {
  // Use current demo price as approximate for series start
  const starts = { QQQM:296,SOXX:536,AVGO:426,MU:577,SMH:190,FNCMX:342,FSELX:65,VTI:266 }
  const raw = makeSeries(starts[id] || 100, cfg.trend, cfg.vol, DAYS, cfg.seed)
  CHART_SERIES[id] = raw
})

function buildChartData(tickerIds, days) {
  const ids = [...tickerIds, 'VTI']
  const base = CHART_SERIES[tickerIds[0]]?.slice(-days) || []
  return base.map((pt, i) => {
    const row = { date: pt.date }
    ids.forEach(id => {
      const s = CHART_SERIES[id]?.slice(-days) || []
      const b0 = s[0]?.price || 1
      const cur = s[i]?.price || b0
      row[id] = +(((cur - b0) / b0) * 100).toFixed(2)
    })
    return row
  })
}

const RANGE_DAYS = { '1W': 7, '1M': 30, '3M': 57, '6M': 57, 'ALL': 57 }

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

function BeatBadge({ alpha }) {
  const beating = alpha >= 0
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, borderRadius: 6, padding: '2px 8px',
      background: beating ? '#e6f4ea' : '#fce8e6',
      color: beating ? '#1e8e3e' : '#c5221f',
      fontFamily: "'Roboto Mono', monospace",
      whiteSpace: 'nowrap'
    }}>
      {beating ? '▲' : '▼'} {Math.abs(alpha).toFixed(1)}% vs VTI
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
          color: p.dataKey === 'VTI' ? '#90a4ae' : p.color, fontWeight: 600, marginBottom: 2
        }}>
          <span>{p.dataKey}</span>
          <span>{p.value >= 0 ? '+' : ''}{p.value}%</span>
        </div>
      ))}
    </div>
  )
}

// Single position card
function PositionCard({ id, pos, livePrice, vtiGainPct, selected, onToggle, showDollar, isEmily }) {
  const meta = TICKER_META[id] || { name: id, color: '#5f6368', tag: 'SATELLITE' }

  let gain = 0, gainPct = 0, currentValue = 0, cost = 0
  if (isEmily) {
    cost = pos.dollarInvested
    // approximate current value using period return from demo
    const periodReturn = (CHART_SEEDS[id]?.trend || 0.15) * DAYS
    currentValue = cost * (1 + periodReturn / 100)
    gain = currentValue - cost
    gainPct = (gain / cost) * 100
  } else if (pos && livePrice) {
    cost = pos.totalCost
    currentValue = pos.shares * livePrice
    gain = currentValue - cost
    gainPct = (gain / cost) * 100
  }

  const alpha = gainPct - (vtiGainPct || 0)

  return (
    <div
      onClick={() => onToggle(id)}
      style={{
        background: '#fff',
        border: `1.5px solid ${selected ? meta.color : '#e8eaed'}`,
        borderRadius: 14,
        padding: '14px 16px',
        cursor: 'pointer',
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

      {/* Row 1 */}
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
          <div style={{
            fontFamily: "'Roboto Mono', monospace", fontWeight: 700, fontSize: 15, color: '#202124'
          }}>{livePrice ? fmtCur(livePrice) : '—'}</div>
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

      {/* Row 3: dollar breakdown */}
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
          <BeatBadge alpha={alpha} />
        </div>
      )}
    </div>
  )
}

// Account section with collapsible header
function AccountSection({ label, accountNum, positions, prices, vtiGainPct, selected, onToggle, showDollar }) {
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
          <div style={{ fontSize: 12, fontWeight: 700, color: '#202124', letterSpacing: '-0.1px' }}>{label}</div>
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
              id={pos.id}
              pos={pos}
              livePrice={prices?.[pos.id]?.price}
              vtiGainPct={vtiGainPct}
              selected={selected.includes(pos.id)}
              onToggle={onToggle}
              showDollar={showDollar}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Household summary banner
function HouseholdBanner({ prices, vtiGainPct }) {
  const jordanAllPositions = Object.values(JORDAN_ACCOUNTS).flatMap(a => a.positions)
  const jTotal = accountTotal(jordanAllPositions, prices)

  // Emily approximate
  const emilyTotal = EMILY_POSITIONS.reduce((sum, p) => {
    const pRet = (CHART_SEEDS[p.id]?.trend || 0.15) * DAYS
    const val = p.dollarInvested * (1 + pRet / 100)
    return { cost: sum.cost + p.dollarInvested, value: sum.value + val }
  }, { cost: 0, value: 0 })
  const emilyGain = emilyTotal.value - emilyTotal.cost

  const householdValue = jTotal.totalValue + emilyTotal.value
  const householdCost = jTotal.totalCost + emilyTotal.cost
  const householdGain = householdValue - householdCost
  const householdGainPct = (householdGain / householdCost) * 100
  const alpha = householdGainPct - (vtiGainPct || 0)

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
          { label: 'Total Value',    val: fmtCur(householdValue),   color: '#202124' },
          { label: 'Total Gain',     val: fmtGain(householdGain),   color: householdGain >= 0 ? '#1e8e3e' : '#c5221f' },
          { label: 'Jordan Total',   val: fmtCur(jTotal.totalValue), color: '#1a73e8' },
          { label: 'Emily Total',    val: `~${fmtCur(emilyTotal.value)}`, color: '#9c27b0' },
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
        <BeatBadge alpha={alpha} />
      </div>
    </div>
  )
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const { prices, loading, isDemo } = usePrices()
  const [tab, setTab] = useState('jordan')
  const [range, setRange] = useState('3M')
  const [selected, setSelected] = useState(['QQQM', 'SOXX', 'AVGO'])
  const [showDollar, setShowDollar] = useState(true)

  const toggleTicker = useCallback(id => {
    setSelected(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }, [])

  const switchTab = t => {
    setTab(t)
    setSelected(t === 'jordan' ? ['QQQM', 'SOXX', 'AVGO'] : ['QQQM', 'SOXX', 'SMH'])
  }

  const vtiGainPct = prices?.VTI
    ? ((prices.VTI.price - 266) / 266) * 100  // approx cost basis for VTI benchmark
    : 2.10

  // Chart
  const jordanTickers = ['QQQM', 'SOXX', 'AVGO', 'MU', 'FNCMX', 'FSELX']
  const emilyTickers = ['QQQM', 'SOXX', 'SMH']
  const activeTickers = tab === 'jordan' ? jordanTickers : emilyTickers
  const visible = activeTickers.filter(id => selected.includes(id))
  const chartData = visible.length ? buildChartData(visible, RANGE_DAYS[range]) : []

  const TABS = [
    { key: 'jordan', label: 'Jordan', accent: '#1a73e8' },
    { key: 'emily',  label: 'Emily 👸🏼', accent: '#9c27b0' },
    { key: 'household', label: 'Household', accent: '#0f9d58' },
  ]

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
            {loading && (
              <div style={{
                width: 8, height: 8, borderRadius: '50%', background: '#fbbc04',
                animation: 'pulse 1.2s infinite'
              }} />
            )}
            <button
              onClick={() => setShowDollar(p => !p)}
              style={{
                background: showDollar ? '#e8f0fe' : '#f1f3f4',
                border: 'none', borderRadius: 8, padding: '5px 12px',
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                color: showDollar ? '#1a73e8' : '#5f6368',
                fontFamily: "'Roboto Mono', monospace"
              }}
            >
              $ {showDollar ? 'ON' : 'OFF'}
            </button>
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
          <HouseholdBanner prices={prices} vtiGainPct={vtiGainPct} />
          {Object.entries(JORDAN_ACCOUNTS).map(([key, acct]) => (
            <AccountSection
              key={key}
              label={acct.label}
              accountNum={acct.accountNum}
              positions={acct.positions}
              prices={prices}
              vtiGainPct={vtiGainPct}
              selected={selected}
              onToggle={toggleTicker}
              showDollar={showDollar}
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
                id={pos.id}
                pos={pos}
                livePrice={prices?.[pos.id]?.price}
                vtiGainPct={vtiGainPct}
                selected={selected.includes(pos.id)}
                onToggle={toggleTicker}
                showDollar={showDollar}
                isEmily
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
                Return % vs VTI benchmark
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {Object.keys(RANGE_DAYS).map(r => (
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

            {visible.length > 0 ? (
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
                color: '#bdc1c6', fontFamily: "'Roboto Mono', monospace", fontSize: 12
              }}>
                Tap a ticker card to overlay on chart
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
                    color: id === 'VTI' ? '#9aa0a6' : '#5f6368', fontWeight: id === 'VTI' ? 400 : 600
                  }}>{id}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Ticker cards */}
          {tab === 'jordan' ? (
            Object.entries(JORDAN_ACCOUNTS).map(([key, acct]) => (
              <AccountSection
                key={key}
                label={acct.label}
                accountNum={acct.accountNum}
                positions={acct.positions}
                prices={prices}
                vtiGainPct={vtiGainPct}
                selected={selected}
                onToggle={toggleTicker}
                showDollar={showDollar}
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
                  key={pos.id}
                  id={pos.id}
                  pos={pos}
                  livePrice={prices?.[pos.id]?.price}
                  vtiGainPct={vtiGainPct}
                  selected={selected.includes(pos.id)}
                  onToggle={toggleTicker}
                  showDollar={showDollar}
                  isEmily
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
                <div style={{ fontSize: 11, color: '#9aa0a6' }}>Benchmark · Broad Market</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: "'Roboto Mono', monospace", fontWeight: 700, fontSize: 14, color: '#202124' }}>
                {prices?.VTI ? fmtCur(prices.VTI.price) : '—'}
              </div>
              <div style={{ fontFamily: "'Roboto Mono', monospace", fontSize: 11, color: '#5f6368', fontWeight: 600 }}>
                {fmtPct(vtiGainPct)} since cost basis
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
          ? '⚠ Demo prices · Add VITE_FMP_KEY to .env for live data · Emily totals are approximate'
          : '✓ Live prices via FMP · Refreshes every 5 min · Emily totals are approximate'}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>
    </div>
  )
}
