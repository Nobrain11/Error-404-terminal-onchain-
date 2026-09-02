import { useMemo } from 'react'
import type { LaunchToken } from '../lib/indexer'
import { buildHolderSnapshot } from '../lib/holders'
import { EXPLORER } from '../lib/chain'

const severityColor: Record<string, string> = {
  ok: 'var(--green)',
  info: 'var(--muted)',
  warn: 'var(--yellow)',
  danger: 'var(--red)',
}

export function HolderMap({ selected }: { selected: LaunchToken | null }) {
  const snap = useMemo(
    () => (selected ? buildHolderSnapshot(selected, EXPLORER) : null),
    [selected]
  )

  if (!selected || !snap) {
    return (
      <div className="panel-body" style={{ padding: 14 }}>
        <div className="empty">Select a token</div>
      </div>
    )
  }

  return (
    <div className="panel-body" style={{ padding: 14 }}>
      <p style={{ marginBottom: 10, color: 'var(--muted)' }}>
        Clusters for <strong style={{ color: 'var(--text)' }}>{snap.symbol}</strong>
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, fontSize: 12, marginBottom: 12 }}>
        <div style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 6 }}>
          <div style={{ color: 'var(--muted)', marginBottom: 4 }}>Top holder</div>
          <div style={{ color: (snap.topHolderPct ?? 0) >= 40 ? 'var(--red)' : 'var(--green)' }}>
            {snap.topHolderPct != null ? `~${snap.topHolderPct}%` : 'n/a'}
          </div>
        </div>
        <div style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 6 }}>
          <div style={{ color: 'var(--muted)', marginBottom: 4 }}>Buys / Sells</div>
          <div>
            {selected.buys} / {selected.sells}
          </div>
        </div>
        <div style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 6 }}>
          <div style={{ color: 'var(--muted)', marginBottom: 4 }}>Deployer</div>
          <a href={snap.deployerUrl} target="_blank" rel="noreferrer">
            {snap.deployerShort}
          </a>
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>{snap.summary}</div>

      <ul className="check-list">
        {snap.signals.map((s) => (
          <li key={s.id}>
            <span className="check-icon" style={{ color: severityColor[s.severity] }}>
              {s.severity === 'ok' ? '✓' : s.severity === 'danger' ? '✗' : s.severity === 'warn' ? '!' : '·'}
            </span>
            <div>
              <strong>{s.label}</strong>
              <div style={{ color: 'var(--muted)' }}>{s.detail}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
