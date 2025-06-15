// src/lib/contracts.ts
// Updated contract configuration with all the new contracts

import PersonaFactoryABI from '@/abi/PersonaTokenFactory.json';
import AmicaTokenABI from '@/abi/AmicaToken.json';
import BridgeWrapperABI from '@/abi/AmicaBridgeWrapper.json';

// Chain-specific addresses - UPDATE THESE WITH YOUR DEPLOYED ADDRESSES
export const ADDRESSES = {
  1: { // Ethereum Mainnet
    factory: '0x...', // PersonaTokenFactory address
    amica: '0x...', // AMICA token address
    bridgeWrapper: undefined, // No bridge wrapper on mainnet
    stakingRewards: '0x...', // PersonaStakingRewards address
    erc20Implementation: '0x...' // ERC20Implementation address
  },
  8453: { // Base
    factory: '0x...', // PersonaTokenFactory address
    amica: '0x...', // AMICA token address (native version)
    bridgeWrapper: '0x...', // AmicaBridgeWrapper address
    stakingRewards: '0x...', // PersonaStakingRewards address
    erc20Implementation: '0x...' // ERC20Implementation address
  },
  42161: { // Arbitrum
    factory: '0x...', // PersonaTokenFactory address
    amica: '0x...', // AMICA token address (native version)
    bridgeWrapper: '0x...', // AmicaBridgeWrapper address
    stakingRewards: '0x...', // PersonaStakingRewards address
    erc20Implementation: '0x...' // ERC20Implementation address
  }
} as const;

// Export ABIs
export const FACTORY_ABI = PersonaFactoryABI;
export const AMICA_ABI = AmicaTokenABI;
export const BRIDGE_WRAPPER_ABI = BridgeWrapperABI;

// Helper to get addresses for current chain
export function getAddressesForChain(chainId: number) {
  return ADDRESSES[chainId as keyof typeof ADDRESSES] || ADDRESSES[1];
}

// New helper functions for contract features
export function hasAgentTokenSupport(chainId: number): boolean {
  // Agent token features are available on all chains
  return true;
}

export function hasStakingRewards(chainId: number): boolean {
  const addresses = getAddressesForChain(chainId);
  return !!addresses.stakingRewards;
}

export function hasBridgeWrapper(chainId: number): boolean {
  const addresses = getAddressesForChain(chainId);
  return !!addresses.bridgeWrapper;
}

// Constants from contracts
export const PERSONA_TOKEN_SUPPLY = BigInt("1000000000000000000000000000"); // 1B tokens
export const SNAPSHOT_DELAY = 100; // blocks
export const BASIS_POINTS = 10000;
