// src/lib/graphql/client.ts
import { cacheExchange, fetchExchange, Client } from 'urql';
import { gql } from 'graphql-tag';

// Get GraphQL endpoint
const GRAPHQL_ENDPOINT = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'https://arbius.squids.live/amica-base-indexer@v1/api/graphql';

console.log('[GraphQL] Using endpoint:', GRAPHQL_ENDPOINT);

// Create urql client
export const urqlClient = new Client({
  url: GRAPHQL_ENDPOINT,
  exchanges: [cacheExchange, fetchExchange],
  requestPolicy: 'cache-and-network',
  fetchOptions: {
    headers: {
      'content-type': 'application/json',
    },
  },
});

// GraphQL Queries
export const GET_PERSONAS = gql`
  query GetPersonas($limit: Int = 10, $offset: Int = 0, $orderBy: [PersonaOrderByInput!] = [createdAt_DESC], $chainId: Int) {
    personas(
      limit: $limit,
      offset: $offset,
      orderBy: $orderBy,
      where: { chainId_eq: $chainId }
    ) {
      id
      tokenId
      name
      symbol
      creator
      owner
      erc20Token
      pairToken
      agentToken
      pairCreated
      pairAddress
      createdAt
      totalDeposited
      tokensSold
      graduationThreshold
      totalAgentDeposited
      minAgentTokens
      chainId
      metadata {
        key
        value
      }
    }
    personasConnection(orderBy: id_ASC, where: { chainId_eq: $chainId }) {
      totalCount
    }
  }
`;

export const GET_PERSONA_DETAILS = gql`
  query GetPersona($id: String!) {
    personas(where: { id_eq: $id }, limit: 1) {
      id
      tokenId
      name
      symbol
      creator
      owner
      erc20Token
      pairToken
      agentToken
      pairCreated
      pairAddress
      createdAt
      totalDeposited
      tokensSold
      graduationThreshold
      totalAgentDeposited
      minAgentTokens
      chainId
      trades(orderBy: timestamp_DESC, limit: 10) {
        id
        trader
        amountIn
        amountOut
        feeAmount
        timestamp
        txHash
      }
      metadata {
        key
        value
        updatedAt
      }
    }
  }
`;

export const GET_RECENT_TRADES = gql`
  query GetRecentTrades($limit: Int = 20) {
    trades(limit: $limit, orderBy: timestamp_DESC) {
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
      timestamp
      txHash
      chainId
    }
  }
`;

export const GET_USER_PORTFOLIO = gql`
  query GetUserPortfolio($creator: String!) {
    createdPersonas: personas(where: { creator_eq: $creator }, orderBy: createdAt_DESC) {
      id
      tokenId
      name
      symbol
      creator
      erc20Token
      pairToken
      pairCreated
      totalDeposited
      tokensSold
      graduationThreshold
      createdAt
      chainId
    }

    userTrades: trades(where: { trader_eq: $creator }, orderBy: timestamp_DESC, limit: 10) {
      id
      persona {
        id
        name
        symbol
        chainId
      }
      amountIn
      amountOut
      feeAmount
      timestamp
      txHash
      chainId
    }
  }
`;

export const GET_PERSONA_TRADES = gql`
  query GetPersonaTrades($personaId: String!, $limit: Int = 10) {
    trades(where: { persona: { id_eq: $personaId } }, orderBy: timestamp_DESC, limit: $limit) {
      id
      trader
      amountIn
      amountOut
      feeAmount
      timestamp
      block
      txHash
      chainId
    }
  }
`;

export const GET_DAILY_STATS = gql`
  query GetPersonaDailyStats($personaId: String!, $days: Int = 30) {
    personaDailyStats(
      where: { persona: { id_eq: $personaId } }
      orderBy: date_DESC
      limit: $days
    ) {
      id
      date
      trades
      volume
      uniqueTraders
    }
  }
`;

// Type definitions
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
  totalDeposited: string;
  tokensSold: string;
  graduationThreshold: string;
  totalAgentDeposited?: string;
  minAgentTokens?: string;
  chainId: number;
  metadata?: PersonaMetadata[];
  trades?: Trade[];
}

export interface Trade {
  id: string;
  persona?: {
    id: string;
    name: string;
    symbol: string;
    chainId: number;
  };
  trader: string;
  amountIn: string;
  amountOut: string;
  feeAmount: string;
  timestamp: string;
  txHash: string;
  chainId: number;
}

export interface PersonasQueryResult {
  personas: Persona[];
  personasConnection: {
    totalCount: number;
  };
}

// Helper to convert orderBy string to GraphQL enum
export function convertOrderBy(sortBy: string): string {
  const sortMap: Record<string, string> = {
    'totalVolume24h_DESC': 'totalDeposited_DESC',
    'totalVolumeAllTime_DESC': 'totalDeposited_DESC',
    'totalDeposited_DESC': 'totalDeposited_DESC',
    'createdAt_DESC': 'createdAt_DESC',
    'name_ASC': 'name_ASC'
  };
  return sortMap[sortBy] || 'createdAt_DESC';
}
