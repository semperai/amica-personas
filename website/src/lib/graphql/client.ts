// src/lib/graphql/client.ts
import { ApolloClient, InMemoryCache, gql } from '@apollo/client';

// Create Apollo Client instance
export const apolloClient = new ApolloClient({
  uri: 'https://arbius.squids.live/amica-base-indexer@v1/api/graphql',
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
  },
});

// GraphQL Queries
export const GET_PERSONAS = gql`
  query GetPersonas($limit: Int = 10, $offset: Int = 0, $orderBy: [PersonaOrderByInput!] = [createdAt_DESC]) {
    personas(limit: $limit, offset: $offset, orderBy: $orderBy) {
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
      metadata {
        key
        value
      }
    }
    personasConnection(orderBy: id_ASC) {
      totalCount
    }
  }
`;

export const GET_PERSONA_DETAILS = gql`
  query GetPersona($id: String!) {
    persona(id: $id) {
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
      }
      trader
      amountIn
      amountOut
      feeAmount
      timestamp
      txHash
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
    }
    
    userTrades: trades(where: { trader_eq: $creator }, orderBy: timestamp_DESC, limit: 10) {
      id
      persona {
        id
        name
        symbol
      }
      amountIn
      amountOut
      feeAmount
      timestamp
      txHash
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

// Type definitions based on GraphQL schema
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
  metadata?: PersonaMetadata[];
  trades?: Trade[];
}

export interface Trade {
  id: string;
  persona?: {
    id: string;
    name: string;
    symbol: string;
  };
  trader: string;
  amountIn: string;
  amountOut: string;
  feeAmount: string;
  timestamp: string;
  txHash: string;
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
    'totalVolume24h_DESC': 'totalDeposited_DESC', // Using totalDeposited as proxy for volume
    'totalVolumeAllTime_DESC': 'totalDeposited_DESC',
    'totalDeposited_DESC': 'totalDeposited_DESC',
    'createdAt_DESC': 'createdAt_DESC',
    'name_ASC': 'name_ASC'
  };
  return sortMap[sortBy] || 'createdAt_DESC';
}
