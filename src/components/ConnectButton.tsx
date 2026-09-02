import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi'
import { robinhoodChain } from '../lib/chain'

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function ConnectButton() {
  const { address, isConnected, isConnecting } = useAccount()
  const { connect, connectors, isPending, error } = useConnect()
  const { disconnect } = useDisconnect()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()

  const wrongChain = isConnected && chainId !== robinhoodChain.id

  if (isConnected && address) {
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {wrongChain && (
          <button
            className="btn"
            style={{ borderColor: 'var(--yellow)', color: 'var(--yellow)' }}
            onClick={() => switchChain?.({ chainId: robinhoodChain.id })}
          >
            Switch to 4663
          </button>
        )}
        <button className="btn" onClick={() => disconnect()}>
          {short(address)} · Disconnect
        </button>
      </div>
    )
  }

  const injected = connectors.find((c) => c.id === 'injected') ?? connectors[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
      <button
        className="btn primary"
        disabled={isConnecting || isPending || !injected}
        onClick={() => injected && connect({ connector: injected, chainId: robinhoodChain.id })}
      >
        {isConnecting || isPending ? 'Connecting…' : 'Connect Wallet'}
      </button>
      {error && (
        <span style={{ fontSize: 10, color: 'var(--red)' }}>{error.message.slice(0, 60)}</span>
      )}
    </div>
  )
}
