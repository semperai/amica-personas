'use client';

// src/pages/portfolio.tsx
import Layout from '@/components/Layout';
import { useAccount, useBalance } from 'wagmi';
import { MyPersonas } from '@/components/MyPersonas';
import { TradingHistory } from '@/components/TradingHistory';
import { BurnAndClaim } from '@/components/BurnAndClaim';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { getAddressesForChain } from '@/lib/contracts';
import { formatEther } from 'viem';
import { useState, useEffect } from 'react';

interface TokenBalance {
  symbol: string;
  name: string;
  balance: string;
  valueUSD: number;
  chainId: string;
  address: string;
}

function PortfolioTokens({ address }: { address: string }) {
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTokens = async () => {
      try {
        // In a real implementation, this would fetch all token balances
        // For now, we'll show a mock implementation
        const mockTokens: TokenBalance[] = [
          {
            symbol: 'SAGE',
            name: 'CryptoSage AI',
            balance: '12500.50',
            valueUSD: 1875.08,
            chainId: '1',
            address: '0xabcdef1234567890123456789012345678901234'
          },
          {
            symbol: 'MEME',
            name: 'MemeLord Bot',
            balance: '85000.00',
            valueUSD: 425.00,
            chainId: '8453',
            address: '0xfedcba9876543210987654321098765432109876'
          },
          {
            symbol: 'DEFI',
            name: 'DeFi Assistant',
            balance: '3200.75',
            valueUSD: 960.23,
            chainId: '42161',
            address: '0x4444444444444444444444444444444444444444'
          }
        ];
        setTokens(mockTokens);
      } catch (error) {
        console.error('Error loading tokens:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTokens();
  }, [address]);

  const totalValue = tokens.reduce((sum, token) => sum + token.valueUSD, 0);

  if (loading) {
    return (
      <div>
        <h2 className="text-2xl font-light text-white mb-6">My Tokens</h2>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (tokens.length === 0) {
    return (
      <div>
        <h2 className="text-2xl font-light text-white mb-6">My Tokens</h2>
        <div className="text-center py-12">
          <p className="text-white/60">You don&apos;t own any persona tokens yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-baseline mb-6">
        <h2 className="text-2xl font-light text-white">My Tokens</h2>
        <p className="text-lg text-white/60">
          Total Value: <span className="text-white font-medium">${totalValue.toFixed(2)}</span>
        </p>
      </div>

      <div className="space-y-3">
        {tokens.map((token, index) => (
          <div
            key={index}
            className="p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:bg-white/10 transition-colors"
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-white">{token.symbol}</h3>
                  <span className="text-xs text-white/50 capitalize">{token.chainId === '1' ? 'ethereum' : token.chainId === '8453' ? 'base' : 'arbitrum'}</span>
                </div>
                <p className="text-sm text-white/60">{token.name}</p>
              </div>
              <div className="text-right">
                <p className="font-medium text-white">{parseFloat(token.balance).toLocaleString()}</p>
                <p className="text-sm text-white/60">${token.valueUSD.toFixed(2)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PortfolioPage() {
  const { address, chainId } = useAccount();
  const addresses = chainId ? getAddressesForChain(chainId) : null;

  // Get AMICA balance
  const { data: amicaBalance } = useBalance({
    address: address,
    token: addresses?.amicaToken as `0x${string}`,
  });

  // Mock AMICA price (in real app, fetch from oracle or DEX)
  const amicaPrice = 0.05; // $0.05 per AMICA
  const amicaValueUSD = amicaBalance
    ? parseFloat(formatEther(amicaBalance.value)) * amicaPrice
    : 0;

  if (!address) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-12 border border-white/10 text-center">
              <h2 className="text-2xl font-light text-white mb-4">Connect Your Wallet</h2>
              <p className="text-white/60 mb-8">Please connect your wallet to view your portfolio</p>
              <div className="p-1 inline-block">
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

        {/* AMICA Balance Card */}
        <div className="mb-8">
          <div className="gradient-brand rounded-2xl shadow-2xl p-8 text-white">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-lg opacity-90 mb-2">AMICA Balance</p>
                <p className="text-4xl font-light">
                  {amicaBalance ? formatEther(amicaBalance.value) : '0'} AMICA
                </p>
                <p className="text-xl opacity-90 mt-2">
                  ≈ ${amicaValueUSD.toFixed(2)} USD
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm opacity-75 mb-1">Current Price</p>
                <p className="text-2xl font-light">${amicaPrice.toFixed(4)}</p>
                <p className="text-sm opacity-75 mt-1">per AMICA</p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-white/20">
              <p className="text-sm opacity-90 mb-3">Benefits of holding AMICA:</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-light">10%</p>
                  <p className="text-xs opacity-75">Fee discount at 1K</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-light">30%</p>
                  <p className="text-xs opacity-75">Fee discount at 10K</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-light">60%</p>
                  <p className="text-xs opacity-75">Fee discount at 100K</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-light">100%</p>
                  <p className="text-xs opacity-75">Fee discount at 1M+</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column - 2/3 width */}
          <div className="lg:col-span-2 space-y-8">
            {/* My Personas Section */}
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-8 border border-white/10">
              <MyPersonas address={address} />
            </div>

            {/* My Tokens Section */}
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-8 border border-white/10">
              <PortfolioTokens address={address} />
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
