// Mock data for testing without API
export const mockPersonas = [
  {
    id: "1-0",
    tokenId: "0",
    name: "CryptoSage AI",
    symbol: "SAGE",
    creator: "0x1234567890123456789012345678901234567890",
    erc20Token: "0xabcdef1234567890123456789012345678901234",
    pairToken: "0x1111111111111111111111111111111111111111",
    pairCreated: true,
    pairAddress: "0x2222222222222222222222222222222222222222",
    totalVolume24h: "125000000000000000000", // 125 ETH
    totalVolumeAllTime: "2500000000000000000000", // 2500 ETH
    totalTrades24h: 42,
    totalTradesAllTime: 850,
    uniqueTraders24h: 18,
    uniqueTradersAllTime: 124,
    totalDeposited: "1000000000000000000000", // 1000 ETH
    tokensSold: "750000000000000000000000", // 750k tokens
    graduationThreshold: "1000000000000000000000", // 1000 ETH
    isGraduated: true,
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    chain: { id: "1", name: "ethereum" },
    growthMultiplier: 2.5,
    metadata: [
      { key: "website", value: "https://cryptosage.ai" },
      { key: "twitter", value: "@cryptosageai" },
      { key: "description", value: "AI-powered crypto analysis and predictions" }
    ]
  },
  {
    id: "8453-1",
    tokenId: "1",
    name: "MemeLord Bot",
    symbol: "MEME",
    creator: "0x9876543210987654321098765432109876543210",
    erc20Token: "0xfedcba9876543210987654321098765432109876",
    pairToken: "0x3333333333333333333333333333333333333333",
    pairCreated: false,
    totalVolume24h: "75000000000000000000", // 75 ETH
    totalVolumeAllTime: "450000000000000000000", // 450 ETH
    totalTrades24h: 28,
    totalTradesAllTime: 320,
    uniqueTraders24h: 12,
    uniqueTradersAllTime: 65,
    totalDeposited: "450000000000000000000", // 450 ETH
    tokensSold: "450000000000000000000000", // 450k tokens
    graduationThreshold: "1000000000000000000000", // 1000 ETH
    isGraduated: false,
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    chain: { id: "8453", name: "base" },
    growthMultiplier: 1.8,
    metadata: [
      { key: "telegram", value: "@memelordbot" },
      { key: "description", value: "The ultimate meme creation and sharing bot" }
    ]
  },
  {
    id: "42161-2",
    tokenId: "2",
    name: "DeFi Assistant",
    symbol: "DEFI",
    creator: "0xaaaabbbbccccddddeeeeffffgggghhhhiiiijjjj",
    erc20Token: "0x4444444444444444444444444444444444444444",
    pairToken: "0x5555555555555555555555555555555555555555",
    pairCreated: true,
    pairAddress: "0x6666666666666666666666666666666666666666",
    totalVolume24h: "200000000000000000000", // 200 ETH
    totalVolumeAllTime: "5000000000000000000000", // 5000 ETH
    totalTrades24h: 85,
    totalTradesAllTime: 2100,
    uniqueTraders24h: 35,
    uniqueTradersAllTime: 280,
    totalDeposited: "2000000000000000000000", // 2000 ETH
    tokensSold: "900000000000000000000000", // 900k tokens
    graduationThreshold: "1000000000000000000000", // 1000 ETH
    isGraduated: true,
    createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    chain: { id: "42161", name: "arbitrum" },
    growthMultiplier: 3.2,
    metadata: [
      { key: "website", value: "https://defiassistant.xyz" },
      { key: "docs", value: "https://docs.defiassistant.xyz" }
    ]
  },
  {
    id: "1-3",
    tokenId: "3",
    name: "Art Generator Pro",
    symbol: "ARTGEN",
    creator: "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
    erc20Token: "0x7777777777777777777777777777777777777777",
    pairToken: "0x8888888888888888888888888888888888888888",
    pairCreated: false,
    totalVolume24h: "30000000000000000000", // 30 ETH
    totalVolumeAllTime: "120000000000000000000", // 120 ETH
    totalTrades24h: 15,
    totalTradesAllTime: 98,
    uniqueTraders24h: 8,
    uniqueTradersAllTime: 32,
    totalDeposited: "120000000000000000000", // 120 ETH
    tokensSold: "250000000000000000000000", // 250k tokens
    graduationThreshold: "1000000000000000000000", // 1000 ETH
    isGraduated: false,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    chain: { id: "1", name: "ethereum" },
    growthMultiplier: 0.8,
    metadata: [
      { key: "gallery", value: "https://artgen.gallery" }
    ]
  },
  {
    id: "8453-4",
    tokenId: "4",
    name: "Trading Signals AI",
    symbol: "SIGNAL",
    creator: "0xbbbbccccddddeeeeffffgggghhhhiiiijjjjkkkk",
    erc20Token: "0x9999999999999999999999999999999999999999",
    pairToken: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    pairCreated: true,
    pairAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    totalVolume24h: "350000000000000000000", // 350 ETH
    totalVolumeAllTime: "8000000000000000000000", // 8000 ETH
    totalTrades24h: 120,
    totalTradesAllTime: 3500,
    uniqueTraders24h: 52,
    uniqueTradersAllTime: 420,
    totalDeposited: "3000000000000000000000", // 3000 ETH
    tokensSold: "950000000000000000000000", // 950k tokens
    graduationThreshold: "1000000000000000000000", // 1000 ETH
    isGraduated: true,
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    chain: { id: "8453", name: "base" },
    growthMultiplier: 4.5,
    metadata: [
      { key: "telegram", value: "@tradingsignalsai" },
      { key: "accuracy", value: "87%" }
    ]
  },
  {
    id: "42161-5",
    tokenId: "5",
    name: "NFT Valuation Bot",
    symbol: "NFTVAL",
    creator: "0xccccddddeeeeffffgggghhhhiiiijjjjkkkkllll",
    erc20Token: "0xcccccccccccccccccccccccccccccccccccccccc",
    pairToken: "0xdddddddddddddddddddddddddddddddddddddddd",
    pairCreated: false,
    totalVolume24h: "10000000000000000000", // 10 ETH
    totalVolumeAllTime: "25000000000000000000", // 25 ETH
    totalTrades24h: 5,
    totalTradesAllTime: 22,
    uniqueTraders24h: 3,
    uniqueTradersAllTime: 12,
    totalDeposited: "25000000000000000000", // 25 ETH
    tokensSold: "100000000000000000000000", // 100k tokens
    graduationThreshold: "1000000000000000000000", // 1000 ETH
    isGraduated: false,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    chain: { id: "42161", name: "arbitrum" },
    growthMultiplier: 0.5,
    metadata: []
  }
];

