// src/components/PersonaMetadata.tsx - Enhanced with new contract features
import { useQuery, gql } from '@apollo/client';
import { formatEther } from 'viem';
import AgentTokenInfo from './AgentTokenInfo';
import { useState, useEffect } from 'react';
import Link from 'next/link';

// Enhanced query with new fields from updated schema
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
      createdAtBlock
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
      transfers(orderBy: timestamp_DESC, limit: 5) {
        id
        from
        to
        timestamp
        txHash
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
  updatedAt?: string;
}

interface Transfer {
  id: string;
  from: string;
  to: string;
  timestamp: string;
  txHash: string;
}

const PersonaMetadata = ({ chainId, tokenId }: PersonaMetadataProps) => {
  const [retryCount, setRetryCount] = useState(0);
  const [showTransfers, setShowTransfers] = useState(false);
  
  // Convert chainId to number and tokenId to BigInt string for the query
  const chainIdNum = parseInt(chainId);
  const tokenIdBigInt = tokenId.replace(/^0+/, '') || '0';
  
  const { data, loading, error, refetch, networkStatus } = useQuery(GET_PERSONA_BY_TOKEN_AND_CHAIN, {
    variables: { 
      tokenId: tokenIdBigInt,
      chainId: chainIdNum 
    },
    skip: !chainId || !tokenId,
    errorPolicy: 'all',
    notifyOnNetworkStatusChange: true,
    fetchPolicy: 'cache-and-network',
  });

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
        return `https://basescan.org/tx/${txHash}`;
    }
  };

  const getAddressExplorerUrl = (address: string) => {
    switch (chainId) {
      case '8453':
        return `https://basescan.org/address/${address}`;
      case '42161':
        return `https://arbiscan.io/address/${address}`;
      case '1':
        return `https://etherscan.io/address/${address}`;
      default:
        return `https://basescan.org/address/${address}`;
    }
  };

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

  const persona = data?.personas?.[0];

  // No data found
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
            This persona (Token ID: {tokenId} on Chain {chainId}) doesn&apos;t exist or hasn&apos;t been indexed yet.
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

  if (error && persona) {
    console.warn('Error fetching persona but showing cached data:', error);
  }

  const isGraduated = persona.pairCreated;
  const progress = persona.totalDeposited && persona.graduationThreshold
    ? (Number(persona.totalDeposited) / Number(persona.graduationThreshold)) * 100
    : 0;

  // Calculate agent token graduation requirements
  const hasAgentToken = persona.agentToken && persona.agentToken !== '0x0000000000000000000000000000000000000000';
  const agentTokenProgress = hasAgentToken && persona.minAgentTokens && persona.totalAgentDeposited
    ? (Number(persona.totalAgentDeposited) / Number(persona.minAgentTokens)) * 100
    : 100; // If no requirement or no agent token, consider it complete

  const canGraduate = progress >= 100 && agentTokenProgress >= 100;
  const isOwnerDifferentFromCreator = persona.owner !== persona.creator;

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
        <div className="flex gap-2">
          {isGraduated && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-500/20 text-green-400 backdrop-blur-sm">
              Graduated
            </span>
          )}
          {!isGraduated && canGraduate && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-500/20 text-yellow-400 backdrop-blur-sm">
              Ready to Graduate
            </span>
          )}
          {hasAgentToken && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-500/20 text-purple-400 backdrop-blur-sm">
              Agent Token
            </span>
          )}
        </div>
      </div>

      {/* Enhanced grid with new fields */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div>
          <p className="text-sm text-white/50">Creator</p>
          <a
            href={getAddressExplorerUrl(persona.creator)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 font-mono text-sm transition-colors"
          >
            {persona.creator.slice(0, 6)}...{persona.creator.slice(-4)}
          </a>
        </div>
        
        {isOwnerDifferentFromCreator && (
          <div>
            <p className="text-sm text-white/50">Current Owner</p>
            <a
              href={getAddressExplorerUrl(persona.owner)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 font-mono text-sm transition-colors"
            >
              {persona.owner.slice(0, 6)}...{persona.owner.slice(-4)}
            </a>
          </div>
        )}
        
        <div>
          <p className="text-sm text-white/50">Chain</p>
          <p className="text-white font-light capitalize">{chainName}</p>
        </div>
        <div>
          <p className="text-sm text-white/50">Token ID</p>
          <p className="text-white font-light">#{tokenId}</p>
        </div>
        <div>
          <p className="text-sm text-white/50">Created</p>
          <p className="text-white font-light">
            {new Date(persona.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div>
          <p className="text-sm text-white/50">Block</p>
          <p className="text-white font-light">#{persona.createdAtBlock}</p>
        </div>
      </div>

      {/* Contract Addresses */}
      <div className="mb-6 p-4 bg-white/5 rounded-xl">
        <h3 className="text-sm font-medium text-white mb-3">Contract Addresses</h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-white/60 text-sm">ERC20 Token:</span>
            <a
              href={getAddressExplorerUrl(persona.erc20Token)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 font-mono text-xs transition-colors"
            >
              {persona.erc20Token.slice(0, 6)}...{persona.erc20Token.slice(-4)}
            </a>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white/60 text-sm">Pairing Token:</span>
            <a
              href={getAddressExplorerUrl(persona.pairToken)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 font-mono text-xs transition-colors"
            >
              {persona.pairToken.slice(0, 6)}...{persona.pairToken.slice(-4)}
            </a>
          </div>
          {isGraduated && persona.pairAddress && (
            <div className="flex justify-between items-center">
              <span className="text-white/60 text-sm">Uniswap Pair:</span>
              <a
                href={getAddressExplorerUrl(persona.pairAddress)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 font-mono text-xs transition-colors"
              >
                {persona.pairAddress.slice(0, 6)}...{persona.pairAddress.slice(-4)}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced graduation progress */}
      {!isGraduated && (
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-white/60">TVL Progress</span>
            <span className="text-white font-light">{progress.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2 mb-2">
            <div
              className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <p className="text-xs text-white/50">
            {formatEther(BigInt(persona.totalDeposited || 0))} / {formatEther(BigInt(persona.graduationThreshold || 0))} tokens
          </p>

          {hasAgentToken && persona.minAgentTokens && Number(persona.minAgentTokens) > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-white/60">Agent Token Progress</span>
                <span className="text-white font-light">{agentTokenProgress.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2 mb-2">
                <div
                  className="bg-gradient-to-r from-purple-500 to-cyan-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(agentTokenProgress, 100)}%` }}
                />
              </div>
              <p className="text-xs text-white/50">
                {formatEther(BigInt(persona.totalAgentDeposited || 0))} / {formatEther(BigInt(persona.minAgentTokens))} agent tokens
              </p>
            </div>
          )}

          {!canGraduate && (
            <div className="mt-3 p-3 bg-yellow-500/10 backdrop-blur-sm rounded-lg border border-yellow-500/20">
              <p className="text-xs text-yellow-400">
                {progress < 100 
                  ? `Need ${formatEther(BigInt(persona.graduationThreshold || 0) - BigInt(persona.totalDeposited || 0))} more tokens` 
                  : agentTokenProgress < 100 
                    ? `Need ${formatEther(BigInt(persona.minAgentTokens || 0) - BigInt(persona.totalAgentDeposited || 0))} more agent tokens`
                    : 'All requirements met - ready to graduate!'
                }
              </p>
            </div>
          )}
        </div>
      )}

      {/* NFT Transfer History */}
      {persona.transfers && persona.transfers.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setShowTransfers(!showTransfers)}
            className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors mb-3"
          >
            <svg className={`w-4 h-4 transform transition-transform ${showTransfers ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            NFT Transfer History ({persona.transfers.length})
          </button>

          {showTransfers && (
            <div className="space-y-2">
              {persona.transfers.map((transfer: Transfer) => (
                <div key={transfer.id} className="p-3 bg-white/5 border border-white/10 rounded-lg">
                  <div className="flex justify-between items-start text-sm">
                    <div>
                      <p className="text-white/80">
                        From: <span className="font-mono">{transfer.from.slice(0, 6)}...{transfer.from.slice(-4)}</span>
                      </p>
                      <p className="text-white/80">
                        To: <span className="font-mono">{transfer.to.slice(0, 6)}...{transfer.to.slice(-4)}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-white/60">{new Date(transfer.timestamp).toLocaleDateString()}</p>
                      <a
                        href={getExplorerUrl(transfer.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        View Tx
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Enhanced metadata display */}
      {persona.metadata && persona.metadata.length > 0 && (
        <div className="mt-6 pt-6 border-t border-white/10">
          <h3 className="text-sm font-medium text-white mb-3">Metadata</h3>
          <div className="space-y-2">
            {persona.metadata.map((item: MetadataItem) => (
              <div key={item.key} className="p-3 bg-white/5 rounded-lg">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white/80">{item.key}</p>
                    <p className="text-sm text-white/60 break-all mt-1">{item.value}</p>
                  </div>
                  {item.updatedAt && (
                    <p className="text-xs text-white/40 ml-2">
                      {new Date(item.updatedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
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

      {/* Quick Actions */}
      <div className="mt-6 pt-6 border-t border-white/10">
        <div className="flex flex-wrap gap-2">
          <a
            href={getAddressExplorerUrl(persona.erc20Token)}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors text-sm"
          >
            View Token Contract
          </a>
          {isGraduated && persona.pairAddress && (
            <a
              href={`https://app.uniswap.org/#/swap?inputCurrency=${persona.pairToken}&outputCurrency=${persona.erc20Token}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors text-sm"
            >
              Trade on Uniswap
            </a>
          )}
          <Link
            href={`/portfolio`}
            className="px-3 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors text-sm"
          >
            View in Portfolio
          </Link>
        </div>
      </div>

      {/* Manual refresh button */}
      <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="text-xs text-white/40 hover:text-white/60 transition-colors disabled:opacity-50"
        >
          Last updated: {new Date().toLocaleTimeString()}
        </button>
        
        {error && (
          <div className="text-xs text-red-400">
            Warning: Some data may be outdated
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonaMetadata;
