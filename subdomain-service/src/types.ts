export interface PersonaMetadata {
  key: string;
  value: string;
  updatedAt?: string;
}

export interface Persona {
  id: string;
  tokenId: string;
  name: string;
  symbol: string;
  creator: string;
  owner: string;
  erc20Token: string;
  pairToken: string;
  agentToken?: string;
  pairCreated: boolean;
  pairAddress?: string;
  createdAt: string;
  createdAtBlock: string;
  totalDeposited: string;
  tokensSold: string;
  graduationThreshold: string;
  totalAgentDeposited?: string;
  minAgentTokens?: string;
  chainId: number;
  domain: string;
  metadata?: PersonaMetadata[];
}

export interface PersonasResponse {
  personas: Persona[];
}

export interface AmicaConfig {
  personaName: string;
  personaSymbol: string;
  chainId: number;
  tokenId: string;
  domain: string;
  erc20Token: string;
  creator: string;
  owner: string;
  isGraduated: boolean;
  metadata: Record<string, string>;
}
