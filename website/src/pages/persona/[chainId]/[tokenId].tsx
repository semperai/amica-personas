// src/pages/persona/[chainId]/[tokenId].tsx
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { NextPage } from 'next';
import { formatEther } from 'viem';
import { useQuery } from '@apollo/client';
import Layout from '@/components/Layout';
import PersonaMetadata from '@/components/PersonaMetadata';
import TradingInterface from '@/components/TradingInterface';
import PriceChart from '@/components/PriceChart';
import AgentDeposits from '@/components/AgentDeposits';
import { GET_PERSONA_DETAILS, GET_PERSONA_TRADES } from '@/lib/graphql/client';
import { useReadContract } from 'wagmi';
import { FACTORY_ABI, getAddressesForChain } from '@/lib/contracts';
import Link from 'next/link';

// Trade interface
interface Trade {
  id: string;
  trader: string;
  amountIn: string;
  amountOut: string;
  feeAmount: string;
  timestamp: string;
  block: string;
  txHash: string;
}

// Create TradeHistory component with GraphQL
const TradeHistory = ({ chainId, tokenId }: { chainId: string; tokenId: string }) => {
  const personaId = `${chainId}-${tokenId}`;
  
  const { data, loading, error } = useQuery(GET_PERSONA_TRADES, {
    variables: { personaId, limit: 10 },
    skip: !chainId || !tokenId,
  });

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10">
        <h3 className="text-lg font-light text-white mb-4">Recent Trades</h3>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-white/10 rounded"></div>
          <div className="h-4 bg-white/10 rounded"></div>
          <div className="h-4 bg-white/10 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10">
        <h3 className="text-lg font-light text-white mb-4">Recent Trades</h3>
        <p className="text-white/50">Unable to load trades</p>
      </div>
    );
  }

  const trades = data?.trades || [];

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10">
      <h3 className="text-lg font-light text-white mb-4">Recent Trades</h3>
      {trades.length === 0 ? (
        <p className="text-white/50">No trades yet</p>
      ) : (
        <div className="space-y-3">
          {trades.map((trade: Trade) => (
            <div key={trade.id} className="border-b border-white/10 pb-3 last:border-b-0">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-white">
                    {trade.trader.slice(0, 6)}...{trade.trader.slice(-4)}
                  </p>
                  <p className="text-xs text-white/50">
                    {new Date(trade.timestamp).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-white/80">
                    {formatEther(BigInt(trade.amountIn))} AMICA
                  </p>
                  <p className="text-xs text-white/60">
                    {formatEther(BigInt(trade.amountOut))} tokens
                  </p>
                  {BigInt(trade.feeAmount) > 0 && (
                    <p className="text-xs text-purple-400">
                      Fee: {formatEther(BigInt(trade.feeAmount))} AMICA
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Persona not found component
const PersonaNotFound = ({ chainId, tokenId }: { chainId: string; tokenId: string }) => {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="bg-white/5 backdrop-blur-md rounded-2xl p-12 border border-white/10 text-center max-w-md">
        <div className="mb-6">
          <svg className="w-24 h-24 mx-auto text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-light text-white mb-4">Persona Not Found</h2>
        <p className="text-white/60 mb-8">
          The persona with ID #{tokenId} on chain {chainId} doesn&apos;t exist or hasn&apos;t been created yet.
        </p>
        <div className="space-y-4">
          <Link href="/" className="block w-full bg-white/10 backdrop-blur-sm text-white py-3 rounded-xl hover:bg-white/20 transition-all duration-300">
            Browse Personas
          </Link>
          <Link href="/create" className="block w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all duration-300">
            Create New Persona
          </Link>
        </div>
      </div>
    </div>
  );
};

const PersonaDetailPage: NextPage = () => {
  const router = useRouter();
  const { chainId, tokenId } = router.query;

  // Ensure we have string values
  const chainIdStr = Array.isArray(chainId) ? chainId[0] : chainId;
  const tokenIdStr = Array.isArray(tokenId) ? tokenId[0] : tokenId;
  const chainIdNum = chainIdStr ? parseInt(chainIdStr) : undefined;
  const personaId = chainIdStr && tokenIdStr ? `${chainIdStr}-${tokenIdStr}` : null;

  // Get contract addresses
  const addresses = chainIdNum ? getAddressesForChain(chainIdNum) : null;

  // Check if persona exists using GraphQL
  const { data: graphqlData, loading: isCheckingPersona } = useQuery(GET_PERSONA_DETAILS, {
    variables: { id: personaId },
    skip: !personaId || !router.isReady,
  });

  // Also check on-chain for verification (optional, can be removed if you trust GraphQL)
  const { data: personaData } = useReadContract({
    address: addresses?.personaFactory as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: 'getPersona',
    args: tokenIdStr ? [BigInt(tokenIdStr)] : undefined,
    query: {
      enabled: !!addresses && !!tokenIdStr && router.isReady,
    },
  }) as { 
    data: readonly [string, string, `0x${string}`, `0x${string}`, boolean, bigint, bigint] | undefined;
  };

  // Check if the persona exists
  const personaExists = graphqlData?.persona || (personaData && personaData[2] !== '0x0000000000000000000000000000000000000000');

  // Handle loading state while router params are being resolved
  if (!router.isReady || !chainId || !tokenId) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </Layout>
    );
  }

  // Show loading while checking if persona exists
  if (isCheckingPersona) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-white/60">Loading persona...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Show not found if persona doesn't exist
  if (!personaExists) {
    return (
      <Layout>
        <PersonaNotFound chainId={chainIdStr ?? ''} tokenId={tokenIdStr ?? ''} />
      </Layout>
    );
  }

  // Show the full persona page if it exists
  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - 2/3 width */}
          <div className="lg:col-span-2 space-y-6">
            <PersonaMetadata chainId={chainIdStr ?? ''} tokenId={tokenIdStr ?? ''} />
            <PriceChart chainId={chainIdStr ?? ''} tokenId={tokenIdStr ?? ''} />
            <AgentDeposits chainId={chainIdStr ?? ''} tokenId={tokenIdStr ?? ''} />
          </div>

          {/* Right column - 1/3 width */}
          <div className="lg:col-span-1 space-y-6">
            <TradingInterface chainId={chainIdStr ?? ''} tokenId={tokenIdStr ?? ''} />
            <TradeHistory chainId={chainIdStr ?? ''} tokenId={tokenIdStr ?? ''} />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default PersonaDetailPage;
