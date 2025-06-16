// src/components/trading/FeeInfoDisplay.tsx
import { useState } from 'react';
import { formatEther } from 'viem';
import { useWriteContract } from 'wagmi';
import { FACTORY_ABI } from '@/lib/contracts';

interface FeeInfoDisplayProps {
  feeInfo?: readonly [bigint, bigint, bigint, bigint, boolean, bigint, bigint, bigint, bigint];
  factoryAddress?: string;
  onUpdateSnapshot: () => void;
  isMockMode: boolean;
}

export function FeeInfoDisplay({ feeInfo, factoryAddress, onUpdateSnapshot, isMockMode }: FeeInfoDisplayProps) {
  const [showFeeInfo, setShowFeeInfo] = useState(false);
  const { writeContract } = useWriteContract();

  const formatFeePercentage = (basisPoints: bigint) => {
    return ((Number(basisPoints) / 10000) * 100).toFixed(2);
  };

  const handleUpdateSnapshot = async () => {
    if (!factoryAddress || isMockMode) {
      if (isMockMode) {
        alert('Mock Mode: Would update AMICA snapshot for fee reduction');
      }
      return;
    }

    await writeContract({
      address: factoryAddress as `0x${string}`,
      abi: FACTORY_ABI,
      functionName: 'updateAmicaSnapshot',
      args: []
    });
    
    onUpdateSnapshot();
  };

  if (!feeInfo) return null;

  return (
    <div className="mb-6">
      <button
        onClick={() => setShowFeeInfo(!showFeeInfo)}
        className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
      >
        <svg className={`w-4 h-4 transform transition-transform ${showFeeInfo ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Your Fee Tier
      </button>

      {showFeeInfo && (
        <div className="mt-3 p-4 bg-purple-500/10 backdrop-blur-sm rounded-xl text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-white/60">AMICA Balance:</span>
            <span className="text-white">{formatEther(feeInfo[0])}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Your Fee Rate:</span>
            <span className="text-green-400 font-medium">
              {formatFeePercentage(feeInfo[7])}%
              {feeInfo[8] > 0 && (
                <span className="text-xs ml-1">({formatFeePercentage(feeInfo[8])}% discount)</span>
              )}
            </span>
          </div>

          {feeInfo[1] === BigInt(0) && feeInfo[0] >= BigInt("1000000000000000000000") && (
            <button
              onClick={handleUpdateSnapshot}
              className="mt-2 w-full bg-purple-600 text-white py-2 rounded-lg text-sm hover:bg-purple-700"
            >
              Create Snapshot for Fee Reduction
            </button>
          )}

          <div className="mt-3 pt-3 border-t border-white/10">
            <p className="text-xs text-white/50">
              Hold AMICA to reduce trading fees:
            </p>
            <ul className="mt-1 space-y-1 text-xs text-white/40">
              <li>• 1,000 AMICA = 10% discount</li>
              <li>• 10,000 AMICA = 30% discount</li>
              <li>• 100,000 AMICA = 60% discount</li>
              <li>• 1,000,000+ AMICA = 100% discount</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
