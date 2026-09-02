import { useState } from 'react'
import { useLaunchTape, type LaunchToken } from './hooks/useLaunchTape'
import { analyzeToken, type SecurityReport } from './lib/security'
import { scanToken } from './lib/scan'
import { EXPLORER } from './lib/chain'
import { ConnectButton } from './components/ConnectButton'
import { SwapPanel } from './components/SwapPanel'
import { HolderMap } from './components/HolderMap'
import { ReferralPanel } from './components/ReferralPanel'

function formatAge(s: number) {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

function formatEth(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  if (n >= 10) return n.toFixed(1)
  return n.toFixed(2)
}

export default function App() {
  const { tokens, loading, error, lastUpdate, mode, refresh } = useLaunchTape()
  const [selected, setSelected] = useState<LaunchToken | null>(tokens[0] ?? null)
  const [scanAddr, setScanAddr] = useState('')
  const [scanReport, setScanReport] = useState<SecurityReport | null>(null)
  const [scanning, setScanning] = useState(false)

  const activeReport = scanReport ?? selected?.report ?? null

  async function runScan() {
    if (!scanAddr.trim()) return
    setScanning(true)
    try {
      const result = await scanToken(scanAddr.trim())
      setScanReport(result.report)
    } catch {
      setScanReport(analyzeToken({ address: scanAddr.trim(), lpLocked: undefined, ageSeconds: 0 }))
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <h1>ERROR404</h1>
          <span className="tag">ROBINHOOD CHAIN TERMINAL</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="badge">
            <span className="dot" />
            {`CHAIN 4663 · ${mode === 'live' ? 'LIVE INDEX' : 'DEMO TAPE'}`}
          </span>
          <ConnectButton />
        </div>
      </header>

      <div className="grid">
        <section className="panel">
          <div className="panel-header">
            <h2>Launch Tape · Pons</h2>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                {loading ? 'syncing…' : `updated ${lastUpdate.toLocaleTimeString()}`}
              </span>
              <button className="btn" onClick={refresh} disabled={loading} style={{ padding: '4px 10px' }}>
                ↻
              </button>
            </div>
          </div>
          <div className="panel-body">
            <div className="tape-row" style={{ fontSize: 10, color: 'var(--muted)', cursor: 'default' }}>
              <span>AGE</span>
              <span>TOKEN</span>
              <span>VOL</span>
              <span>LIQ</span>
              <span>Δ%</span>
              <span>VERDICT</span>
            </div>
            {tokens.map((t) => (
              <div
                key={t.address}
                className={`tape-row ${selected?.address === t.address ? 'active' : ''}`}
                onClick={() => {
                  setSelected(t)
                  setScanReport(null)
                  setScanAddr(t.address)
                }}
              >
                <span className="token-age">{formatAge(t.ageSeconds)}</span>
                <div>
                  <div className="token-sym">{t.symbol}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>{t.name}</div>
                </div>
                <span className="token-vol">{formatEth(t.volumeEth)} Ξ</span>
                <span className="token-liq">{formatEth(t.liquidityEth)} Ξ</span>
                <span className={`token-chg ${t.changePct >= 0 ? 'up' : 'down'}`}>
                  {t.changePct >= 0 ? '+' : ''}
                  {t.changePct.toFixed(1)}%
                </span>
                <span className={`verdict ${t.report.verdict}`}>{t.report.verdict}</span>
              </div>
            ))}
            {tokens.length === 0 && <div className="empty">No launches in window</div>}
            {error && (
              <div className="empty" style={{ color: 'var(--yellow)' }}>
                RPC note: {error} — showing demo tape
              </div>
            )}
          </div>
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <section className="panel">
            <div className="panel-header">
              <h2>Security Layer</h2>
              <span className="badge">AUTO · PRE-ENTRY</span>
            </div>
            <div className="scan-panel">
              <div className="scan-input-row">
                <input
                  placeholder="Paste token address (0x…)"
                  value={scanAddr}
                  onChange={(e) => setScanAddr(e.target.value)}
                  spellCheck={false}
                />
                <button className="btn" onClick={runScan} disabled={scanning}>
                  {scanning ? '…' : 'SCAN'}
                </button>
              </div>

              {activeReport ? (
                <>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 8 }}>
                    <div
                      className="score-ring"
                      style={{
                        borderColor:
                          activeReport.verdict === 'SAFE'
                            ? 'var(--green)'
                            : activeReport.verdict === 'CAUTION'
                              ? 'var(--yellow)'
                              : 'var(--red)',
                        color:
                          activeReport.verdict === 'SAFE'
                            ? 'var(--green)'
                            : activeReport.verdict === 'CAUTION'
                              ? 'var(--yellow)'
                              : 'var(--red)',
                      }}
                    >
                      {activeReport.score}
                    </div>
                    <div>
                      <div className={`verdict ${activeReport.verdict}`} style={{ marginBottom: 4 }}>
                        {activeReport.verdict}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{activeReport.summary}</div>
                    </div>
                  </div>
                  <ul className="check-list">
                    {activeReport.checks.map((c) => (
                      <li key={c.name}>
                        <span className={`check-icon ${c.status}`}>
                          {c.status === 'pass' ? '✓' : c.status === 'fail' ? '✗' : c.status === 'warn' ? '!' : '·'}
                        </span>
                        <div>
                          <strong>{c.name}</strong>
                          <div style={{ color: 'var(--muted)' }}>{c.detail}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="empty">Select a token or paste an address to scan</div>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <h2>Trading Engine</h2>
              <span className="badge">NON-CUSTODIAL · 0.3% FEE</span>
            </div>
            <SwapPanel selected={selected} />
          </section>
        </div>
      </div>

      <div className="grid" style={{ marginTop: 14 }}>
        <section className="panel">
          <div className="panel-header">
            <h2>Holder Map · Cluster Detection</h2>
          </div>
          <HolderMap selected={selected} />
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Profiles · Referral Flywheel</h2>
          </div>
          <ReferralPanel />
        </section>
      </div>

      <footer className="footer">
        <div>ERROR404 · Non-custodial · Robinhood Chain (4663) · Pons-native terminal</div>
        <div>
          <a href="https://robinhoodchain.blockscout.com" target="_blank" rel="noreferrer">
            Explorer
          </a>
          {' · '}
          <a href="https://docs.robinhood.com/chain" target="_blank" rel="noreferrer">
            Chain docs
          </a>
          {' · '}
          <a href="https://github.com/Nobrain11/Error-404-terminal-onchain-" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
      </footer>
    </div>
  )
}
