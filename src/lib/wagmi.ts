/**
 * Wagmi + RainbowKit config — Robinhood Chain only (4663)
 */
import { http, createConfig } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { robinhoodChain } from './chain'

export const config = createConfig({
  chains: [robinhoodChain],
  connectors: [
    injected({
      shimDisconnect: true,
    }),
  ],
  transports: {
    [robinhoodChain.id]: http('https://rpc.mainnet.chain.robinhood.com'),
  },
  ssr: false,
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
