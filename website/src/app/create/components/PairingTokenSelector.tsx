'use client';

interface TokenOption {
  address: string;
  symbol: string;
  name: string;
  icon?: string;
}

interface PairingTokenSelectorProps {
  selectedToken: TokenOption | null;
  options: TokenOption[];
  showDropdown: boolean;
  formattedMintCost: string;
  onToggleDropdown: () => void;
  onSelectToken: (token: TokenOption) => void;
}

export default function PairingTokenSelector({
  selectedToken,
  options,
  showDropdown,
  formattedMintCost,
  onToggleDropdown,
  onSelectToken
}: PairingTokenSelectorProps) {
  return (
    <div className="mb-8">
      <label className="block text-sm font-light text-white/80 mb-3">Pairing Token</label>
      <div className="relative">
        <button
          type="button"
          onClick={onToggleDropdown}
          className="w-full p-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white hover:bg-white/15 focus:border-white/40 focus:outline-none transition-all duration-300 flex items-center justify-between"
        >
          {selectedToken ? (
            <div className="flex items-center gap-3">
              <span className="text-2xl">{selectedToken.icon}</span>
              <div className="text-left">
                <div className="font-medium">{selectedToken.symbol}</div>
                <div className="text-xs text-white/50">{selectedToken.name}</div>
              </div>
            </div>
          ) : (
            <span className="text-white/40">Select a pairing token</span>
          )}
          <svg
            className={`w-5 h-5 text-white/60 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showDropdown && (
          <div className="absolute z-10 w-full mt-2 bg-black/90 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl overflow-hidden">
            {options.map((token) => (
              <button
                key={token.address}
                onClick={() => onSelectToken(token)}
                className="w-full p-4 hover:bg-white/10 transition-colors flex items-center gap-3 text-left"
              >
                <span className="text-2xl">{token.icon}</span>
                <div>
                  <div className="font-medium text-white">{token.symbol}</div>
                  <div className="text-xs text-white/50">{token.name}</div>
                  <div className="text-xs text-white/30 font-mono mt-1">
                    {token.address.slice(0, 6)}...{token.address.slice(-4)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-white/50 mt-2">
        The token used for bonding curve trading. Creation cost: {formattedMintCost} {selectedToken?.symbol || 'tokens'}
      </p>
    </div>
  );
}
