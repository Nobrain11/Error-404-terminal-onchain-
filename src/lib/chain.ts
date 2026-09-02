import { defineChain } from 'viem'

/** Robinhood Chain mainnet — chain ID 4663 */
export const robinhoodChain = defineChain({
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.mainnet.chain.robinhood.com'] },
    public: { http: ['https://rpc.mainnet.chain.robinhood.com'] },
  },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://robinhoodchain.blockscout.com' },
  },
})

export const ADDRESSES = {
  WETH: '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73' as const,
  PONS_V1_FACTORY: '0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB' as const,
  PONS_V2_FACTORY: '0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e' as const,
  PONS_V2_ROUTER: '0xe33e9e479df8802cb0866d5d05258bec4cf62948' as const,
  PONS_V2_HOOK: '0xe5e702641ea86f4ae6cc3cdaed2b886f976be044' as const,
  UNIV3_FACTORY: '0x1f7d7550B1b028f7571E69A784071F0205FD2EfA' as const,
  UNIV3_POSITION_MANAGER: '0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3' as const,
  UNIV3_SWAP_ROUTER: '0xCaf681a66D020601342297493863E78C959E5cb2' as const,
  V4_POOL_MANAGER: '0x8366a39cc670b4001a1121b8f6a443a643e40951' as const,
} as const

export const EXPLORER = 'https://robinhoodchain.blockscout.com'
