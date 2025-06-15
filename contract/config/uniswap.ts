export interface UniswapAddresses {
  factory: string;
  router: string;
  weth?: string;
}

export const uniswapAddresses: Record<number, UniswapAddresses> = {
  // Ethereum Mainnet
  1: {
    factory: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
    router: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  },
  // Hardhat (local development)
  31337: {
    weth:    "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6",
    factory: "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318",
    router:  "0x610178dA211FEF7D417bC0e6FeD39F05609AD788",
  },
  // Arbitrum One
  42161: {
    factory: "0xf1D7CC64Fb4452F05c498126312eBE29f30Fbcf9",
    router: "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24",
    weth: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
  },
  // Base
  8453: {
    factory: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6",
    router: "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24",
    weth: "0x4200000000000000000000000000000000000006",
  },
};
