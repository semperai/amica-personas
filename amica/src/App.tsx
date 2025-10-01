import { Providers } from './providers';
import Home from './HomePage';
import { useEffect } from 'react';

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
      <Home />
    </Providers>
  );
}

export default App;
