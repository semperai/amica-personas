// src/pages/bridge.tsx
import Layout from '@/components/Layout';
import BridgeInterface from '@/components/BridgeInterface';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function BridgePage() {
  const { address } = useAccount();

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-4xl font-light text-white mb-8">AMICA Bridge</h1>

        {!address ? (
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-12 border border-white/10 text-center">
            <h2 className="text-2xl font-light text-white mb-4">Connect Your Wallet</h2>
            <p className="text-white/60 mb-8">
              Please connect your wallet to use the AMICA bridge
            </p>
            <div className="flex justify-center">
              <div className="p-1 inline-block">
                <ConnectButton />
              </div>
            </div>
          </div>
        ) : (
          <>
            <BridgeInterface />

            <div className="mt-8 bg-white/5 backdrop-blur-md rounded-2xl p-8 border border-white/10">
              <h2 className="text-2xl font-light text-white mb-6">Bridge Information</h2>

              <div className="space-y-6">
                <div>
                  <h3 className="font-light text-lg text-white mb-3">Supported Networks</h3>
                  <ul className="text-sm text-white/70 space-y-2 ml-6 list-disc">
                    <li>Ethereum (Native AMICA)</li>
                    <li>Base (Bridged → Native conversion)</li>
                    <li>Arbitrum (Bridged → Native conversion)</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-light text-lg text-white mb-3">How Bridging Works</h3>
                  <ol className="text-sm text-white/70 space-y-2 ml-6 list-decimal">
                    <li>Bridge AMICA from Ethereum to L2 using the official bridge</li>
                    <li>Use this wrapper to convert bridged tokens to native L2 AMICA</li>
                    <li>Native AMICA can be used for trading personas and earning fee discounts</li>
                    <li>Unwrap anytime to convert back to bridged tokens</li>
                  </ol>
                </div>

                <div>
                  <h3 className="font-light text-lg text-white mb-3">Fee Discount Benefits</h3>
                  <p className="text-sm text-white/70 mb-3">
                    Holding AMICA tokens provides trading fee discounts:
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl p-4 border border-purple-500/20">
                      <p className="text-2xl font-light text-white mb-1">10%</p>
                      <p className="text-xs text-white/60">1,000 AMICA</p>
                    </div>
                    <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl p-4 border border-purple-500/20">
                      <p className="text-2xl font-light text-white mb-1">30%</p>
                      <p className="text-xs text-white/60">10,000 AMICA</p>
                    </div>
                    <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl p-4 border border-purple-500/20">
                      <p className="text-2xl font-light text-white mb-1">60%</p>
                      <p className="text-xs text-white/60">100,000 AMICA</p>
                    </div>
                    <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl p-4 border border-purple-500/20">
                      <p className="text-2xl font-light text-white mb-1">100%</p>
                      <p className="text-xs text-white/60">1,000,000+ AMICA</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
