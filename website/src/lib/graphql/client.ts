// src/lib/graphql/client.ts
import { ApolloClient, InMemoryCache, gql, ApolloLink, createHttpLink, from } from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { RetryLink } from '@apollo/client/link/retry';

// Create a custom error type for GraphQL errors
export class GraphQLError extends Error {
  public statusCode?: number;
  public networkError?: Error;
  public graphQLErrors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: Array<string | number>;
    extensions?: Record<string, unknown>;
  }>;

  constructor(
    message: string, 
    statusCode?: number, 
    networkError?: Error, 
    graphQLErrors?: Array<{
      message: string;
      locations?: Array<{ line: number; column: number }>;
      path?: Array<string | number>;
      extensions?: Record<string, unknown>;
    }>
  ) {
    super(message);
    this.name = 'GraphQLError';
    this.statusCode = statusCode;
    this.networkError = networkError;
    this.graphQLErrors = graphQLErrors;
  }
}

// Error notification system (can be replaced with your preferred notification library)
export const errorNotification = {
  show: (message: string, type: 'error' | 'warning' | 'info' = 'error') => {
    // In production, you might want to use a toast library like react-toastify
    console.error(`[${type.toUpperCase()}]`, message);
    
    // Simple notification implementation
    if (typeof window !== 'undefined') {
      const notification = document.createElement('div');
      notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
        type === 'error' ? 'bg-red-500' : type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
      } text-white max-w-md`;
      notification.innerHTML = `
        <div class="flex items-start">
          <div class="flex-1">
            <p class="text-sm font-medium">${type === 'error' ? 'Error' : type === 'warning' ? 'Warning' : 'Info'}</p>
            <p class="text-sm mt-1">${message}</p>
          </div>
          <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white/80 hover:text-white">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      `;
      document.body.appendChild(notification);
      
      // Auto-remove after 5 seconds
      setTimeout(() => {
        notification.remove();
      }, 5000);
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
    retryIf: (error, _operation) => {
      // Retry on network errors and 5xx errors
      if (error?.networkError?.statusCode) {
        return error.networkError.statusCode >= 500;
      }
      // Retry on timeout or connection errors
      return !!(error?.networkError);
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
      } else {
        // Generic GraphQL error
        errorNotification.show(`Operation failed: ${message}`, 'error');
      }
    });
  }

  // Handle network errors
  if (networkError) {
    console.error(`Network error: ${networkError}`);
    
    // Type guard for network error with statusCode
    if ('statusCode' in networkError) {
      switch (networkError.statusCode) {
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
          errorNotification.show('Resource not found. The requested data may have been moved or deleted.', 'error');
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
          errorNotification.show(`Network error (${networkError.statusCode}). Please try again.`, 'error');
      }
    } else if (networkError.message === 'Network request failed' || networkError.message.includes('fetch')) {
      errorNotification.show('Connection error. Please check your internet connection and try again.', 'error');
    } else if (networkError.message.includes('timeout')) {
      errorNotification.show('Request timeout. The server took too long to respond. Please try again.', 'warning');
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

// HTTP link with custom fetch that includes timeout
const httpLink = createHttpLink({
  uri: 'https://arbius.squids.live/amica-base-indexer@v1/api/graphql',
  fetch: (uri, options) => {
    return fetch(uri, {
      ...options,
      // Add custom headers if needed
      headers: {
        ...options?.headers,
        'X-Client-Version': '1.0.0', // Add version tracking
      },
    }).catch((error) => {
      // Transform fetch errors into more user-friendly messages
      if (error.name === 'AbortError') {
        throw new Error('Request timeout: The server took too long to respond');
      }
      throw error;
    });
  },
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
            merge(_existing = [], incoming) {
              return [...incoming];
            },
          },
          trades: {
            keyArgs: ['where', 'orderBy'],
            merge(_existing = [], incoming) {
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
    'totalVolume24h_DESC': 'totalDeposited_DESC',
    'totalVolumeAllTime_DESC': 'totalDeposited_DESC',
    'totalDeposited_DESC': 'totalDeposited_DESC',
    'createdAt_DESC': 'createdAt_DESC',
    'name_ASC': 'name_ASC'
  };
  return sortMap[sortBy] || 'createdAt_DESC';
}
