import { useState } from 'react'
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther, type Address, type Hex } from 'viem'
import { buildBuyTx, buildSellTx, buildApproveTx, PROTOCOL_FEE_BPS } from '../lib/swap'
import type { LaunchToken } from '../lib/indexer'

interface Props {
  selected: LaunchToken | null
}

export function SwapPanel({ selected }: Props) {
  const { address, isConnected } = useAccount()
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [amount, setAmount] = useState('0.1')
  const [status, setStatus] = useState<string | null>(null)

  const { sendTransaction, data: txHash, isPending, error, reset } = useSendTransaction()
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  async function onTrade() {
    if (!isConnected || !address || !selected) return
    setStatus(null)
    reset()

    try {
      const token = selected.address as Address

      if (side === 'buy') {
        const eth = amount.trim()
        if (!eth || Number(eth) <= 0) {
          setStatus('Enter a valid ETH amount')
          return
        }
        const tx = buildBuyTx({
          side: 'buy',
          token,
          amountEth: eth,
          recipient: address,
        })
        setStatus(tx.description)
        sendTransaction({
          to: tx.to,
          data: tx.data as Hex,
          value: tx.value,
        })
      } else {
        const whole = amount.trim()
        if (!whole || Number(whole) <= 0) {
          setStatus('Enter token amount to sell')
          return
        }
        const approve = buildApproveTx(token)
        setStatus('Approve router (confirm in wallet), then sell again if needed…')
        sendTransaction({
          to: approve.to,
          data: approve.data as Hex,
          value: 0n,
        })
      }
    } catch (e: any) {
      setStatus(e?.message ?? 'Build failed')
    }
  }

  async function onSellAfterApprove() {
    if (!isConnected || !address || !selected) return
    const token = selected.address as Address
    const amountTokenWei = parseEther(amount.trim() || '0')
    const tx = buildSellTx({
      side: 'sell',
      token,
      amountEth: '0',
      amountTokenWei,
      recipient: address,
    })
    setStatus(tx.description)
    sendTransaction({
      to: tx.to,
      data: tx.data as Hex,
      value: 0n,
    })
  }

  const busy = isPending || confirming

  return (
    <div className="trade-panel">
      <div className="trade-tabs">
        <button className={side === 'buy' ? 'active' : ''} onClick={() => setSide('buy')} type="button">
          BUY
        </button>
        <button className={side === 'sell' ? 'active' : ''} onClick={() => setSide('sell')} type="button">
          SELL
        </button>
      </div>

      <div className="field">
        <label>TOKEN</label>
        <input
          value={selected ? `${selected.symbol} · ${selected.address.slice(0, 10)}…` : ''}
          readOnly
          placeholder="Select from tape"
        />
      </div>

      <div className="field">
        <label>{side === 'buy' ? 'PAY (ETH)' : 'SELL AMOUNT (tokens)'}</label>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>

      <button
        className="btn primary"
        style={{ width: '100%', marginTop: 6 }}
        disabled={!isConnected || !selected || busy}
        onClick={onTrade}
        type="button"
      >
        {!isConnected
          ? 'CONNECT TO TRADE'
          : busy
            ? isPending
              ? 'CONFIRM IN WALLET…'
              : 'CONFIRMING…'
            : side === 'buy'
              ? 'BUY'
              : 'APPROVE + SELL'}
      </button>

      {side === 'sell' && (
        <button
          className="btn"
          style={{ width: '100%', marginTop: 8 }}
          disabled={!isConnected || !selected || busy}
          onClick={onSellAfterApprove}
          type="button"
        >
          SELL (after approve)
        </button>
      )}

      <p style={{ marginTop: 10, fontSize: 11, color: 'var(--muted)' }}>
        Routes via Uniswap V3 SwapRouter02 · fee tier 1% · protocol fee target {PROTOCOL_FEE_BPS / 100}% (not
        skimmed in this phase). You sign every tx. Keys never leave your wallet.
      </p>

      {status && (
        <p style={{ marginTop: 8, fontSize: 11, color: 'var(--green-dim)' }}>{status}</p>
      )}
      {txHash && (
        <p style={{ marginTop: 6, fontSize: 11 }}>
          Tx:{' '}
          <a
            href={`https://robinhoodchain.blockscout.com/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
          >
            {txHash.slice(0, 10)}…
          </a>
          {isSuccess && ' · confirmed'}
        </p>
      )}
      {error && (
        <p style={{ marginTop: 6, fontSize: 11, color: 'var(--red)' }}>
          {error.message?.slice(0, 120) || 'Transaction failed'}
        </p>
      )}
    </div>
  )
}
