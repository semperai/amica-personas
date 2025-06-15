// src/components/AgentDeposits.tsx
import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { parseEther, formatEther } from 'viem';
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
  amount: bigint;
  timestamp: bigint;
  withdrawn: boolean;
}

export default function AgentDeposits({ chainId, tokenId }: AgentDepositsProps) {
  const { address } = useAccount();
  const [depositAmount, setDepositAmount] = useState('');
  const [showDeposits, setShowDeposits] = useState(false);

  const addresses = getAddressesForChain(Number(chainId));
  const { writeContract, isPending } = useWriteContract();

  // Get persona details - the function returns a tuple
  const { data: personaTuple } = useReadContract({
    address: addresses?.factory as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: 'getPersona',
    args: [BigInt(tokenId)],
    query: {
      enabled: !!addresses
    }
  }) as { data: readonly [string, string, `0x${string}`, `0x${string}`, boolean, bigint, bigint] | undefined };

  // Get the full persona struct to access agentToken
  const { data: personaStruct } = useReadContract({
    address: addresses?.factory as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: 'personas',
    args: [BigInt(tokenId)],
    query: {
      enabled: !!addresses
    }
  }) as { data: { agentToken: `0x${string}`, totalAgentDeposited: bigint } | undefined };

  // Get user's agent deposits
  const { data: userDeposits } = useReadContract({
    address: addresses?.factory as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: 'getUserAgentDeposits',
    args: address ? [BigInt(tokenId), address] : undefined,
    query: {
      enabled: !!address && !!addresses
    }
  }) as { data: AgentDeposit[] | undefined };

  // Calculate expected rewards
  const { data: rewardCalculation } = useReadContract({
    address: addresses?.factory as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: 'calculateAgentRewards',
    args: address ? [BigInt(tokenId), address] : undefined,
    query: {
      enabled: !!address && !!addresses
    }
  }) as { data: readonly [bigint, bigint] | undefined };

  const handleDeposit = async () => {
    if (!address || !depositAmount || !addresses) return;

    await writeContract({
      address: addresses.factory as `0x${string}`,
      abi: FACTORY_ABI,
      functionName: 'depositAgentTokens',
      args: [
        BigInt(tokenId),
        parseEther(depositAmount)
      ]
    });

    setDepositAmount('');
  };

  const handleWithdraw = async () => {
    if (!address || !addresses) return;

    await writeContract({
      address: addresses.factory as `0x${string}`,
      abi: FACTORY_ABI,
      functionName: 'withdrawAgentTokens',
      args: [BigInt(tokenId)]
    });
  };

  const handleClaimRewards = async () => {
    if (!address || !addresses) return;

    await writeContract({
      address: addresses.factory as `0x${string}`,
      abi: FACTORY_ABI,
      functionName: 'claimAgentRewards',
      args: [BigInt(tokenId)]
    });
  };

  // Don't show component if no agent token
  if (!personaStruct || !personaStruct.agentToken || personaStruct.agentToken === '0x0000000000000000000000000000000000000000') {
    return null;
  }

  // Parse persona data
  const persona: PersonaData | null = personaTuple ? {
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
  const agentToken = personaStruct.agentToken;
  const minAgentTokens = persona.minAgentTokens;
  const totalAgentDeposited = personaStruct.totalAgentDeposited || BigInt(0);

  const activeDeposits = userDeposits?.filter(d => !d.withdrawn) || [];
  const totalDeposited = activeDeposits.reduce((sum, d) => sum + d.amount, BigInt(0));

  return (
    <div className="bg-white rounded-lg shadow p-6 mt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Agent Token Deposits</h3>
        <span className="text-sm text-gray-500">
          Min Required: {formatEther(minAgentTokens)} tokens
        </span>
      </div>

      <div className="mb-4 p-3 bg-gray-50 rounded">
        <div className="flex justify-between text-sm">
          <span>Total Deposited (All Users):</span>
          <span className="font-medium">{formatEther(totalAgentDeposited)} tokens</span>
        </div>
        {minAgentTokens > BigInt(0) && (
          <div className="flex justify-between text-sm mt-1">
            <span>Progress to Requirement:</span>
            <span className="font-medium">
              {((Number(totalAgentDeposited) / Number(minAgentTokens)) * 100).toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      {!isGraduated ? (
        <>
          {/* Deposit Form */}
          <div className="mb-6">
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Amount to deposit"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="flex-1 p-2 border rounded"
              />
              <button
                onClick={handleDeposit}
                disabled={!address || !depositAmount || isPending}
                className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:bg-gray-400"
              >
                Deposit
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Deposit agent tokens to help this persona graduate. You&apos;ll receive persona tokens after graduation.
            </p>
          </div>

          {/* User's deposits */}
          {address && totalDeposited > BigInt(0) && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Your Deposits</span>
                <button
                  onClick={() => setShowDeposits(!showDeposits)}
                  className="text-sm text-purple-600 hover:text-purple-700"
                >
                  {showDeposits ? 'Hide' : 'Show'} Details
                </button>
              </div>

              <div className="p-3 bg-gray-50 rounded">
                <div className="flex justify-between">
                  <span>Your Total Deposited:</span>
                  <span className="font-medium">{formatEther(totalDeposited)} tokens</span>
                </div>

                {rewardCalculation && rewardCalculation[0] > BigInt(0) && (
                  <div className="flex justify-between mt-1">
                    <span>Expected Persona Tokens:</span>
                    <span className="font-medium text-green-600">
                      ~{formatEther(rewardCalculation[0])} tokens
                    </span>
                  </div>
                )}
              </div>

              {showDeposits && activeDeposits.length > 0 && (
                <div className="mt-3 space-y-2">
                  {activeDeposits.map((deposit, index) => (
                    <div key={index} className="text-sm p-2 bg-white border rounded">
                      <div className="flex justify-between">
                        <span>{formatEther(deposit.amount)} tokens</span>
                        <span className="text-gray-500">
                          {new Date(Number(deposit.timestamp) * 1000).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={handleWithdraw}
                disabled={isPending}
                className="mt-3 w-full bg-gray-200 text-gray-700 py-2 rounded hover:bg-gray-300"
              >
                Withdraw All Deposits
              </button>
            </div>
          )}
        </>
      ) : (
        /* After graduation - claim rewards */
        <div>
          {rewardCalculation && rewardCalculation[0] > BigInt(0) ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 rounded">
                <p className="text-sm font-medium mb-2">Rewards Available!</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Agent Tokens Deposited:</span>
                    <span>{formatEther(rewardCalculation[1])} tokens</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Persona Token Rewards:</span>
                    <span className="font-medium text-green-600">
                      {formatEther(rewardCalculation[0])} tokens
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleClaimRewards}
                disabled={isPending}
                className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
              >
                Claim Rewards
              </button>
            </div>
          ) : (
            <p className="text-gray-500 text-center">
              No rewards to claim. The persona has graduated.
            </p>
          )}
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-50 rounded text-xs">
        <p className="font-medium mb-1">Agent Token Info:</p>
        <a
          href={`https://etherscan.io/address/${agentToken}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-700 font-mono break-all"
        >
          {agentToken}
        </a>
      </div>
    </div>
  );
}
