// src/components/PersonaMetadata.tsx - Enhanced with new contract features
import { gql } from 'graphql-tag';
import { useQuery } from 'urql';
import { useReadContract } from 'wagmi';
import { formatEther } from 'viem';
import AgentTokenInfo from './AgentTokenInfo';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import AmicaLogo from '@/assets/AmicaLogo.png';

// Type definitions for GraphQL query result
interface PersonaQueryResult {
  personas?: Array<{
    id: string;
    tokenId: string;
    name: string;
    symbol: string;
    creator: string;
    owner: string;
    erc20Token: string;
    pairToken: string;
    agentToken: string;
    pairCreated: boolean;
    pairAddress: string;
    createdAt: string;
    createdAtBlock: string;
    totalDeposited: string;
    tokensSold: string;
    graduationThreshold: string;
    totalAgentDeposited: string;
    minAgentTokens: string;
    chainId: number;
    metadata: Array<{ key: string; value: string; updatedAt?: string }>;
    transfers: Array<{ id: string; from: string; to: string; timestamp: string; txHash: string }>;
  }>;
}

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
  
  const [{ data, fetching: loading, error }, refetch] = useQuery<PersonaQueryResult>({
    query: GET_PERSONA_BY_TOKEN_AND_CHAIN,
    variables: {
      tokenId: tokenIdBigInt,
      chainId: chainIdNum
    },
    pause: !chainId || !tokenId,
  });

  // urql doesn't have networkStatus, we'll just use fetching
  const networkStatus = loading ? 4 : 7;

  const isRefetching = networkStatus === 4;

  // Extract persona data early for hooks
  const persona = data?.personas?.[0];

  // Get total supply for graduated tokens (must be called before any early returns)
  const { data: totalSupply } = useReadContract({
    address: persona?.erc20Token as `0x${string}`,
    abi: [{
      name: 'totalSupply',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ name: '', type: 'uint256' }]
    }],
    functionName: 'totalSupply',
    query: {
      enabled: !!persona?.erc20Token && !!persona?.pairCreated
    }
  }) as { data: bigint | undefined };

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
      <div className="bg-card backdrop-blur-md rounded-2xl p-6 border border-border">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/2 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="h-16 bg-muted rounded"></div>
            <div className="h-16 bg-muted rounded"></div>
            <div className="h-16 bg-muted rounded"></div>
            <div className="h-16 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  // No data found
  if (!loading && !persona) {
    return (
      <div className="bg-card backdrop-blur-md rounded-2xl p-6 border border-border">
        <div className="text-center py-8">
          <div className="mb-4">
            <svg className="w-16 h-16 mx-auto text-red-400/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">Persona Not Found</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            This persona (Token ID: {tokenId} on Chain {chainId}) doesn&apos;t exist or hasn&apos;t been indexed yet.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                setRetryCount(0);
                refetch();
              }}
              disabled={isRefetching}
              className={`px-6 py-2 bg-brand-blue text-white rounded-lg hover:bg-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors cursor-pointer ${
                isRefetching ? 'animate-pulse' : ''
              }`}
            >
              {isRefetching ? 'Checking...' : 'Check Again'}
            </button>
            <button
              onClick={() => window.history.back()}
              className="px-6 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-all"
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

  // Early return if no persona data (should not happen due to earlier checks)
  if (!persona) {
    return null;
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
    <div className="bg-card backdrop-blur-md rounded-2xl p-4 border border-border relative">
      {/* Refetching indicator */}
      {isRefetching && (
        <div className="absolute top-4 right-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-2 h-2 bg-brand-blue rounded-full animate-pulse"></div>
            Updating...
          </div>
        </div>
      )}

      <div className="flex gap-4 mb-3">
        {/* Left Content */}
        <div className="flex-1">
          {/* Name and Badges */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <h1 className="text-3xl font-semibold text-foreground">{persona.name}</h1>
              <p className="text-lg text-muted-foreground">${persona.symbol}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
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
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-brand-cyan/20 text-brand-cyan backdrop-blur-sm">
                  Agent Token
                </span>
              )}
            </div>
          </div>

          {/* Enhanced grid with new fields */}
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-0.5">Creator</p>
          <a
            href={getAddressExplorerUrl(persona.creator)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-cyan hover:text-brand-blue font-mono text-xs transition-colors"
          >
            {persona.creator.slice(0, 6)}...{persona.creator.slice(-4)}
          </a>
        </div>

        {isOwnerDifferentFromCreator && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-0.5">Owner</p>
            <a
              href={getAddressExplorerUrl(persona.owner)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-cyan hover:text-brand-blue font-mono text-xs transition-colors"
            >
              {persona.owner.slice(0, 6)}...{persona.owner.slice(-4)}
            </a>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-0.5">Chain</p>
          <p className="text-foreground text-xs capitalize">{chainName}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-0.5">Token ID</p>
          <p className="text-foreground text-xs">#{tokenId}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-0.5">Created</p>
          <p className="text-foreground text-xs">
            {new Date(persona.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-0.5">Block</p>
          <p className="text-foreground text-xs">#{persona.createdAtBlock}</p>
        </div>
        {isGraduated && totalSupply && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-0.5">Total Supply</p>
            <p className="text-foreground text-xs">{formatEther(totalSupply)}</p>
          </div>
        )}
      </div>

      {/* NFT Transfer History */}
      {persona.transfers && persona.transfers.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setShowTransfers(!showTransfers)}
            className="flex items-center gap-2 text-sm text-brand-cyan hover:text-brand-blue transition-colors mb-3"
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

          {/* Agent Token Info */}
          <AgentTokenInfo
            agentToken={persona.agentToken}
            minAgentTokens={persona.minAgentTokens}
            totalAgentDeposited={persona.totalAgentDeposited}
            isGraduated={isGraduated}
          />
        </div>

        {/* Persona Image */}
        <a
          href={`https://${persona.name.toLowerCase().replace(/\s+/g, '-')}.amica.bot`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0"
        >
          <div className="w-48 self-stretch rounded-3xl border-4 border-brand-blue/30 hover:border-brand-blue transition-colors overflow-hidden bg-gradient-to-br from-brand-blue/20 to-brand-cyan/20 flex items-center justify-center min-h-full">
            {persona.metadata?.find((m: MetadataItem) => m.key === 'image')?.value ? (
              <img
                src={persona.metadata.find((m: MetadataItem) => m.key === 'image')?.value}
                alt={persona.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="p-8">
                <Image
                  src={AmicaLogo}
                  alt="Amica Logo"
                  width={120}
                  height={120}
                  className="opacity-60"
                />
              </div>
            )}
          </div>
        </a>
      </div>

      {/* Quick Actions */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex flex-wrap gap-2">
          <a
            href={getAddressExplorerUrl(persona.erc20Token)}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors text-sm font-medium cursor-pointer"
          >
            View Contract
          </a>
          {isGraduated && persona.pairAddress && (
            <a
              href={`https://app.uniswap.org/#/swap?inputCurrency=${persona.pairToken}&outputCurrency=${persona.erc20Token}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-blue-500 transition-colors text-sm font-medium cursor-pointer"
            >
              Trade on Uniswap
            </a>
          )}
          <Link
            href={`/portfolio`}
            className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors text-sm font-medium cursor-pointer"
          >
            View Portfolio
          </Link>
        </div>
      </div>

    </div>
  );
};

export default PersonaMetadata;
