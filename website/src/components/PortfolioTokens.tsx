import React, { useEffect, useState } from 'react';
import { useQuery } from '@apollo/client';

function PortfolioTokens({ address }: { address: string }) {
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(true);

  // Query for created personas to show token holdings
  const { data: portfolioData } = useQuery(GET_USER_PORTFOLIO, {
    variables: { creator: address.toLowerCase() },
    skip: !address,
  });

  useEffect(() => {
    const loadTokens = async () => {
      try {
        // In a real implementation, you would query token balances
        // For now, we'll create mock data based on created personas
        if (portfolioData?.createdPersonas) {
          const mockTokens: TokenBalance[] = portfolioData.createdPersonas
            .filter((p: any) => p.pairCreated)
            .slice(0, 3)
            .map((persona: any, index: number) => {
              const chain = extractChainFromId(persona.id);
              return {
                symbol: persona.symbol,
                name: persona.name,
                balance: (Math.random() * 100000).toFixed(2),
                valueUSD: Math.random() * 2000,
                chainId: chain.id,
                address: persona.erc20Token
              };
            });
          setTokens(mockTokens);
        }
      } catch (error) {
        console.error('Error loading tokens:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTokens();
  }, [portfolioData, address]);

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

// Helper function for chain extraction
const extractChainFromId = (id: string) => {
  const [chainId] = id.split('-');
  const chainNames: Record<string, string> = {
    '1': 'ethereum',
    '8453': 'base',
    '42161': 'arbitrum'
  };
  return {
    id: chainId,
    name: chainNames[chainId] || 'unknown'
  };
};
