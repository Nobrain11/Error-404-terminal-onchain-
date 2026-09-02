/** Lightweight client-side security heuristics for Robinhood Chain tokens */

export type SecurityVerdict = 'SAFE' | 'CAUTION' | 'DANGER' | 'UNKNOWN'

export interface SecurityReport {
  verdict: SecurityVerdict
  score: number
  checks: {
    name: string
    status: 'pass' | 'fail' | 'warn' | 'skip'
    detail: string
  }[]
  summary: string
}

export function analyzeToken(params: {
  address: string
  deployer?: string
  lpLocked?: boolean
  holderCount?: number
  topHolderPct?: number
  hasHoneypotSignals?: boolean
  buyTaxBps?: number
  sellTaxBps?: number
  ageSeconds?: number
}): SecurityReport {
  const checks: SecurityReport['checks'] = []
  let score = 70

  if (params.deployer) {
    checks.push({
      name: 'Deployer identified',
      status: 'pass',
      detail: `Deployer ${params.deployer.slice(0, 6)}…${params.deployer.slice(-4)}`,
    })
  } else {
    checks.push({ name: 'Deployer identified', status: 'warn', detail: 'Unable to resolve deployer' })
    score -= 10
  }

  if (params.lpLocked === true) {
    checks.push({ name: 'LP locked', status: 'pass', detail: 'Liquidity position appears locked' })
    score += 15
  } else if (params.lpLocked === false) {
    checks.push({ name: 'LP locked', status: 'fail', detail: 'Liquidity may be withdrawable by deployer' })
    score -= 35
  } else {
    checks.push({ name: 'LP locked', status: 'skip', detail: 'Lock status not checked' })
  }

  if (typeof params.topHolderPct === 'number') {
    if (params.topHolderPct > 40) {
      checks.push({
        name: 'Holder concentration',
        status: 'fail',
        detail: `Top holder controls ~${params.topHolderPct.toFixed(1)}%`,
      })
      score -= 25
    } else if (params.topHolderPct > 20) {
      checks.push({
        name: 'Holder concentration',
        status: 'warn',
        detail: `Top holder controls ~${params.topHolderPct.toFixed(1)}%`,
      })
      score -= 10
    } else {
      checks.push({
        name: 'Holder concentration',
        status: 'pass',
        detail: `Top holder ~${params.topHolderPct.toFixed(1)}%`,
      })
    }
  }

  if (params.hasHoneypotSignals) {
    checks.push({ name: 'Honeypot simulation', status: 'fail', detail: 'Buy ok / sell failed or restricted' })
    score -= 50
  } else {
    checks.push({ name: 'Honeypot simulation', status: 'pass', detail: 'No obvious honeypot signals' })
  }

  const buy = params.buyTaxBps ?? 0
  const sell = params.sellTaxBps ?? 0
  if (buy > 1000 || sell > 1000) {
    checks.push({ name: 'Tax', status: 'fail', detail: `High tax: buy ${buy / 100}% / sell ${sell / 100}%` })
    score -= 20
  } else if (buy > 300 || sell > 300) {
    checks.push({ name: 'Tax', status: 'warn', detail: `Tax: buy ${buy / 100}% / sell ${sell / 100}%` })
    score -= 5
  } else {
    checks.push({ name: 'Tax', status: 'pass', detail: `Tax: buy ${buy / 100}% / sell ${sell / 100}%` })
  }

  if (typeof params.ageSeconds === 'number') {
    if (params.ageSeconds < 60) {
      checks.push({ name: 'Age', status: 'warn', detail: `Very new (< 1 min)` })
      score -= 5
    } else {
      const s = params.ageSeconds
      const age =
        s < 3600 ? `${Math.floor(s / 60)}m` : s < 86400 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 86400)}d`
      checks.push({ name: 'Age', status: 'pass', detail: age })
    }
  }

  score = Math.max(0, Math.min(100, score))

  let verdict: SecurityVerdict = 'UNKNOWN'
  if (score >= 75) verdict = 'SAFE'
  else if (score >= 45) verdict = 'CAUTION'
  else verdict = 'DANGER'

  const summary =
    verdict === 'SAFE'
      ? 'No major red flags detected. Still DYOR.'
      : verdict === 'CAUTION'
        ? 'Some risk signals present. Proceed carefully.'
        : 'High risk indicators. Avoid unless you understand the risk.'

  return { verdict, score, checks, summary }
}
