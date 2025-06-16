// src/pages/_app.tsx
import '@rainbow-me/rainbowkit/styles.css';
import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, midnightTheme } from '@rainbow-me/rainbowkit';
import { ApolloProvider } from '@apollo/client';
import { config } from '@/lib/wagmi';
import { apolloClient } from '@/lib/graphql/client';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ErrorNotification, setupErrorNotifications, errorNotificationStyles } from '@/components/ErrorNotification';
import { useEffect } from 'react';

// Configure React Query with retry logic
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: unknown) => {
        // Type guard for error with response
        const errorWithResponse = error as { response?: { status?: number } };
        // Don't retry on 4xx errors except 429 (rate limit)
        if (errorWithResponse?.response?.status && 
            errorWithResponse.response.status >= 400 && 
            errorWithResponse.response.status < 500 && 
            errorWithResponse.response.status !== 429) {
          return false;
        }
        // Retry up to 3 times with exponential backoff
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 30000, // Data is fresh for 30 seconds
    },
  },
});

function MyApp({ Component, pageProps }: AppProps) {
  // Set up error notifications on mount
  useEffect(() => {
    setupErrorNotifications();
  }, []);

  return (
    <ErrorBoundary>
      <style jsx global>{errorNotificationStyles}</style>
      <ApolloProvider client={apolloClient}>
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <RainbowKitProvider 
              theme={midnightTheme({
                borderRadius: 'large',
              })}
              appInfo={{
                appName: 'Amica Personas',
              }}
            >
              <Component {...pageProps} />
              <ErrorNotification />
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </ApolloProvider>
    </ErrorBoundary>
  );
}

export default MyApp;
