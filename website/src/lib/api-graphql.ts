// src/lib/api-graphql.ts
import { apolloClient, GET_PERSONAS, GET_PERSONA_DETAILS, convertOrderBy, PersonasQueryResult } from './graphql/client';
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
function transformPersona(subsquidPersona: any): Persona {
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
    
    const { data } = await apolloClient.query<PersonasQueryResult>({
      query: GET_PERSONAS,
      variables: {
        limit: params?.limit || 50,
        offset: params?.offset || 0,
        orderBy: [orderBy]
      },
      fetchPolicy: 'network-only' // Always fetch fresh data
    });

    // Transform the data
    let personas = data.personas.map(transformPersona);

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
      total: data.personasConnection.totalCount,
      limit: params?.limit,
      offset: params?.offset
    };
  } catch (error) {
    console.error('Error fetching personas from Subsquid:', error);
    // Return empty result on error
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
    const { data } = await apolloClient.query({
      query: GET_PERSONA_DETAILS,
      variables: { id: personaId }
    });

    if (!data.persona) {
      return null;
    }

    return transformPersona(data.persona);
  } catch (error) {
    console.error('Error fetching persona detail:', error);
    return null;
  }
}

// Keep other functions as they were (they'll be updated in subsequent steps)
export async function fetchVolumeChart(chainId: string, tokenId: string, days = 30): Promise<any[]> {
  if (USE_MOCK_DATA) {
    return mockVolumeChart.slice(-days);
  }
  
  // TODO: Implement with GraphQL query for PersonaDailyStats
  return [];
}

export async function fetchTrending(): Promise<Persona[]> {
  if (USE_MOCK_DATA) {
    return [...mockPersonas]
      .sort((a, b) => (b.growthMultiplier || 0) - (a.growthMultiplier || 0))
      .slice(0, 10);
  }

  // For now, return top personas by total deposited
  try {
    const { data } = await apolloClient.query<PersonasQueryResult>({
      query: GET_PERSONAS,
      variables: {
        limit: 10,
        orderBy: ['totalDeposited_DESC']
      }
    });

    return data.personas.map(transformPersona);
  } catch (error) {
    console.error('Error fetching trending:', error);
    return [];
  }
}

export async function fetchUserPortfolio(address: string): Promise<any> {
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

export async function fetchPersonaTrades(chainId: string, tokenId: string, limit = 10): Promise<any> {
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

  // TODO: Implement with GraphQL
  return {
    trades: [],
    total: 0
  };
}

// Health check - GraphQL endpoint doesn't need this
export async function checkApiHealth(): Promise<boolean> {
  if (USE_MOCK_DATA) {
    return true;
  }

  try {
    // Simple query to check if GraphQL is responding
    await apolloClient.query({
      query: GET_PERSONAS,
      variables: { limit: 1 }
    });
    return true;
  } catch {
    return false;
  }
}

export function isApiConfigured(): boolean {
  return true; // GraphQL endpoint is always configured
}
