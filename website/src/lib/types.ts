// src/lib/types.ts
// API and Contract Types

export interface PersonaChain {
  id: string;
  name: string;
}

export interface PersonaMetadata {
  key: string;
  value: string;
}

export interface Persona {
  id: string;
  tokenId: string;
  name: string;
  symbol: string;
  creator: string;
  erc20Token: string;
  pairToken: string;
  agentToken?: string;
  minAgentTokens?: string;
  pairCreated: boolean;
  pairAddress?: string;
  totalVolume24h: string;
  totalVolumeAllTime: string;
  totalTrades24h: number;
  totalTradesAllTime: number;
  uniqueTraders24h: number;
  uniqueTradersAllTime: number;
  totalDeposited: string;
  tokensSold: string;
  graduationThreshold: string;
  isGraduated: boolean;
  createdAt: string;
  chain: PersonaChain;
  metadata?: PersonaMetadata[];
  growthMultiplier?: number;
  totalAgentDeposited?: string;
}

export interface Trade {
  id: string;
  trader: string;
  amountIn: string;
  amountOut: string;
  feeAmount: string;
  timestamp: string;
  block: string;
  txHash: string;
  persona?: {
    id: string;
    name: string;
    symbol: string;
  };
  chain?: PersonaChain;
}

export interface BridgeActivity {
  id: string;
  action: 'WRAP' | 'UNWRAP';
  amount: string;
  timestamp: string;
  txHash: string;
  chain: PersonaChain;
}

export interface UserPurchase {
  amount: string;
  timestamp: string;
  withdrawn: boolean;
}

export interface AgentDeposit {
  amount: string;
  timestamp: string;
  withdrawn: boolean;
}

export interface StakingPool {
  id: string;
  lpToken: string;
  allocBasisPoints: number;
  totalStaked: string;
  isActive: boolean;
  isAgentPool: boolean;
  personaTokenId?: string;
  accAmicaPerShare: string;
  lastRewardBlock: string;
}

export interface UserStakeInfo {
  poolId: string;
  flexibleAmount: string;
  lockedAmount: string;
  effectiveStake: string;
  unclaimedRewards: string;
  locks: LockInfo[];
}

export interface LockInfo {
  lockId: string;
  amount: string;
  unlockTime: string;
  lockMultiplier: number;
  rewardDebt: string;
}

// API Response Types
export interface PersonasResponse {
  personas: Persona[];
  total: number;
  limit?: number;
  offset?: number;
}

export interface TradesResponse {
  trades: Trade[];
  total: number;
}

export interface VolumeChartData {
  date: string;
  volume: string;
  trades: number;
  uniqueTraders?: number;
}

export interface UserPortfolioResponse {
  createdPersonas: Persona[];
  tradedPersonasCount: number;
  totalTradeVolume: string;
  totalBridgedVolume: string;
  recentTrades: Trade[];
  bridgeActivities: BridgeActivity[];
  stakingPositions?: UserStakeInfo[];
}

// Contract Interaction Types
export interface FeeInfo {
  currentBalance: bigint;
  snapshotBalance: bigint;
  effectiveBalance: bigint;
  snapshotBlock: bigint;
  isEligible: boolean;
  blocksUntilEligible: bigint;
  baseFeePercentage: bigint;
  effectiveFeePercentage: bigint;
  discountPercentage: bigint;
}

export interface TradingFeeConfig {
  feePercentage: bigint;
  creatorShare: bigint;
}

export interface FeeReductionConfig {
  minAmicaForReduction: bigint;
  maxAmicaForReduction: bigint;
  minReductionMultiplier: bigint;
  maxReductionMultiplier: bigint;
}

export interface PairingConfig {
  enabled: boolean;
  mintCost: bigint;
  graduationThreshold: bigint;
}
