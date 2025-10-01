// src/lib/graphql/client.ts
import { ApolloClient, InMemoryCache, gql, ApolloLink, createHttpLink, from } from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { RetryLink } from '@apollo/client/link/retry';

// Define proper types for GraphQL errors
interface GraphQLErrorDetail {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: Array<string | number>;
  extensions?: {
    code?: string;
    [key: string]: unknown;
  };
}

// Custom error type for GraphQL errors
export class GraphQLError extends Error {
  public statusCode?: number;
  public networkError?: Error;
  public graphQLErrors?: GraphQLErrorDetail[];

  constructor(
    message: string, 
    statusCode?: number, 
    networkError?: Error, 
    graphQLErrors?: GraphQLErrorDetail[]
  ) {
    super(message);
    this.name = 'GraphQLError';
    this.statusCode = statusCode;
    this.networkError = networkError;
    this.graphQLErrors = graphQLErrors;
  }
}

// Type for network error with status code
interface NetworkErrorWithStatus extends Error {
  statusCode?: number;
  response?: {
    status?: number;
  };
}

// Window extension for error notification
interface WindowWithErrorNotification extends Window {
  errorNotification?: {
    show: (message: string, type: 'error' | 'warning' | 'info') => void;
  };
}

// Error notification system
export const errorNotification = {
  show: (message: string, type: 'error' | 'warning' | 'info' = 'error') => {
    console.error(`[${type.toUpperCase()}]`, message);
    
    if (typeof window !== 'undefined') {
      const windowWithNotification = window as WindowWithErrorNotification;
      if (windowWithNotification.errorNotification) {
        windowWithNotification.errorNotification.show(message, type);
      }
    }
  }
};

// Retry link configuration
const retryLink = new RetryLink({
  delay: {
    initial: 300,
    max: Infinity,
    jitter: true
  },
  attempts: {
    max: 3,
    retryIf: (error) => {
      // Type guard for network error
      if (error?.networkError) {
        const networkError = error.networkError as NetworkErrorWithStatus;
        if (networkError.statusCode) {
          return networkError.statusCode >= 500;
        }
        // Retry on connection errors
        return true;
      }
      return false;
    }
  }
});

// Error handling link
const errorLink = onError(({ graphQLErrors, networkError }) => {
  // Handle GraphQL errors
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path, extensions }) => {
      console.error(
        `GraphQL error: Message: ${message}, Location: ${locations}, Path: ${path}`
      );
      
      // Check for specific error types
      if (extensions?.code === 'UNAUTHENTICATED') {
        errorNotification.show('Authentication required. Please reconnect your wallet.', 'warning');
      } else if (extensions?.code === 'FORBIDDEN') {
        errorNotification.show('You do not have permission to perform this action.', 'error');
      } else if (message.includes('not found') || message.includes('does not exist')) {
        // Don't show error for not found - let the component handle it
        console.log('Resource not found, letting component handle it');
      } else {
        // Generic GraphQL error
        errorNotification.show(`Operation failed: ${message}`, 'error');
      }
    });
  }

  // Handle network errors
  if (networkError) {
    console.error(`Network error:`, networkError);
    
    // Type guard for network error with statusCode
    const isNetworkErrorWithStatus = (error: Error): error is NetworkErrorWithStatus => {
      return 'statusCode' in error || ('response' in error && typeof error.response === 'object');
    };

    if (isNetworkErrorWithStatus(networkError)) {
      const statusCode = networkError.statusCode || networkError.response?.status;
      
      if (statusCode) {
        switch (statusCode) {
          case 400:
            errorNotification.show('Bad request. Please check your input and try again.', 'error');
            break;
          case 401:
            errorNotification.show('Authentication failed. Please reconnect your wallet.', 'warning');
            break;
          case 403:
            errorNotification.show('Access forbidden. You do not have permission to access this resource.', 'error');
            break;
          case 404:
            // Don't show notification for 404s - let component handle
            console.log('404 - Resource not found');
            break;
          case 429:
            errorNotification.show('Too many requests. Please wait a moment and try again.', 'warning');
            break;
          case 500:
          case 502:
          case 503:
          case 504:
            errorNotification.show('Server error. Our team has been notified. Please try again later.', 'error');
            break;
          default:
            if (statusCode >= 400) {
              errorNotification.show(`Network error (${statusCode}). Please try again.`, 'error');
            }
        }
      }
    } else if (networkError.message === 'Network request failed' || networkError.message.includes('fetch')) {
      errorNotification.show('Connection error. Please check your internet connection and try again.', 'error');
    } else if (networkError.message.includes('timeout')) {
      errorNotification.show('Request timeout. The server took too long to respond. Please try again.', 'warning');
    } else if (networkError.message.includes('Failed to fetch')) {
      // This is often a CORS error
      console.error('CORS error detected. Check browser console for details.');
      errorNotification.show('Connection failed. This might be a CORS issue. Check the console for details.', 'error');
    } else {
      errorNotification.show('Network error. Please check your connection and try again.', 'error');
    }
  }
});

// Timeout link
const timeoutLink = new ApolloLink((operation, forward) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 30000); // 30 second timeout

  // Add abort signal to fetch options
  operation.setContext({
    fetchOptions: {
      signal: controller.signal,
    },
  });

  return forward(operation).map((data) => {
    clearTimeout(timeout);
    return data;
  });
});

// Get GraphQL endpoint
const GRAPHQL_ENDPOINT = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'https://arbius.squids.live/amica-base-indexer@v1/api/graphql';

console.log('[GraphQL] Using endpoint:', GRAPHQL_ENDPOINT);

// HTTP link with CORS-safe configuration
const httpLink = createHttpLink({
  uri: GRAPHQL_ENDPOINT,
  // Remove custom headers that might cause CORS issues
  headers: {
    // Only use simple headers that don't trigger CORS preflight
    'content-type': 'application/json',
  },
  fetchOptions: {
    mode: 'cors',
  },
  // Don't include credentials unless necessary
  credentials: 'omit',
});

// Combine all links
const link = from([
  errorLink,
  timeoutLink,
  retryLink,
  httpLink,
]);

// Create Apollo Client instance with error handling
export const apolloClient = new ApolloClient({
  link,
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          // Add merge functions for paginated queries
          personas: {
            keyArgs: ['where', 'orderBy'],
            merge(_, incoming) {
              return [...incoming];
            },
          },
          trades: {
            keyArgs: ['where', 'orderBy'],
            merge(_, incoming) {
              return [...incoming];
            },
          },
        },
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
      errorPolicy: 'all', // Return both data and errors
      notifyOnNetworkStatusChange: true,
    },
    query: {
      fetchPolicy: 'cache-first',
      errorPolicy: 'all',
      notifyOnNetworkStatusChange: true,
    },
  },
});

// Helper function to handle GraphQL query errors
export async function executeQuery<T>(
  queryFn: () => Promise<T>,
  options?: {
    fallbackData?: T;
    showError?: boolean;
    retries?: number;
  }
): Promise<T | null> {
  const { fallbackData = null, showError = true } = options || {};
  
  try {
    return await queryFn();
  } catch (error: unknown) {
    console.error('Query execution error:', error);
    
    if (showError) {
      // Error notification is already handled by error link
      // This is for any additional error handling
    }
    
    // Return fallback data if provided
    return fallbackData as T | null;
  }
}

// GraphQL Queries (keeping existing queries)
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

// Type definitions (keeping existing types)
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
