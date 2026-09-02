/**
 * Pons launch indexer for Robinhood Chain
 */
import { ADDRESSES } from './chain'
import { getBlockNumber, getLogs, ethCall, type LogEntry } from './rpc'
import { analyzeToken, type SecurityReport } from './security'

export interface LaunchToken {
  address: string
  symbol: string
  name: string
  deployer: string
  ageSeconds: number
  volumeEth: number
  liquidityEth: number
  buys: number
  sells: number
  changePct: number
  report: SecurityReport
  source: 'live' | 'demo'
  txHash?: string
  blockNumber?: number
}

const WINDOW_BLOCKS = 3_000n

function padAddress(topic: string): string {
  return ('0x' + topic.slice(-40)).toLowerCase()
}

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
    return out || '???'
  } catch {
    return '???'
  }
}

async function readTokenMeta(address: string): Promise<{ symbol: string; name: string }> {
  try {
    const [symHex, nameHex] = await Promise.all([
      ethCall(address, '0x95d89b41').catch(() => '0x'),
      ethCall(address, '0x06fdde03').catch(() => '0x'),
    ])
    return {
      symbol: decodeString(symHex).slice(0, 12) || 'TOKEN',
      name: decodeString(nameHex).slice(0, 32) || 'Unknown',
    }
  } catch {
    return { symbol: 'TOKEN', name: 'Unknown' }
  }
}

function logToPartial(log: LogEntry): { token: string; deployer: string; txHash: string; block: number } | null {
  if (!log.topics || log.topics.length < 3) return null
  const token = padAddress(log.topics[1])
  const deployer = padAddress(log.topics[2])
  if (!token.startsWith('0x') || token.length !== 42) return null
  return {
    token,
    deployer,
    txHash: log.transactionHash,
    block: parseInt(log.blockNumber, 16),
  }
}

export async function fetchLiveLaunches(): Promise<{ tokens: LaunchToken[]; error?: string }> {
  try {
    const latest = await getBlockNumber()
    const from = latest > WINDOW_BLOCKS ? latest - WINDOW_BLOCKS : 0n
    const factories = [ADDRESSES.PONS_V2_FACTORY, ADDRESSES.PONS_V1_FACTORY]
    const allLogs: LogEntry[] = []
    for (const factory of factories) {
      try {
        const logs = await getLogs({
          address: factory,
          fromBlock: '0x' + from.toString(16),
          toBlock: 'latest',
        })
        allLogs.push(...(logs || []))
      } catch {
        /* continue */
      }
    }

    const byToken = new Map<string, ReturnType<typeof logToPartial>>()
    for (const log of allLogs) {
      const partial = logToPartial(log)
      if (!partial) continue
      const prev = byToken.get(partial.token)
      if (!prev || partial.block > prev.block) byToken.set(partial.token, partial)
    }

    const entries = [...byToken.values()].slice(0, 25)
    if (entries.length === 0) {
      return {
        tokens: [],
        error: allLogs.length === 0 ? 'No recent logs (RPC restricted or quiet window)' : 'Could not decode logs',
      }
    }

    const nowBlock = Number(latest)
    const SEC_PER_BLOCK = 0.2
    const tokens: LaunchToken[] = []
    for (const e of entries) {
      const meta = await readTokenMeta(e.token)
      const ageBlocks = Math.max(0, nowBlock - e.block)
      const ageSeconds = Math.floor(ageBlocks * SEC_PER_BLOCK)
      const report = analyzeToken({
        address: e.token,
        deployer: e.deployer,
        ageSeconds,
        lpLocked: undefined,
      })
      tokens.push({
        address: e.token,
        symbol: meta.symbol,
        name: meta.name,
        deployer: e.deployer,
        ageSeconds,
        volumeEth: 0,
        liquidityEth: 0,
        buys: 0,
        sells: 0,
        changePct: 0,
        report,
        source: 'live',
        txHash: e.txHash,
        blockNumber: e.block,
      })
    }
    tokens.sort((a, b) => (b.blockNumber ?? 0) - (a.blockNumber ?? 0))
    return { tokens }
  } catch (e: any) {
    return { tokens: [], error: e?.message ?? 'Indexer failed' }
  }
}

export function getDemoLaunches(): LaunchToken[] {
  const base = [
    {
      address: '0x1111111111111111111111111111111111111111',
      symbol: 'ERROR',
      name: 'Error404',
      deployer: '0xabcdef0000000000000000000000000000000001',
      ageSeconds: 420,
      volumeEth: 18.4,
      liquidityEth: 4.2,
      buys: 142,
      sells: 31,
      changePct: 340,
      lpLocked: true,
      topHolderPct: 8,
    },
    {
      address: '0x2222222222222222222222222222222222222222',
      symbol: 'PONS',
      name: 'Pons',
      deployer: '0x2222222222222222222222222222222222222222',
      ageSeconds: 86400 * 40,
      volumeEth: 920,
      liquidityEth: 180,
      buys: 8400,
      sells: 6100,
      changePct: 12.4,
      lpLocked: true,
      topHolderPct: 6,
    },
    {
      address: '0x3333333333333333333333333333333333333333',
      symbol: 'RUGME',
      name: 'Definitely Not A Rug',
      deployer: '0xdeadbeef00000000000000000000000000000001',
      ageSeconds: 95,
      volumeEth: 2.1,
      liquidityEth: 0.4,
      buys: 28,
      sells: 0,
      changePct: 890,
      lpLocked: false,
      topHolderPct: 62,
      hasHoneypotSignals: true,
      sellTaxBps: 2500,
    },
    {
      address: '0x4444444444444444444444444444444444444444',
      symbol: 'HOOD',
      name: 'Hood Terminal',
      deployer: '0x4444444444444444444444444444444444444444',
      ageSeconds: 3600 * 6,
      volumeEth: 11.2,
      liquidityEth: 3.8,
      buys: 210,
      sells: 88,
      changePct: -14.2,
      lpLocked: true,
      topHolderPct: 18,
    },
    {
      address: '0x5555555555555555555555555555555555555555',
      symbol: 'SNIPE',
      name: 'Snipe Protocol',
      deployer: '0x5555555555555555555555555555555555555555',
      ageSeconds: 180,
      volumeEth: 6.7,
      liquidityEth: 2.1,
      buys: 89,
      sells: 12,
      changePct: 156,
      lpLocked: true,
      topHolderPct: 22,
    },
  ]

  return base.map((t) => ({
    address: t.address,
    symbol: t.symbol,
    name: t.name,
    deployer: t.deployer,
    ageSeconds: t.ageSeconds,
    volumeEth: t.volumeEth,
    liquidityEth: t.liquidityEth,
    buys: t.buys,
    sells: t.sells,
    changePct: t.changePct,
    source: 'demo' as const,
    report: analyzeToken({
      address: t.address,
      deployer: t.deployer,
      ageSeconds: t.ageSeconds,
      lpLocked: t.lpLocked,
      topHolderPct: t.topHolderPct,
      hasHoneypotSignals: (t as any).hasHoneypotSignals,
      sellTaxBps: (t as any).sellTaxBps,
    }),
  }))
}
