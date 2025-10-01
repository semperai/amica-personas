'use client';

import { useState, useEffect, useMemo } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { fetchPersonas } from '@/lib/api-graphql';

interface PersonaToken {
  id: string;
  name: string;
  symbol: string;
  erc20Token?: string;
  chain: {
    id: string;
    name: string;
  };
}

interface MultiTokenSelectorProps {
  selectedTokens: string[]; // Array of token addresses
  onSelectionChange: (tokens: string[]) => void;
  maxTokens?: number;
}

export function MultiTokenSelector({
  selectedTokens,
  onSelectionChange,
  maxTokens = 100,
}: MultiTokenSelectorProps) {
  const [tokens, setTokens] = useState<PersonaToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  // Load all persona tokens
  useEffect(() => {
    const loadTokens = async () => {
      try {
        setLoading(true);
        const response = await fetchPersonas({
          limit: 1000, // Get all tokens
          graduated: 'true', // Only graduated tokens have ERC20
        });

        // Filter to only tokens with ERC20 addresses
        const validTokens = response.personas
          .filter(p => p.erc20Token && p.erc20Token !== '0x0000000000000000000000000000000000000000')
          .map(p => ({
            id: p.id,
            name: p.name,
            symbol: p.symbol,
            erc20Token: p.erc20Token,
            chain: p.chain,
          }));

        setTokens(validTokens);

        // Auto-select all tokens by default (up to maxTokens)
        const tokensToSelect = validTokens
          .slice(0, maxTokens)
          .map(t => t.erc20Token!)
          .filter(Boolean);

        if (tokensToSelect.length > 0 && selectedTokens.length === 0) {
          onSelectionChange(tokensToSelect);
        }
      } catch (error) {
        console.error('Error loading tokens:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTokens();
  }, []);

  // Filter tokens based on search
  const filteredTokens = useMemo(() => {
    if (!searchQuery) return tokens;
    const query = searchQuery.toLowerCase();
    return tokens.filter(
      t =>
        t.name.toLowerCase().includes(query) ||
        t.symbol.toLowerCase().includes(query)
    );
  }, [tokens, searchQuery]);

  const handleToggleToken = (tokenAddress: string) => {
    if (selectedTokens.includes(tokenAddress)) {
      // Remove token
      onSelectionChange(selectedTokens.filter(t => t !== tokenAddress));
    } else {
      // Add token if under limit
      if (selectedTokens.length < maxTokens) {
        onSelectionChange([...selectedTokens, tokenAddress]);
      }
    }
  };

  const handleSelectAll = () => {
    // Select first maxTokens from filtered list
    const tokensToSelect = filteredTokens
      .slice(0, maxTokens)
      .map(t => t.erc20Token!)
      .filter(Boolean);
    onSelectionChange(tokensToSelect);
  };

  const handleDeselectAll = () => {
    onSelectionChange([]);
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue"></div>
        <p className="text-sm text-muted-foreground mt-2">Loading tokens...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with selection summary */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 px-4 py-2 bg-muted rounded-full hover:bg-muted/80 transition-colors cursor-pointer"
        >
          <h3 className="text-base font-semibold text-foreground">Select Tokens to Receive</h3>
          <span className="text-sm text-muted-foreground">
            ({selectedTokens.length}/{maxTokens})
          </span>
          <svg
            className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-2">
          {selectedTokens.length > 0 && (
            <button
              onClick={handleDeselectAll}
              className="px-3 py-1.5 text-sm bg-muted rounded-lg hover:bg-muted/80 transition-colors text-foreground/80 cursor-pointer"
            >
              Clear All
            </button>
          )}
          <button
            onClick={handleSelectAll}
            disabled={filteredTokens.length === 0}
            className="px-3 py-1.5 text-sm bg-brand-blue text-white rounded-lg hover:bg-brand-blue/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Select All {filteredTokens.length > maxTokens && `(${maxTokens})`}
          </button>
        </div>
      </div>

      {/* Expandable token list */}
      {isExpanded && (
        <div className="border border-border rounded-xl overflow-hidden bg-card">
          {/* Search bar */}
          <div className="p-4 border-b border-border">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tokens..."
                className="w-full pl-10 pr-10 py-2 bg-muted border border-border rounded-lg text-foreground placeholder-muted-foreground focus:border-brand-blue focus:outline-none transition-colors text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Token list */}
          <div className="max-h-96 overflow-y-auto">
            {filteredTokens.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No tokens found
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredTokens.map((token) => {
                  const isSelected = selectedTokens.includes(token.erc20Token!);
                  const isDisabled = !isSelected && selectedTokens.length >= maxTokens;

                  return (
                    <button
                      key={token.id}
                      onClick={() => !isDisabled && handleToggleToken(token.erc20Token!)}
                      disabled={isDisabled}
                      className={`w-full p-4 flex items-center gap-3 hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        isSelected ? 'bg-brand-blue/5' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-brand-blue border-brand-blue'
                          : 'border-border'
                      }`}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>

                      {/* Token info */}
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{token.symbol}</span>
                          <span className="text-xs text-muted-foreground capitalize">{token.chain.name}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{token.name}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer with count */}
          {selectedTokens.length >= maxTokens && (
            <div className="p-3 bg-yellow-500/10 border-t border-yellow-500/20 text-center">
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                Maximum of {maxTokens} tokens selected
              </p>
            </div>
          )}
        </div>
      )}

      {/* Compact view when collapsed */}
      {!isExpanded && selectedTokens.length > 0 && (
        <div className="p-4 bg-muted/50 rounded-lg border border-border">
          <p className="text-sm text-muted-foreground">
            {selectedTokens.length} token{selectedTokens.length !== 1 ? 's' : ''} selected
          </p>
        </div>
      )}
    </div>
  );
}
