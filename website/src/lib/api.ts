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

interface ApiError {
  error: string;
  message?: string;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
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

export async function fetchPersonas(params?: FetchPersonasParams) {
  const query = new URLSearchParams();
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        query.append(key, String(value));
      }
    });
  }
  
  return fetchWithErrorHandling<{
    personas: any[];
    total: number;
    limit?: number;
    offset?: number;
  }>(`${API_URL}/api/personas?${query}`, {
    personas: [],
    total: 0,
    limit: params?.limit,
    offset: params?.offset
  });
}

export async function fetchPersonaDetail(chainId: string, tokenId: string) {
  return fetchWithErrorHandling<any>(
    `${API_URL}/api/personas/${chainId}/${tokenId}`,
    null // Return null for single entity fetches
  );
}

export async function fetchVolumeChart(chainId: string, tokenId: string, days = 30) {
  return fetchWithErrorHandling<any[]>(
    `${API_URL}/api/personas/${chainId}/${tokenId}/volume-chart?days=${days}`,
    [] // Empty array for chart data
  );
}

export async function fetchTrending() {
  return fetchWithErrorHandling<any[]>(
    `${API_URL}/api/trending`,
    [] // Empty array for trending
  );
}

export async function fetchUserPortfolio(address: string) {
  return fetchWithErrorHandling<{
    createdPersonas: any[];
    tradedPersonasCount: number;
    totalTradeVolume: string;
    totalBridgedVolume: string;
    recentTrades: any[];
    bridgeActivities: any[];
  }>(`${API_URL}/api/users/${address}/portfolio`, {
    createdPersonas: [],
    tradedPersonasCount: 0,
    totalTradeVolume: "0",
    totalBridgedVolume: "0",
    recentTrades: [],
    bridgeActivities: []
  });
}

export async function fetchPersonaTrades(chainId: string, tokenId: string, limit = 10) {
  return fetchWithErrorHandling<{
    trades: any[];
    total: number;
  }>(`${API_URL}/api/personas/${chainId}/${tokenId}/trades?limit=${limit}`, {
    trades: [],
    total: 0
  });
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
