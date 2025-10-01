// src/lib/api-graphql.ts - Updated with enhanced contract features and proper types
import { apolloClient, GET_PERSONAS, GET_PERSONA_DETAILS, convertOrderBy, PersonasQueryResult, executeQuery } from './graphql/client';
import { mockPersonas, mockTrades, mockVolumeChart, mockUserPortfolio } from './mockData';
import { gql } from '@apollo/client';

const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

interface FetchPersonasParams {
  chainId?: string;
  sort?: string;
  limit?: number;
  offset?: number;
  search?: string;
  graduated?: string;
  creator?: string;
  hasAgentToken?: boolean; // New filter for agent token integration
  minTvl?: string; // New filter for minimum TVL
}

// Enhanced types for personas with new contract features
interface PersonaChain {
  id: string;
  name: string;
}

interface Persona {
  id: string;
  tokenId?: string;
  name: string;
  symbol: string;
  creator?: string;
  owner?: string; // Track current owner (for transfers)
  erc20Token?: string;
  pairToken?: string;
  agentToken?: string;
  minAgentTokens?: string;
  totalAgentDeposited?: string;
  pairCreated?: boolean;
  pairAddress?: string;
  totalVolume24h: string;
  totalVolumeAllTime: string;
  totalBuyVolume24h?: string; // New: separate buy/sell volumes
  totalSellVolume24h?: string;
  isGraduated: boolean;
  chain: PersonaChain;
  growthMultiplier?: number;
  totalTrades24h?: number;
  totalBuyTrades24h?: number; // New: separate buy/sell trade counts
  totalSellTrades24h?: number;
  totalTradesAllTime?: number;
  uniqueTraders24h?: number;
  uniqueTradersAllTime?: number;
  totalDeposited?: string;
  tokensSold?: string;
  graduationThreshold?: string;
  createdAt?: string;
  createdAtBlock?: string;
  metadata?: Array<{ key: string; value: string; updatedAt?: string }>;
  
  // New contract features
  hasAgentToken: boolean;
  agentTokenProgress?: number; // Percentage of required agent tokens deposited
  canGraduate?: boolean; // Whether all graduation requirements are met
  lockedTokensCount?: string; // Number of tokens locked from direct purchases
  
  // Enhanced metrics
  priceImpact24h?: number;
  liquidityDepth?: string;
  holderCount?: number;
}

interface PersonasResponse {
  personas: Persona[];
  total: number;
  limit?: number;
  offset?: number;
}

// Types for GraphQL query results
interface PersonaDailyStat {
  id: string;
  date: string;
  trades: number;
  buyTrades?: number;
  sellTrades?: number;
  volume: string;
  buyVolume?: string;
  sellVolume?: string;
  uniqueTraders: number;
}

interface PersonaTransfer {
  id: string;
  from: string;
  to: string;
  timestamp: string;
  block: string;
  txHash: string;
  chainId: number;
}

interface TokenWithdrawalRecord {
  id: string;
  user: string;
  amount: string;
  timestamp: string;
  block: string;
  txHash: string;
  chainId: number;
}

export interface GlobalStats {
  totalPersonas: number;
  totalTrades: number;
  totalBuyTrades: number;
  totalSellTrades: number;
  totalVolume: string;
  totalBuyVolume: string;
  totalSellVolume: string;
  totalStakingPools: number;
  totalStaked: string;
  totalBridgeVolume: string;
  lastUpdated: string;
}

interface WhereClause {
  chainId_eq?: number;
  creator_eq?: string;
  pairCreated_eq?: boolean;
  agentToken_isNull?: boolean;
  agentToken_ne?: string;
  agentToken_eq?: string;
  totalDeposited_gte?: string;
  OR?: Array<{ agentToken_isNull?: boolean; agentToken_eq?: string }>;
  persona?: {
    tokenId_eq?: string;
    chainId_eq?: number;
    id_eq?: string;
  };
  user_eq?: string;
  trader_eq?: string;
  isBuy_eq?: boolean;
}

