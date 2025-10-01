// src/app/layout.tsx
import '@rainbow-me/rainbowkit/styles.css';
import '@/styles/globals.css';
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
