// Chain configuration for multichain support

export interface ChainConfig {
  id: number
  name: string
  rpcUrl: string
  archive: string
  amicaToken: string
  factoryAddress: string
  bridgeWrapperAddress?: string
  deploymentBlock: number
  isMainnet: boolean
}

export const CHAIN_CONFIGS: Record<number, ChainConfig> = {
  // Ethereum Mainnet
  1: {
    id: 1,
    name: 'ethereum',
    rpcUrl: process.env.ETHEREUM_RPC || 'https://mainnet.infura.io/v3/YOUR_KEY',
    archive: 'https://v2.archive.subsquid.io/network/ethereum-mainnet',
    amicaToken: '0x...', // Your AMICA token on Ethereum
    factoryAddress: '0x...', // PersonaTokenFactory on Ethereum
    bridgeWrapperAddress: undefined, // No wrapper on mainnet
    deploymentBlock: 0, // Your deployment block
    isMainnet: true
  },
  
  // Base
  8453: {
    id: 8453,
    name: 'base',
    rpcUrl: process.env.BASE_RPC || 'https://mainnet.base.org',
    archive: 'https://v2.archive.subsquid.io/network/base-mainnet',
    amicaToken: '0x...', // Native AMICA on Base
    factoryAddress: '0x...', // PersonaTokenFactory on Base
    bridgeWrapperAddress: '0x...', // Bridge wrapper on Base
    deploymentBlock: 0, // Your deployment block
    isMainnet: false
  },
  
  // Arbitrum One
  42161: {
    id: 42161,
    name: 'arbitrum',
    rpcUrl: process.env.ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc',
    archive: 'https://v2.archive.subsquid.io/network/arbitrum-one',
    amicaToken: '0x...', // Native AMICA on Arbitrum
    factoryAddress: '0x...', // PersonaTokenFactory on Arbitrum
    bridgeWrapperAddress: '0x...', // Bridge wrapper on Arbitrum
    deploymentBlock: 0, // Your deployment block
    isMainnet: false
  },
  
  // Add more chains as needed
}

// Get enabled chains from environment
export function getEnabledChains(): ChainConfig[] {
  const enabledChainIds = process.env.ENABLED_CHAINS
    ? process.env.ENABLED_CHAINS.split(',').map(id => parseInt(id.trim()))
    : Object.keys(CHAIN_CONFIGS).map(Number)
  
  return enabledChainIds
    .map(id => CHAIN_CONFIGS[id])
    .filter(config => config !== undefined)
}

// Helper to get chain name
export function getChainName(chainId: number): string {
  return CHAIN_CONFIGS[chainId]?.name || `chain-${chainId}`
}

// Helper to format chain-specific ID
export function formatChainEntityId(chainId: number, localId: string): string {
  return `${chainId}-${localId}`
}
