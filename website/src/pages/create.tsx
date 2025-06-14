import { useState } from 'react';
import Layout from '@/components/Layout';
import { useAccount, useWriteContract } from 'wagmi';
import { parseEther } from 'viem';
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
    metadataKeys: [] as string[],
    metadataValues: [] as string[],
    initialBuyAmount: '0'
  });

  const [newMetadataKey, setNewMetadataKey] = useState('');
  const [newMetadataValue, setNewMetadataValue] = useState('');

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
      await writeContract({
        address: addresses.factory as `0x${string}`,
        abi: FACTORY_ABI,
        functionName: 'createPersona',
        args: [
          formData.pairingToken as `0x${string}`,
          formData.name,
          formData.symbol,
          formData.metadataKeys,
          formData.metadataValues,
          parseEther(formData.initialBuyAmount)
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
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Create New Persona</h1>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="My Awesome Persona"
            />
            <p className="text-xs text-gray-500 mt-1">Choose a unique and memorable name</p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Symbol</label>
            <input
              type="text"
              value={formData.symbol}
              onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="AWESOME"
              maxLength={10}
            />
            <p className="text-xs text-gray-500 mt-1">3-10 characters, letters only</p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Pairing Token Address</label>
            <input
              type="text"
              value={formData.pairingToken}
              onChange={(e) => setFormData({ ...formData, pairingToken: e.target.value })}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono"
              placeholder="0x..."
            />
            <p className="text-xs text-gray-500 mt-1">The token used for bonding curve trading (usually AMICA)</p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Initial Buy Amount (optional)</label>
            <input
              type="number"
              value={formData.initialBuyAmount}
              onChange={(e) => setFormData({ ...formData, initialBuyAmount: e.target.value })}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="0"
              step="0.01"
              min="0"
            />
            <p className="text-xs text-gray-500 mt-1">Amount to buy immediately after creation</p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Metadata (optional)</label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newMetadataKey}
                onChange={(e) => setNewMetadataKey(e.target.value)}
                className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Key (e.g., website)"
              />
              <input
                type="text"
                value={newMetadataValue}
                onChange={(e) => setNewMetadataValue(e.target.value)}
                className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Value (e.g., https://...)"
              />
              <button
                onClick={handleAddMetadata}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Add
              </button>
            </div>
            
            {formData.metadataKeys.length > 0 && (
              <div className="space-y-2">
                {formData.metadataKeys.map((key, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm">
                      <span className="font-medium">{key}:</span> {formData.metadataValues[index]}
                    </span>
                    <button
                      onClick={() => {
                        const newKeys = [...formData.metadataKeys];
                        const newValues = [...formData.metadataValues];
                        newKeys.splice(index, 1);
                        newValues.splice(index, 1);
                        setFormData({ ...formData, metadataKeys: newKeys, metadataValues: newValues });
                      }}
                      className="text-red-500 hover:text-red-700 text-sm"
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
            disabled={!address || isPending || !formData.name || !formData.symbol || !formData.pairingToken}
            className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isPending ? 'Creating...' : 'Create Persona'}
          </button>

          {!address && (
            <p className="text-center text-sm text-gray-500 mt-4">
              Please connect your wallet to create a persona
            </p>
          )}
        </div>
      </div>
    </Layout>
  );
}
