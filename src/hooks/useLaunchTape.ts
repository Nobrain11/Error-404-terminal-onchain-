import { useEffect, useState, useCallback } from 'react'
import { fetchLiveLaunches, getDemoLaunches, type LaunchToken } from '../lib/indexer'

export type { LaunchToken }

export function useLaunchTape(pollMs = 25_000) {
  const [tokens, setTokens] = useState<LaunchToken[]>(() => getDemoLaunches())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [mode, setMode] = useState<'live' | 'demo'>('demo')

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const { tokens: live, error: err } = await fetchLiveLaunches()
      if (live.length > 0) {
        const liveAddrs = new Set(live.map((t) => t.address.toLowerCase()))
        const demo = getDemoLaunches().filter((t) => !liveAddrs.has(t.address.toLowerCase()))
        setTokens([...live, ...demo].slice(0, 30))
        setMode('live')
        setError(null)
      } else {
        setTokens(getDemoLaunches())
        setMode('demo')
        setError(err ?? 'Using demo tape — RPC limited or no recent launches')
      }
      setLastUpdate(new Date())
    } catch (e: any) {
      setTokens(getDemoLaunches())
      setMode('demo')
      setError(e?.message ?? 'Indexer error')
      setLastUpdate(new Date())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, pollMs)
    return () => clearInterval(id)
  }, [refresh, pollMs])

  return { tokens, loading, error, lastUpdate, mode, refresh }
}
