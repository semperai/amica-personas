// src/pages/create.tsx
import { useState } from 'react';
import Layout from '@/components/Layout';
import { useAccount, useWriteContract, useReadContract } from 'wagmi';
import { parseEther, zeroAddress } from 'viem';
import { FACTORY_ABI, getAddressesForChain } from '@/lib/contracts';
import { useRouter } from 'next/router';

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

  // Get default pairing token (AMICA) for current chain
  const addresses = chainId ? getAddressesForChain(chainId) : null;
  const defaultPairingToken = addresses?.amica || '';

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

  const handleCreate = async () => {
    if (!address || !chainId) return;

    const addresses = getAddressesForChain(chainId);
    if (!addresses) {
      alert('This chain is not supported');
      return;
    }

    try {
      const pairingToken = formData.pairingToken || defaultPairingToken;
      const agentToken = showAgentConfig && formData.agentToken ? formData.agentToken : zeroAddress;
      const minAgentTokens = showAgentConfig && formData.minAgentTokens ? parseEther(formData.minAgentTokens) : BigInt(0);

      await writeContract({
        address: addresses.factory as `0x${string}`,
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
            <label className="block text-sm font-light text-white/80 mb-3">Pairing Token Address (optional)</label>
            <input
              type="text"
              value={formData.pairingToken}
              onChange={(e) => setFormData({ ...formData, pairingToken: e.target.value })}
              className="w-full p-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/40 focus:border-white/40 focus:outline-none transition-colors font-mono text-sm"
              placeholder={defaultPairingToken || "0x..."}
            />
            <p className="text-xs text-white/50 mt-2">
              The token used for bonding curve trading (defaults to AMICA if left empty)
            </p>
          </div>

          {/* Agent Token Configuration */}
          <div className="mb-8 p-6 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
            <div className="flex items-center justify-between mb-4">
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

            {showAgentConfig && (
              <div className="space-y-4 mt-6">
                <div>
                  <label className="block text-sm font-light text-white/80 mb-3">Agent Token Address</label>
                  <input
                    type="text"
                    value={formData.agentToken}
                    onChange={(e) => setFormData({ ...formData, agentToken: e.target.value })}
                    className="w-full p-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/40 focus:border-white/40 focus:outline-none transition-colors font-mono text-sm"
                    placeholder="0x..."
                  />
                  <p className="text-xs text-white/50 mt-2">
                    Must be an approved agent token. Contact admin to whitelist new tokens.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-light text-white/80 mb-3">Minimum Agent Tokens Required</label>
                  <input
                    type="number"
                    value={formData.minAgentTokens}
                    onChange={(e) => setFormData({ ...formData, minAgentTokens: e.target.value })}
                    className="w-full p-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/40 focus:border-white/40 focus:outline-none transition-colors"
                    placeholder="0"
                    step="0.01"
                    min="0"
                  />
                  <p className="text-xs text-white/50 mt-2">
                    Minimum agent tokens that must be deposited before graduation (0 = no requirement)
                  </p>
                </div>

                <div className="p-4 bg-purple-500/10 backdrop-blur-sm rounded-lg border border-purple-500/20">
                  <p className="font-light text-white/90 mb-2">Agent Token Benefits:</p>
                  <ul className="text-xs text-white/70 space-y-1 ml-4 list-disc">
                    <li>Modified token distribution: 1/3 liquidity, 2/9 each for bonding, AMICA deposit, and agent rewards</li>
                    <li>Agent token depositors receive persona tokens proportionally after graduation</li>
                    <li>Creates additional utility and alignment with partner projects</li>
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
            <p className="text-xs text-white/50 mt-2">Amount to buy immediately after creation</p>
          </div>

          <div className="mb-8">
            <label className="block text-sm font-light text-white/80 mb-3">Metadata (optional)</label>
            <div className="flex gap-2 mb-4">
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
                    <span className="text-sm text-white/80">
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
                      className="text-red-400 hover:text-red-300 text-sm transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleCreate}
            disabled={!address || isPending || !formData.name || !formData.symbol}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-xl hover:from-purple-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all duration-300 font-light text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            {isPending ? 'Creating...' : 'Create Persona'}
          </button>

          {!address && (
            <p className="text-center text-sm text-white/50 mt-6">
              Please connect your wallet to create a persona
            </p>
          )}
        </div>
      </div>
    </Layout>
  );
}
