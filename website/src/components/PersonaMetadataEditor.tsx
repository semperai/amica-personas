// src/components/PersonaMetadataEditor.tsx
import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { getAddressesForChain, FACTORY_ABI } from '../lib/contracts';

interface MetadataItem {
  key: string;
  value: string;
  updatedAt?: string;
}

interface PersonaMetadataEditorProps {
  tokenId: string;
  chainId: string;
  metadata: MetadataItem[];
  owner: string;
  onUpdate?: () => void;
}

export default function PersonaMetadataEditor({
  tokenId,
  chainId,
  metadata,
  owner,
  onUpdate
}: PersonaMetadataEditorProps) {
  const { address } = useAccount();
  const [isEditing, setIsEditing] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');

  const addresses = getAddressesForChain(Number(chainId));
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const isOwner = address && owner && address.toLowerCase() === owner.toLowerCase();

  const handleAddMetadata = async () => {
    if (!address || !addresses || !newKey || !newValue) return;

    try {
      await writeContract({
        address: addresses.personaFactory as `0x${string}`,
        abi: FACTORY_ABI,
        functionName: 'setMetadata',
        args: [BigInt(tokenId), newKey, newValue]
      });
      setNewKey('');
      setNewValue('');
      setIsEditing(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error adding metadata:', error);
    }
  };

  const handleUpdateMetadata = async (key: string) => {
    if (!address || !addresses || !editValue) return;

    try {
      await writeContract({
        address: addresses.personaFactory as `0x${string}`,
        abi: FACTORY_ABI,
        functionName: 'setMetadata',
        args: [BigInt(tokenId), key, editValue]
      });
      setEditingKey(null);
      setEditKey('');
      setEditValue('');
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error updating metadata:', error);
    }
  };

  const startEdit = (item: MetadataItem) => {
    setEditingKey(item.key);
    setEditKey(item.key);
    setEditValue(item.value);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditKey('');
    setEditValue('');
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-foreground">Metadata</h3>
        {isOwner && (
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-3 py-1.5 bg-brand-blue text-white rounded-lg hover:bg-blue-500 transition-colors text-sm font-medium cursor-pointer"
          >
            {isEditing ? 'Cancel' : 'Add Metadata'}
          </button>
        )}
      </div>

      {/* Add New Metadata Form */}
      {isEditing && isOwner && (
        <div className="mb-4 p-4 bg-muted rounded-lg border border-border">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Key</label>
              <input
                type="text"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="e.g., description, twitter, website"
                className="w-full px-3 py-2 bg-background text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Value</label>
              <textarea
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Enter value..."
                rows={3}
                className="w-full px-3 py-2 bg-background text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddMetadata}
                disabled={!newKey || !newValue || isPending || isConfirming}
                className="px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium cursor-pointer"
              >
                {isPending || isConfirming ? 'Adding...' : 'Add Metadata'}
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setNewKey('');
                  setNewValue('');
                }}
                className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors text-sm font-medium cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Metadata List */}
      {metadata && metadata.length > 0 ? (
        <div className="space-y-3">
          {metadata.map((item) => (
            <div key={item.key} className="p-4 bg-muted rounded-lg border border-border">
              {editingKey === item.key ? (
                // Edit mode
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Key</label>
                    <input
                      type="text"
                      value={editKey}
                      readOnly
                      className="w-full px-3 py-2 bg-background/50 text-muted-foreground border border-border rounded-lg cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Value</label>
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 bg-background text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue resize-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdateMetadata(item.key)}
                      disabled={!editValue || isPending || isConfirming}
                      className="px-4 py-2 bg-brand-blue text-white rounded-lg hover:bg-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium cursor-pointer"
                    >
                      {isPending || isConfirming ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors text-sm font-medium cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                // View mode
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-foreground">{item.key}</p>
                      {item.updatedAt && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.updatedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground break-words whitespace-pre-wrap">{item.value}</p>
                  </div>
                  {isOwner && (
                    <button
                      onClick={() => startEdit(item)}
                      className="ml-4 px-3 py-1.5 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors text-xs font-medium cursor-pointer flex-shrink-0"
                    >
                      Edit
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No metadata available</p>
          {isOwner && (
            <p className="text-xs mt-2">Click "Add Metadata" to add information about this persona</p>
          )}
        </div>
      )}

      {/* Success Message */}
      {isSuccess && (
        <div className="mt-4 p-3 bg-green-500/10 backdrop-blur-sm rounded-lg border border-green-500/20">
          <p className="text-sm text-green-400">
            ✅ Metadata updated successfully!
          </p>
        </div>
      )}
    </div>
  );
}
