// src/components/TradingInterface.tsx
import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useBalance, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { FACTORY_ABI, getAddressesForChain } from '../lib/contracts';
import { SwapSettings } from './trading/SwapSettings';
import { FeeInfoDisplay } from './trading/FeeInfoDisplay';
import { TokenInput } from './trading/TokenInput';
import { GraduationProgress } from './trading/GraduationProgress';

interface TradingInterfaceProps {
  chainId: string;
  tokenId: string;
}

// ERC20 ABI for token operations
const ERC20_ABI = [
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }]
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }]
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  }
] as const;

export default function TradingInterface({ chainId, tokenId }: TradingInterfaceProps) {
  const { address } = useAccount();
  const [amount, setAmount] = useState('');
  const [isBuying, setIsBuying] = useState(true);
  const [slippage, setSlippage] = useState('0.5');
  const [isApproving, setIsApproving] = useState(false);

  const addresses = getAddressesForChain(Number(chainId));
  const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

  // Transaction handling
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // Get persona details
  const { data: personaTuple } = useReadContract({
    address: addresses?.personaFactoryViewer as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: 'getPersona',
    args: [BigInt(tokenId)],
    query: {
      enabled: !!addresses && !isMockMode
    }
  }) as { data: readonly [string, string, `0x${string}`, `0x${string}`, boolean, bigint, bigint] | undefined };

  // Extract data from persona tuple
  const pairingToken = personaTuple?.[3];
  const personaToken = personaTuple?.[2];
  const tokenSymbol = personaTuple?.[1] || 'TOKEN';
  const isGraduated = personaTuple?.[4] || false;
  const totalDeposited = personaTuple?.[5] || BigInt(0);
  const graduationThreshold = personaTuple?.[6] || BigInt(1);

  // Get pairing token symbol
  const { data: pairingTokenSymbol } = useReadContract({
    address: pairingToken,
    abi: ERC20_ABI,
    functionName: 'symbol',
    query: {
      enabled: !!pairingToken && !isMockMode
    }
  }) as { data: string | undefined };

  // Get user balances
  const { data: pairingTokenBalance } = useBalance({
    address: address,
    token: pairingToken,
  });

  const { data: personaTokenBalance } = useReadContract({
    address: personaToken,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!personaToken && !!address && !isMockMode
    }
  }) as { data: bigint | undefined };

  // Get user's locked tokens (cannot sell these)
  const { data: lockedTokens } = useReadContract({
    address: addresses?.personaFactoryViewer as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: 'userPurchases',
    args: [BigInt(tokenId), address!],
    query: {
      enabled: !!address && !!addresses && !isBuying && !isMockMode
    }
  }) as { data: bigint | undefined };

  // Calculate sellable balance (total balance - locked tokens)
  const sellableBalance = personaTokenBalance && lockedTokens 
    ? personaTokenBalance - lockedTokens 
    : personaTokenBalance || BigInt(0);

  // Get current allowance
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    address: isBuying ? pairingToken : personaToken,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && addresses?.personaFactory ? [address, addresses.personaFactory as `0x${string}`] : undefined,
    query: {
      enabled: !!address && !!addresses?.personaFactory && (isBuying ? !!pairingToken : !!personaToken) && !isMockMode,
      refetchInterval: 2000,
    }
  }) as { data: bigint | undefined, refetch: () => void };

  // Get fee information
  const { data: feeInfo } = useReadContract({
    address: addresses?.personaFactoryViewer as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: 'getUserFeeInfo',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!addresses && !isMockMode
    }
  }) as { data: readonly [bigint, bigint, bigint, bigint, boolean, bigint, bigint, bigint, bigint] | undefined };

  // Get quote based on buy/sell mode
  const { data: quote } = useReadContract({
    address: addresses?.personaFactoryViewer as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: isBuying ? 'getAmountOutForUser' : 'getAmountInForUser',
    args: address && amount && parseFloat(amount) > 0 
      ? isBuying 
        ? [BigInt(tokenId), parseEther(amount), address] // Buying: input pairing tokens
        : [BigInt(tokenId), parseEther(amount), address] // Selling: input persona tokens
      : undefined,
    query: {
      enabled: !!amount && !!address && parseFloat(amount) > 0 && !!addresses && !isMockMode
    }
  }) as { data: bigint | undefined };

  // Get preview with fee breakdown
  const { data: preview } = useReadContract({
    address: addresses?.personaFactoryViewer as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: 'previewSwapWithFee',
    args: address && amount && parseFloat(amount) > 0 
      ? [BigInt(tokenId), parseEther(amount), address] 
      : undefined,
    query: {
      enabled: !!amount && !!address && parseFloat(amount) > 0 && !!addresses && !isMockMode && isBuying
    }
  }) as { data: readonly [bigint, bigint, bigint] | undefined };

  // Calculate if approval is needed
  const amountWei = amount && parseFloat(amount) > 0 ? parseEther(amount) : BigInt(0);
  const needsApproval = currentAllowance !== undefined && amountWei > currentAllowance;

  // Calculate graduation progress
  const graduationProgress = Number(totalDeposited) > 0 && Number(graduationThreshold) > 0
    ? (Number(totalDeposited) / Number(graduationThreshold)) * 100
    : 0;

  // Reset form on success
  useEffect(() => {
    if (isSuccess) {
      setAmount('');
      refetchAllowance();
    }
  }, [isSuccess, refetchAllowance]);

  const handleApprove = async () => {
    if (!address || !addresses || !amount || parseFloat(amount) <= 0) return;

    if (isMockMode) {
      alert(`Mock Mode: Would approve ${amount} ${isBuying ? pairingTokenSymbol : tokenSymbol}`);
      return;
    }

    setIsApproving(true);
    const tokenToApprove = isBuying ? pairingToken : personaToken;
    
    try {
      await writeContract({
        address: tokenToApprove as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [addresses.personaFactory as `0x${string}`, amountWei]
      });
    } catch (error) {
      console.error('Approval error:', error);
    } finally {
      setIsApproving(false);
    }
  };

  const handleTrade = async () => {
    if (!address || !amount || !addresses) return;

    if (needsApproval) {
      alert('Please approve tokens first');
      return;
    }

    if (isMockMode) {
      alert(`Mock Mode: Would ${isBuying ? 'buy' : 'sell'} ${amount} tokens`);
      return;
    }

    const slippageMultiplier = 1 - (parseFloat(slippage) / 100);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 min deadline

    try {
      if (isBuying) {
        const minAmountOut = quote ? BigInt(Math.floor(Number(quote) * slippageMultiplier)) : BigInt(0);
        
        await writeContract({
          address: addresses.personaFactory as `0x${string}`,
          abi: FACTORY_ABI,
          functionName: 'swapExactTokensForTokens',
          args: [
            BigInt(tokenId),
            parseEther(amount),
            minAmountOut,
            address,
            deadline
          ]
        });
      } else {
        // Selling persona tokens
        const minAmountOut = quote ? BigInt(Math.floor(Number(quote) * slippageMultiplier)) : BigInt(0);
        
        await writeContract({
          address: addresses.personaFactory as `0x${string}`,
          abi: FACTORY_ABI,
          functionName: 'swapExactPersonaTokensForTokens',
          args: [
            BigInt(tokenId),
            parseEther(amount),
            minAmountOut,
            address,
            deadline
          ]
        });
      }
    } catch (error) {
      console.error('Trade error:', error);
    }
  };

  const handleMaxClick = () => {
    if (isBuying && pairingTokenBalance) {
      setAmount(formatEther(pairingTokenBalance.value));
    } else if (!isBuying && sellableBalance) {
      setAmount(formatEther(sellableBalance));
    }
  };

  // Format balances
  const currentBalance = isBuying ? pairingTokenBalance : { value: sellableBalance };
  const currentBalanceFormatted = currentBalance 
    ? formatEther(currentBalance.value) 
    : '0';

  const currentTokenSymbol = isBuying ? (pairingTokenSymbol || 'PAIRING') : tokenSymbol;
  const targetTokenSymbol = isBuying ? tokenSymbol : (pairingTokenSymbol || 'PAIRING');

  // Calculate price per token
  const pricePerToken = amount && quote && parseFloat(amount) > 0
    ? isBuying 
      ? (parseFloat(amount) / parseFloat(formatEther(quote))).toFixed(6)
      : (parseFloat(formatEther(quote)) / parseFloat(amount)).toFixed(6)
    : '0';

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-light text-white">Swap</h2>
          <div className="flex items-center gap-2">
            {isMockMode && (
              <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">Mock Mode</span>
            )}
            <SwapSettings slippage={slippage} onSlippageChange={setSlippage} />
          </div>
        </div>
      </div>

      {/* Graduation Progress */}
      <GraduationProgress isGraduated={isGraduated} progress={graduationProgress} />

      {/* Swap Interface */}
      <div className="p-4">
        {/* From Token */}
        <TokenInput
          label={isBuying ? 'You pay' : 'You sell'}
          value={amount}
          onChange={setAmount}
          onMaxClick={handleMaxClick}
          balance={currentBalanceFormatted}
          tokenSymbol={currentTokenSymbol}
          className="mb-2"
        />

        {/* Show locked tokens warning when selling */}
        {!isBuying && lockedTokens && lockedTokens > BigInt(0) && (
          <div className="mb-2 p-3 bg-yellow-500/10 backdrop-blur-sm rounded-lg border border-yellow-500/20">
            <p className="text-xs text-yellow-400">
              ⚠️ {formatEther(lockedTokens)} {tokenSymbol} are locked from direct purchases. 
              Withdraw them first to sell.
            </p>
          </div>
        )}

        {/* Swap Direction Button */}
        <div className="flex justify-center -my-2 relative z-10">
          <button
            onClick={() => {
              setIsBuying(!isBuying);
              setAmount('');
            }}
            disabled={isGraduated}
            className="p-3 bg-slate-800 border-4 border-slate-900 rounded-xl hover:bg-slate-700 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5 text-white/70 group-hover:text-white transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </div>

        {/* To Token */}
        <TokenInput
          label={isBuying ? 'You receive' : 'You get'}
          value={quote ? formatEther(quote) : ''}
          readOnly
          balance={isBuying
            ? (personaTokenBalance ? formatEther(personaTokenBalance) : '0')
            : (pairingTokenBalance ? formatEther(pairingTokenBalance.value) : '0')
          }
          tokenSymbol={targetTokenSymbol}
          className="mb-6"
        />

        {/* Price Info */}
        {amount && quote && parseFloat(amount) > 0 && (
          <div className="mb-6 p-4 bg-white/5 rounded-xl space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Price</span>
              <span className="text-white">
                1 {tokenSymbol} = {pricePerToken} {pairingTokenSymbol || 'tokens'}
              </span>
            </div>
            {preview && isBuying && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Fee</span>
                  <span className="text-white">
                    {formatEther(preview[0])} {pairingTokenSymbol || 'tokens'}
                    {feeInfo && feeInfo[8] > 0 && (
                      <span className="text-green-400 ml-1">
                        (-{((Number(feeInfo[8]) / 10000) * 100).toFixed(0)}%)
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Minimum received</span>
                  <span className="text-white">
                    {formatEther(BigInt(Math.floor(Number(quote) * (1 - parseFloat(slippage) / 100))))} {targetTokenSymbol}
                  </span>
                </div>
              </>
            )}
            {!isBuying && (
              <div className="flex justify-between text-sm">
                <span className="text-white/60">Minimum received</span>
                <span className="text-white">
                  {formatEther(BigInt(Math.floor(Number(quote) * (1 - parseFloat(slippage) / 100))))} {targetTokenSymbol}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Fee Reduction Info */}
        {address && (
          <FeeInfoDisplay 
            feeInfo={feeInfo} 
            factoryAddress={addresses?.personaFactory}
            onUpdateSnapshot={() => refetchAllowance()}
            isMockMode={isMockMode}
          />
        )}

        {/* Graduated Warning */}
        {isGraduated && (
          <div className="mb-6 p-4 bg-blue-500/10 backdrop-blur-sm rounded-xl border border-blue-500/20">
            <p className="text-sm text-blue-400">
              ℹ️ This persona has graduated. Please trade on Uniswap instead.
            </p>
          </div>
        )}

        {/* Action Button */}
        {!address ? (
          <button
            disabled
            className="w-full bg-gray-600 text-white py-4 rounded-xl cursor-not-allowed font-light text-lg"
          >
            Connect Wallet
          </button>
        ) : needsApproval ? (
          <button
            onClick={handleApprove}
            disabled={!amount || parseFloat(amount) <= 0 || isApproving || isPending || isConfirming || isGraduated}
            className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white py-4 rounded-xl hover:from-yellow-600 hover:to-orange-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all duration-300 font-light text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            {isApproving || isPending || isConfirming 
              ? 'Approving...' 
              : `Approve ${currentTokenSymbol}`
            }
          </button>
        ) : (
          <button
            onClick={handleTrade}
            disabled={!amount || parseFloat(amount) <= 0 || isPending || isConfirming || isGraduated}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-xl hover:from-purple-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all duration-300 font-light text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            {isPending || isConfirming 
              ? 'Processing...' 
              : isBuying ? `Buy ${tokenSymbol}` : `Sell ${tokenSymbol}`
            }
          </button>
        )}

        {/* Transaction Error */}
        {writeError && (
          <div className="mt-4 p-3 bg-red-500/10 backdrop-blur-sm rounded-xl border border-red-500/20">
            <p className="text-sm text-red-400">
              {writeError.message.includes('user rejected') 
                ? 'Transaction cancelled by user' 
                : 'Transaction failed. Please try again.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
