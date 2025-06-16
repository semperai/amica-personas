// src/lib/contracts.ts
// Updated contract configuration to use deployment files

import PersonaFactoryABI from '@/abi/PersonaTokenFactory.json';
import AmicaTokenABI from '@/abi/AmicaToken.json';
import BridgeWrapperABI from '@/abi/AmicaBridgeWrapper.json';
import StakingRewardsABI from '@/abi/PersonaStakingRewards.json';
import ERC20ImplementationABI from '@/abi/ERC20Implementation.json';
import { getAddressesForChain as getDeploymentAddresses, getBridgedAmicaAddress as getDeploymentBridgedAddress, hasBridgeWrapper as checkBridgeWrapper } from './deployments';

// Export ABIs
export const FACTORY_ABI = PersonaFactoryABI;
export const AMICA_ABI = AmicaTokenABI;
export const BRIDGE_WRAPPER_ABI = BridgeWrapperABI;
export const STAKING_REWARDS_ABI = StakingRewardsABI;
export const ERC20_IMPLEMENTATION_ABI = ERC20ImplementationABI;

// Re-export deployment helpers
export { getDeploymentAddresses as getAddressesForChain, getDeploymentBridgedAddress as getBridgedAmicaAddress };

// Helper to get specific contract address with type safety
export function getContractAddress(chainId: number, contractName: 'factory' | 'amica' | 'bridgeWrapper' | 'stakingRewards' | 'erc20Implementation'): string | undefined {
  const addresses = getDeploymentAddresses(chainId);
  if (!addresses) return undefined;

  const mapping = {
    factory: addresses.personaFactory,
    amica: addresses.amicaToken,
    bridgeWrapper: addresses.bridgeWrapper,
    stakingRewards: addresses.stakingRewards,
    erc20Implementation: addresses.erc20Implementation,
  };

  return mapping[contractName];
}

// Feature availability helpers
export function hasAgentTokenSupport(chainId: number): boolean {
  // Agent token features are available on all chains where we have deployments
  return !!getDeploymentAddresses(chainId);
}

export function hasStakingRewards(chainId: number): boolean {
  const addresses = getDeploymentAddresses(chainId);
  return !!addresses?.stakingRewards;
}

export function hasBridgeWrapper(chainId: number): boolean {
  return checkBridgeWrapper(chainId);
}

// Constants from contracts
export const PERSONA_TOKEN_SUPPLY = BigInt("1000000000000000000000000000"); // 1B tokens
export const SNAPSHOT_DELAY = 100; // blocks
export const BASIS_POINTS = 10000;

// Standard token allocations
export const STANDARD_LIQUIDITY_AMOUNT = BigInt("333333333000000000000000000"); // ~333.33M tokens
export const STANDARD_BONDING_AMOUNT = BigInt("333333333000000000000000000"); // ~333.33M tokens
export const STANDARD_AMICA_AMOUNT = BigInt("333333334000000000000000000"); // ~333.33M tokens

// Agent token allocations
export const AGENT_LIQUIDITY_AMOUNT = BigInt("333333333000000000000000000"); // ~333.33M tokens
export const AGENT_BONDING_AMOUNT = BigInt("222222222000000000000000000"); // ~222.22M tokens
export const AGENT_AMICA_AMOUNT = BigInt("222222222000000000000000000"); // ~222.22M tokens
export const AGENT_REWARDS_AMOUNT = BigInt("222222223000000000000000000"); // ~222.22M tokens

// Helper function to validate contract setup for a chain
export function validateChainSetup(chainId: number): { isValid: boolean; missingContracts: string[] } {
  const addresses = getDeploymentAddresses(chainId);
  if (!addresses) {
    return { isValid: false, missingContracts: ['all'] };
  }

  const required = ['amicaToken', 'personaFactory', 'erc20Implementation'];
  const missing = required.filter(contract => !addresses[contract as keyof typeof addresses]);

  // Check chain-specific requirements
  if (chainId !== 1 && !addresses.bridgeWrapper) {
    missing.push('bridgeWrapper');
  }

  return {
    isValid: missing.length === 0,
    missingContracts: missing
  };
}
