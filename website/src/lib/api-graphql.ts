// src/lib/api-graphql.ts
import { apolloClient, GET_PERSONAS, GET_PERSONA_DETAILS, GET_PERSONA_TRADES, GET_DAILY_STATS, convertOrderBy, PersonasQueryResult, executeQuery } from './graphql/client';
import { mockPersonas, mockTrades, mockVolumeChart, mockUserPortfolio } from './mockData';

const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

interface FetchPersonasParams {
  chainId?: string;
  sort?: string;
  limit?: number;
  offset?: number;
  search?: string;
  graduated?: string;
  creator?: string;
}

// Types for personas with additional computed fields
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
  erc20Token?: string;
  pairToken?: string;
  agentToken?: string;
  minAgentTokens?: string;
  totalAgentDeposited?: string;
  pairCreated?: boolean;
  pairAddress?: string;
  totalVolume24h: string;
  totalVolumeAllTime: string;
  isGraduated: boolean;
  chain: PersonaChain;
  growthMultiplier?: number;
  totalTrades24h?: number;
  totalTradesAllTime?: number;
  uniqueTraders24h?: number;
  uniqueTradersAllTime?: number;
  totalDeposited?: string;
  tokensSold?: string;
  graduationThreshold?: string;
  createdAt?: string;
  metadata?: Array<{ key: string; value: string }>;
}

interface PersonasResponse {
  personas: Persona[];
  total: number;
  limit?: number;
  offset?: number;
}

// Helper function to extract chain from persona ID (format: "chainId-tokenId")
function extractChainFromId(id: string): PersonaChain {
  const [chainId] = id.split('-');
  const chainNames: Record<string, string> = {
    '1': 'ethereum',
    '8453': 'base',
    '42161': 'arbitrum'
  };
  return {
    id: chainId,
    name: chainNames[chainId] || 'unknown'
  };
}

// Transform Subsquid persona to our API format
function transformPersona(subsquidPersona: PersonasQueryResult['personas'][0]): Persona {
  const chain = extractChainFromId(subsquidPersona.id);
  
  return {
    id: subsquidPersona.id,
    tokenId: subsquidPersona.tokenId,
    name: subsquidPersona.name,
    symbol: subsquidPersona.symbol,
    creator: subsquidPersona.creator,
    erc20Token: subsquidPersona.erc20Token,
    pairToken: subsquidPersona.pairToken,
    agentToken: subsquidPersona.agentToken || undefined,
    minAgentTokens: subsquidPersona.minAgentTokens || undefined,
    totalAgentDeposited: subsquidPersona.totalAgentDeposited || undefined,
    pairCreated: subsquidPersona.pairCreated,
    pairAddress: subsquidPersona.pairAddress || undefined,
    // For now, we'll use totalDeposited as a proxy for volume
    // In production, you'd calculate these from trade data
    totalVolume24h: subsquidPersona.totalDeposited || '0',
    totalVolumeAllTime: subsquidPersona.totalDeposited || '0',
    isGraduated: subsquidPersona.pairCreated,
    chain,
    totalDeposited: subsquidPersona.totalDeposited,
    tokensSold: subsquidPersona.tokensSold,
    graduationThreshold: subsquidPersona.graduationThreshold,
    createdAt: subsquidPersona.createdAt,
    metadata: subsquidPersona.metadata || []
  };
}

export async function fetchPersonas(params?: FetchPersonasParams): Promise<PersonasResponse> {
  if (USE_MOCK_DATA) {
    // Mock data implementation remains the same
    let personas = [...mockPersonas];

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
    // Convert sort parameter to GraphQL orderBy
    const orderBy = params?.sort ? convertOrderBy(params.sort) : 'createdAt_DESC';
    
    const result = await executeQuery(async () => {
      const { data } = await apolloClient.query<PersonasQueryResult>({
        query: GET_PERSONAS,
        variables: {
          limit: params?.limit || 50,
          offset: params?.offset || 0,
          orderBy: [orderBy]
        },
        fetchPolicy: 'network-only' // Always fetch fresh data
      });
      return data;
    }, {
      showError: true,
      fallbackData: null
    });

    if (!result) {
      // Return empty result on error
      return {
        personas: [],
        total: 0,
        limit: params?.limit,
        offset: params?.offset
      };
    }

    // Transform the data
    let personas = result.personas.map(transformPersona);

    // Apply client-side filters if needed
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

    return {
      personas,
      total: result.personasConnection.totalCount,
      limit: params?.limit,
      offset: params?.offset
    };
  } catch (error) {
    console.error('Error fetching personas:', error);
    // Error is already handled by the error link
    return {
      personas: [],
      total: 0,
      limit: params?.limit,
      offset: params?.offset
    };
  }
}

