import '@rainbow-me/rainbowkit/styles.css';
import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, midnightTheme } from '@rainbow-me/rainbowkit';
import { ApolloProvider } from '@apollo/client';
import { config } from '@/lib/wagmi';
import { apolloClient } from '@/lib/graphql/client';
import { ApiStatusProvider } from '@/components/ApiStatusProvider';
import ErrorBoundary from '@/components/ErrorBoundary';

const queryClient = new QueryClient();

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      <ApolloProvider client={apolloClient}>
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <RainbowKitProvider theme={midnightTheme({
              borderRadius: 'large',
            })}>
              <ApiStatusProvider>
                <Component {...pageProps} />
              </ApiStatusProvider>
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </ApolloProvider>
    </ErrorBoundary>
  );
}

export default MyApp;
