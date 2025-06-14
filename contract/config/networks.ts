export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl?: string;
  blockExplorer?: string;
  nativeCurrency?: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export const networks: Record<string, NetworkConfig> = {
  mainnet: {
    chainId: 1,
    name: "Ethereum Mainnet",
    blockExplorer: "https://etherscan.io",
  },
  arbitrum: {
    chainId: 42161,
    name: "Arbitrum One",
    blockExplorer: "https://arbiscan.io",
  },
  optimism: {
    chainId: 10,
    name: "Optimism",
    blockExplorer: "https://optimistic.etherscan.io",
  },
  polygon: {
    chainId: 137,
    name: "Polygon",
    blockExplorer: "https://polygonscan.com",
  },
  base: {
    chainId: 8453,
    name: "Base",
    blockExplorer: "https://basescan.org",
  },
  avalanche: {
    chainId: 43114,
    name: "Avalanche",
    blockExplorer: "https://snowtrace.io",
  },
  bsc: {
    chainId: 56,
    name: "BSC",
    blockExplorer: "https://bscscan.com",
  },
};