export async function fetchPersonaDetail(chainId: string, tokenId: string): Promise<Persona | null> {
  if (USE_MOCK_DATA) {
    const persona = mockPersonas.find(p =>
      p.chain.id === chainId && p.id.split('-')[1] === tokenId
    );
    return persona || null;
  }

  try {
    const personaId = `${chainId}-${tokenId}`;
    const result = await executeQuery(async () => {
      const { data } = await apolloClient.query({
        query: GET_PERSONA_DETAILS,
        variables: { id: personaId }
      });
      return data;
    }, {
      showError: true,
      fallbackData: null
    });

    if (!result?.persona) {
      return null;
    }

    return transformPersona(result.persona);
  } catch (error) {
    console.error('Error fetching persona detail:', error);
    return null;
  }
}

// Chart data type
interface ChartData {
  date: string;
  volume: string;
  trades: number;
  uniqueTraders?: number;
}

interface DailyStat {
  id: string;
  date: string;
  trades: number;
  volume: string;
  uniqueTraders: number;
}

export async function fetchVolumeChart(chainId: string, tokenId: string, days = 30): Promise<ChartData[]> {
  if (USE_MOCK_DATA) {
    return mockVolumeChart.slice(-days);
  }
  
  try {
    const personaId = `${chainId}-${tokenId}`;
    const result = await executeQuery(async () => {
      const { data } = await apolloClient.query({
        query: GET_DAILY_STATS,
        variables: { 
          personaId,
          days 
        }
      });
      return data;
    }, {
      showError: false, // Don't show error for chart data
      fallbackData: null
    });

    if (!result?.personaDailyStats) {
      // Return mock data as fallback
      return mockVolumeChart.slice(-days);
    }

    // Transform the data to match expected format
    return result.personaDailyStats.map((stat: DailyStat) => ({
      date: stat.date,
      volume: stat.volume,
      trades: stat.trades,
      uniqueTraders: stat.uniqueTraders
    }));
  } catch (error) {
    console.error('Error fetching volume chart:', error);
    // Return mock data as fallback
    return mockVolumeChart.slice(-days);
  }
}

export async function fetchTrending(): Promise<Persona[]> {
  if (USE_MOCK_DATA) {
    return [...mockPersonas]
      .sort((a, b) => (b.growthMultiplier || 0) - (a.growthMultiplier || 0))
      .slice(0, 10);
  }

  // For now, return top personas by total deposited
  try {
    const result = await executeQuery(async () => {
      const { data } = await apolloClient.query<PersonasQueryResult>({
        query: GET_PERSONAS,
        variables: {
          limit: 10,
          orderBy: ['totalDeposited_DESC']
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

// User portfolio type
interface UserPortfolio {
  createdPersonas: Persona[];
  tradedPersonasCount: number;
  totalTradeVolume: string;
  totalBridgedVolume: string;
  recentTrades: Trade[];
  bridgeActivities: BridgeActivity[];
}

interface Trade {
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

interface BridgeActivity {
  id: string;
  action: 'WRAP' | 'UNWRAP';
  amount: string;
  timestamp: string;
  txHash: string;
  chain: PersonaChain;
}

export async function fetchUserPortfolio(address: string): Promise<UserPortfolio> {
  if (USE_MOCK_DATA) {
    const userPersonas = mockPersonas
      .filter(p => p.creator?.toLowerCase() === address.toLowerCase())
      .slice(0, 2);

    return {
      ...mockUserPortfolio,
      createdPersonas: userPersonas.length > 0 ? userPersonas : mockUserPortfolio.createdPersonas
    };
  }

  // TODO: Implement with GraphQL
  return {
    createdPersonas: [],
    tradedPersonasCount: 0,
    totalTradeVolume: "0",
    totalBridgedVolume: "0",
    recentTrades: [],
    bridgeActivities: []
  };
}

interface TradesResponse {
  trades: Trade[];
  total: number;
}

export async function fetchPersonaTrades(chainId: string, tokenId: string, limit = 10): Promise<TradesResponse> {
  if (USE_MOCK_DATA) {
    const personaId = `${chainId}-${tokenId}`;
    const trades = mockTrades.filter(t =>
      t.persona?.id === personaId ||
      (personaId === '1-0' && !t.persona)
    ).slice(0, limit);

    return {
      trades,
      total: trades.length
    };
  }

  try {
    const personaId = `${chainId}-${tokenId}`;
    const result = await executeQuery(async () => {
      const { data } = await apolloClient.query({
        query: GET_PERSONA_TRADES,
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
        total: 0
      };
    }

    // Add chain info to trades
    const chain = extractChainFromId(personaId);
    const trades = result.trades.map((trade: Trade) => ({
      ...trade,
      chain
    }));

    return {
      trades,
      total: trades.length
    };
  } catch (error) {
    console.error('Error fetching persona trades:', error);
    return {
      trades: [],
      total: 0
    };
  }
}

// Health check
export async function checkApiHealth(): Promise<boolean> {
  if (USE_MOCK_DATA) {
    return true;
  }

  try {
    // Use timeout for health check
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

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
    return true;
  } catch (error) {
    console.error('API health check failed:', error);
    return false;
  }
}

export function isApiConfigured(): boolean {
  return true; // GraphQL endpoint is always configured
}
