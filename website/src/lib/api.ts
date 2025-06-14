const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
  return fetchWithErrorHandling<Persona | null>(
    `${API_URL}/api/personas/${chainId}/${tokenId}`,
    null
  );
}

export async function fetchVolumeChart(chainId: string, tokenId: string, days = 30): Promise<VolumeChartData[]> {
  return fetchWithErrorHandling<VolumeChartData[]>(
    `${API_URL}/api/personas/${chainId}/${tokenId}/volume-chart?days=${days}`,
    []
  );
}

export async function fetchTrending(): Promise<Persona[]> {
  return fetchWithErrorHandling<Persona[]>(
    `${API_URL}/api/trending`,
    []
  );
}

export async function fetchUserPortfolio(address: string): Promise<UserPortfolioResponse> {
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
  return API_URL !== 'http://localhost:3001' || !!process.env.NEXT_PUBLIC_API_URL;
}
