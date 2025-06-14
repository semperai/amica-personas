import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { 
  mainnet,
  base,
  arbitrum,
} from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Amica Personas',
  projectId: 'YOUR_PROJECT_ID',
  chains: [mainnet, base, arbitrum],
  ssr: true,
});

