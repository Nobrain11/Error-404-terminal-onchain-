import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import {
  captureRefFromUrl,
  getStoredRef,
  buildReferralLink,
  setSelfRefCode,
  shortAddr,
} from '../lib/referral'

export function ReferralPanel() {
  const { address, isConnected } = useAccount()
  const [storedRef, setStoredRef] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const r = captureRefFromUrl()
    setStoredRef(r ?? getStoredRef())
  }, [])

  useEffect(() => {
    if (address) setSelfRefCode(address)
  }, [address])

  const link = address ? buildReferralLink(address) : null

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="referral-box">
      <p style={{ marginBottom: 8 }}>
        Every invite earns the referrer a cut of swap fees — on-chain, forever (contract phase next).
      </p>

      {storedRef && (
        <p style={{ marginBottom: 8, fontSize: 11 }}>
          You were referred by <code>{shortAddr(storedRef)}</code>
        </p>
      )}

      {isConnected && link ? (
        <>
          <p style={{ marginBottom: 6 }}>Your link:</p>
          <p style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <code style={{ wordBreak: 'break-all' }}>{link}</code>
            <button className="btn" type="button" onClick={copy} style={{ padding: '4px 10px' }}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </p>
        </>
      ) : (
        <p>
          Your link: <code>connect wallet to generate</code>
        </p>
      )}

      <p style={{ marginTop: 10, color: 'var(--muted)' }}>
        Leaderboard (PnL / volume) activates when fee split is live. Ref is stored locally from{' '}
        <code>?ref=0x…</code> and will be passed into swap metadata / fee router later.
      </p>
    </div>
  )
}
