/**
 * Token page reads — V2 getReserves / V3 slot0. No fake token0Price.
 * WETH (4663) = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73
 */
import { ethCall } from './rpc'
import { ADDRESSES } from './chain'

const WETH = ADDRESSES.WETH.toLowerCase()

function sel(sig: string): string {
  const m: Record<string, string> = {
    'token0()': '0dfe1681',
    'token1()': 'd21220a7',
    'getReserves()': '0902f1ac',
    'slot0()': '3850c7bd',
    'symbol()': '95d89b41',
    'name()': '06fdde03',
  }
  return '0x' + m[sig]
}

function addrFromWord(hex: string): string {
  return ('0x' + hex.replace(/^0x/, '').slice(-40)).toLowerCase()
}

function decodeString(hex: string): string {
  try {
    if (!hex || hex === '0x') return ''
    const data = hex.startsWith('0x') ? hex.slice(2) : hex
    if (data.length === 64) {
      let s = ''
      for (let i = 0; i < 64; i += 2) {
        const c = parseInt(data.slice(i, i + 2), 16)
        if (!c) break
        s += String.fromCharCode(c)
      }
      if (s) return s
    }
    const offset = parseInt(data.slice(0, 64), 16) * 2
    const len = parseInt(data.slice(offset, offset + 64), 16)
    const strHex = data.slice(offset + 64, offset + 64 + len * 2)
    let out = ''
    for (let i = 0; i < strHex.length; i += 2) {
      const c = parseInt(strHex.slice(i, i + 2), 16)
      if (!c) break
      out += String.fromCharCode(c)
    }
    return out
  } catch {
    return ''
  }
}

export interface TokenPageData {
  token: string
  pairOrPool: string
  symbol: string
  name: string
  isV2: boolean
  isV3: boolean
  reserveToken?: string
  reserveWeth?: string
  priceWeth?: number
  error?: string
}

export async function getTokenPage(pairOrPool: string): Promise<TokenPageData> {
  const pair = pairOrPool.trim().toLowerCase()
  const empty: TokenPageData = {
    token: pair,
    pairOrPool: pair,
    symbol: 'TOKEN',
    name: 'Unknown',
    isV2: false,
    isV3: false,
  }

  try {
    const [t0hex, t1hex] = await Promise.all([
      ethCall(pair, sel('token0()')),
      ethCall(pair, sel('token1()')),
    ])
    const token0 = addrFromWord(t0hex)
    const token1 = addrFromWord(t1hex)
    if (token0 === '0x0000000000000000000000000000000000000000') {
      return { ...empty, error: 'Not a pool/pair (token0 empty)' }
    }

    const isToken0Weth = token0 === WETH
    const isToken1Weth = token1 === WETH
    const token = isToken0Weth ? token1 : isToken1Weth ? token0 : token0

    let isV2 = false
    let isV3 = false
    let reserveToken: string | undefined
    let reserveWeth: string | undefined
    let priceWeth: number | undefined

    try {
      const resHex = await ethCall(pair, sel('getReserves()'))
      const data = resHex.replace(/^0x/, '')
      if (data.length >= 128) {
        const r0 = BigInt('0x' + data.slice(0, 64))
        const r1 = BigInt('0x' + data.slice(64, 128))
        isV2 = true
        const rt = isToken0Weth ? r1 : r0
        const rw = isToken0Weth ? r0 : r1
        reserveToken = rt.toString()
        reserveWeth = rw.toString()
        if (rt > 0n) priceWeth = Number(rw) / Number(rt)
      }
    } catch {
      /* not V2 */
    }

    if (!isV2) {
      try {
        const slot = await ethCall(pair, sel('slot0()'))
        if (slot && slot !== '0x' && slot.length > 10) isV3 = true
      } catch {
        /* neither */
      }
    }

    let symbol = 'TOKEN'
    let name = 'Unknown'
    try {
      const [symH, nameH] = await Promise.all([
        ethCall(token, sel('symbol()')),
        ethCall(token, sel('name()')),
      ])
      symbol = decodeString(symH) || symbol
      name = decodeString(nameH) || name
    } catch {
      /* defaults */
    }

    return { token, pairOrPool: pair, symbol, name, isV2, isV3, reserveToken, reserveWeth, priceWeth }
  } catch (e: any) {
    return { ...empty, error: e?.message ?? 'read failed' }
  }
}
