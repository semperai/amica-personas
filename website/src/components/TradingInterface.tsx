// src/components/TradingInterface.tsx
import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { FACTORY_ABI, getAddressesForChain, BASIS_POINTS } from '../lib/contracts';

interface TradingInterfaceProps {
  chainId: string;
  tokenId: string;
}

export default function TradingInterface({ chainId, tokenId }: TradingInterfaceProps) {
  const { address } = useAccount();
  const [amount, setAmount] = useState('');
  const [isBuying, setIsBuying] = useState(true);
  const [showFeeInfo, setShowFeeInfo] = useState(false);

  const addresses = getAddressesForChain(Number(chainId));

  // Get fee information for the user
  const { data: feeInfo } = useReadContract({
    address: addresses?.factory as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: 'getUserFeeInfo',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!addresses
    }
  }) as { data: readonly [bigint, bigint, bigint, bigint, boolean, bigint, bigint, bigint, bigint] | undefined };

  // Get quote with user-specific fees
  const { data: quote } = useReadContract({
    address: addresses?.factory as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: 'getAmountOutForUser',
    args: address && amount ? [BigInt(tokenId), parseEther(amount), address] : undefined,
    query: {
      enabled: !!amount && !!address && parseFloat(amount) > 0 && !!addresses
    }
  }) as { data: bigint | undefined };

  // Get preview with fee breakdown
  const { data: preview } = useReadContract({
    address: addresses?.factory as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: 'previewSwapWithFee',
    args: address && amount ? [BigInt(tokenId), parseEther(amount), address] : undefined,
    query: {
      enabled: !!amount && !!address && parseFloat(amount) > 0 && !!addresses
    }
  }) as { data: readonly [bigint, bigint, bigint] | undefined };

  const { writeContract } = useWriteContract();

  const handleTrade = async () => {
    if (!address || !amount || !addresses) return;

    if (isBuying) {
      await writeContract({
        address: addresses.factory as `0x${string}`,
        abi: FACTORY_ABI,
        functionName: 'swapExactTokensForTokens',
        args: [
          BigInt(tokenId),
          parseEther(amount),
          BigInt(0), // amountOutMin - should calculate with slippage
          address,
          BigInt(Math.floor(Date.now() / 1000) + 300) // 5 min deadline
        ]
      });
    } else {
      // TODO: Implement selling logic
      console.log('Selling not implemented yet');
    }
  };

  const handleUpdateSnapshot = async () => {
    if (!address || !addresses) return;

    await writeContract({
      address: addresses.factory as `0x${string}`,
      abi: FACTORY_ABI,
      functionName: 'updateAmicaSnapshot',
      args: []
    });
  };

  // Format fee percentage for display
  const formatFeePercentage = (basisPoints: bigint) => {
    return ((Number(basisPoints) / 10000) * 100).toFixed(2);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">Trade</h2>

      <div className="flex gap-2 mb-4">
        <button
          className={`px-4 py-2 rounded ${isBuying ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
          onClick={() => setIsBuying(true)}
        >
          Buy
        </button>
        <button
          className={`px-4 py-2 rounded ${!isBuying ? 'bg-red-500 text-white' : 'bg-gray-200'}`}
          onClick={() => setIsBuying(false)}
        >
          Sell
        </button>
      </div>

      <input
        type="number"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full p-2 border rounded mb-4"
      />

      {preview && amount && (
        <div className="mb-4 space-y-2">
          <div className="p-3 bg-gray-100 rounded">
            <div className="flex justify-between text-sm">
              <span>You will receive:</span>
              <span className="font-medium">{formatEther(preview[2])} tokens</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span>Trading fee:</span>
              <span className="font-medium">{formatEther(preview[0])} AMICA</span>
            </div>
          </div>
        </div>
      )}

      {/* Fee Reduction Info */}
      {address && (
        <div className="mb-4">
          <button
            onClick={() => setShowFeeInfo(!showFeeInfo)}
            className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
          >
            <svg className={`w-4 h-4 transform transition-transform ${showFeeInfo ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Fee Reduction Status
          </button>

          {showFeeInfo && feeInfo && (
            <div className="mt-3 p-4 bg-purple-50 rounded-lg text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Current AMICA Balance:</span>
                  <span className="font-medium">{formatEther(feeInfo[0])} AMICA</span>
                </div>
                <div className="flex justify-between">
                  <span>Snapshot Balance:</span>
                  <span className="font-medium">{formatEther(feeInfo[1])} AMICA</span>
                </div>
                <div className="flex justify-between">
                  <span>Effective Balance:</span>
                  <span className="font-medium">{formatEther(feeInfo[2])} AMICA</span>
                </div>
                <div className="flex justify-between">
                  <span>Your Fee Rate:</span>
                  <span className="font-medium text-green-600">
                    {formatFeePercentage(feeInfo[7])}%
                    {feeInfo[8] > 0 && (
                      <span className="text-xs ml-1">({formatFeePercentage(feeInfo[8])}% discount)</span>
                    )}
                  </span>
                </div>

                {!feeInfo[4] && feeInfo[5] > 0 && (
                  <div className="mt-2 p-2 bg-yellow-100 rounded">
                    <p className="text-xs">Snapshot pending. Eligible in {feeInfo[5].toString()} blocks</p>
                  </div>
                )}

                {feeInfo[1] === BigInt(0) && feeInfo[0] >= BigInt("1000000000000000000000") && (
                  <button
                    onClick={handleUpdateSnapshot}
                    className="mt-2 w-full bg-purple-600 text-white py-2 rounded text-sm hover:bg-purple-700"
                  >
                    Create AMICA Snapshot for Fee Reduction
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <button
        onClick={handleTrade}
        className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
        disabled={!address || !amount || parseFloat(amount) <= 0}
      >
        {isBuying ? 'Buy' : 'Sell'} Tokens
      </button>
    </div>
  );
}
