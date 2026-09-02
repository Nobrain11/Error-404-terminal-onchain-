/** Multi-RPC client for Robinhood Chain with fallbacks */

const RPCS = [
  ...(typeof import.meta !== 'undefined' && import.meta.env?.VITE_RPC_URL
    ? [import.meta.env.VITE_RPC_URL as string]
    : []),
  'https://rpc.mainnet.chain.robinhood.com',
  'https://robinhood-mainnet.g.alchemy.com/v2/demo',
]

export type JsonRpcResult<T = unknown> = { result?: T; error?: { message: string; code?: number } }

export async function rpcCall<T = unknown>(
  method: string,
  params: unknown[] = [],
  timeoutMs = 12_000
): Promise<T> {
  let lastError: Error | null = null

  for (const url of RPCS) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status} from ${url}`)
        continue
      }
      const body = (await res.json()) as JsonRpcResult<T>
      if (body.error) {
        lastError = new Error(body.error.message || 'RPC error')
        continue
      }
      return body.result as T
    } catch (e: any) {
      lastError = e instanceof Error ? e : new Error(String(e))
    }
  }
  throw lastError ?? new Error('All RPCs failed')
}

export async function getBlockNumber(): Promise<bigint> {
  const hex = await rpcCall<string>('eth_blockNumber')
  return BigInt(hex)
}

export async function getLogs(filter: {
  address?: string | string[]
  topics?: (string | string[] | null)[]
  fromBlock: string
  toBlock: string
}): Promise<LogEntry[]> {
  return rpcCall<LogEntry[]>('eth_getLogs', [filter])
}

export async function ethCall(to: string, data: string): Promise<string> {
  return rpcCall<string>('eth_call', [{ to, data }, 'latest'])
}

export interface LogEntry {
  address: string
  topics: string[]
  data: string
  blockNumber: string
  transactionHash: string
  logIndex: string
}
