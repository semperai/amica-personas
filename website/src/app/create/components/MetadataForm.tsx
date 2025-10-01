'use client';

import { useState } from 'react';

interface MetadataFormProps {
  metadataKeys: string[];
  metadataValues: string[];
  onAddMetadata: (key: string, value: string) => void;
  onRemoveMetadata: (index: number) => void;
}

export default function MetadataForm({
  metadataKeys,
  metadataValues,
  onAddMetadata,
  onRemoveMetadata
}: MetadataFormProps) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const handleAdd = () => {
    if (newKey && newValue) {
      onAddMetadata(newKey, newValue);
      setNewKey('');
      setNewValue('');
    }
  };

  return (
    <div className="mb-8">
      <label className="block text-sm font-light text-white/80 mb-3">Metadata (optional)</label>
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          type="text"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          className="flex-1 p-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/40 focus:border-white/40 focus:outline-none transition-colors"
          placeholder="Key (e.g., website)"
        />
        <input
          type="text"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          className="flex-1 p-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/40 focus:border-white/40 focus:outline-none transition-colors"
          placeholder="Value (e.g., https://...)"
        />
        <button
          onClick={handleAdd}
          className="px-6 py-4 bg-white/10 backdrop-blur-sm rounded-xl hover:bg-white/20 transition-all duration-300 text-white/80"
        >
          Add
        </button>
      </div>

      {metadataKeys.length > 0 && (
        <div className="space-y-2">
          {metadataKeys.map((key, index) => (
            <div key={index} className="flex justify-between items-center p-4 bg-white/5 backdrop-blur-sm rounded-xl">
              <span className="text-sm text-white/80 break-all">
                <span className="font-medium text-white/90">{key}:</span> {metadataValues[index]}
              </span>
              <button
                onClick={() => onRemoveMetadata(index)}
                className="text-red-400 hover:text-red-300 text-sm transition-colors ml-2 flex-shrink-0"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
