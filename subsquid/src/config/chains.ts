// src/config/chains.ts
import { lookupArchive } from '@subsquid/archive-registry'

export interface ChainConfig {
  id: number
  name: string
  archive: string
  rpcUrl: string
  deploymentBlock: number
  factoryAddress: string
  amicaToken: string
  bridgeWrapperAddress?: string
  stakingRewardsAddress?: string
}

// Format entity IDs to include chain for cross-chain uniqueness
export function formatChainEntityId(chainId: number, localId: string): string {
  return `${chainId}-${localId}`
}

// Chain configurations - Only Ethereum and Base at launch
export const CHAIN_CONFIGS = {
  // Ethereum Mainnet
  ethereum: {
    id: 1,
    name: 'Ethereum',
    archive: lookupArchive('eth-mainnet'),
    rpcUrl: process.env.ETHEREUM_RPC || 'https://eth.llamarpc.com',
    deploymentBlock: parseInt(process.env.ETHEREUM_DEPLOYMENT_BLOCK || '0'),
    factoryAddress: process.env.ETHEREUM_FACTORY_ADDRESS || '0x...',
    amicaToken: process.env.ETHEREUM_AMICA_TOKEN || '0x...',
    stakingRewardsAddress: process.env.ETHEREUM_STAKING_REWARDS || '0x...'
  },

  // Base
  base: {
    id: 8453,
    name: 'Base',
    archive: lookupArchive('base-mainnet'),
    rpcUrl: process.env.BASE_RPC || 'https://mainnet.base.org',
    deploymentBlock: parseInt(process.env.BASE_DEPLOYMENT_BLOCK || '0'),
    factoryAddress: process.env.BASE_FACTORY_ADDRESS || '0x...',
    amicaToken: process.env.BASE_AMICA_TOKEN || '0x...',
    bridgeWrapperAddress: process.env.BASE_BRIDGE_WRAPPER || '0x...',
    stakingRewardsAddress: process.env.BASE_STAKING_REWARDS || '0x...'
  }
} as const

// Get chain name by ID
export function getChainName(chainId: number): string {
  const chain = Object.values(CHAIN_CONFIGS).find(c => c.id === chainId)
  return chain?.name || `Chain ${chainId}`
}

// Get all configured chains
export function getAllChains(): ChainConfig[] {
  return Object.values(CHAIN_CONFIGS)
}

// Get chain by ID
export function getChainById(chainId: number): ChainConfig | undefined {
  return Object.values(CHAIN_CONFIGS).find(c => c.id === chainId)
}

// Get chain by name
export function getChainByName(name: string): ChainConfig | undefined {
  const key = name.toLowerCase() as keyof typeof CHAIN_CONFIGS
  return CHAIN_CONFIGS[key]
}