// Helper function to convert numeric chainId to chain object
function getChainFromId(chainId: number): PersonaChain {
  const chainNames: Record<string, string> = {
    '1': 'ethereum',
    '8453': 'base',
    '42161': 'arbitrum'
  };
  return {
    id: chainId.toString(),
    name: chainNames[chainId.toString()] || 'unknown'
  };
}

// Define the structure of a persona from the GraphQL query
type SubsquidPersona = PersonasQueryResult['personas'][0] & {
  createdAtBlock?: number | string;
};

// Enhanced transform function with new contract features
function transformPersona(subsquidPersona: SubsquidPersona): Persona {
  const chain = getChainFromId(subsquidPersona.chainId);
  
  // Calculate agent token progress
  const hasAgentToken = !!subsquidPersona.agentToken && subsquidPersona.agentToken !== '0x0000000000000000000000000000000000000000';
  const agentTokenProgress = hasAgentToken && subsquidPersona.minAgentTokens && subsquidPersona.totalAgentDeposited
    ? Math.min(100, (Number(subsquidPersona.totalAgentDeposited) / Number(subsquidPersona.minAgentTokens)) * 100)
    : undefined;
  
  // Determine if can graduate (both TVL and agent token requirements met)
  const tvlProgress = subsquidPersona.totalDeposited && subsquidPersona.graduationThreshold
    ? (Number(subsquidPersona.totalDeposited) / Number(subsquidPersona.graduationThreshold)) * 100
    : 0;
  
  const canGraduate: boolean = tvlProgress >= 100 && (!hasAgentToken || !subsquidPersona.minAgentTokens || (agentTokenProgress !== undefined && agentTokenProgress >= 100));
  
  return {
    id: subsquidPersona.id,
    tokenId: subsquidPersona.tokenId,
    name: subsquidPersona.name,
    symbol: subsquidPersona.symbol,
    creator: subsquidPersona.creator,
    owner: subsquidPersona.owner,
    erc20Token: subsquidPersona.erc20Token,
    pairToken: subsquidPersona.pairToken,
    agentToken: subsquidPersona.agentToken || undefined,
    minAgentTokens: subsquidPersona.minAgentTokens || undefined,
    totalAgentDeposited: subsquidPersona.totalAgentDeposited || undefined,
    pairCreated: subsquidPersona.pairCreated,
    pairAddress: subsquidPersona.pairAddress || undefined,
    
    // Enhanced volume tracking
    totalVolume24h: subsquidPersona.totalDeposited || '0',
    totalVolumeAllTime: subsquidPersona.totalDeposited || '0',
    totalBuyVolume24h: subsquidPersona.totalDeposited || '0', // TODO: Calculate from trades
    totalSellVolume24h: '0', // TODO: Calculate from trades
    
    isGraduated: subsquidPersona.pairCreated,
    chain,
    totalDeposited: subsquidPersona.totalDeposited,
    tokensSold: subsquidPersona.tokensSold,
    graduationThreshold: subsquidPersona.graduationThreshold,
    createdAt: subsquidPersona.createdAt,
    createdAtBlock: subsquidPersona.createdAtBlock?.toString(),
    metadata: subsquidPersona.metadata || [],
    
    // New features
    hasAgentToken,
    agentTokenProgress,
    canGraduate,
    
    // Enhanced metrics (mock for now - implement with real data)
    totalTrades24h: 0,
    totalBuyTrades24h: 0,
    totalSellTrades24h: 0,
    holderCount: 0,
    priceImpact24h: 0,
  };
}

