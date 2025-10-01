'use client';

// src/pages/persona/[chainId]/[tokenId].tsx

import { gql } from 'graphql-tag';
import { useParams } from 'next/navigation';
import { formatEther } from 'viem';
import { useQuery } from 'urql';
import Layout from '@/components/Layout';
import PersonaMetadata from '@/components/PersonaMetadata';
import TradingInterface from '@/components/TradingInterface';
import PriceChart from '@/components/PriceChart';
import AgentDeposits from '@/components/AgentDeposits';
import PersonaMetadataEditor from '@/components/PersonaMetadataEditor';
import PersonaTokenBurnAndClaim from '@/components/PersonaTokenBurnAndClaim';
import Link from 'next/link';

// Type definitions for GraphQL queries
interface PersonaQueryResult {
  personas?: Array<{
    id: string;
    tokenId: string;
    name: string;
    symbol: string;
    creator: string;
    owner: string;
    erc20Token: string;
    chainId: number;
    pairCreated: boolean;
    metadata?: Array<{ key: string; value: string; updatedAt?: string }>;
  }>;
}

interface TradesQueryResult {
  trades?: Array<{
    id: string;
    trader: string;
    amountIn: string;
    amountOut: string;
    feeAmount: string;
    timestamp: string;
    block: string;
    txHash: string;
    chainId: number;
  }>;
}

// Updated query to use BigInt for tokenId
const GET_PERSONA_BY_TOKEN_AND_CHAIN = gql`
  query GetPersonaByTokenAndChain($tokenId: BigInt!, $chainId: Int!) {
    personas(
      where: {
        tokenId_eq: $tokenId,
        chainId_eq: $chainId
      },
      limit: 1
    ) {
      id
      tokenId
      name
      symbol
      creator
      owner
      erc20Token
      chainId
      pairCreated
      metadata {
        key
        value
        updatedAt
      }
    }
  }
`;

