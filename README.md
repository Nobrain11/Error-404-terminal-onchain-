# ERROR404 — Robinhood Chain Trading Terminal

Non-custodial trading terminal for **Robinhood Chain** (chain ID `4663`).

> Live Pons launch tape · security scan before entry · in-browser swaps · holder signals · referral links  
> Keys never leave the wallet.

## Quick start

```bash
git clone https://github.com/Nobrain11/Error-404-terminal-onchain-.git
cd Error-404-terminal-onchain-
npm install
npm run dev
```

Open http://localhost:5173

Optional: copy `.env.example` → `.env` and set `VITE_RPC_URL` if the public RPC rate-limits.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Local dev server |
| `npm run build` | Typecheck + production bundle → `dist/` |
| `npm run preview` | Serve `dist/` locally |

## Deploy (Vercel)

1. Import this repo in Vercel
2. Framework: Vite · Build: `npm run build` · Output: `dist`
3. Optional env: `VITE_RPC_URL`

## Modules

| Module | Status |
|--------|--------|
| Launch tape + Pons indexer | Live path + demo fallback |
| Security scan | Client heuristics + eth_call metadata |
| Wallet (4663) | Injected connector |
| Swaps (SwapRouter02) | Buy + approve/sell |
| Holder signals | Concentration, flow, LP |
| Referral | `?ref=` capture + share link |

## Addresses (Robinhood Chain)

| Role | Address |
|------|---------|
| WETH | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` |
| Pons V2 Factory | `0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e` |
| Uniswap V3 Swap Router | `0xCaf681a66D020601342297493863E78C959E5cb2` |

Explorer: https://robinhoodchain.blockscout.com

## Disclaimer

Research tools only. DYOR. Not financial advice.

---

**ERROR404** — Profit not found. Community found.
