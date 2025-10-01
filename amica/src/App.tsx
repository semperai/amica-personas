import { Providers } from './providers';
import Home from './HomePage';
import { Navbar } from './components/Navbar';
import { AAWalletProvider, init as initAAWallet } from './lib/arbius-wallet';
import { useEffect } from 'react';

// Initialize AA Wallet
initAAWallet({
  defaultChainId: 42161, // Arbitrum
  supportedChainIds: [42161],
  ui: {
    theme: 'light',
    autoConnectOnInit: false,
  },
});

function App() {
  useEffect(() => {
    // Google Analytics
    if (import.meta.env.PROD && import.meta.env.VITE_GOOGLE_ANALYTICS_ID) {
      const script = document.createElement('script');
      script.src = `https://www.googletagmanager.com/gtag/js?id=${import.meta.env.VITE_GOOGLE_ANALYTICS_ID}`;
      script.async = true;
      document.head.appendChild(script);

      window.dataLayer = window.dataLayer || [];
      function gtag(...args: any[]) {
        window.dataLayer.push(args);
      }
      gtag('js', new Date());
      gtag('config', import.meta.env.VITE_GOOGLE_ANALYTICS_ID);
    }
  }, []);

  return (
    <Providers>
      <AAWalletProvider>
        <Navbar />
        <div className="pt-14">
          <Home />
        </div>
      </AAWalletProvider>
    </Providers>
  );
}

export default App;