export async function fetchPersonas(params?: FetchPersonasParams): Promise<PersonasResponse> {
  if (USE_MOCK_DATA) {
    // Ensure mock personas have all required properties
    let personas = [...mockPersonas].map(p => ({
      ...p,
      hasAgentToken: !!p.agentToken && p.agentToken !== '0x0000000000000000000000000000000000000000',
      agentTokenProgress: p.agentToken && p.minAgentTokens && p.totalAgentDeposited
        ? Math.min(100, (Number(p.totalAgentDeposited) / Number(p.minAgentTokens)) * 100)
        : undefined,
      canGraduate: false // Will be calculated if needed
    }));

    // Apply filters
    if (params?.chainId) {
      personas = personas.filter(p => p.chain.id === params.chainId);
    }
    if (params?.search) {
      const search = params.search.toLowerCase();
      personas = personas.filter(p =>
        p.name.toLowerCase().includes(search) ||
        p.symbol.toLowerCase().includes(search)
      );
    }
    if (params?.graduated !== undefined) {
      const isGraduated = params.graduated === 'true';
      personas = personas.filter(p => p.isGraduated === isGraduated);
    }
    if (params?.creator) {
      personas = personas.filter(p => p.creator?.toLowerCase() === params.creator?.toLowerCase());
    }
    if (params?.hasAgentToken !== undefined) {
      personas = personas.filter(p => p.hasAgentToken === params.hasAgentToken);
    }
    if (params?.minTvl) {
      const minTvl = BigInt(params.minTvl);
      personas = personas.filter(p => BigInt(p.totalDeposited || '0') >= minTvl);
    }

    // Apply sorting
    if (params?.sort) {
      switch (params.sort) {
        case 'totalVolume24h_DESC':
          personas.sort((a, b) => BigInt(b.totalVolume24h) > BigInt(a.totalVolume24h) ? 1 : -1);
          break;
        case 'totalVolumeAllTime_DESC':
          personas.sort((a, b) => BigInt(b.totalVolumeAllTime) > BigInt(a.totalVolumeAllTime) ? 1 : -1);
          break;
        case 'createdAt_DESC':
          personas.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
          break;
        case 'name_ASC':
          personas.sort((a, b) => a.name.localeCompare(b.name));
          break;
        case 'agentTokenProgress_DESC':
          personas.sort((a, b) => (b.agentTokenProgress || 0) - (a.agentTokenProgress || 0));
          break;
      }
    }

    const limit = params?.limit || 20;
    const offset = params?.offset || 0;
    const paginatedPersonas = personas.slice(offset, offset + limit);

    return {
      personas: paginatedPersonas,
      total: personas.length,
      limit,
      offset
    };
  }

  try {
    // Build GraphQL where clause
    const whereClause: WhereClause = {};
    
    if (params?.chainId) {
      whereClause.chainId_eq = parseInt(params.chainId);
    }
    if (params?.creator) {
      whereClause.creator_eq = params.creator.toLowerCase();
    }
    if (params?.graduated !== undefined) {
      whereClause.pairCreated_eq = params.graduated === 'true';
    }
    if (params?.hasAgentToken !== undefined) {
      if (params.hasAgentToken) {
        whereClause.agentToken_isNull = false;
        whereClause.agentToken_ne = '0x0000000000000000000000000000000000000000';
      } else {
        whereClause.OR = [
          { agentToken_isNull: true },
          { agentToken_eq: '0x0000000000000000000000000000000000000000' }
        ];
      }
    }
    if (params?.minTvl) {
      whereClause.totalDeposited_gte = params.minTvl;
    }

    const orderBy = params?.sort ? convertOrderBy(params.sort) : 'createdAt_DESC';
    
    const result = await executeQuery(async () => {
      const { data } = await apolloClient.query<PersonasQueryResult>({
        query: GET_PERSONAS,
        variables: {
          limit: params?.limit || 50,
          offset: params?.offset || 0,
          orderBy: [orderBy],
          where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
        },
        fetchPolicy: 'network-only'
      });
      return data;
    }, {
      showError: true,
      fallbackData: null
    });

    if (!result) {
      return {
        personas: [],
        total: 0,
        limit: params?.limit,
        offset: params?.offset
      };
    }

    let personas = result.personas.map(transformPersona);

    // Apply client-side search filter (for text search)
    if (params?.search) {
      const search = params.search.toLowerCase();
      personas = personas.filter(p =>
        p.name.toLowerCase().includes(search) ||
        p.symbol.toLowerCase().includes(search)
      );
    }

    return {
      personas,
      total: result.personasConnection.totalCount,
      limit: params?.limit,
      offset: params?.offset
    };
  } catch (error) {
    console.error('Error fetching personas:', error);
    return {
      personas: [],
      total: 0,
      limit: params?.limit,
      offset: params?.offset
    };
  }
}

