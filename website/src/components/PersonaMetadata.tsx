// src/components/PersonaMetadata.tsx
import { useQuery, gql } from '@apollo/client';
import { formatEther } from 'viem';
import AgentTokenInfo from './AgentTokenInfo';
import { useState, useEffect } from 'react';

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
      pairToken
      agentToken
      pairCreated
      pairAddress
      createdAt
      totalDeposited
      tokensSold
      graduationThreshold
      totalAgentDeposited
      minAgentTokens
      chainId
      metadata {
        key
        value
        updatedAt
      }
    }
  }
`;

interface PersonaMetadataProps {
  chainId: string;
  tokenId: string;
}

interface MetadataItem {
  key: string;
  value: string;
}

const PersonaMetadata = ({ chainId, tokenId }: PersonaMetadataProps) => {
  const [retryCount, setRetryCount] = useState(0);
  
  // Convert chainId to number and tokenId to BigInt string for the query
  const chainIdNum = parseInt(chainId);
  const tokenIdBigInt = tokenId.replace(/^0+/, '') || '0'; // Remove leading zeros
  
  const { data, loading, error, refetch, networkStatus } = useQuery(GET_PERSONA_BY_TOKEN_AND_CHAIN, {
    variables: { 
      tokenId: tokenIdBigInt, // Pass as string representation of BigInt
      chainId: chainIdNum 
    },
    skip: !chainId || !tokenId,
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
    fetchPolicy: 'cache-and-network',
  });

  // Check if we're refetching
  const isRefetching = networkStatus === 4;

  // Auto-retry on error with exponential backoff
  useEffect(() => {
    if (error && retryCount < 3 && !data) {
      const timeout = setTimeout(() => {
        refetch();
        setRetryCount(prev => prev + 1);
      }, Math.pow(2, retryCount) * 1000);

      return () => clearTimeout(timeout);
    }
  }, [error, retryCount, refetch, data]);

  // Loading state with skeleton
  if (loading && !data) {
    return (
      <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10">
        <div className="animate-pulse">
          <div className="h-8 bg-white/10 rounded w-1/2 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-white/10 rounded w-3/4"></div>
            <div className="h-4 bg-white/10 rounded w-1/2"></div>
            <div className="h-4 bg-white/10 rounded w-2/3"></div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="h-16 bg-white/10 rounded"></div>
            <div className="h-16 bg-white/10 rounded"></div>
            <div className="h-16 bg-white/10 rounded"></div>
            <div className="h-16 bg-white/10 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  // Check if we have persona data
  const persona = data?.personas?.[0];

  // No data found (but no error) or empty result
  if (!loading && !persona) {
    return (
      <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10">
        <div className="text-center py-8">
          <div className="mb-4">
            <svg className="w-16 h-16 mx-auto text-red-400/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">Persona Not Found</h3>
          <p className="text-white/60 mb-6 max-w-sm mx-auto">
            This persona (Token ID: {tokenId} on Chain {chainId}) doesn't exist or hasn't been indexed yet.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                setRetryCount(0);
                refetch();
              }}
              disabled={isRefetching}
              className={`px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all ${
                isRefetching ? 'animate-pulse' : ''
              }`}
            >
              {isRefetching ? 'Checking...' : 'Check Again'}
            </button>
            <button
              onClick={() => window.history.back()}
              className="px-6 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If we have an error but also have cached data, show the data
  if (error && persona) {
    console.warn('Error fetching persona but showing cached data:', error);
  }

  const isGraduated = persona.pairCreated;
  const progress = persona.totalDeposited && persona.graduationThreshold
    ? (Number(persona.totalDeposited) / Number(persona.graduationThreshold)) * 100
    : 0;

  // Extract chain info
  const chainNames: Record<string, string> = {
    '1': 'ethereum',
    '8453': 'base',
    '42161': 'arbitrum'
  };
  const chainName = chainNames[chainId] || 'unknown';

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 relative">
      {/* Refetching indicator */}
      {isRefetching && (
        <div className="absolute top-4 right-4">
          <div className="flex items-center gap-2 text-xs text-white/50">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
            Updating...
          </div>
        </div>
      )}

      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-3xl font-light text-white">{persona.name}</h1>
          <p className="text-lg text-white/60">${persona.symbol}</p>
        </div>
        {isGraduated && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-500/20 text-green-400 backdrop-blur-sm">
            Graduated
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-sm text-white/50">Creator</p>
          <a
            href={`https://etherscan.io/address/${persona.creator}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 font-mono text-sm"
          >
            {persona.creator.slice(0, 6)}...{persona.creator.slice(-4)}
          </a>
        </div>
        <div>
          <p className="text-sm text-white/50">Chain</p>
          <p className="text-white font-light capitalize">{chainName}</p>
        </div>
        <div>
          <p className="text-sm text-white/50">Token ID</p>
          <p className="text-white font-light">#{tokenId}</p>
        </div>
        <div>
          <p className="text-sm text-white/50">Total Volume</p>
          <p className="text-white font-light">
            {formatEther(BigInt(persona.totalDeposited || 0))} {persona.pairToken === '0x...' ? 'AMICA' : 'tokens'}
          </p>
        </div>
      </div>

      {!isGraduated && (
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-white/60">Graduation Progress</span>
            <span className="text-white font-light">{progress.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <p className="text-xs text-white/50 mt-2">
            {formatEther(BigInt(persona.totalDeposited || 0))} / {formatEther(BigInt(persona.graduationThreshold || 0))} tokens
          </p>
        </div>
      )}

      {persona.metadata && persona.metadata.length > 0 && (
        <div className="mt-6 pt-6 border-t border-white/10">
          <h3 className="text-sm font-medium text-white mb-3">Metadata</h3>
          <div className="space-y-2">
            {persona.metadata.map((item: MetadataItem) => (
              <div key={item.key} className="flex justify-between text-sm">
                <span className="text-white/50">{item.key}:</span>
                <span className="text-white/80 break-all">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agent Token Info */}
      <AgentTokenInfo
        agentToken={persona.agentToken}
        minAgentTokens={persona.minAgentTokens}
        totalAgentDeposited={persona.totalAgentDeposited}
        isGraduated={isGraduated}
      />

      {/* Manual refresh button */}
      <div className="mt-4 pt-4 border-t border-white/10 flex justify-end">
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="text-xs text-white/40 hover:text-white/60 transition-colors disabled:opacity-50"
        >
          Last updated: {new Date().toLocaleTimeString()}
        </button>
      </div>
    </div>
  );
};

export default PersonaMetadata;
