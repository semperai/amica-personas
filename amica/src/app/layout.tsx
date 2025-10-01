import '@rainbow-me/rainbowkit/styles.css';
import "@/styles/globals.css";
import "@charcoal-ui/icons";

import { GoogleAnalytics } from '@next/third-parties/google';
import Script from 'next/script';
import { Providers } from './providers';

const title = "Amica - Where Empathy Meets AI";
const description = "Amica is your personal 3D companion that can communicate via natural voice chat and vision, with an emotion engine that allows Amica to express feelings, complete tasks and engage on her own.";
const imageUrl = "https://amica.arbius.ai/ogp.png";

export const metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    images: [imageUrl],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [imageUrl],
  },
  applicationName: title,
  appleWebApp: {
    title,
  },
  manifest: '/site.webmanifest',
  themeColor: '#ffffff',
  other: {
    'msapplication-TileColor': '#da532c',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=M+PLUS+2&family=Montserrat&display=swap"
          rel="stylesheet"
        />
        <Script
          src="/debugLogger.js"
          strategy="beforeInteractive"
        />
        <Script
          src="/ammo.wasm.js"
          strategy="beforeInteractive"
        />
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
        {process.env.NODE_ENV === "production" && (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID!} />
        )}
      </body>
    </html>
  );
}
