import { mockPersonas, mockTrades, mockVolumeChart, mockUserPortfolio } from './mockData';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
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

// Types for personas
interface PersonaChain {
  id: string;
  name: string;
}

interface Persona {
  id: string;
  name: string;
  symbol: string;
  totalVolume24h: string;
  totalVolumeAllTime: string;
  isGraduated: boolean;
  chain: PersonaChain;
  growthMultiplier?: number;
  creator?: string;
  erc20Token?: string;
  pairToken?: string;
  pairCreated?: boolean;
  pairAddress?: string;
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
  chain?: {
    id: string;
    name: string;
  };
}

interface BridgeActivity {
  action: string;
  amount: string;
  timestamp: string;
  chain: {
    id: string;
    name: string;
  };
}

interface VolumeChartData {
  date: string;
  volume: string;
  trades: number;
  uniqueTraders?: number;
}

interface UserPortfolioResponse {
  createdPersonas: Persona[];
  tradedPersonasCount: number;
  totalTradeVolume: string;
  totalBridgedVolume: string;
  recentTrades: Trade[];
  bridgeActivities: BridgeActivity[];
}

interface TradesResponse {
  trades: Trade[];
  total: number;
}

// Generic fetch wrapper with error handling
async function fetchWithErrorHandling<T>(url: string, defaultValue: T): Promise<T> {
  // If mock data is enabled, skip the actual API call
  if (USE_MOCK_DATA) {
    return defaultValue;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const res = await fetch(url, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.error(`HTTP error! status: ${res.status} for ${url}`);
      return defaultValue;
    }

    const data = await res.json();
    return data;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        console.error(`Request timeout for ${url}`);
      } else {
        console.error(`API Error for ${url}:`, error.message);
      }
    } else {
      console.error(`Unknown error for ${url}:`, error);
    }

    return defaultValue;
  }
}

export async function fetchPersonas(params?: FetchPersonasParams): Promise<PersonasResponse> {
  if (USE_MOCK_DATA) {
    let personas = [...mockPersonas];

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
      }
    }

    // Apply pagination
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

  const query = new URLSearchParams();

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        query.append(key, String(value));
      }
    });
  }

  return fetchWithErrorHandling<PersonasResponse>(`${API_URL}/api/personas?${query}`, {
    personas: [],
    total: 0,
    limit: params?.limit,
    offset: params?.offset
  });
}

export async function fetchPersonaDetail(chainId: string, tokenId: string): Promise<Persona | null> {
  if (USE_MOCK_DATA) {
    const persona = mockPersonas.find(p =>
      p.chain.id === chainId && p.id.split('-')[1] === tokenId
    );
    return persona || null;
  }

  return fetchWithErrorHandling<Persona | null>(
    `${API_URL}/api/personas/${chainId}/${tokenId}`,
    null
  );
}

export async function fetchVolumeChart(chainId: string, tokenId: string, days = 30): Promise<VolumeChartData[]> {
  if (USE_MOCK_DATA) {
    return mockVolumeChart.slice(-days);
  }

  return fetchWithErrorHandling<VolumeChartData[]>(
    `${API_URL}/api/personas/${chainId}/${tokenId}/volume-chart?days=${days}`,
    []
  );
}

export async function fetchTrending(): Promise<Persona[]> {
  if (USE_MOCK_DATA) {
    // Return personas sorted by growth multiplier
    return [...mockPersonas]
      .sort((a, b) => (b.growthMultiplier || 0) - (a.growthMultiplier || 0))
      .slice(0, 10);
  }

  return fetchWithErrorHandling<Persona[]>(
    `${API_URL}/api/trending`,
    []
  );
}

export async function fetchUserPortfolio(address: string): Promise<UserPortfolioResponse> {
  if (USE_MOCK_DATA) {
    // Simulate user owning first 2 personas
    const userPersonas = mockPersonas
      .filter(p => p.creator?.toLowerCase() === address.toLowerCase())
      .slice(0, 2);

    return {
      ...mockUserPortfolio,
      createdPersonas: userPersonas.length > 0 ? userPersonas : mockUserPortfolio.createdPersonas
    };
  }

  return fetchWithErrorHandling<UserPortfolioResponse>(`${API_URL}/api/users/${address}/portfolio`, {
    createdPersonas: [],
    tradedPersonasCount: 0,
    totalTradeVolume: "0",
    totalBridgedVolume: "0",
    recentTrades: [],
    bridgeActivities: []
  });
}

export async function fetchPersonaTrades(chainId: string, tokenId: string, limit = 10): Promise<TradesResponse> {
  if (USE_MOCK_DATA) {
    // Filter trades for this persona
    const personaId = `${chainId}-${tokenId}`;
    const trades = mockTrades.filter(t =>
      t.persona?.id === personaId ||
      (personaId === '1-0' && !t.persona) // Default some trades to first persona
    ).slice(0, limit);

    return {
      trades,
      total: trades.length
    };
  }

  return fetchWithErrorHandling<TradesResponse>(
    `${API_URL}/api/personas/${chainId}/${tokenId}/trades?limit=${limit}`,
    {
      trades: [],
      total: 0
    }
  );
}

// Health check function
export async function checkApiHealth(): Promise<boolean> {
  if (USE_MOCK_DATA) {
    return true; // Always return healthy when using mock data
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const res = await fetch(`${API_URL}/health`, {
      method: 'GET',
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

// Check if API URL is configured
export function isApiConfigured(): boolean {
  return USE_MOCK_DATA || API_URL !== 'http://localhost:3001' || !!process.env.NEXT_PUBLIC_API_URL;
}
