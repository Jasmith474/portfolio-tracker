// ─── REAL POSITION DATA (from Fidelity, June 2026) ──────────────────────────
// Jordan accounts are broken out by account type.
// Emily values are dollar-invested (no share count available).

export const JORDAN_ACCOUNTS = {
  individual: {
    label: "Individual TOD",
    accountNum: "Z35682413",
    positions: [
      { id: "QQQM",  shares: 4.59,   costPerShare: 296.18, totalCost: 1359.47 },
      { id: "AVGO",  shares: 2.202,  costPerShare: 425.74, totalCost: 937.49  },
      { id: "SOXX",  shares: 1.423,  costPerShare: 533.41, totalCost: 759.04  },
      { id: "MU",    shares: 0.13,   costPerShare: 576.69, totalCost: 74.97   },
    ]
  },
  brokerageLink: {
    label: "BrokerageLink (401k)",
    accountNum: "653556845",
    positions: [
      { id: "FNCMX", shares: 13.44,   costPerShare: 342.26, totalCost: 4600.00 },
      { id: "FSELX", shares: 105.182, costPerShare: 64.66,  totalCost: 6801.00 },
    ]
  },
  brokerageLinkRoth: {
    label: "BrokerageLink Roth",
    accountNum: "653556846",
    positions: [
      { id: "FNCMX", shares: 4.502,  costPerShare: 342.29, totalCost: 1541.00 },
      { id: "FSELX", shares: 50.357, costPerShare: 61.56,  totalCost: 3100.00 },
    ]
  },
  hsa: {
    label: "HSA",
    accountNum: "264546199",
    positions: [
      { id: "QQQM", shares: 20.669, costPerShare: 294.90, totalCost: 6095.33 },
      { id: "SOXX", shares: 6.572,  costPerShare: 569.76, totalCost: 3744.47 },
    ]
  }
}

export const EMILY_POSITIONS = [
  { id: "QQQM", dollarInvested: 43000 },
  { id: "SOXX", dollarInvested: 26000 },
  { id: "SMH",  dollarInvested: 16000 },
]

// All unique tickers we track (+ VTI benchmark)
export const ALL_TICKERS = ["QQQM", "SOXX", "AVGO", "MU", "FNCMX", "FSELX", "SMH", "VTI"]

// Ticker metadata
export const TICKER_META = {
  QQQM:  { name: "Nasdaq 100 Mini",         issuer: "Invesco",  color: "#1a73e8", tag: "CORE"      },
  SOXX:  { name: "iShares Semiconductor",   issuer: "iShares",  color: "#0f9d58", tag: "SATELLITE" },
  AVGO:  { name: "Broadcom Inc.",            issuer: "NASDAQ",   color: "#ea4335", tag: "SATELLITE" },
  MU:    { name: "Micron Technology",        issuer: "NASDAQ",   color: "#ff6d00", tag: "SATELLITE" },
  SMH:   { name: "VanEck Semiconductors",   issuer: "VanEck",   color: "#9c27b0", tag: "SATELLITE" },
  FNCMX: { name: "Fidelity Nasdaq Comp.",   issuer: "Fidelity", color: "#00838f", tag: "BROKERAGE" },
  FSELX: { name: "Fidelity Select Semis",   issuer: "Fidelity", color: "#f9ab00", tag: "BROKERAGE" },
  VTI:   { name: "Vanguard Total Market",   issuer: "Vanguard", color: "#90a4ae", tag: "BENCHMARK" },
}
