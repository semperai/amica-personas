import '@rainbow-me/rainbowkit/styles.css';
import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, midnightTheme, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';
import { config } from '@/lib/wagmi';
import { ApiStatusProvider } from '@/components/ApiStatusProvider';
import ErrorBoundary from '@/components/ErrorBoundary';

const queryClient = new QueryClient();

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}

export default MyApp;
