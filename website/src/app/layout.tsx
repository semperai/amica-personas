// src/app/layout.tsx
import '@rainbow-me/rainbowkit/styles.css';
import '@/styles/globals.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, midnightTheme } from '@rainbow-me/rainbowkit';
import { ApolloProvider } from '@apollo/client';
import { config } from '@/lib/wagmi';
import { apolloClient } from '@/lib/graphql/client';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ErrorNotification, errorNotificationStyles } from '@/components/ErrorNotification';
import Providers from './providers';

export const metadata = {
  title: 'Amica Personas',
  description: 'Create, trade, and monetize autonomous AI agents on the blockchain',
  manifest: '/site.webmanifest',
  appleWebApp: {
    title: 'Amica',
  },
  openGraph: {
    title: 'Amica Personas',
    description: 'Create, trade, and monetize autonomous AI agents on the blockchain',
    type: 'website',
    siteName: 'Amica Personas',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Amica Personas',
    description: 'Create, trade, and monetize autonomous AI agents on the blockchain',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
