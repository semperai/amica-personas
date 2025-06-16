// src/components/AgentDeposits.tsx
import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useBalance, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { FACTORY_ABI, getAddressesForChain } from '../lib/contracts';
import { fetchPersonaDetail } from '../lib/api';

interface AgentDepositsProps {
  chainId: string;
  tokenId: string;
}

interface PersonaData {
  name: string;
  symbol: string;
  erc20Token: string;
  pairToken: string;
  pairCreated: boolean;
  createdAt: bigint;
  minAgentTokens: bigint;
}

interface AgentDeposit {
  amount: bigint;
  timestamp: bigint;
  withdrawn: boolean;
}

// ERC20 ABI for agent token operations
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

export default function AgentDeposits({ chainId, tokenId }: AgentDepositsProps) {
  const { address } = useAccount();
  const [depositAmount, setDepositAmount] = useState('');
  const [showDeposits, setShowDeposits] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [mockPersona, setMockPersona] = useState<{
    name: string;
    symbol: string;
    erc20Token?: string;
    pairToken?: string;
    isGraduated: boolean;
    createdAt?: string;
    agentToken?: string;
    minAgentTokens?: string;
    totalAgentDeposited?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const addresses = getAddressesForChain(Number(chainId));
  const { writeContract, data: hash, isPending, isError } = useWriteContract();
  const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';
  
  // Wait for transaction confirmations
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Load mock data if in mock mode
  useEffect(() => {
    const loadMockData = async () => {
      if (isMockMode) {
        try {
          const persona = await fetchPersonaDetail(chainId, tokenId);
          setMockPersona(persona);
        } catch (error) {
          console.error('Failed to load mock persona:', error);
        }
      }
      setLoading(false);
    };
    loadMockData();
  }, [isMockMode, chainId, tokenId]);

  // Get persona details - the function returns a tuple
  const { data: personaTuple } = useReadContract({
    address: addresses?.personaFactory as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: 'getPersona',
    args: [BigInt(tokenId)],
    query: {
      enabled: !!addresses && !isMockMode
    }
  }) as { data: readonly [string, string, `0x${string}`, `0x${string}`, boolean, bigint, bigint] | undefined };

  // Get the full persona struct to access agentToken
  const { data: personaStruct } = useReadContract({
    address: addresses?.personaFactory as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: 'personas',
    args: [BigInt(tokenId)],
    query: {
      enabled: !!addresses && !isMockMode
    }
  }) as { data: { agentToken: `0x${string}`, totalAgentDeposited: bigint } | undefined };

  // Mock user deposits for demo
  const mockUserDeposits: AgentDeposit[] = isMockMode && address ? [
    {
      amount: BigInt("5000000000000000000000"), // 5k tokens
      timestamp: BigInt(Math.floor(Date.now() / 1000) - 86400), // 1 day ago
      withdrawn: false
    }
  ] : [];

  // Get user's agent deposits
  const { data: userDeposits } = useReadContract({
    address: addresses?.personaFactory as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: 'getUserAgentDeposits',
    args: address ? [BigInt(tokenId), address] : undefined,
    query: {
      enabled: !!address && !!addresses && !isMockMode
    }
  }) as { data: AgentDeposit[] | undefined };

  // Calculate expected rewards
  const { data: rewardCalculation } = useReadContract({
    address: addresses?.personaFactory as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: 'calculateAgentRewards',
    args: address ? [BigInt(tokenId), address] : undefined,
    query: {
      enabled: !!address && !!addresses && !isMockMode
    }
  }) as { data: readonly [bigint, bigint] | undefined };

  // Get mock or real data
  const agentToken = isMockMode ? mockPersona?.agentToken : personaStruct?.agentToken;
  const totalAgentDeposited = isMockMode 
    ? BigInt(mockPersona?.totalAgentDeposited || "0") 
    : (personaStruct?.totalAgentDeposited || BigInt(0));

  // Get agent token symbol (mock it in mock mode)
  const { data: agentTokenSymbol } = useReadContract({
    address: agentToken as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'symbol',
    query: {
      enabled: !!agentToken && agentToken !== '0x0000000000000000000000000000000000000000' && !isMockMode
    }
  }) as { data: string | undefined };

  const mockAgentTokenSymbol = isMockMode ? 'AGENT' : undefined;
  const finalAgentTokenSymbol = agentTokenSymbol || mockAgentTokenSymbol;

  // Get user's agent token balance (mock it in mock mode)
  const { data: agentTokenBalance, refetch: refetchBalance } = useBalance({
    address: address,
    token: agentToken as `0x${string}`,
    query: {
      enabled: !!address && !!agentToken && agentToken !== '0x0000000000000000000000000000000000000000' && !isMockMode
    }
  });

  const mockBalance = isMockMode && address ? BigInt("100000000000000000000000") : BigInt(0); // 100k tokens

  // Get current allowance (mock it in mock mode)
  const { data: currentAllowance } = useReadContract({
    address: agentToken as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && addresses ? [address, addresses.personaFactory as `0x${string}`] : undefined,
    query: {
      enabled: !!address && !!addresses && !!agentToken && agentToken !== '0x0000000000000000000000000000000000000000' && !isMockMode
    }
  }) as { data: bigint | undefined };

  const mockAllowance = isMockMode ? BigInt(0) : undefined; // No allowance in mock mode

  // Mock rewards calculation
  const mockRewardCalculation: readonly [bigint, bigint] | undefined = isMockMode && address 
    ? [BigInt("11111111111111111111111"), BigInt("5000000000000000000000")] // ~11k persona tokens for 5k agent tokens
    : undefined;

  // Refetch data after successful transaction
  useEffect(() => {
    if (isSuccess && !isMockMode) {
      // refetchDeposits();
      refetchBalance();
      // refetchAllowance();
      setDepositAmount('');
    }
  }, [isSuccess, isMockMode]);

  const handleApprove = async () => {
    if (!address || !addresses || !agentToken || !depositAmount) return;

    if (isMockMode) {
      alert('Mock Mode: Would approve ' + depositAmount + ' ' + finalAgentTokenSymbol);
      return;
    }

    setIsApproving(true);
    try {
      await writeContract({
        address: agentToken as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [addresses.personaFactory as `0x${string}`, parseEther(depositAmount)]
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleDeposit = async () => {
    if (!address || !depositAmount || !addresses) return;

    if (isMockMode) {
      alert('Mock Mode: Would deposit ' + depositAmount + ' ' + finalAgentTokenSymbol);
      return;
    }

    await writeContract({
      address: addresses.personaFactory as `0x${string}`,
      abi: FACTORY_ABI,
      functionName: 'depositAgentTokens',
      args: [
        BigInt(tokenId),
        parseEther(depositAmount)
      ]
    });
  };

  const handleWithdraw = async () => {
    if (!address || !addresses) return;

    if (isMockMode) {
      alert('Mock Mode: Would withdraw all deposits');
      return;
    }

    await writeContract({
      address: addresses.personaFactory as `0x${string}`,
      abi: FACTORY_ABI,
      functionName: 'withdrawAgentTokens',
      args: [BigInt(tokenId)]
    });
  };

  const handleClaimRewards = async () => {
    if (!address || !addresses) return;

    if (isMockMode) {
      alert('Mock Mode: Would claim persona token rewards');
      return;
    }

    await writeContract({
      address: addresses.personaFactory as `0x${string}`,
      abi: FACTORY_ABI,
      functionName: 'claimAgentRewards',
      args: [BigInt(tokenId)]
    });
  };

  // Don't show component if no agent token
  if (!agentToken || agentToken === '0x0000000000000000000000000000000000000000') {
    return null;
  }

  // Wait for data to load in mock mode
  if (isMockMode && loading) {
    return (
      <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10">
        <div className="animate-pulse">
          <div className="h-6 bg-white/10 rounded w-1/3 mb-4"></div>
          <div className="h-20 bg-white/10 rounded"></div>
        </div>
      </div>
    );
  }

  // Parse persona data
  const persona: PersonaData | null = isMockMode && mockPersona ? {
    name: mockPersona.name,
    symbol: mockPersona.symbol,
    erc20Token: mockPersona.erc20Token || '0x0000000000000000000000000000000000000000',
    pairToken: mockPersona.pairToken || '0x0000000000000000000000000000000000000000',
    pairCreated: mockPersona.isGraduated,
    createdAt: BigInt(Math.floor(new Date(mockPersona.createdAt || Date.now()).getTime() / 1000)),
    minAgentTokens: BigInt(mockPersona.minAgentTokens || "0")
  } : personaTuple ? {
    name: personaTuple[0],
    symbol: personaTuple[1],
    erc20Token: personaTuple[2],
    pairToken: personaTuple[3],
    pairCreated: personaTuple[4],
    createdAt: personaTuple[5],
    minAgentTokens: personaTuple[6]
  } : null;

  if (!persona) return null;

  const isGraduated = persona.pairCreated;
  const minAgentTokens = persona.minAgentTokens;

  const activeDeposits = (isMockMode ? mockUserDeposits : userDeposits)?.filter(d => !d.withdrawn) || [];
  const totalDeposited = activeDeposits.reduce((sum, d) => sum + d.amount, BigInt(0));

  // Check if approval is needed
  const finalAllowance = currentAllowance !== undefined ? currentAllowance : mockAllowance;
  const needsApproval = depositAmount && finalAllowance !== undefined && parseEther(depositAmount) > finalAllowance;

  // Calculate progress percentage safely
  const progressPercentage = minAgentTokens > BigInt(0) 
    ? Math.min(100, (Number(totalAgentDeposited) * 100) / Number(minAgentTokens))
    : 100;

  // Get final values for display
  const finalBalance = agentTokenBalance?.value || mockBalance;
  const finalRewardCalculation = rewardCalculation || mockRewardCalculation;

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-light text-white">Agent Token Integration</h3>
        <div className="flex items-center gap-2">
          {isMockMode && (
            <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">Mock Mode</span>
          )}
          {finalAgentTokenSymbol && (
            <span className="text-sm text-purple-400 font-medium">
              {finalAgentTokenSymbol}
            </span>
          )}
        </div>
      </div>

      {/* Progress Overview */}
      <div className="mb-6 p-4 bg-white/5 rounded-xl">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-white/60">Total Deposited (All Users)</span>
          <span className="font-light text-white">{formatEther(totalAgentDeposited)} {finalAgentTokenSymbol || 'tokens'}</span>
        </div>
        
        {minAgentTokens > BigInt(0) && (
          <>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-white/60">Required for Graduation</span>
              <span className="font-light text-white">{formatEther(minAgentTokens)} {finalAgentTokenSymbol || 'tokens'}</span>
            </div>
            
            <div className="w-full bg-white/10 rounded-full h-2 mt-3">
              <div
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            
            <p className="text-xs text-white/50 mt-2">
              {progressPercentage.toFixed(1)}% complete
              {progressPercentage < 100 && (
                <span className="text-yellow-400 ml-2">⚠️ Graduation blocked until requirement met</span>
              )}
            </p>
          </>
        )}
        
        {minAgentTokens === BigInt(0) && (
          <p className="text-xs text-white/50 mt-2">
            No minimum requirement - deposits are optional but earn rewards
          </p>
        )}
      </div>

      {!isGraduated ? (
        <>
          {/* Tab Selection */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab('deposit')}
              className={`flex-1 py-2 px-4 rounded-lg transition-all ${
                activeTab === 'deposit'
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                  : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              Deposit
            </button>
            <button
              onClick={() => setActiveTab('withdraw')}
              className={`flex-1 py-2 px-4 rounded-lg transition-all ${
                activeTab === 'withdraw'
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                  : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              Withdraw
            </button>
          </div>

          {/* Deposit Tab */}
          {activeTab === 'deposit' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-light text-white/80 mb-2">Amount to Deposit</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="0.0"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="flex-1 p-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/40 focus:border-white/40 focus:outline-none transition-colors"
                  />
                  <button
                    onClick={() => setDepositAmount(formatEther(finalBalance))}
                    className="px-4 py-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors text-white/80 text-sm"
                  >
                    MAX
                  </button>
                </div>
                {finalBalance && (
                  <p className="text-xs text-white/50 mt-1">
                    Balance: {formatEther(finalBalance)} {finalAgentTokenSymbol}
                  </p>
                )}
              </div>

              <div className="p-3 bg-blue-500/10 backdrop-blur-sm rounded-xl border border-blue-500/20">
                <p className="text-sm text-white/90 mb-1">How it works:</p>
                <ul className="text-xs text-white/70 space-y-1 ml-4 list-disc">
                  <li>Deposit agent tokens to help this persona graduate</li>
                  <li>You can withdraw anytime before graduation</li>
                  <li>After graduation, claim your share of persona tokens</li>
                  <li>Your share = (your deposits / total deposits) × {formatEther(BigInt("222222223000000000000000000"))} {persona.symbol}</li>
                </ul>
              </div>

              {needsApproval ? (
                <button
                  onClick={handleApprove}
                  disabled={!address || !depositAmount || isPending || isApproving || isConfirming}
                  className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white py-3 rounded-xl hover:from-yellow-600 hover:to-orange-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all"
                >
                  {isApproving || isConfirming ? 'Approving...' : 'Approve ' + finalAgentTokenSymbol}
                </button>
              ) : (
                <button
                  onClick={handleDeposit}
                  disabled={!address || !depositAmount || isPending || parseFloat(depositAmount) <= 0 || isConfirming}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-xl hover:from-purple-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all"
                >
                  {isPending || isConfirming ? 'Depositing...' : 'Deposit ' + finalAgentTokenSymbol}
                </button>
              )}
            </div>
          )}

          {/* Withdraw Tab */}
          {activeTab === 'withdraw' && (
            <div className="space-y-4">
              {totalDeposited > BigInt(0) ? (
                <>
                  <div className="p-4 bg-white/5 rounded-xl">
                    <div className="flex justify-between mb-2">
                      <span className="text-white/60">Your Total Deposited</span>
                      <span className="font-light text-white">{formatEther(totalDeposited)} {finalAgentTokenSymbol}</span>
                    </div>
                    {finalRewardCalculation && finalRewardCalculation[0] > BigInt(0) && (
                      <div className="flex justify-between">
                        <span className="text-white/60">Expected Rewards</span>
                        <span className="font-light text-green-400">
                          ~{formatEther(finalRewardCalculation[0])} {persona.symbol}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Deposit History */}
                  <div>
                    <button
                      onClick={() => setShowDeposits(!showDeposits)}
                      className="text-sm text-purple-400 hover:text-purple-300 transition-colors mb-2"
                    >
                      {showDeposits ? 'Hide' : 'Show'} Deposit History ({activeDeposits.length})
                    </button>

                    {showDeposits && activeDeposits.length > 0 && (
                      <div className="space-y-2">
                        {activeDeposits.map((deposit, index) => (
                          <div key={index} className="text-sm p-3 bg-white/5 border border-white/10 rounded-lg">
                            <div className="flex justify-between">
                              <span className="text-white/80">{formatEther(deposit.amount)} {finalAgentTokenSymbol}</span>
                              <span className="text-white/50">
                                {new Date(Number(deposit.timestamp) * 1000).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleWithdraw}
                    disabled={isPending || isConfirming}
                    className="w-full bg-white/10 text-white py-3 rounded-xl hover:bg-white/20 disabled:bg-white/5 disabled:cursor-not-allowed transition-colors"
                  >
                    {isPending || isConfirming ? 'Withdrawing...' : 'Withdraw All Deposits'}
                  </button>

                  <p className="text-xs text-yellow-400/80 text-center">
                    ⚠️ Withdrawing forfeits your persona token rewards
                  </p>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-white/60">You have no deposits to withdraw</p>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* After graduation - claim rewards */
        <div>
          {finalRewardCalculation && finalRewardCalculation[0] > BigInt(0) ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-500/10 backdrop-blur-sm rounded-xl border border-green-500/20">
                <p className="text-sm font-light text-white mb-3">🎉 Graduation Complete!</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Your Agent Token Deposits</span>
                    <span className="text-white">{formatEther(finalRewardCalculation[1])} {finalAgentTokenSymbol}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Persona Token Rewards</span>
                    <span className="font-light text-green-400">
                      {formatEther(finalRewardCalculation[0])} {persona.symbol}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleClaimRewards}
                disabled={isPending || isConfirming}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 rounded-xl hover:from-green-600 hover:to-emerald-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all"
              >
                {isPending || isConfirming ? 'Claiming...' : 'Claim Persona Token Rewards'}
              </button>

              <p className="text-xs text-white/50 text-center">
                Your deposited agent tokens have been sent to the AMICA treasury
              </p>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-white/50">No rewards to claim</p>
              <p className="text-xs text-white/40 mt-2">
                The persona has graduated. Agent token deposits are no longer accepted.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Agent Token Info */}
      <div className="mt-4 p-3 bg-purple-500/10 backdrop-blur-sm rounded-xl text-xs border border-purple-500/20">
        <p className="font-light text-white mb-1">Agent Token Contract:</p>
        <a
          href={`https://etherscan.io/address/${agentToken}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-400 hover:text-purple-300 font-mono break-all"
        >
          {agentToken}
        </a>
      </div>

      {/* Error handling */}
      {isError && (
        <div className="mt-4 p-3 bg-red-500/10 backdrop-blur-sm rounded-xl border border-red-500/20">
          <p className="text-sm text-red-400">Transaction failed. Please try again.</p>
        </div>
      )}
    </div>
  );
}