// Enhanced persona detail fetch with transfer history
export async function fetchPersonaDetail(chainId: string, tokenId: string): Promise<Persona | null> {
  if (USE_MOCK_DATA) {
    const persona = mockPersonas.find(p =>
      p.chain.id === chainId && p.id.split('-')[1] === tokenId
    );
    if (!persona) return null;
    
    // Add required properties for mock data
    return {
      ...persona,
      hasAgentToken: !!persona.agentToken && persona.agentToken !== '0x0000000000000000000000000000000000000000',
      agentTokenProgress: persona.agentToken && persona.minAgentTokens && persona.totalAgentDeposited
        ? Math.min(100, (Number(persona.totalAgentDeposited) / Number(persona.minAgentTokens)) * 100)
        : undefined,
      canGraduate: false
    };
  }

  try {
    const personaId = `${chainId}-${tokenId}`;
    const result = await executeQuery(async () => {
      const { data } = await apolloClient.query<PersonasQueryResult>({
        query: GET_PERSONA_DETAILS,
        variables: { id: personaId }
      });
      return data;
    }, {
      showError: true,
      fallbackData: null
    });

    if (!result?.personas || result.personas.length === 0) {
      return null;
    }

    return transformPersona(result.personas[0]);
  } catch (error) {
    console.error('Error fetching persona detail:', error);
    return null;
  }
}

// Type for persona transfers query
interface PersonaTransfersQueryResult {
  personaTransfers?: PersonaTransfer[];
}

// Type for token withdrawals query
interface TokenWithdrawalsQueryResult {
  tokenWithdrawals?: TokenWithdrawalRecord[];
}

// Type for persona daily stats query
interface PersonaDailyStatsQueryResult {
  personaDailyStats?: PersonaDailyStat[];
}

// Type for global stats query
interface GlobalStatsQueryResult {
  globalStats?: GlobalStats | GlobalStats[];
}

// New function to fetch persona transfer history
export async function fetchPersonaTransfers(chainId: string, tokenId: string, limit = 10): Promise<PersonaTransfer[]> {
  const tokenIdBigInt = tokenId.replace(/^0+/, '') || '0';

  try {
    const result = await executeQuery(async () => {
      const { data } = await apolloClient.query<PersonaTransfersQueryResult>({
        query: gql`
          query GetPersonaTransfers($tokenId: BigInt!, $chainId: Int!, $limit: Int!) {
            personaTransfers(
              where: {
                persona: {
                  tokenId_eq: $tokenId,
                  chainId_eq: $chainId
                }
              }
              orderBy: timestamp_DESC
              limit: $limit
            ) {
              id
              from
              to
              timestamp
              block
              txHash
              chainId
            }
          }
        `,
        variables: {
          tokenId: tokenIdBigInt,
          chainId: parseInt(chainId),
          limit
        }
      });
      return data;
    }, {
      showError: false,
      fallbackData: null
    });

    return result?.personaTransfers || [];
  } catch (error) {
    console.error('Error fetching persona transfers:', error);
    return [];
  }
}

// New function to fetch token withdrawal history
export async function fetchTokenWithdrawals(chainId: string, tokenId: string, user?: string, limit = 10): Promise<TokenWithdrawalRecord[]> {
  const tokenIdBigInt = tokenId.replace(/^0+/, '') || '0';
  
  try {
    const whereClause: WhereClause = {
      persona: {
        tokenId_eq: tokenIdBigInt,
        chainId_eq: parseInt(chainId)
      }
    };
    
    if (user) {
      whereClause.user_eq = user.toLowerCase();
    }

    const result = await executeQuery(async () => {
      const { data } = await apolloClient.query<TokenWithdrawalsQueryResult>({
        query: gql`
          query GetTokenWithdrawals($where: TokenWithdrawalWhereInput!, $limit: Int!) {
            tokenWithdrawals(
              where: $where
              orderBy: timestamp_DESC
              limit: $limit
            ) {
              id
              user
              amount
              timestamp
              block
              txHash
              chainId
            }
          }
        `,
        variables: {
          where: whereClause,
          limit
        }
      });
      return data;
    }, {
      showError: false,
      fallbackData: null
    });

    return result?.tokenWithdrawals || [];
  } catch (error) {
    console.error('Error fetching token withdrawals:', error);
    return [];
  }
}

