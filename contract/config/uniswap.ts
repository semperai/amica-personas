export interface UniswapAddresses {
  factory: string;
  router: string;
  weth?: string;
}

// TODO check these addresses for correctness and update if necessary
export const uniswapAddresses: Record<number, UniswapAddresses> = {
  // Ethereum Mainnet
  1: {
    factory: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
    router: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  },
  // Arbitrum One
  42161: {
    factory: "0xf1D7CC64Fb4452F05c498126312eBE29f30Fbcf9",
    router: "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24",
    weth: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  },
  // Optimism
  10: {
    factory: "0x0c3c1c532F1e39EdF36BE9Fe0bE1410313E074Bf",
    router: "0x4A7b5Da61326A6379179b40d00F57E5bbDC962c2",
    weth: "0x4200000000000000000000000000000000000006",
  },
  // Polygon
  137: {
    factory: "0x9e5A52f57b3038F1B8EeE45F28b3C1967e22799C",
    router: "0xedf6066a2b290C185783862C7F4776A2C8077AD1",
    weth: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
  },
  // Base
  8453: {
    factory: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6",
    router: "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24",
    weth: "0x4200000000000000000000000000000000000006",
  },
  // Avalanche
  43114: {
    factory: "0x9e5A52f57b3038F1B8EeE45F28b3C1967e22799C",
    router: "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24",
    weth: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
  },
  // BSC
  56: {
    factory: "0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6",
    router: "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24",
    weth: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
  },
};
