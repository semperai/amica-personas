// src/components/TradingInterface.tsx - Enhanced with buy/sell separation and improved error handling
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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [tradeHistory, setTradeHistory] = useState<'all' | 'buy' | 'sell'>('all');

  const addresses = getAddressesForChain(Number(chainId));
  const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

  // Transaction handling
  const { writeContract, data: txHash, isPending, error: writeError, reset: resetWrite } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // Get persona details using the viewer contract
  const { data: personaTuple, refetch: refetchPersona } = useReadContract({
    address: addresses?.personaFactoryViewer as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: 'getPersonaExtended',
    args: [BigInt(tokenId)],
    query: {
      enabled: !!addresses && !isMockMode,
      refetchInterval: 5000, // Refresh every 5 seconds
    }
  }) as { data: readonly [string, string, `0x${string}`, `0x${string}`, `0x${string}`, boolean, bigint, bigint, bigint] | undefined, refetch: () => void };

  // Extract data from persona tuple
  const personaName = personaTuple?.[0] || 'Unknown';
  const tokenSymbol = personaTuple?.[1] || 'TOKEN';
  const personaToken = personaTuple?.[2];
  const pairingToken = personaTuple?.[3];
  const agentToken = personaTuple?.[4];
  const isGraduated = personaTuple?.[5] || false;
  const createdAt = personaTuple?.[6] || BigInt(0);
  const totalAgentDeposited = personaTuple?.[7] || BigInt(0);
  const minAgentTokens = personaTuple?.[8] || BigInt(0);

  // Get purchase info using viewer contract
  const { data: purchaseInfo, refetch: refetchPurchaseInfo } = useReadContract({
    address: addresses?.personaFactoryViewer as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: 'getPurchaseInfo',
    args: [BigInt(tokenId)],
    query: {
      enabled: !!addresses && !isMockMode,
      refetchInterval: 5000,
    }
  }) as { data: readonly [bigint, bigint, bigint] | undefined, refetch: () => void };

  const totalDeposited = purchaseInfo?.[0] || BigInt(0);
  const tokensSold = purchaseInfo?.[1] || BigInt(0);
  const availableTokens = purchaseInfo?.[2] || BigInt(0);

  // Get graduation progress
  const { data: graduationProgress } = useReadContract({
    address: addresses?.personaFactoryViewer as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: 'getGraduationProgress',
    args: [BigInt(tokenId)],
    query: {
      enabled: !!addresses && !isMockMode
    }
  }) as { data: readonly [bigint, bigint, bigint, bigint, bigint] | undefined };

  const currentDeposited = graduationProgress?.[0] || BigInt(0);
  const thresholdRequired = graduationProgress?.[1] || BigInt(1);
  const percentComplete = graduationProgress?.[2] || BigInt(0);
  const currentAgentDeposited = graduationProgress?.[3] || BigInt(0);
  const agentRequired = graduationProgress?.[4] || BigInt(0);

  // Get pairing token symbol
  const { data: pairingTokenSymbol } = useReadContract({
    address: pairingToken,
    abi: ERC20_ABI,
    functionName: 'symbol',
    query: {
      enabled: !!pairingToken && !isMockMode
    }
  }) as { data: string | undefined };

  // Get user balances - pairing token balance
  const { data: pairingTokenBalance, refetch: refetchPairingBalance } = useReadContract({
    address: pairingToken,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!pairingToken && !!address && !isMockMode,
      refetchInterval: 2000,
    }
  }) as { data: bigint | undefined, refetch: () => void };

  // Get persona token balance
  const { data: personaTokenBalance, refetch: refetchPersonaBalance } = useReadContract({
    address: personaToken,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!personaToken && !!address && !isMockMode,
      refetchInterval: 2000,
    }
  }) as { data: bigint | undefined, refetch: () => void };

  // Get user's locked tokens (cannot sell these directly)
  const { data: lockedTokens, refetch: refetchLockedTokens } = useReadContract({
    address: addresses?.personaFactory as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: 'userPurchases',
    args: [BigInt(tokenId), address!],
    query: {
      enabled: !!address && !!addresses && !isBuying && !isMockMode,
      refetchInterval: 2000,
    }
  }) as { data: bigint | undefined, refetch: () => void };

  // Calculate sellable balance (total balance - locked tokens)
  const sellableBalance = personaTokenBalance && lockedTokens 
    ? personaTokenBalance >= lockedTokens ? personaTokenBalance - lockedTokens : BigInt(0)
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
  const { data: feeInfo, refetch: refetchFeeInfo } = useReadContract({
    address: addresses?.personaFactoryViewer as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: 'getUserFeeInfo',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!addresses && !isMockMode,
      refetchInterval: 10000, // Update every 10 seconds
    }
  }) as { data: readonly [bigint, bigint, bigint, bigint, boolean, bigint, bigint, bigint, bigint] | undefined, refetch: () => void };

  // Get quote for buying
  const { data: buyQuote } = useReadContract({
    address: addresses?.personaFactoryViewer as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: 'getAmountOutForUser',
    args: isBuying && address && amount && parseFloat(amount) > 0 
      ? [BigInt(tokenId), parseEther(amount), address]
      : undefined,
    query: {
      enabled: isBuying && !!amount && !!address && parseFloat(amount) > 0 && !!addresses && !isMockMode
    }
  }) as { data: bigint | undefined };

  // Get quote for selling
  const { data: sellQuote } = useReadContract({
    address: addresses?.personaFactoryViewer as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: 'getAmountOutForSellForUser',
    args: !isBuying && address && amount && parseFloat(amount) > 0 
      ? [BigInt(tokenId), parseEther(amount), address]
      : undefined,
    query: {
      enabled: !isBuying && !!amount && !!address && parseFloat(amount) > 0 && !!addresses && !isMockMode
    }
  }) as { data: bigint | undefined };

  // Get preview with fee breakdown for buying
  const { data: buyPreview } = useReadContract({
    address: addresses?.personaFactoryViewer as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: 'previewBuyWithFee',
    args: address && amount && parseFloat(amount) > 0 && isBuying
      ? [BigInt(tokenId), parseEther(amount), address] 
      : undefined,
    query: {
      enabled: !!amount && !!address && parseFloat(amount) > 0 && !!addresses && !isMockMode && isBuying
    }
  }) as { data: readonly [bigint, bigint, bigint] | undefined };

  // Get preview with fee breakdown for selling
  const { data: sellPreview } = useReadContract({
    address: addresses?.personaFactoryViewer as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: 'previewSellWithFee',
    args: address && amount && parseFloat(amount) > 0 && !isBuying
      ? [BigInt(tokenId), parseEther(amount), address] 
      : undefined,
    query: {
      enabled: !!amount && !!address && parseFloat(amount) > 0 && !!addresses && !isMockMode && !isBuying
    }
  }) as { data: readonly [bigint, bigint, bigint] | undefined };

  // Calculate if approval is needed
  const amountWei = amount && parseFloat(amount) > 0 ? parseEther(amount) : BigInt(0);
  const needsApproval = currentAllowance !== undefined && amountWei > currentAllowance;

  // Reset form on success and refetch data
  useEffect(() => {
    if (isSuccess) {
      setAmount('');
      // Refetch all relevant data
      refetchAllowance();
      refetchPairingBalance();
      refetchPersonaBalance();
      refetchLockedTokens();
      refetchPersona();
      refetchPurchaseInfo();
      refetchFeeInfo();
    }
  }, [isSuccess, refetchAllowance, refetchPairingBalance, refetchPersonaBalance, refetchLockedTokens, refetchPersona, refetchPurchaseInfo, refetchFeeInfo]);

  // Reset write error when changing amount or buy/sell mode
  useEffect(() => {
    resetWrite();
  }, [amount, isBuying, resetWrite]);

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
        args: [addresses.personaFactory as `0x${string}`, parseEther('1000000000')] // Approve max amount
      });
    } catch (error) {
      console.error('Approval error:', error);
    } finally {
      setIsApproving(false);
    }
  };

  const handleTrade = async () => {
    if (!address || !amount || !addresses || parseFloat(amount) <= 0) return;

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
        const minAmountOut = buyQuote ? BigInt(Math.floor(Number(buyQuote) * slippageMultiplier)) : BigInt(0);
        
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
        const minAmountOut = sellQuote ? BigInt(Math.floor(Number(sellQuote) * slippageMultiplier)) : BigInt(0);
        
        // Check if we have tokens to sell
        if (sellableBalance < parseEther(amount)) {
          alert('Insufficient sellable balance. You may have locked tokens that need to be withdrawn first.');
          return;
        }
        
        await writeContract({
          address: addresses.personaFactory as `0x${string}`,
          abi: FACTORY_ABI,
          functionName: 'swapExactTokensForPairingTokens',
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
      setAmount(formatEther(pairingTokenBalance));
    } else if (!isBuying && sellableBalance > BigInt(0)) {
      setAmount(formatEther(sellableBalance));
    }
  };

  const handleWithdrawTokens = async () => {
    if (!address || !addresses || !lockedTokens || lockedTokens === BigInt(0)) return;

    if (isMockMode) {
      alert('Mock Mode: Would withdraw locked tokens');
      return;
    }

    try {
      await writeContract({
        address: addresses.personaFactory as `0x${string}`,
        abi: FACTORY_ABI,
        functionName: 'withdrawTokens',
        args: [BigInt(tokenId)]
      });
    } catch (error) {
      console.error('Withdraw error:', error);
    }
  };

  // Format balances
  const currentBalance = isBuying ? pairingTokenBalance : sellableBalance;
  const currentBalanceFormatted = currentBalance 
    ? formatEther(currentBalance) 
    : '0';

  const currentTokenSymbol = isBuying ? (pairingTokenSymbol || 'AMICA') : tokenSymbol;
  const targetTokenSymbol = isBuying ? tokenSymbol : (pairingTokenSymbol || 'AMICA');

  // Use the appropriate quote and preview based on buy/sell
  const outputAmount = isBuying ? buyQuote : sellQuote;
  const preview = isBuying ? buyPreview : sellPreview;

  // Calculate price per token
  const pricePerToken = amount && outputAmount && parseFloat(amount) > 0
    ? isBuying 
      ? (parseFloat(amount) / parseFloat(formatEther(outputAmount))).toFixed(6)
      : (parseFloat(formatEther(outputAmount)) / parseFloat(amount)).toFixed(6)
    : '0';

  // Calculate price impact
  const calculatePriceImpact = () => {
    if (!amount || parseFloat(amount) === 0) return 0;
    // Simplified price impact calculation - in reality this would be more complex
    const tradeSize = parseFloat(amount);
    const liquiditySize = Number(formatEther(totalDeposited));
    return liquiditySize > 0 ? (tradeSize / liquiditySize) * 100 : 0;
  };

  const priceImpact = calculatePriceImpact();

  return (
    <div className="bg-card backdrop-blur-md rounded-2xl border border-border">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-light text-foreground">
            {isBuying ? 'Buy' : 'Sell'} {tokenSymbol}
          </h2>
          <div className="flex items-center gap-2">
            {isMockMode && (
              <span className="text-xs bg-brand-blue/20 text-brand-blue px-2 py-1 rounded">Mock Mode</span>
            )}
            <SwapSettings slippage={slippage} onSlippageChange={setSlippage} />
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Graduation Progress */}
      <GraduationProgress 
        isGraduated={isGraduated} 
        progress={Number(percentComplete)} 
        agentTokenProgress={agentRequired > BigInt(0) ? Number(currentAgentDeposited) / Number(agentRequired) * 100 : 100}
        hasAgentToken={agentToken !== '0x0000000000000000000000000000000000000000'}
      />

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
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-yellow-400">
                  ⚠️ {formatEther(lockedTokens)} {tokenSymbol} are locked from direct purchases.
                </p>
                <p className="text-xs text-yellow-300 mt-1">
                  Withdraw them first to sell or trade on Uniswap after graduation.
                </p>
              </div>
              {isGraduated && (
                <button
                  onClick={handleWithdrawTokens}
                  disabled={isPending || isConfirming}
                  className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs hover:bg-yellow-500/30 transition-colors"
                >
                  Withdraw
                </button>
              )}
            </div>
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
            className="p-3 bg-background border-4 border-card rounded-xl hover:bg-muted transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </div>

        {/* To Token */}
        <TokenInput
          label={isBuying ? 'You receive' : 'You get'}
          value={outputAmount ? formatEther(outputAmount) : ''}
          readOnly
          balance={isBuying
            ? (personaTokenBalance ? formatEther(personaTokenBalance) : '0')
            : (pairingTokenBalance ? formatEther(pairingTokenBalance) : '0')
          }
          tokenSymbol={targetTokenSymbol}
          className="mb-6"
        />

        {/* Price Info */}
        {amount && outputAmount && parseFloat(amount) > 0 && (
          <div className="mb-6 p-4 bg-muted rounded-xl space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Price</span>
              <span className="text-foreground">
                1 {tokenSymbol} = {pricePerToken} {pairingTokenSymbol || 'AMICA'}
              </span>
            </div>
            
            {preview && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fee</span>
                  <span className="text-foreground">
                    {formatEther(preview[0])} {isBuying ? (pairingTokenSymbol || 'AMICA') : tokenSymbol}
                    {feeInfo && feeInfo[8] > 0 && (
                      <span className="text-green-400 ml-1">
                        (-{((Number(feeInfo[8]) / 10000) * 100).toFixed(0)}%)
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Minimum received</span>
                  <span className="text-foreground">
                    {formatEther(BigInt(Math.floor(Number(outputAmount) * (1 - parseFloat(slippage) / 100))))} {targetTokenSymbol}
                  </span>
                </div>
              </>
            )}

            {priceImpact > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Price Impact</span>
                <span className={`${priceImpact > 5 ? 'text-red-400' : priceImpact > 2 ? 'text-yellow-400' : 'text-green-400'}`}>
                  {priceImpact.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
        )}

        {/* Advanced Info */}
        {showAdvanced && (
          <div className="mb-6 p-4 bg-muted rounded-xl">
            <h4 className="text-sm font-medium text-foreground mb-3">Advanced Information</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Available in curve:</span>
                <span className="text-foreground">{formatEther(availableTokens)} {tokenSymbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total sold:</span>
                <span className="text-foreground">{formatEther(tokensSold)} {tokenSymbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current TVL:</span>
                <span className="text-foreground">{formatEther(totalDeposited)} {pairingTokenSymbol || 'AMICA'}</span>
              </div>
              {agentToken && agentToken !== '0x0000000000000000000000000000000000000000' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Agent tokens deposited:</span>
                    <span className="text-foreground">{formatEther(totalAgentDeposited)}</span>
                  </div>
                  {minAgentTokens > BigInt(0) && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Agent tokens required:</span>
                      <span className="text-foreground">{formatEther(minAgentTokens)}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Fee Reduction Info */}
        {address && (
          <FeeInfoDisplay 
            feeInfo={feeInfo} 
            factoryAddress={addresses?.personaFactory}
            onUpdateSnapshot={() => refetchFeeInfo()}
            isMockMode={isMockMode}
          />
        )}

        {/* Graduated Warning */}
        {isGraduated && (
          <div className="mb-6 p-4 bg-blue-500/10 backdrop-blur-sm rounded-xl border border-blue-500/20">
            <p className="text-sm text-blue-400 mb-2">
              ℹ️ This persona has graduated to Uniswap.
            </p>
            <a
              href={`https://app.uniswap.org/#/swap?inputCurrency=${pairingToken}&outputCurrency=${personaToken}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Trade on Uniswap
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        )}

        {/* Action Button */}
        {!address ? (
          <button
            disabled
            className="w-full bg-muted text-foreground py-4 rounded-xl cursor-not-allowed font-light text-lg"
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
            disabled={!amount || parseFloat(amount) <= 0 || isPending || isConfirming || isGraduated || (priceImpact > 10)}
            className="w-full gradient-brand text-white py-4 rounded-xl hover:opacity-90 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all duration-300 font-light text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            {isPending || isConfirming 
              ? 'Processing...' 
              : priceImpact > 10
              ? 'Price Impact Too High'
              : isBuying ? `Buy ${tokenSymbol}` : `Sell ${tokenSymbol}`
            }
          </button>
        )}

        {/* Price Impact Warning */}
        {priceImpact > 5 && (
          <div className="mt-4 p-3 bg-red-500/10 backdrop-blur-sm rounded-xl border border-red-500/20">
            <p className="text-sm text-red-400">
              ⚠️ High price impact ({priceImpact.toFixed(2)}%). Consider reducing trade size.
            </p>
          </div>
        )}

        {/* Transaction Error */}
        {writeError && (
          <div className="mt-4 p-3 bg-red-500/10 backdrop-blur-sm rounded-xl border border-red-500/20">
            <p className="text-sm text-red-400">
              {writeError.message.includes('user rejected') 
                ? 'Transaction cancelled by user' 
                : writeError.message.includes('Insufficient sellable balance')
                ? 'Insufficient sellable balance. You may have locked tokens.'
                : writeError.message.includes('slippage')
                ? 'Price moved unfavorably. Try increasing slippage tolerance.'
                : 'Transaction failed. Please try again.'}
            </p>
          </div>
        )}

        {/* Success Message */}
        {isSuccess && (
          <div className="mt-4 p-3 bg-green-500/10 backdrop-blur-sm rounded-xl border border-green-500/20">
            <p className="text-sm text-green-400">
              ✅ Transaction successful! {isBuying ? 'Tokens purchased' : 'Tokens sold'}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
