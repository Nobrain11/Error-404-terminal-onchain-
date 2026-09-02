/**
 * Holder / cluster heuristics (client-side)
 * Full graph needs an indexer (same-funding, transfer clusters).
 * Here we surface structured signals from known fields + placeholders for live data.
 */

import type { LaunchToken } from './indexer'
import type { SecurityReport } from './security'

export interface ClusterSignal {
  id: string
  label: string
  severity: 'info' | 'warn' | 'danger' | 'ok'
  detail: string
}

export interface HolderSnapshot {
  token: string
  symbol: string
  signals: ClusterSignal[]
  topHolderPct: number | null
  buySellRatio: number | null
  deployerShort: string
  deployerUrl: string
  summary: string
}

function pctFromReport(report: SecurityReport): number | null {
  const row = report.checks.find((c) => c.name === 'Holder concentration')
  if (!row) return null
  const m = row.detail.match(/([\d.]+)%/)
  return m ? parseFloat(m[1]) : null
}

export function buildHolderSnapshot(token: LaunchToken, explorerBase: string): HolderSnapshot {
  const signals: ClusterSignal[] = []
  const top = pctFromReport(token.report)

  if (top != null) {
    if (top >= 40) {
      signals.push({
        id: 'conc',
        label: 'Concentration',
        severity: 'danger',
        detail: `Top wallet ~${top}% — high dump risk if single entity`,
      })
    } else if (top >= 20) {
      signals.push({
        id: 'conc',
        label: 'Concentration',
        severity: 'warn',
        detail: `Top wallet ~${top}% — watch for coordinated exits`,
      })
    } else {
      signals.push({
        id: 'conc',
        label: 'Concentration',
        severity: 'ok',
        detail: `Top wallet ~${top}% — relatively distributed`,
      })
    }
  } else {
    signals.push({
      id: 'conc',
      label: 'Concentration',
      severity: 'info',
      detail: 'Not measured yet — connect indexer for live holder %',
    })
  }

  const buys = token.buys
  const sells = token.sells
  const ratio = sells > 0 ? buys / sells : buys > 0 ? Infinity : null
  if (ratio != null) {
    if (sells === 0 && buys > 10) {
      signals.push({
        id: 'flow',
        label: 'Buy/Sell flow',
        severity: 'warn',
        detail: `${buys} buys / 0 sells — possible delayed honeypot or one-way flow`,
      })
    } else if (ratio > 5) {
      signals.push({
        id: 'flow',
        label: 'Buy/Sell flow',
        severity: 'info',
        detail: `${buys} buys / ${sells} sells — heavy buy pressure`,
      })
    } else if (ratio < 0.5 && sells > 5) {
      signals.push({
        id: 'flow',
        label: 'Buy/Sell flow',
        severity: 'warn',
        detail: `${buys} buys / ${sells} sells — distribution pressure`,
      })
    } else {
      signals.push({
        id: 'flow',
        label: 'Buy/Sell flow',
        severity: 'ok',
        detail: `${buys} buys / ${sells} sells`,
      })
    }
  }

  if (token.ageSeconds < 120) {
    signals.push({
      id: 'age',
      label: 'Freshness',
      severity: 'warn',
      detail: 'Under 2 minutes old — clusters often form in first blocks',
    })
  }

  const lp = token.report.checks.find((c) => c.name === 'LP locked')
  if (lp?.status === 'fail') {
    signals.push({
      id: 'lp',
      label: 'LP custody',
      severity: 'danger',
      detail: 'Liquidity may be pullable — classic rug vector',
    })
  } else if (lp?.status === 'pass') {
    signals.push({
      id: 'lp',
      label: 'LP custody',
      severity: 'ok',
      detail: 'LP appears locked',
    })
  }

  signals.push({
    id: 'bundle',
    label: 'Bundle / sybil',
    severity: 'info',
    detail: 'Cluster graph pending indexer (same-funding edges, peel chains)',
  })

  const danger = signals.filter((s) => s.severity === 'danger').length
  const warn = signals.filter((s) => s.severity === 'warn').length
  let summary = 'No strong cluster red flags in local signals.'
  if (danger > 0) summary = 'High-risk cluster signals present — treat as hostile until proven otherwise.'
  else if (warn > 0) summary = 'Some caution signals — size down and watch deployer/top wallets.'

  return {
    token: token.address,
    symbol: token.symbol,
    signals,
    topHolderPct: top,
    buySellRatio: ratio === Infinity ? null : ratio,
    deployerShort: `${token.deployer.slice(0, 6)}…${token.deployer.slice(-4)}`,
    deployerUrl: `${explorerBase}/address/${token.deployer}`,
    summary,
  }
}
