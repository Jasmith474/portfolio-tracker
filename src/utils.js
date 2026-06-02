export const fmtCur = (n) =>
  `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const fmtGain = (n) =>
  `${n >= 0 ? '+' : '-'}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const fmtPct = (n) =>
  `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

export const fmtPctAbs = (n) => `${n.toFixed(2)}%`

// Compute position P&L given live price
export function positionStats(pos, livePrice) {
  if (!livePrice) return null
  const currentValue = pos.shares * livePrice
  const gain = currentValue - pos.totalCost
  const gainPct = (gain / pos.totalCost) * 100
  return { currentValue, gain, gainPct }
}

// Compute Emily position stats (dollar-invested, no shares)
export function emilyStats(pos, livePrice, costPerShare) {
  if (!livePrice || !costPerShare) return null
  const sharesImplied = pos.dollarInvested / costPerShare
  const currentValue = sharesImplied * livePrice
  const gain = currentValue - pos.dollarInvested
  const gainPct = (gain / pos.dollarInvested) * 100
  return { currentValue, gain, gainPct, sharesImplied }
}

// Aggregate account total
export function accountTotal(positions, prices) {
  let totalCost = 0, totalValue = 0
  positions.forEach(pos => {
    const lp = prices?.[pos.id]?.price
    totalCost += pos.totalCost
    totalValue += lp ? pos.shares * lp : pos.totalCost
  })
  const gain = totalValue - totalCost
  const gainPct = totalCost > 0 ? (gain / totalCost) * 100 : 0
  return { totalCost, totalValue, gain, gainPct }
}

// VTI benchmark comparison
export function vtiAlpha(myGainPct, vtiGainPct) {
  return myGainPct - vtiGainPct
}
