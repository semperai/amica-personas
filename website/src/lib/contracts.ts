// Import your ABI from the abi folder
import PersonaFactoryABI from '@/abi/PersonaTokenFactory.json';
import AmicaTokenABI from '@/abi/AmicaToken.json';
import BridgeWrapperABI from '@/abi/AmicaBridgeWrapper.json';

// Chain-specific addresses
export const ADDRESSES = {
  1: { // Ethereum
    factory: '0x...', // Your PersonaTokenFactory on Ethereum
    amica: '0x...', // Your AMICA token on Ethereum
    bridgeWrapper: undefined
  },
  8453: { // Base
    factory: '0x...', // Your PersonaTokenFactory on Base
    amica: '0x...', // Your AMICA token on Base
    bridgeWrapper: '0x...' // Your BridgeWrapper on Base
  },
  42161: { // Arbitrum
    factory: '0x...', // Your PersonaTokenFactory on Arbitrum
    amica: '0x...', // Your AMICA token on Arbitrum
    bridgeWrapper: '0x...' // Your BridgeWrapper on Arbitrum
  }
} as const;

// Export ABIs with different names to avoid conflicts
export const FACTORY_ABI = PersonaFactoryABI;
export const AMICA_ABI = AmicaTokenABI;
export const BRIDGE_WRAPPER_ABI = BridgeWrapperABI;

// Default to Ethereum addresses (you should make this dynamic based on current chain)
export const FACTORY_ADDRESS = ADDRESSES[1].factory;
export const AMICA_ADDRESS = ADDRESSES[1].amica;

// Helper to get addresses for current chain
export function getAddressesForChain(chainId: number) {
  return ADDRESSES[chainId as keyof typeof ADDRESSES] || ADDRESSES[1];
}
