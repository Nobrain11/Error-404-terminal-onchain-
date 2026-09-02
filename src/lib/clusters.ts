/**
 * Holder cluster v0 — same-block first buys sharing funder (tx.from).
 * 5+ wallets, same funder, same first-buy block → bundle risk.
 */
import { getLogs, type LogEntry, rpcCall } from './rpc'

const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

export interface ClusterHit {
  key: string
  block: number
  funder: string
  count: number
  wallets: string[]
}

export interface ClusterReport {
  clusters: ClusterHit[]
  buyerCount: number
  risk: 'ok' | 'warn' | 'danger'
  summary: string
}

function padAddr(topic: string): string {
  return ('0x' + topic.slice(-40)).toLowerCase()
}

export async function findClusters(
  pair: string,
  fromBlock: bigint,
  toBlock: bigint
): Promise<ClusterReport> {
  const pairLc = pair.toLowerCase()
  let logs: LogEntry[] = []
  try {
    logs = await getLogs({
      address: pair,
      topics: [TRANSFER_TOPIC],
      fromBlock: '0x' + fromBlock.toString(16),
      toBlock: toBlock === 0n ? 'latest' : '0x' + toBlock.toString(16),
    })
  } catch {
    return {
      clusters: [],
      buyerCount: 0,
      risk: 'ok',
      summary: 'Could not load Transfer logs (RPC). Cluster scan skipped.',
    }
  }

  const firstBuy = new Map<string, { block: number; tx: string }>()
  for (const log of logs) {
    if (!log.topics || log.topics.length < 3) continue
    const from = padAddr(log.topics[1])
    const to = padAddr(log.topics[2])
    if (from !== pairLc) continue
    if (to === pairLc) continue
    const bn = parseInt(log.blockNumber, 16)
    const prev = firstBuy.get(to)
    if (!prev || bn < prev.block) {
      firstBuy.set(to, { block: bn, tx: log.transactionHash })
    }
  }

  type Row = { wallet: string; block: number; funder: string }
  const rows: Row[] = []
  for (const [wallet, { block, tx }] of firstBuy) {
    try {
      const raw = await rpcCall<{ from: string }>('eth_getTransactionByHash', [tx])
      const funder = (raw?.from || wallet).toLowerCase()
      rows.push({ wallet, block, funder })
    } catch {
      rows.push({ wallet, block, funder: wallet })
    }
  }

  const groups = new Map<string, Row[]>()
  for (const r of rows) {
    const key = `${r.block}-${r.funder}`
    const g = groups.get(key) || []
    g.push(r)
    groups.set(key, g)
  }

  const clusters: ClusterHit[] = []
  for (const [key, g] of groups) {
    if (g.length < 5) continue
    clusters.push({
      key,
      block: g[0].block,
      funder: g[0].funder,
      count: g.length,
      wallets: g.map((x) => x.wallet),
    })
  }
  clusters.sort((a, b) => b.count - a.count)

  const max = clusters[0]?.count ?? 0
  const risk = max >= 15 ? 'danger' : max >= 5 ? 'warn' : 'ok'
  const summary =
    risk === 'danger'
      ? `Large same-block cluster (${max} wallets). Treat as coordinated.`
      : risk === 'warn'
        ? `Cluster of ${max} wallets same block/funder. Dump risk elevated.`
        : rows.length
          ? `No 5+ same-block/funder clusters in window (${rows.length} first buyers).`
          : 'No buyer sample in window.'

  return { clusters, buyerCount: rows.length, risk, summary }
}
