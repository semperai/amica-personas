// src/pages/create.tsx
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useAccount, useWriteContract, useReadContract } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { parseEther, zeroAddress, parseUnits, formatUnits, formatEther } from 'viem';
import { FACTORY_ABI, getAddressesForChain } from '@/lib/contracts';
import { useRouter } from 'next/router';

// ERC20 ABI for reading token details
const ERC20_ABI = [
  {
    inputs: [],
    name: 'name',
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

interface TokenOption {
  address: string;
  symbol: string;
  name: string;
  icon?: string;
}

export default function CreatePersonaPage() {
  const { address, chainId } = useAccount();
  const router = useRouter();
  const { writeContract, isPending } = useWriteContract();

  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    pairingToken: '',
    agentToken: '',
    minAgentTokens: '0',
    metadataKeys: [] as string[],
    metadataValues: [] as string[],
    initialBuyAmount: '0'
  });

  const [newMetadataKey, setNewMetadataKey] = useState('');
  const [newMetadataValue, setNewMetadataValue] = useState('');
  const [showAgentConfig, setShowAgentConfig] = useState(false);
  const [showPairingDropdown, setShowPairingDropdown] = useState(false);
  const [selectedPairingToken, setSelectedPairingToken] = useState<TokenOption | null>(null);
  const [agentTokenDetails, setAgentTokenDetails] = useState<{
    name: string;
    symbol: string;
    decimals: number;
  } | null>(null);
  const [isLoadingAgentToken, setIsLoadingAgentToken] = useState(false);

  // Get addresses for current chain
  const addresses = chainId ? getAddressesForChain(chainId) : null;

  // Define pairing token options
  const pairingTokenOptions: TokenOption[] = [
    {
      address: addresses?.amicaToken || '',
      symbol: 'AMICA',
      name: 'Amica Token',
      icon: '🎭' // You can replace with actual icon URL
    },
    {
      address: '0x8AFE4055Ebc86Bd2AFB3940c0095C9aca511d852', // Replace with actual AIUS address for your chain
      symbol: 'AIUS',
      name: 'Arbius Token',
      icon: '🤖' // You can replace with actual icon URL
    }
  ];

  // Set default pairing token on mount or chain change
  useEffect(() => {
    if (addresses?.amicaToken && !selectedPairingToken) {
      const amicaToken = pairingTokenOptions.find(t => t.symbol === 'AMICA');
      if (amicaToken) {
        setSelectedPairingToken(amicaToken);
        setFormData(prev => ({ ...prev, pairingToken: amicaToken.address }));
      }
    }
  }, [addresses, chainId]);

  // Read agent token details
  const { data: agentTokenName } = useReadContract({
    address: formData.agentToken as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'name',
    query: {
      enabled: showAgentConfig && formData.agentToken.length === 42 && formData.agentToken.startsWith('0x'),
    },
  });

  const { data: agentTokenSymbol } = useReadContract({
    address: formData.agentToken as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'symbol',
    query: {
      enabled: showAgentConfig && formData.agentToken.length === 42 && formData.agentToken.startsWith('0x'),
    },
  });

  const { data: agentTokenDecimals } = useReadContract({
    address: formData.agentToken as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: {
      enabled: showAgentConfig && formData.agentToken.length === 42 && formData.agentToken.startsWith('0x'),
    },
  });

  // Get initial token preview using getInitialTokensForLiquidity
  const { data: initialTokensPreview } = useReadContract({
    address: addresses?.personaFactory as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: 'getInitialTokensForLiquidity',
    args: formData.initialBuyAmount && parseFloat(formData.initialBuyAmount) > 0
      ? [parseEther(formData.initialBuyAmount)]
      : undefined,
    query: {
      enabled: !!addresses && !!formData.initialBuyAmount && parseFloat(formData.initialBuyAmount) > 0,
    },
  }) as { data: bigint | undefined };

  // Update agent token details when contract data is fetched
  useEffect(() => {
    if (agentTokenName && agentTokenSymbol && agentTokenDecimals !== undefined) {
      setAgentTokenDetails({
        name: agentTokenName,
        symbol: agentTokenSymbol,
        decimals: agentTokenDecimals,
      });
      setIsLoadingAgentToken(false);
    } else if (formData.agentToken.length === 42 && formData.agentToken.startsWith('0x')) {
      setIsLoadingAgentToken(true);
    }
  }, [agentTokenName, agentTokenSymbol, agentTokenDecimals, formData.agentToken]);

  const handleAddMetadata = () => {
    if (newMetadataKey && newMetadataValue) {
      setFormData({
        ...formData,
        metadataKeys: [...formData.metadataKeys, newMetadataKey],
        metadataValues: [...formData.metadataValues, newMetadataValue]
      });
      setNewMetadataKey('');
      setNewMetadataValue('');
    }
  };

  const handlePairingTokenSelect = (token: TokenOption) => {
    setSelectedPairingToken(token);
    setFormData({ ...formData, pairingToken: token.address });
    setShowPairingDropdown(false);
  };

  const handleCreate = async () => {
    if (!address || !chainId) return;

    const addresses = getAddressesForChain(chainId);
    if (!addresses) {
      alert('This chain is not supported');
      return;
    }

    try {
      const pairingToken = formData.pairingToken || selectedPairingToken?.address || addresses.amicaToken;
      const agentToken = showAgentConfig && formData.agentToken ? formData.agentToken : zeroAddress;

      // Use the correct decimals for agent token if available
      const minAgentTokens = showAgentConfig && formData.minAgentTokens && agentTokenDetails
        ? parseUnits(formData.minAgentTokens, agentTokenDetails.decimals)
        : BigInt(0);

      await writeContract({
        address: addresses.personaFactory as `0x${string}`,
        abi: FACTORY_ABI,
        functionName: 'createPersona',
        args: [
          pairingToken as `0x${string}`,
          formData.name,
          formData.symbol,
          formData.metadataKeys,
          formData.metadataValues,
          parseEther(formData.initialBuyAmount),
          agentToken as `0x${string}`,
          minAgentTokens,
        ]
      });

      // Redirect to explore page after successful creation
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (error) {
      console.error('Error creating persona:', error);
    }
  };

  // Calculate price per token for initial buy
  const pricePerToken = formData.initialBuyAmount && initialTokensPreview && parseFloat(formData.initialBuyAmount) > 0
    ? (parseFloat(formData.initialBuyAmount) / parseFloat(formatEther(initialTokensPreview))).toFixed(6)
    : '0';

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-4xl font-light text-white mb-8">Create New Persona</h1>

        <div className="bg-white/5 backdrop-blur-md rounded-2xl p-8 border border-white/10">
          <div className="mb-8">
            <label className="block text-sm font-light text-white/80 mb-3">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full p-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/40 focus:border-white/40 focus:outline-none transition-colors"
              placeholder="My Awesome Persona"
            />
            <p className="text-xs text-white/50 mt-2">Choose a unique and memorable name</p>
          </div>

          <div className="mb-8">
            <label className="block text-sm font-light text-white/80 mb-3">Symbol</label>
            <input
              type="text"
              value={formData.symbol}
              onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
              className="w-full p-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/40 focus:border-white/40 focus:outline-none transition-colors"
              placeholder="AWESOME"
              maxLength={10}
            />
            <p className="text-xs text-white/50 mt-2">3-10 characters, letters only</p>
          </div>

          <div className="mb-8">
            <label className="block text-sm font-light text-white/80 mb-3">Pairing Token</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowPairingDropdown(!showPairingDropdown)}
                className="w-full p-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white hover:bg-white/15 focus:border-white/40 focus:outline-none transition-all duration-300 flex items-center justify-between"
              >
                {selectedPairingToken ? (
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{selectedPairingToken.icon}</span>
                    <div className="text-left">
                      <div className="font-medium">{selectedPairingToken.symbol}</div>
                      <div className="text-xs text-white/50">{selectedPairingToken.name}</div>
                    </div>
                  </div>
                ) : (
                  <span className="text-white/40">Select a pairing token</span>
                )}
                <svg
                  className={`w-5 h-5 text-white/60 transition-transform ${showPairingDropdown ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showPairingDropdown && (
                <div className="absolute z-10 w-full mt-2 bg-black/90 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl overflow-hidden">
                  {pairingTokenOptions.map((token) => (
                    <button
                      key={token.address}
                      onClick={() => handlePairingTokenSelect(token)}
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
              The token used for bonding curve trading
            </p>
          </div>

          {/* Agent Token Configuration */}
          <div className="mb-8 p-6 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-2">
                <label className="text-sm font-light text-white/80">Enable Agent Token Integration</label>
                <button
                  type="button"
                  onClick={() => setShowAgentConfig(!showAgentConfig)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    showAgentConfig ? 'bg-purple-500/50' : 'bg-white/20'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      showAgentConfig ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
            <div>
              <div>
                <p className="text-xs text-white/50 ">
                  Tokens from Virtuals or independent agent tokens can be used.
                </p>
              </div>
            </div>

            {showAgentConfig && (
              <div className="space-y-4 mt-6">
                <div>
                  <label className="block text-sm font-light text-white/80 mb-3">Agent Token Address</label>
                  <input
                    type="text"
                    value={formData.agentToken}
                    onChange={(e) => {
                      setFormData({ ...formData, agentToken: e.target.value });
                      if (e.target.value.length !== 42 || !e.target.value.startsWith('0x')) {
                        setAgentTokenDetails(null);
                        setIsLoadingAgentToken(false);
                      }
                    }}
                    className="w-full p-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/40 focus:border-white/40 focus:outline-none transition-colors font-mono text-sm"
                    placeholder="0x..."
                  />

                  {isLoadingAgentToken && (
                    <div className="mt-2 text-xs text-white/50">Loading token details...</div>
                  )}

                  {agentTokenDetails && (
                    <div className="mt-3 p-3 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {agentTokenDetails.symbol.slice(0, 2)}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">{agentTokenDetails.name}</div>
                          <div className="text-xs text-white/50">{agentTokenDetails.symbol} • {agentTokenDetails.decimals} decimals</div>
                        </div>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-white/50 mt-2">
                    Enter the contract address of the agent token
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-light text-white/80 mb-3">
                    Minimum Agent Tokens Required
                    {agentTokenDetails && <span className="text-xs text-white/50 ml-2">({agentTokenDetails.symbol})</span>}
                  </label>
                  <input
                    type="number"
                    value={formData.minAgentTokens}
                    onChange={(e) => setFormData({ ...formData, minAgentTokens: e.target.value })}
                    className="w-full p-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/40 focus:border-white/40 focus:outline-none transition-colors"
                    placeholder="0"
                    step="0.000001"
                    min="0"
                  />
                  <p className="text-xs text-white/50 mt-2">
                    Minimum agent tokens that must be deposited before graduation (0 = no requirement). All collected tokens during bonding will be distributed to AMICA holders.
                    {agentTokenDetails && (
                      <span className="block mt-1">
                        This token has {agentTokenDetails.decimals} decimals
                      </span>
                    )}
                  </p>
                </div>

                <div className="p-4 bg-purple-500/10 backdrop-blur-sm rounded-lg border border-purple-500/20">
                  <p className="font-light text-white/90 mb-2">Agent Token Benefits:</p>
                  <ul className="text-xs text-white/70 space-y-1 ml-4 list-disc">
                    <li>Modified token distribution: 1/3 liquidity, 2/9 each for bonding, AMICA deposit, and agent rewards</li>
                    <li>Agent token depositors receive persona tokens proportionally after graduation</li>
                    <li>Creates additional utility and alignment with partner projects</li>
                    <li>If minimum required is set, graduation is blocked until that amount is deposited</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          <div className="mb-8">
            <label className="block text-sm font-light text-white/80 mb-3">Initial Buy Amount (optional)</label>
            <input
              type="number"
              value={formData.initialBuyAmount}
              onChange={(e) => setFormData({ ...formData, initialBuyAmount: e.target.value })}
              className="w-full p-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/40 focus:border-white/40 focus:outline-none transition-colors"
              placeholder="0"
              step="0.01"
              min="0"
            />
            <p className="text-xs text-white/50 mt-2">
              Amount of {selectedPairingToken?.symbol || 'pairing tokens'} to buy immediately after creation
            </p>

            {/* Initial Buy Preview */}
            {formData.initialBuyAmount && parseFloat(formData.initialBuyAmount) > 0 && initialTokensPreview && (
              <div className="mt-4 p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 backdrop-blur-sm rounded-xl border border-purple-500/20">
                <h4 className="text-sm font-medium text-white mb-3">Initial Buy Preview</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">You will spend</span>
                    <span className="text-white font-medium">
                      {formData.initialBuyAmount} {selectedPairingToken?.symbol || 'tokens'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">You will receive</span>
                    <span className="text-green-400 font-medium">
                      {formatEther(initialTokensPreview)} {formData.symbol || 'tokens'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Initial price</span>
                    <span className="text-white">
                      1 {formData.symbol || 'token'} = {pricePerToken} {selectedPairingToken?.symbol || 'tokens'}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-white/50 mt-3">
                  This will be the first transaction on the bonding curve. The price will increase as more people buy.
                </p>
              </div>
            )}
          </div>

          <div className="mb-8">
            <label className="block text-sm font-light text-white/80 mb-3">Metadata (optional)</label>
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <input
                type="text"
                value={newMetadataKey}
                onChange={(e) => setNewMetadataKey(e.target.value)}
                className="flex-1 p-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/40 focus:border-white/40 focus:outline-none transition-colors"
                placeholder="Key (e.g., website)"
              />
              <input
                type="text"
                value={newMetadataValue}
                onChange={(e) => setNewMetadataValue(e.target.value)}
                className="flex-1 p-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/40 focus:border-white/40 focus:outline-none transition-colors"
                placeholder="Value (e.g., https://...)"
              />
              <button
                onClick={handleAddMetadata}
                className="px-6 py-4 bg-white/10 backdrop-blur-sm rounded-xl hover:bg-white/20 transition-all duration-300 text-white/80"
              >
                Add
              </button>
            </div>

            {formData.metadataKeys.length > 0 && (
              <div className="space-y-2">
                {formData.metadataKeys.map((key, index) => (
                  <div key={index} className="flex justify-between items-center p-4 bg-white/5 backdrop-blur-sm rounded-xl">
                    <span className="text-sm text-white/80 break-all">
                      <span className="font-medium text-white/90">{key}:</span> {formData.metadataValues[index]}
                    </span>
                    <button
                      onClick={() => {
                        const newKeys = [...formData.metadataKeys];
                        const newValues = [...formData.metadataValues];
                        newKeys.splice(index, 1);
                        newValues.splice(index, 1);
                        setFormData({ ...formData, metadataKeys: newKeys, metadataValues: newValues });
                      }}
                      className="text-red-400 hover:text-red-300 text-sm transition-colors ml-2 flex-shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!address ? (
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-12 border border-white/10 text-center">
              <h2 className="text-2xl font-light text-white mb-4">Connect Your Wallet</h2>
              <p className="text-white/60 mb-8">
                Please connect your wallet to create a persona
              </p>
              <div className="flex justify-center">
                <div className="p-1 inline-block">
                  <ConnectButton />
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={handleCreate}
              disabled={!address || isPending || !formData.name || !formData.symbol}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-xl hover:from-purple-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all duration-300 font-light text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {isPending ? 'Creating...' : 'Create Persona'}
            </button>
          )}
        </div>
      </div>
    </Layout>
  );
}