// Enhanced chart data with buy/sell separation
export async function fetchVolumeChart(chainId: string, tokenId: string, days = 30): Promise<VolumeChartData[]> {
  if (USE_MOCK_DATA) {
    return mockVolumeChart.slice(-days);
  }
  
  try {
    const personaId = `${chainId}-${tokenId}`;
    const result = await executeQuery(async () => {
      const { data } = await apolloClient.query<PersonaDailyStatsQueryResult>({
        query: gql`
          query GetPersonaDailyStats($personaId: String!, $days: Int!) {
            personaDailyStats(
              where: {
                persona: { id_eq: $personaId }
              }
              orderBy: date_DESC
              limit: $days
            ) {
              id
              date
              trades
              buyTrades
              sellTrades
              volume
              buyVolume
              sellVolume
              uniqueTraders
            }
          }
        `,
        variables: { 
          personaId,
          days 
        }
      });
      return data;
    }, {
      showError: false,
      fallbackData: null
    });

    if (!result?.personaDailyStats) {
      return mockVolumeChart.slice(-days);
    }

    return result.personaDailyStats.map((stat: PersonaDailyStat) => ({
      date: stat.date,
      volume: stat.volume,
      buyVolume: stat.buyVolume || '0',
      sellVolume: stat.sellVolume || '0',
      trades: stat.trades,
      buyTrades: stat.buyTrades || 0,
      sellTrades: stat.sellTrades || 0,
      uniqueTraders: stat.uniqueTraders
    }));
  } catch (error) {
    console.error('Error fetching volume chart:', error);
    return mockVolumeChart.slice(-days);
  }
}

// Enhanced trending function with new metrics
export async function fetchTrending(timeframe: '1h' | '24h' | '7d' = '24h'): Promise<Persona[]> {
  if (USE_MOCK_DATA) {
    return [...mockPersonas]
      .map(p => ({
        ...p,
        hasAgentToken: !!p.agentToken && p.agentToken !== '0x0000000000000000000000000000000000000000',
        agentTokenProgress: p.agentToken && p.minAgentTokens && p.totalAgentDeposited
          ? Math.min(100, (Number(p.totalAgentDeposited) / Number(p.minAgentTokens)) * 100)
          : undefined,
        canGraduate: false
      }))
      .sort((a, b) => (b.growthMultiplier || 0) - (a.growthMultiplier || 0))
      .slice(0, 10);
  }

  try {
    // Different sorting strategies based on timeframe
    const orderBy = timeframe === '1h' ? 'totalVolume24h_DESC' :
                   timeframe === '24h' ? 'totalVolume24h_DESC' :
                   'totalVolumeAllTime_DESC';

    const result = await executeQuery(async () => {
      const { data } = await apolloClient.query<PersonasQueryResult>({
        query: GET_PERSONAS,
        variables: {
          limit: 10,
          orderBy: [orderBy],
          where: {
            // Only include personas with some volume
            totalDeposited_gte: '1000000000000000000' // 1 ETH minimum
          }
        }
      });
      return data;
    }, {
      showError: false,
      fallbackData: null
    });

    if (!result) {
      return [];
    }

    return result.personas.map(transformPersona);
  } catch (error) {
    console.error('Error fetching trending:', error);
    return [];
  }
}

// Enhanced user portfolio with new features
interface UserPortfolio {
  createdPersonas: Persona[];
  tradedPersonasCount: number;
  totalTradeVolume: string;
  totalBuyVolume: string;
  totalSellVolume: string;
  totalBridgedVolume: string;
  recentTrades: Trade[];
  bridgeActivities: BridgeActivity[];
  agentDeposits: AgentDeposit[];
  tokenWithdrawals: TokenWithdrawal[];
}

