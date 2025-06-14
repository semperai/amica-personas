const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface FetchPersonasParams {
  chainId?: string;
  sort?: string;
  limit?: number;
  offset?: number;
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
  
  const res = await fetch(`${API_URL}/api/personas?${query}`);
  return res.json();
}

export async function fetchPersonaDetail(chainId: string, tokenId: string) {
  const res = await fetch(`${API_URL}/api/personas/${chainId}/${tokenId}`);
  return res.json();
}

export async function fetchVolumeChart(chainId: string, tokenId: string, days = 30) {
  const res = await fetch(
    `${API_URL}/api/personas/${chainId}/${tokenId}/volume-chart?days=${days}`
  );
  return res.json();
}

export async function fetchTrending() {
  const res = await fetch(`${API_URL}/api/trending`);
  return res.json();
}

export async function fetchUserPortfolio(address: string) {
  const res = await fetch(`${API_URL}/api/users/${address}/portfolio`);
  return res.json();
}
