import Layout from '@/components/Layout';
import { useAccount } from 'wagmi';
import { MyPersonas } from '@/components/MyPersonas';
import { TradingHistory } from '@/components/TradingHistory';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function PortfolioPage() {
  const { address } = useAccount();

  if (!address) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
          <p className="text-gray-600 mb-6">Please connect your wallet to view your portfolio</p>
          <ConnectButton />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <h1 className="text-3xl font-bold mb-6">My Portfolio</h1>
      <MyPersonas address={address} />
      <TradingHistory address={address} />
    </Layout>
  );
}