interface AgentDeposit {
  id: string;
  amount: string;
  timestamp: string;
  withdrawn: boolean;
  rewardsClaimed: boolean;
  persona: {
    id: string;
    name: string;
    symbol: string;
  };
}

interface TokenWithdrawal {
  id: string;
  amount: string;
  timestamp: string;
  persona: {
    id: string;
    name: string;
    symbol: string;
  };
}

// Types for user portfolio GraphQL results
interface UserTradeResult {
  id: string;
  persona: {
    id: string;
    name: string;
    symbol: string;
    chainId: number;
  };
  trader: string;
  amountIn: string;
  amountOut: string;
  feeAmount: string;
  isBuy: boolean;
  timestamp: string;
  block: string;
  txHash: string;
  chainId: number;
}

interface UserPortfolioQueryResult {
  createdPersonas: PersonasQueryResult['personas'];
  userTrades: UserTradeResult[];
  agentDeposits: AgentDeposit[];
  tokenWithdrawals: TokenWithdrawal[];
}

export async function fetchUserPortfolio(address: string): Promise<UserPortfolio> {
  if (USE_MOCK_DATA) {
    const userPersonas = mockPersonas
      .filter(p => p.creator?.toLowerCase() === address.toLowerCase())
      .map(p => ({
        ...p,
        hasAgentToken: !!p.agentToken && p.agentToken !== '0x0000000000000000000000000000000000000000',
        agentTokenProgress: p.agentToken && p.minAgentTokens && p.totalAgentDeposited
          ? Math.min(100, (Number(p.totalAgentDeposited) / Number(p.minAgentTokens)) * 100)
          : undefined,
        canGraduate: false
      }))
      .slice(0, 2);

    // Transform mockUserPortfolio.createdPersonas to ensure they have required properties
    const transformedMockPersonas = mockUserPortfolio.createdPersonas.map(p => ({
      ...p,
      hasAgentToken: !!p.agentToken && p.agentToken !== '0x0000000000000000000000000000000000000000',
      agentTokenProgress: p.agentToken && p.minAgentTokens && p.totalAgentDeposited
        ? Math.min(100, (Number(p.totalAgentDeposited) / Number(p.minAgentTokens)) * 100)
        : undefined,
      canGraduate: false
    }));

    // Ensure recentTrades have the isBuy property
    const transformedRecentTrades = mockUserPortfolio.recentTrades.map(trade => ({
      ...trade,
      isBuy: true // Default to buy trades for mock data, or determine based on some logic
    }));

    return {
      ...mockUserPortfolio,
      createdPersonas: userPersonas.length > 0 ? userPersonas : transformedMockPersonas,
      recentTrades: transformedRecentTrades,
      totalBuyVolume: "45000000000000000000", // 45 ETH
      totalSellVolume: "30000000000000000000", // 30 ETH
      agentDeposits: [],
      tokenWithdrawals: []
    };
  }

  try {
    const result = await executeQuery(async () => {
      const { data } = await apolloClient.query<UserPortfolioQueryResult>({
        query: gql`
          query GetUserPortfolio($creator: String!) {
            createdPersonas: personas(where: { creator_eq: $creator }, orderBy: createdAt_DESC) {
              id
              tokenId
              name
              symbol
              creator
              erc20Token
              pairToken
              agentToken
              pairCreated
              totalDeposited
              tokensSold
              graduationThreshold
              totalAgentDeposited
              minAgentTokens
              createdAt
              chainId
            }
            
            userTrades: trades(where: { trader_eq: $creator }, orderBy: timestamp_DESC, limit: 20) {
              id
              persona {
                id
                name
                symbol
                chainId
              }
              trader
              amountIn
              amountOut
              feeAmount
              isBuy
              timestamp
              block
              txHash
              chainId
            }

            agentDeposits: agentDeposits(where: { user_eq: $creator }, orderBy: timestamp_DESC, limit: 10) {
              id
              amount
              timestamp
              withdrawn
              rewardsClaimed
              persona {
                id
                name
                symbol
              }
            }

            tokenWithdrawals: tokenWithdrawals(where: { user_eq: $creator }, orderBy: timestamp_DESC, limit: 10) {
              id
              amount
              timestamp
              persona {
                id
                name
                symbol
              }
            }
          }
        `,
        variables: { creator: address.toLowerCase() }
      });
      return data;
    }, {
      showError: false,
      fallbackData: null
    });

    if (!result) {
      return {
        createdPersonas: [],
        tradedPersonasCount: 0,
        totalTradeVolume: "0",
        totalBuyVolume: "0",
        totalSellVolume: "0",
        totalBridgedVolume: "0",
        recentTrades: [],
        bridgeActivities: [],
        agentDeposits: [],
        tokenWithdrawals: []
      };
    }

    // Calculate volumes from trades
    const buyTrades = result.userTrades.filter((t: UserTradeResult) => t.isBuy);
    const sellTrades = result.userTrades.filter((t: UserTradeResult) => !t.isBuy);
    
    const totalBuyVolume = buyTrades.reduce((sum: bigint, trade: UserTradeResult) => sum + BigInt(trade.amountIn), BigInt(0));
    const totalSellVolume = sellTrades.reduce((sum: bigint, trade: UserTradeResult) => sum + BigInt(trade.amountOut), BigInt(0));
    const totalTradeVolume = totalBuyVolume + totalSellVolume;

    // Map userTrades to Trade format with proper chain info
    const recentTrades: Trade[] = result.userTrades.map((trade: UserTradeResult) => ({
      ...trade,
      chain: getChainFromId(trade.chainId)
    }));

    return {
      createdPersonas: result.createdPersonas.map(transformPersona),
      tradedPersonasCount: new Set(result.userTrades.map((t: UserTradeResult) => t.persona?.id)).size,
      totalTradeVolume: totalTradeVolume.toString(),
      totalBuyVolume: totalBuyVolume.toString(),
      totalSellVolume: totalSellVolume.toString(),
      totalBridgedVolume: "0", // TODO: Calculate from bridge activities
      recentTrades,
      bridgeActivities: [], // TODO: Fetch bridge activities
      agentDeposits: result.agentDeposits,
      tokenWithdrawals: result.tokenWithdrawals
    };
  } catch (error) {
    console.error('Error fetching user portfolio:', error);
    return {
      createdPersonas: [],
      tradedPersonasCount: 0,
      totalTradeVolume: "0",
      totalBuyVolume: "0",
      totalSellVolume: "0",
      totalBridgedVolume: "0",
      recentTrades: [],
      bridgeActivities: [],
      agentDeposits: [],
      tokenWithdrawals: []
    };
  }
}

