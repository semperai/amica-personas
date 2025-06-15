import Layout from '@/components/Layout';
import { useAccount } from 'wagmi';
import { MyPersonas } from '@/components/MyPersonas';
import { TradingHistory } from '@/components/TradingHistory';
import { BurnAndClaim } from '@/components/BurnAndClaim';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function PortfolioPage() {
  const { address } = useAccount();

  if (!address) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-12 border border-white/10 text-center">
              <h2 className="text-2xl font-light text-white mb-4">Connect Your Wallet</h2>
              <p className="text-white/60 mb-8">Please connect your wallet to view your portfolio</p>
              <div className="bg-white/10 backdrop-blur-md rounded-full p-1 inline-block">
                <ConnectButton />
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-4xl font-light text-white mb-8">My Portfolio</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column - 2/3 width */}
          <div className="lg:col-span-2 space-y-8">
            {/* My Personas Section */}
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-8 border border-white/10">
              <MyPersonas address={address} />
            </div>

            {/* Trading History Section */}
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-8 border border-white/10">
              <TradingHistory address={address} />
            </div>
          </div>

          {/* Right column - 1/3 width */}
          <div className="lg:col-span-1">
            {/* Burn & Claim Section */}
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-8 border border-white/10">
              <BurnAndClaim />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