export const mockTrades = [
  {
    id: "0x123-0",
    trader: "0x1234567890123456789012345678901234567890",
    amountIn: "10000000000000000000", // 10 ETH
    amountOut: "50000000000000000000000", // 50k tokens
    feeAmount: "100000000000000000", // 0.1 ETH
    timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    block: "18500000",
    txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    persona: {
      id: "1-0",
      name: "CryptoSage AI",
      symbol: "SAGE"
    }
  },
  {
    id: "0x124-1",
    trader: "0x9876543210987654321098765432109876543210",
    amountIn: "5000000000000000000", // 5 ETH
    amountOut: "25000000000000000000000", // 25k tokens
    feeAmount: "50000000000000000", // 0.05 ETH
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    block: "18500100",
    txHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
  },
  {
    id: "0x125-2",
    trader: "0xaaaabbbbccccddddeeeeffffgggghhhhiiiijjjj",
    amountIn: "2000000000000000000", // 2 ETH
    amountOut: "10000000000000000000000", // 10k tokens
    feeAmount: "20000000000000000", // 0.02 ETH
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    block: "18500200",
    txHash: "0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"
  }
];

export const mockVolumeChart = Array.from({ length: 30 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (29 - i));
  const baseVolume = 50 + Math.random() * 100;
  return {
    date: date.toISOString(),
    volume: (baseVolume * 1e18).toString(),
    trades: Math.floor(10 + Math.random() * 50),
    uniqueTraders: Math.floor(5 + Math.random() * 20)
  };
});

export const mockUserPortfolio = {
  createdPersonas: mockPersonas.slice(0, 2),
  tradedPersonasCount: 5,
  totalTradeVolume: "75000000000000000000", // 75 ETH
  totalBridgedVolume: "100000000000000000000", // 100 ETH
  recentTrades: mockTrades,
  bridgeActivities: [
    {
      action: "WRAP",
      amount: "50000000000000000000", // 50 ETH
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      chain: { id: "8453", name: "base" }
    },
    {
      action: "UNWRAP",
      amount: "25000000000000000000", // 25 ETH
      timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      chain: { id: "42161", name: "arbitrum" }
    }
  ]
};

