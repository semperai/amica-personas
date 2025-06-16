// src/components/TradingInterface.tsx
import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useBalance } from 'wagmi';
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
  const [slippage, setSlippage] = useState('0.5'); // 0.5% default slippage
  const [showSettings, setShowSettings] = useState(false);

  const addresses = getAddressesForChain(Number(chainId));

  // Get persona details
  const { data: personaTuple } = useReadContract({
    address: addresses?.personaFactory as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: 'getPersona',
    args: [BigInt(tokenId)],
    query: {
      enabled: !!addresses
    }
  }) as { data: readonly [string, string, `0x${string}`, `0x${string}`, boolean, bigint, bigint] | undefined };

  // Get user balances
  const { data: amicaBalance } = useBalance({
    address: address,
    token: addresses?.amicaToken as `0x${string}`,
  });

  const { data: tokenBalance } = useReadContract({
    address: personaTuple?.[2] as `0x${string}`,
    abi: [{
      "inputs": [{"name": "account", "type": "address"}],
      "name": "balanceOf",
      "outputs": [{"name": "", "type": "uint256"}],
      "type": "function"
    }],
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!personaTuple && !!address
    }
  }) as { data: bigint | undefined };

  // Get fee information for the user
  const { data: feeInfo } = useReadContract({
    address: addresses?.personaFactory as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: 'getUserFeeInfo',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!addresses
    }
  }) as { data: readonly [bigint, bigint, bigint, bigint, boolean, bigint, bigint, bigint, bigint] | undefined };

  // Get quote with user-specific fees
  const { data: quote } = useReadContract({
    address: addresses?.personaFactory as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: 'getAmountOutForUser',
    args: address && amount && parseFloat(amount) > 0 ? [BigInt(tokenId), parseEther(amount), address] : undefined,
    query: {
      enabled: !!amount && !!address && parseFloat(amount) > 0 && !!addresses
    }
  }) as { data: bigint | undefined };

  // Get preview with fee breakdown
  const { data: preview } = useReadContract({
    address: addresses?.personaFactory as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: 'previewSwapWithFee',
    args: address && amount && parseFloat(amount) > 0 ? [BigInt(tokenId), parseEther(amount), address] : undefined,
    query: {
      enabled: !!amount && !!address && parseFloat(amount) > 0 && !!addresses
    }
  }) as { data: readonly [bigint, bigint, bigint] | undefined };

  const { writeContract, isPending } = useWriteContract();

  const handleTrade = async () => {
    if (!address || !amount || !addresses) return;

    const slippageMultiplier = 1 - (parseFloat(slippage) / 100);
    const minAmountOut = quote ? BigInt(Math.floor(Number(quote) * slippageMultiplier)) : BigInt(0);

    if (isBuying) {
      await writeContract({
        address: addresses.personaFactory as `0x${string}`,
        abi: FACTORY_ABI,
        functionName: 'swapExactTokensForTokens',
        args: [
          BigInt(tokenId),
          parseEther(amount),
          minAmountOut,
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
      address: addresses.personaFactory as `0x${string}`,
      abi: FACTORY_ABI,
      functionName: 'updateAmicaSnapshot',
      args: []
    });
  };

  // Format fee percentage for display
  const formatFeePercentage = (basisPoints: bigint) => {
    return ((Number(basisPoints) / 10000) * 100).toFixed(2);
  };

  // Calculate price per token
  const pricePerToken = amount && quote && parseFloat(amount) > 0
    ? (parseFloat(amount) / parseFloat(formatEther(quote))).toFixed(6)
    : '0';

  const isGraduated = personaTuple?.[4] || false;
  const tokenSymbol = personaTuple?.[1] || 'TOKEN';
  const graduationProgress = personaTuple && personaTuple[5] && personaTuple[6]
    ? (Number(personaTuple[5]) / Number(personaTuple[6])) * 100
    : 0;

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-light text-white">Swap</h2>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        {/* Settings Dropdown */}
        {showSettings && (
          <div className="absolute right-6 mt-2 w-80 bg-slate-800/95 backdrop-blur-xl rounded-xl shadow-xl border border-white/10 p-4 z-10">
            <h3 className="text-sm font-medium text-white mb-3">Transaction Settings</h3>
            <div className="mb-4">
              <label className="text-xs text-white/60 block mb-2">Slippage Tolerance</label>
              <div className="flex gap-2">
                {['0.1', '0.5', '1.0'].map((value) => (
                  <button
                    key={value}
                    onClick={() => setSlippage(value)}
                    className={`px-3 py-1 rounded-lg text-sm ${
                      slippage === value
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                        : 'bg-white/5 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {value}%
                  </button>
                ))}
                <input
                  type="number"
                  value={slippage}
                  onChange={(e) => setSlippage(e.target.value)}
                  className="flex-1 px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                  placeholder="Custom"
                  step="0.1"
                  min="0.1"
                  max="50"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Graduation Status */}
      {!isGraduated && (
        <div className="p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-b border-white/10">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-white/80">Graduation Progress</span>
            <span className="text-sm font-medium text-white">{graduationProgress.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(graduationProgress, 100)}%` }}
            />
          </div>
          <p className="text-xs text-white/60 mt-2">
            This persona will graduate when {(100 - graduationProgress).toFixed(1)}% more tokens are purchased
          </p>
        </div>
      )}

      {/* Swap Interface */}
      <div className="p-4">
        {/* From Token */}
        <div className="mb-2">
          <div className="p-4 bg-white/5 rounded-xl border border-white/10">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-white/60">{isBuying ? 'You pay' : 'You sell'}</span>
              <span className="text-xs text-white/50">
                Balance: {isBuying
                  ? (amicaBalance ? formatEther(amicaBalance.value) : '0')
                  : (tokenBalance ? formatEther(tokenBalance) : '0')
                }
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                className="flex-1 bg-transparent text-2xl text-white placeholder-white/30 outline-none min-w-0"
              />
              <button className="flex-shrink-0 px-4 py-2 bg-white/10 rounded-lg text-white hover:bg-white/20 transition-colors">
                {isBuying ? 'AMICA' : tokenSymbol}
              </button>
            </div>
          </div>
        </div>

        {/* Swap Direction Button */}
        <div className="flex justify-center -my-2 relative z-10">
          <button
            onClick={() => setIsBuying(!isBuying)}
            className="p-3 bg-slate-800 border-4 border-slate-900 rounded-xl hover:bg-slate-700 transition-colors group"
          >
            <svg className="w-5 h-5 text-white/70 group-hover:text-white transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </div>

        {/* To Token */}
        <div className="mb-6">
          <div className="p-4 bg-white/5 rounded-xl border border-white/10">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-white/60">{isBuying ? 'You receive' : 'You get'}</span>
              <span className="text-xs text-white/50">
                Balance: {isBuying
                  ? (tokenBalance ? formatEther(tokenBalance) : '0')
                  : (amicaBalance ? formatEther(amicaBalance.value) : '0')
                }
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={quote ? formatEther(quote) : ''}
                readOnly
                placeholder="0.0"
                className="flex-1 bg-transparent text-2xl text-white placeholder-white/30 outline-none min-w-0"
              />
              <button className="flex-shrink-0 px-4 py-2 bg-white/10 rounded-lg text-white hover:bg-white/20 transition-colors">
                {isBuying ? tokenSymbol : 'AMICA'}
              </button>
            </div>
          </div>
        </div>

        {/* Price Info */}
        {amount && quote && parseFloat(amount) > 0 && (
          <div className="mb-6 p-4 bg-white/5 rounded-xl space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Price</span>
              <span className="text-white">
                1 {tokenSymbol} = {pricePerToken} AMICA
              </span>
            </div>
            {preview && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Fee</span>
                  <span className="text-white">
                    {formatEther(preview[0])} AMICA
                    {feeInfo && feeInfo[8] > 0 && (
                      <span className="text-green-400 ml-1">
                        (-{formatFeePercentage(feeInfo[8])}%)
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Minimum received</span>
                  <span className="text-white">
                    {formatEther(BigInt(Math.floor(Number(quote) * (1 - parseFloat(slippage) / 100))))} {tokenSymbol}
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Fee Reduction Info */}
        {address && (
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

            {showFeeInfo && feeInfo && (
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
              </div>
            )}
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleTrade}
          disabled={!address || !amount || parseFloat(amount) <= 0 || isPending}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-xl hover:from-purple-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all duration-300 font-light text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
        >
          {!address ? 'Connect Wallet' : isPending ? 'Processing...' : isBuying ? 'Buy' : 'Sell'}
        </button>
      </div>
    </div>
  );
}
