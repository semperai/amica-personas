// src/components/AgentDeposits.tsx
import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useBalance, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther, parseUnits } from 'viem';
import { useQuery, gql } from '@apollo/client';
import { FACTORY_ABI, getAddressesForChain } from '../lib/contracts';

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
  id: string;
  amount: string;
  timestamp: string;
  withdrawn: boolean;
  txHash: string;
}

// GraphQL query for agent deposits
const GET_AGENT_DEPOSITS = gql`
  query GetAgentDeposits($personaId: String!, $user: String!) {
    persona(id: $personaId) {
      id
      name
      symbol
      agentToken
      minAgentTokens
      totalAgentDeposited
      pairCreated
      agentDeposits(where: { user_eq: $user }) {
        id
        amount
        timestamp
        withdrawn
        txHash
      }
    }
    allDeposits: agentDeposits(where: { persona: { id_eq: $personaId } }) {
      id
      user
      amount
    }
  }
`;

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
  
  const addresses = getAddressesForChain(Number(chainId));
  const { writeContract, data: hash, isPending, isError } = useWriteContract();
  const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';
  const personaId = `${chainId}-${tokenId}`;
  
  // Wait for transaction confirmations
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Query GraphQL for agent deposits
  const { data: graphqlData, loading: graphqlLoading, refetch: refetchDeposits } = useQuery(GET_AGENT_DEPOSITS, {
    variables: { 
      personaId,
      user: address?.toLowerCase() || ''
    },
    skip: !address || !chainId || !tokenId,
    fetchPolicy: 'cache-and-network',
  });

  // Get persona details from contract (for real-time data)
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

  // Get GraphQL or on-chain data
  const agentToken = graphqlData?.persona?.agentToken || personaStruct?.agentToken;
  const totalAgentDeposited = graphqlData?.persona?.totalAgentDeposited 
    ? BigInt(graphqlData.persona.totalAgentDeposited)
    : (personaStruct?.totalAgentDeposited || BigInt(0));

  // Get agent token symbol
  const { data: agentTokenSymbol } = useReadContract({
    address: agentToken as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'symbol',
    query: {
      enabled: !!agentToken && agentToken !== '0x0000000000000000000000000000000000000000' && !isMockMode
    }
  }) as { data: string | undefined };

  // Get agent token decimals
  const { data: agentTokenDecimals } = useReadContract({
    address: agentToken as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: {
      enabled: !!agentToken && agentToken !== '0x0000000000000000000000000000000000000000' && !isMockMode
    }
  }) as { data: number | undefined };

  // Get user's agent token balance
  const { data: agentTokenBalance, refetch: refetchBalance } = useBalance({
    address: address,
    token: agentToken as `0x${string}`,
    query: {
      enabled: !!address && !!agentToken && agentToken !== '0x0000000000000000000000000000000000000000' && !isMockMode
    }
  });

  // Get current allowance
  const { data: currentAllowance } = useReadContract({
    address: agentToken as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && addresses ? [address, addresses.personaFactory as `0x${string}`] : undefined,
    query: {
      enabled: !!address && !!addresses && !!agentToken && agentToken !== '0x0000000000000000000000000000000000000000' && !isMockMode
    }
  }) as { data: bigint | undefined };

  // Refetch data after successful transaction
  useEffect(() => {
    if (isSuccess && !isMockMode) {
      refetchDeposits();
      refetchBalance();
      setDepositAmount('');
    }
  }, [isSuccess, isMockMode, refetchDeposits, refetchBalance]);

  const handleApprove = async () => {
    if (!address || !addresses || !agentToken || !depositAmount || !agentTokenDecimals) return;

    if (isMockMode) {
      alert('Mock Mode: Would approve ' + depositAmount + ' ' + agentTokenSymbol);
      return;
    }

    setIsApproving(true);
    try {
      await writeContract({
        address: agentToken as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [addresses.personaFactory as `0x${string}`, parseUnits(depositAmount, agentTokenDecimals)]
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleDeposit = async () => {
    if (!address || !depositAmount || !addresses || !agentTokenDecimals) return;

    if (isMockMode) {
      alert('Mock Mode: Would deposit ' + depositAmount + ' ' + agentTokenSymbol);
      return;
    }

    await writeContract({
      address: addresses.personaFactory as `0x${string}`,
      abi: FACTORY_ABI,
      functionName: 'depositAgentTokens',
      args: [
        BigInt(tokenId),
        parseUnits(depositAmount, agentTokenDecimals)
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

  // Wait for data to load
  if (graphqlLoading) {
    return (
      <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10">
        <div className="animate-pulse">
          <div className="h-6 bg-white/10 rounded w-1/3 mb-4"></div>
          <div className="h-20 bg-white/10 rounded"></div>
        </div>
      </div>
    );
  }

  const persona = graphqlData?.persona;
  if (!persona) return null;

  const isGraduated = persona.pairCreated;
  const minAgentTokens = BigInt(persona.minAgentTokens || 0);
  
  // Get user's deposits from GraphQL
  const userDeposits = persona.agentDeposits || [];
  const activeDeposits = userDeposits.filter((d: AgentDeposit) => !d.withdrawn);
  const totalDeposited = activeDeposits.reduce((sum: bigint, d: AgentDeposit) => sum + BigInt(d.amount), BigInt(0));

  // Format token amounts based on decimals
  const formatTokenAmount = (amount: bigint | string) => {
    const amountBigInt = typeof amount === 'string' ? BigInt(amount) : amount;
    return agentTokenDecimals ? formatUnits(amountBigInt, agentTokenDecimals) : formatEther(amountBigInt);
  };

  // Check if approval is needed
  const depositAmountWei = depositAmount && agentTokenDecimals 
    ? parseUnits(depositAmount, agentTokenDecimals) 
    : BigInt(0);
  const needsApproval = depositAmount && currentAllowance !== undefined && depositAmountWei > currentAllowance;

  // Calculate progress percentage safely
  const progressPercentage = minAgentTokens > BigInt(0) 
    ? Math.min(100, (Number(totalAgentDeposited) * 100) / Number(minAgentTokens))
    : 100;

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-light text-white">Agent Token Integration</h3>
        <div className="flex items-center gap-2">
          {isMockMode && (
            <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">Mock Mode</span>
          )}
          {agentTokenSymbol && (
            <span className="text-sm text-purple-400 font-medium">
              {agentTokenSymbol}
            </span>
          )}
        </div>
      </div>

      {/* Progress Overview */}
      <div className="mb-6 p-4 bg-white/5 rounded-xl">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-white/60">Total Deposited (All Users)</span>
          <span className="font-light text-white">{formatTokenAmount(totalAgentDeposited)} {agentTokenSymbol || 'tokens'}</span>
        </div>
        
        {minAgentTokens > BigInt(0) && (
          <>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-white/60">Required for Graduation</span>
              <span className="font-light text-white">{formatTokenAmount(minAgentTokens)} {agentTokenSymbol || 'tokens'}</span>
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
                    onClick={() => setDepositAmount(agentTokenBalance ? formatTokenAmount(agentTokenBalance.value) : '0')}
                    className="px-4 py-3 bg-white/10 rounded-xl hover:bg-white/20 transition-colors text-white/80 text-sm"
                  >
                    MAX
                  </button>
                </div>
                {agentTokenBalance && (
                  <p className="text-xs text-white/50 mt-1">
                    Balance: {formatTokenAmount(agentTokenBalance.value)} {agentTokenSymbol}
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
                  {isApproving || isConfirming ? 'Approving...' : 'Approve ' + agentTokenSymbol}
                </button>
              ) : (
                <button
                  onClick={handleDeposit}
                  disabled={!address || !depositAmount || isPending || parseFloat(depositAmount) <= 0 || isConfirming}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-xl hover:from-purple-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all"
                >
                  {isPending || isConfirming ? 'Depositing...' : 'Deposit ' + agentTokenSymbol}
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
                      <span className="font-light text-white">{formatTokenAmount(totalDeposited)} {agentTokenSymbol}</span>
                    </div>
                    {rewardCalculation && rewardCalculation[0] > BigInt(0) && (
                      <div className="flex justify-between">
                        <span className="text-white/60">Expected Rewards</span>
                        <span className="font-light text-green-400">
                          ~{formatEther(rewardCalculation[0])} {persona.symbol}
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
                        {activeDeposits.map((deposit: AgentDeposit) => (
                          <div key={deposit.id} className="text-sm p-3 bg-white/5 border border-white/10 rounded-lg">
                            <div className="flex justify-between">
                              <span className="text-white/80">{formatTokenAmount(deposit.amount)} {agentTokenSymbol}</span>
                              <span className="text-white/50">
                                {new Date(deposit.timestamp).toLocaleDateString()}
                              </span>
                            </div>
                            <a
                              href={`https://etherscan.io/tx/${deposit.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-purple-400 hover:text-purple-300"
                            >
                              {deposit.txHash.slice(0, 10)}...
                            </a>
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
          {rewardCalculation && rewardCalculation[0] > BigInt(0) ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-500/10 backdrop-blur-sm rounded-xl border border-green-500/20">
                <p className="text-sm font-light text-white mb-3">🎉 Graduation Complete!</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Your Agent Token Deposits</span>
                    <span className="text-white">{formatTokenAmount(rewardCalculation[1])} {agentTokenSymbol}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Persona Token Rewards</span>
                    <span className="font-light text-green-400">
                      {formatEther(rewardCalculation[0])} {persona.symbol}
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