// Enhanced persona trades with buy/sell separation
interface TradesResponse {
  trades: Trade[];
  total: number;
  buyTradesCount: number;
  sellTradesCount: number;
}

interface Trade {
  id: string;
  trader: string;
  amountIn: string;
  amountOut: string;
  feeAmount: string;
  isBuy: boolean;
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

interface TradesQueryResult {
  trades: Trade[];
  tradesConnection: { totalCount: number };
  buyTradesConnection: { totalCount: number };
  sellTradesConnection: { totalCount: number };
}

export async function fetchPersonaTrades(chainId: string, tokenId: string, limit = 10): Promise<TradesResponse> {
  if (USE_MOCK_DATA) {
    const personaId = `${chainId}-${tokenId}`;
    const trades = mockTrades
      .filter(t =>
        t.persona?.id === personaId ||
        (personaId === '1-0' && !t.persona)
      )
      .map(t => ({
        ...t,
        isBuy: true // Default to buy for mock data, or determine based on some logic
      }))
      .slice(0, limit);

    const buyTrades = trades.filter(t => t.isBuy);
    const sellTrades = trades.filter(t => !t.isBuy);

    return {
      trades,
      total: trades.length,
      buyTradesCount: buyTrades.length,
      sellTradesCount: sellTrades.length
    };
  }

  try {
    const personaId = `${chainId}-${tokenId}`;
    const result = await executeQuery(async () => {
      const { data } = await apolloClient.query<TradesQueryResult>({
        query: gql`
          query GetPersonaTrades($personaId: String!, $limit: Int!) {
            trades(
              where: { persona: { id_eq: $personaId } }
              orderBy: timestamp_DESC
              limit: $limit
            ) {
              id
              trader
              amountIn
              amountOut
              feeAmount
              isBuy
              timestamp
              block
              txHash
              chainId
            }
            
            tradesConnection(where: { persona: { id_eq: $personaId } }) {
              totalCount
            }
            
            buyTradesConnection: tradesConnection(where: { 
              persona: { id_eq: $personaId },
              isBuy_eq: true 
            }) {
              totalCount
            }
            
            sellTradesConnection: tradesConnection(where: { 
              persona: { id_eq: $personaId },
              isBuy_eq: false 
            }) {
              totalCount
            }
          }
        `,
        variables: { 
          personaId,
          limit 
        }
      });
      return data;
    }, {
      showError: false,
      fallbackData: null
    });

    if (!result?.trades) {
      return {
        trades: [],
        total: 0,
        buyTradesCount: 0,
        sellTradesCount: 0
      };
    }

    const chain = getChainFromId(parseInt(chainId));
    const trades = result.trades.map((trade: Trade) => ({
      ...trade,
      chain
    }));

    return {
      trades,
      total: result.tradesConnection.totalCount,
      buyTradesCount: result.buyTradesConnection.totalCount,
      sellTradesCount: result.sellTradesConnection.totalCount
    };
  } catch (error) {
    console.error('Error fetching persona trades:', error);
    return {
      trades: [],
      total: 0,
      buyTradesCount: 0,
      sellTradesCount: 0
    };
  }
}

// New function to fetch global statistics

export async function fetchGlobalStats(): Promise<GlobalStats | null> {
  try {
    const result = await executeQuery(async () => {
      const { data } = await apolloClient.query<GlobalStatsQueryResult>({
        query: gql`
          query GetGlobalStats {
            globalStats {
              totalPersonas
              totalTrades
              totalBuyTrades
              totalSellTrades
              totalVolume
              totalBuyVolume
              totalSellVolume
              totalStakingPools
              totalStaked
              totalBridgeVolume
              lastUpdated
            }
          }
        `
      });
      return data;
    }, {
      showError: false,
      fallbackData: null
    });

    // Handle both array and single object responses
    if (result?.globalStats) {
      // If it's an array, take the first element
      if (Array.isArray(result.globalStats)) {
        return result.globalStats[0] || null;
      }
      // If it's a single object, return it
      return result.globalStats;
    }

    // Return default values if no data
    return {
      totalPersonas: 0,
      totalTrades: 0,
      totalBuyTrades: 0,
      totalSellTrades: 0,
      totalVolume: '0',
      totalBuyVolume: '0',
      totalSellVolume: '0',
      totalStakingPools: 0,
      totalStaked: '0',
      totalBridgeVolume: '0',
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching global stats:', error);
    return null;
  }
}

// Health check with enhanced error handling
export async function checkApiHealth(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
  if (USE_MOCK_DATA) {
    return { healthy: true, latency: 0 };
  }

  try {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    await apolloClient.query({
      query: GET_PERSONAS,
      variables: { limit: 1 },
      context: {
        fetchOptions: {
          signal: controller.signal
        }
      }
    });

    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;
    
    return { healthy: true, latency };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('API health check failed:', error);
    return { 
      healthy: false, 
      error: errorMessage
    };
  }
}

export function isApiConfigured(): boolean {
  return true;
}

// Enhanced types export
export type {
  Persona,
  PersonasResponse,
  Trade,
  TradesResponse,
  UserPortfolio,
  AgentDeposit,
  TokenWithdrawal,
  VolumeChartData
};

interface VolumeChartData {
  date: string;
  volume: string;
  buyVolume?: string;
  sellVolume?: string;
  trades: number;
  buyTrades?: number;
  sellTrades?: number;
  uniqueTraders?: number;
}

interface BridgeActivity {
  id: string;
  action: 'WRAP' | 'UNWRAP';
  amount: string;
  timestamp: string;
  txHash: string;
  chain: PersonaChain;
}
