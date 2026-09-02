/**
 * On-chain token scanner
 * Uses eth_call for metadata + simple heuristics.
 * Full honeypot simulation (buy+sell in one eth_call) requires a simulation backend or local fork.
 */

import { ethCall } from './rpc'
import { analyzeToken, type SecurityReport } from './security'

function decodeString(hex: string): string {
  try {
    if (!hex || hex === '0x') return ''
    const data = hex.startsWith('0x') ? hex.slice(2) : hex
    const offset = parseInt(data.slice(0, 64), 16) * 2
    const len = parseInt(data.slice(offset, offset + 64), 16)
    const strHex = data.slice(offset + 64, offset + 64 + len * 2)
    let out = ''
    for (let i = 0; i < strHex.length; i += 2) {
      const c = parseInt(strHex.slice(i, i + 2), 16)
      if (c === 0) break
      out += String.fromCharCode(c)
    }
    return out
  } catch {
    return ''
  }
}

function decodeUint(hex: string): bigint {
  try {
    if (!hex || hex === '0x') return 0n
    return BigInt(hex)
  } catch {
    return 0n
  }
}

export interface ScanResult {
  address: string
  symbol: string
  name: string
  totalSupply: string
  report: SecurityReport
  raw: {
    hasCode: boolean
    symbolOk: boolean
    nameOk: boolean
  }
}

export async function scanToken(address: string): Promise<ScanResult> {
  const addr = address.trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(addr)) {
    return {
      address,
      symbol: '?',
      name: 'Invalid address',
      totalSupply: '0',
      report: analyzeToken({ address }),
      raw: { hasCode: false, symbolOk: false, nameOk: false },
    }
  }

  const [code, symHex, nameHex, supplyHex] = await Promise.all([
    ethCall(addr, '0x').catch(() => '0x'),
    ethCall(addr, '0x95d89b41').catch(() => '0x'),
    ethCall(addr, '0x06fdde03').catch(() => '0x'),
    ethCall(addr, '0x18160ddd').catch(() => '0x'),
  ])

  const symbol = decodeString(symHex) || 'TOKEN'
  const name = decodeString(nameHex) || 'Unknown'
  const supply = decodeUint(supplyHex)

  const symbolOk = !!decodeString(symHex)
  const nameOk = !!decodeString(nameHex)

  const report = analyzeToken({
    address: addr,
    hasHoneypotSignals: !symbolOk && !nameOk,
  })

  if (!symbolOk) {
    report.checks.push({
      name: 'ERC20 interface',
      status: 'warn',
      detail: 'symbol() did not return a readable string',
    })
    report.score = Math.max(0, report.score - 10)
  }

  return {
    address: addr,
    symbol,
    name,
    totalSupply: supply.toString(),
    report,
    raw: {
      hasCode: true,
      symbolOk,
      nameOk,
    },
  }
}
