// src/lib/deployments.ts
// This file handles loading deployment configurations based on chain ID

import { mainnet, base, arbitrum } from 'wagmi/chains';

// Type definitions for deployment data
export interface DeploymentAddresses {
  amicaToken: string;
  amicaTokenImpl: string;
  personaFactory: string;
  personaFactoryImpl: string;
  proxyAdmin: string;
  bridgeWrapper?: string;
  bridgeWrapperImpl?: string;
  erc20Implementation: string;
  bridgedAmicaAddress?: string;
  stakingRewards?: string;
}

export interface Deployment {
  chainId: number;
  chainName: string;
  addresses: DeploymentAddresses;
  blockNumber: number;
  timestamp: string;
  deployer: string;
  transactionHashes: Record<string, string>;
}

// Statically import deployment files
// Make sure these files exist in src/deployments/
import baseDeployment from '@/deployments/8453.json';
// import mainnetDeployment from '@/deployments/1.json';
// import arbitrumDeployment from '@/deployments/42161.json';

// Create deployments object
const deployments: Record<number, Deployment> = {
  [base.id]: baseDeployment as Deployment,
  // [mainnet.id]: mainnetDeployment as Deployment,
  // [arbitrum.id]: arbitrumDeployment as Deployment,
};

// Log loaded deployments
console.log('Loaded deployments for chains:', Object.keys(deployments));

// Get deployment for a specific chain
export function getDeployment(chainId: number): Deployment | undefined {
  return deployments[chainId];
}

// Get contract addresses for a specific chain
export function getAddressesForChain(chainId: number): DeploymentAddresses | undefined {
  const deployment = getDeployment(chainId);
  return deployment?.addresses;
}

// Helper to get specific contract address
export function getContractAddress(chainId: number, contract: keyof DeploymentAddresses): string | undefined {
  const addresses = getAddressesForChain(chainId);
  return addresses?.[contract];
}

// Check if chain has bridge wrapper (i.e., not mainnet)
export function hasBridgeWrapper(chainId: number): boolean {
  const addresses = getAddressesForChain(chainId);
  return !!addresses?.bridgeWrapper;
}

// Get bridged AMICA address for a chain
export function getBridgedAmicaAddress(chainId: number): string | undefined {
  const addresses = getAddressesForChain(chainId);
  return addresses?.bridgedAmicaAddress;
}

// Export supported chains with deployment info
export const supportedChains = [/*mainnet, */ base, /*arbitrum*/];

// Chain names mapping
export const chainNames: Record<number, string> = {
  [mainnet.id]: 'ethereum',
  [base.id]: 'base',
  [arbitrum.id]: 'arbitrum',
};

// Helper to check if we have a deployment for a chain
export function hasDeployment(chainId: number): boolean {
  return !!getDeployment(chainId);
}

// Get all deployed chains
export function getDeployedChains(): number[] {
  return Object.keys(deployments).map(id => parseInt(id));
}
