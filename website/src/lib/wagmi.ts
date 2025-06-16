import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { 
  mainnet,
  base,
  arbitrum,
} from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Amica Personas',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || 'YOUR_PROJECT_ID_HERE',
  chains: [/*mainnet, */ base, /*arbitrum*/],
  ssr: true,
});

