/**
 * Uniswap V3 SwapRouter02 helpers for Robinhood Chain
 * exactInputSingle: ETH → token (buy) or token → ETH (sell)
 *
 * Fee tier for most Pons V1 launches: 10000 (1%)
 * V2 graduated pools may differ — default 10000, overridable.
 */

import { encodeFunctionData, parseEther, type Address, type Hex } from 'viem'
import { ADDRESSES } from './chain'

export const SWAP_ROUTER = ADDRESSES.UNIV3_SWAP_ROUTER as Address
export const WETH = ADDRESSES.WETH as Address

/** SwapRouter02 exactInputSingle ABI fragment */
const exactInputSingleAbi = [
  {
    name: 'exactInputSingle',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'recipient', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMinimum', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint256' },
        ],
      },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
] as const

/** ERC20 approve */
const approveAbi = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

export type SwapSide = 'buy' | 'sell'

export interface BuildSwapParams {
  side: SwapSide
  token: Address
  amountEth: string
  amountTokenWei?: bigint
  recipient: Address
  fee?: number
  slippageBps?: number
}

export interface BuiltTx {
  to: Address
  data: Hex
  value: bigint
  description: string
}

export function buildBuyTx(p: BuildSwapParams): BuiltTx {
  const fee = p.fee ?? 10_000
  const amountIn = parseEther(p.amountEth || '0')

  const data = encodeFunctionData({
    abi: exactInputSingleAbi,
    functionName: 'exactInputSingle',
    args: [
      {
        tokenIn: WETH,
        tokenOut: p.token,
        fee,
        recipient: p.recipient,
        amountIn,
        amountOutMinimum: 0n,
        sqrtPriceLimitX96: 0n,
      },
    ],
  })

  return {
    to: SWAP_ROUTER,
    data,
    value: amountIn,
    description: `Buy ${p.token.slice(0, 10)}… with ${p.amountEth} ETH`,
  }
}

export function buildApproveTx(token: Address, amount: bigint = 2n ** 256n - 1n): BuiltTx {
  const data = encodeFunctionData({
    abi: approveAbi,
    functionName: 'approve',
    args: [SWAP_ROUTER, amount],
  })
  return {
    to: token,
    data,
    value: 0n,
    description: `Approve router to spend token`,
  }
}

export function buildSellTx(p: BuildSwapParams & { amountTokenWei: bigint }): BuiltTx {
  const fee = p.fee ?? 10_000
  const amountIn = p.amountTokenWei

  const data = encodeFunctionData({
    abi: exactInputSingleAbi,
    functionName: 'exactInputSingle',
    args: [
      {
        tokenIn: p.token,
        tokenOut: WETH,
        fee,
        recipient: p.recipient,
        amountIn,
        amountOutMinimum: 0n,
        sqrtPriceLimitX96: 0n,
      },
    ],
  })

  return {
    to: SWAP_ROUTER,
    data,
    value: 0n,
    description: `Sell token ${p.token.slice(0, 10)}… for ETH`,
  }
}

export const PROTOCOL_FEE_BPS = 30 // 0.3%
