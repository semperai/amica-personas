/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_ANALYTICS_ID?: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  // add more env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    dataLayer: any[];
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, handler: (...args: any[]) => void) => void;
      removeListener: (event: string, handler: (...args: any[]) => void) => void;
    };
  }
}

declare namespace JSX {
  interface IntrinsicElements {
    'pixiv-icon': {
      name: string;
      scale?: string;
    };
  }
}

export {};
