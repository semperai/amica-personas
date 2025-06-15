// src/pages/bridge.tsx
import Layout from '@/components/Layout';
import BridgeInterface from '@/components/BridgeInterface';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function BridgePage() {
  const { address } = useAccount();

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">AMICA Bridge</h1>

        {!address ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <h2 className="text-xl font-semibold mb-4">Connect Your Wallet</h2>
            <p className="text-gray-600 mb-6">
              Please connect your wallet to use the AMICA bridge
            </p>
            <div className="flex justify-center">
              <ConnectButton />
            </div>
          </div>
        ) : (
          <>
            <BridgeInterface />

            <div className="mt-8 bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Bridge Information</h2>

              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Supported Networks</h3>
                  <ul className="text-sm space-y-1 ml-4 list-disc">
                    <li>Ethereum (Native AMICA)</li>
                    <li>Base (Bridged → Native conversion)</li>
                    <li>Arbitrum (Bridged → Native conversion)</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-medium mb-2">How Bridging Works</h3>
                  <ol className="text-sm space-y-2 ml-4 list-decimal">
                    <li>Bridge AMICA from Ethereum to L2 using the official bridge</li>
                    <li>Use this wrapper to convert bridged tokens to native L2 AMICA</li>
                    <li>Native AMICA can be used for trading personas and earning fee discounts</li>
                    <li>Unwrap anytime to convert back to bridged tokens</li>
                  </ol>
                </div>

                <div>
                  <h3 className="font-medium mb-2">Fee Discount Benefits</h3>
                  <p className="text-sm text-gray-600">
                    Holding AMICA tokens provides trading fee discounts:
                  </p>
                  <ul className="text-sm space-y-1 ml-4 list-disc mt-2">
                    <li>1,000 AMICA: 10% discount</li>
                    <li>10,000 AMICA: 30% discount</li>
                    <li>100,000 AMICA: 60% discount</li>
                    <li>1,000,000+ AMICA: 100% discount (no fees)</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