// Updated query for trades
const GET_PERSONA_TRADES_BY_TOKEN = gql`
  query GetPersonaTradesByToken($tokenId: BigInt!, $chainId: Int!, $limit: Int = 10) {
    trades(
      where: {
        persona: {
          tokenId_eq: $tokenId,
          chainId_eq: $chainId
        }
      },
      orderBy: timestamp_DESC,
      limit: $limit
    ) {
      id
      trader
      amountIn
      amountOut
      feeAmount
      timestamp
      block
      txHash
      chainId
    }
  }
`;

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
  // Convert tokenId to BigInt string for GraphQL
  const tokenIdBigInt = tokenId.replace(/^0+/, '') || '0';

  const [{ data, fetching: loading, error }] = useQuery<TradesQueryResult>({
    query: GET_PERSONA_TRADES_BY_TOKEN,
    variables: {
      tokenId: tokenIdBigInt, // Pass as string representation of BigInt
      chainId: parseInt(chainId),
      limit: 10
    },
    pause: !chainId || !tokenId,
  });

  // Get block explorer URL based on chain
  const getExplorerUrl = (txHash: string) => {
    switch (chainId) {
      case '8453':
        return `https://basescan.org/tx/${txHash}`;
      case '42161':
        return `https://arbiscan.io/tx/${txHash}`;
      case '1':
        return `https://etherscan.io/tx/${txHash}`;
      default:
        return `https://basescan.org/tx/${txHash}`; // Default to Base
    }
  };

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Trades</h3>
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
      <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Trades</h3>
        <p className="text-white/50">Unable to load trades</p>
      </div>
    );
  }

  const trades = data?.trades || [];

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10">
      <h3 className="text-lg font-semibold text-white mb-4">Recent Trades</h3>
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
                  {trade.txHash && (
                    <a
                      href={getExplorerUrl(trade.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1 mt-1"
                    >
                      View on Explorer
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
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
        <h2 className="text-2xl font-semibold text-white mb-4">Persona Not Found</h2>
        <p className="text-white/60 mb-8">
          The persona with ID #{tokenId} on chain {chainId} doesn&apos;t exist or hasn&apos;t been created yet.
        </p>
        <div className="space-y-4">
          <Link href="/" className="block w-full bg-muted text-foreground py-3 rounded-xl hover:bg-muted/80 transition-colors text-center">
            Browse Personas
          </Link>
          <Link href="/create" className="block w-full bg-brand-blue text-white py-3 rounded-xl hover:bg-blue-500 transition-colors text-center">
            Create New Persona
          </Link>
        </div>
      </div>
    </div>
  );
};

const PersonaDetailPage = () => {
  const params = useParams();
  const chainId = params.chainId as string;
  const tokenId = params.tokenId as string;

  // Ensure we have string values
  const chainIdStr = Array.isArray(chainId) ? chainId[0] : chainId;
  const tokenIdStr = Array.isArray(tokenId) ? tokenId[0] : tokenId;

  // Convert tokenId to BigInt string for GraphQL
  const tokenIdBigInt = tokenIdStr ? tokenIdStr.replace(/^0+/, '') || '0' : '0';

  // Query to check if persona exists
  const [{ data: graphqlData, fetching: isCheckingPersona }] = useQuery<PersonaQueryResult>({
    query: GET_PERSONA_BY_TOKEN_AND_CHAIN,
    variables: {
      tokenId: tokenIdBigInt, // Pass as string representation of BigInt
      chainId: parseInt(chainIdStr || '0')
    },
    pause: !tokenIdStr || !chainIdStr,
  });

  // Handle loading state while params are being resolved or checking if persona exists
  if (!chainId || !tokenId || (isCheckingPersona && !graphqlData)) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left column skeleton - 2/3 width */}
            <div className="lg:col-span-2 space-y-4">
              {/* Header skeleton */}
              <div className="bg-card backdrop-blur-md rounded-2xl p-4 border border-border animate-pulse">
                <div className="flex gap-4 mb-3">
                  <div className="flex-1">
                    <div className="h-8 bg-muted rounded w-1/3 mb-2"></div>
                    <div className="h-5 bg-muted rounded w-1/4 mb-3"></div>
                    <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="h-12 bg-muted rounded"></div>
                      ))}
                    </div>
                  </div>
                  <div className="w-48 h-48 bg-muted rounded-3xl"></div>
                </div>
              </div>

              {/* Chart skeleton */}
              <div className="bg-card backdrop-blur-md rounded-2xl p-4 border border-border animate-pulse">
                <div className="h-6 bg-muted rounded w-1/4 mb-4"></div>
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-20 bg-muted rounded"></div>
                  ))}
                </div>
                <div className="h-80 bg-muted rounded"></div>
              </div>

              {/* Agent deposits skeleton */}
              <div className="bg-card backdrop-blur-md rounded-2xl p-4 border border-border animate-pulse">
                <div className="h-6 bg-muted rounded w-1/3 mb-4"></div>
                <div className="h-32 bg-muted rounded"></div>
              </div>
            </div>

            {/* Right column skeleton - 1/3 width */}
            <div className="lg:col-span-1 space-y-4">
              {/* Trading interface skeleton */}
              <div className="bg-card backdrop-blur-md rounded-2xl p-4 border border-border animate-pulse">
                <div className="h-6 bg-muted rounded w-1/2 mb-4"></div>
                <div className="h-32 bg-muted rounded mb-4"></div>
                <div className="h-32 bg-muted rounded mb-4"></div>
                <div className="h-12 bg-muted rounded"></div>
              </div>

              {/* Trade history skeleton */}
              <div className="bg-card backdrop-blur-md rounded-2xl p-4 border border-border animate-pulse">
                <div className="h-6 bg-muted rounded w-1/3 mb-4"></div>
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-muted rounded"></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Check if the persona exists
  const personaExists = graphqlData?.personas && graphqlData.personas.length > 0;

  // Show not found if persona doesn't exist or there's a 404 error
  if (!personaExists && !isCheckingPersona) {
    return (
      <Layout>
        <PersonaNotFound chainId={chainIdStr ?? ''} tokenId={tokenIdStr ?? ''} />
      </Layout>
    );
  }

  // Get persona data for metadata editor
  const persona = graphqlData?.personas?.[0];

  // Show the full persona page if it exists
  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left column - 2/3 width */}
          <div className="lg:col-span-2 space-y-4">
            <PersonaMetadata chainId={chainIdStr ?? ''} tokenId={tokenIdStr ?? ''} />
            <PriceChart chainId={chainIdStr ?? ''} tokenId={tokenIdStr ?? ''} />
            <AgentDeposits chainId={chainIdStr ?? ''} tokenId={tokenIdStr ?? ''} />
          </div>

          {/* Right column - 1/3 width */}
          <div className="lg:col-span-1 space-y-4">
            <TradingInterface chainId={chainIdStr ?? ''} tokenId={tokenIdStr ?? ''} />
            <TradeHistory chainId={chainIdStr ?? ''} tokenId={tokenIdStr ?? ''} />
            {persona && persona.erc20Token && (
              <PersonaTokenBurnAndClaim
                chainId={chainIdStr ?? ''}
                tokenId={tokenIdStr ?? ''}
                personaToken={persona.erc20Token}
                isGraduated={persona.pairCreated || false}
              />
            )}
          </div>
        </div>

        {/* Metadata Section - Full Width */}
        {persona && (
          <div className="mt-4">
            <div className="bg-card backdrop-blur-md rounded-2xl p-4 border border-border">
              <PersonaMetadataEditor
                tokenId={tokenIdStr ?? '0'}
                chainId={chainIdStr ?? '0'}
                metadata={persona.metadata || []}
                owner={persona.owner}
              />
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default PersonaDetailPage;
