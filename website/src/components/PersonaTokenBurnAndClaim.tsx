// src/components/PersonaTokenBurnAndClaim.tsx
import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { getAddressesForChain, FACTORY_ABI } from '../lib/contracts';

interface PersonaTokenBurnAndClaimProps {
  chainId: string;
  tokenId: string;
  personaToken: string;
  isGraduated: boolean;
}

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
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
  }
] as const;

export default function PersonaTokenBurnAndClaim({
  chainId,
  tokenId,
  personaToken,
  isGraduated
}: PersonaTokenBurnAndClaimProps) {
  const { address } = useAccount();
  const [burnAmount, setBurnAmount] = useState('');
  const [selectedTokens, setSelectedTokens] = useState<string[]>([]);
  const [isApproving, setIsApproving] = useState(false);

  const addresses = getAddressesForChain(Number(chainId));
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // Get user's locked tokens (before graduation)
  const { data: lockedTokens, refetch: refetchLockedTokens } = useReadContract({
    address: addresses?.personaFactory as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: 'userPurchases',
    args: [BigInt(tokenId), address!],
    query: {
      enabled: !!address && !!addresses && !isGraduated
    }
  }) as { data: bigint | undefined, refetch: () => void };

  // Get user's actual token balance
  const { data: tokenBalance, refetch: refetchTokenBalance } = useReadContract({
    address: personaToken as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!personaToken && isGraduated
    }
  }) as { data: bigint | undefined, refetch: () => void };

  // Get total supply
  const { data: totalSupply } = useReadContract({
    address: personaToken as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'totalSupply',
    query: {
      enabled: !!personaToken && isGraduated
    }
  }) as { data: bigint | undefined };

  // Get allowance for burn
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: personaToken as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && personaToken ? [address, personaToken as `0x${string}`] : undefined,
    query: {
      enabled: !!address && !!personaToken && isGraduated
    }
  }) as { data: bigint | undefined, refetch: () => void };

  // Reset on success
  useEffect(() => {
    if (isSuccess) {
      setBurnAmount('');
      setSelectedTokens([]);
      refetchTokenBalance();
      refetchLockedTokens();
      refetchAllowance();
    }
  }, [isSuccess, refetchTokenBalance, refetchLockedTokens, refetchAllowance]);

  const handleWithdraw = async () => {
    if (!address || !addresses) return;

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

  const handleApprove = async () => {
    if (!address || !personaToken) return;

    setIsApproving(true);
    try {
      await writeContract({
        address: personaToken as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [personaToken as `0x${string}`, parseEther('1000000000')]
      });
    } catch (error) {
      console.error('Approval error:', error);
    } finally {
      setIsApproving(false);
    }
  };

  const handleBurn = async () => {
    if (!address || !personaToken || !burnAmount || parseFloat(burnAmount) <= 0) return;

    // For now, we'll just burn for the pairing token
    // In a full implementation, you'd want a token selector like BurnAndClaim
    try {
      await writeContract({
        address: personaToken as `0x${string}`,
        abi: [{
          name: 'burnAndClaim',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'amountToBurn', type: 'uint256' },
            { name: 'tokens', type: 'address[]' }
          ],
          outputs: []
        }],
        functionName: 'burnAndClaim',
        args: [parseEther(burnAmount), selectedTokens as `0x${string}`[]]
      });
    } catch (error) {
      console.error('Burn error:', error);
    }
  };

  const userBalance = isGraduated ? (tokenBalance || BigInt(0)) : (lockedTokens || BigInt(0));
  const needsApproval = allowance !== undefined && burnAmount && parseFloat(burnAmount) > 0 &&
    parseEther(burnAmount) > allowance;

  if (!address) {
    return null;
  }

  return (
    <div className="bg-card backdrop-blur-md rounded-2xl p-4 border border-border">
      <h2 className="text-xl font-semibold text-foreground mb-4">Your Tokens</h2>

      {/* Token Holdings */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-muted rounded-lg p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Your Balance</p>
          <p className="text-lg font-semibold text-foreground">
            {formatEther(userBalance)}
          </p>
          {!isGraduated && userBalance > BigInt(0) && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">Locked until graduation</p>
          )}
          {isGraduated && lockedTokens && lockedTokens > BigInt(0) && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
              {formatEther(lockedTokens)} unclaimed
            </p>
          )}
        </div>

        {isGraduated && totalSupply && (
          <div className="bg-muted rounded-lg p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Total Supply</p>
            <p className="text-lg font-semibold text-foreground">
              {formatEther(totalSupply)}
            </p>
          </div>
        )}
      </div>

      {/* Different states */}
      {!isGraduated && userBalance > BigInt(0) && (
        <div className="p-4 bg-blue-500/10 backdrop-blur-sm rounded-lg border border-blue-500/20">
          <p className="text-sm text-blue-400">
            ℹ️ Your tokens are locked until this persona graduates. Once graduated, you can claim them to your wallet.
          </p>
        </div>
      )}

      {isGraduated && lockedTokens && lockedTokens > BigInt(0) && (
        <div className="space-y-3">
          <div className="p-4 bg-yellow-500/10 backdrop-blur-sm rounded-lg border border-yellow-500/20">
            <p className="text-sm text-yellow-400 mb-2">
              ⚠️ You have {formatEther(lockedTokens)} unclaimed tokens from purchases.
            </p>
            <p className="text-xs text-yellow-300">
              Withdraw them to your wallet to be able to burn them for underlying assets.
            </p>
          </div>
          <button
            onClick={handleWithdraw}
            disabled={isPending || isConfirming}
            className="w-full bg-brand-blue text-white py-3 rounded-xl hover:bg-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium cursor-pointer"
          >
            {isPending || isConfirming ? 'Withdrawing...' : 'Withdraw Tokens'}
          </button>
        </div>
      )}

      {isGraduated && tokenBalance && tokenBalance > BigInt(0) && (!lockedTokens || lockedTokens === BigInt(0)) && (
        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg border border-border">
            <label className="block text-sm font-medium text-foreground mb-2">
              Amount to Burn
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={burnAmount}
                onChange={(e) => setBurnAmount(e.target.value)}
                placeholder="0.0"
                className="flex-1 px-3 py-2 bg-background text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue"
              />
              <button
                onClick={() => setBurnAmount(formatEther(tokenBalance))}
                className="px-3 py-1.5 bg-brand-blue text-white rounded-full hover:bg-blue-500 transition-colors text-xs font-medium cursor-pointer"
              >
                MAX
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Balance: {formatEther(tokenBalance)}
            </p>
          </div>

          <div className="p-4 bg-blue-500/10 backdrop-blur-sm rounded-lg border border-blue-500/20">
            <p className="text-sm text-blue-400">
              ℹ️ Burning tokens will give you a proportional share of the assets held by this token contract.
            </p>
          </div>

          {needsApproval ? (
            <button
              onClick={handleApprove}
              disabled={isApproving || isPending || isConfirming}
              className="w-full bg-orange-600 text-white py-3 rounded-xl hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium cursor-pointer"
            >
              {isApproving || isPending || isConfirming ? 'Approving...' : 'Approve Tokens'}
            </button>
          ) : (
            <button
              onClick={handleBurn}
              disabled={!burnAmount || parseFloat(burnAmount) <= 0 || isPending || isConfirming}
              className="w-full bg-red-600 text-white py-3 rounded-xl hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium cursor-pointer"
            >
              {isPending || isConfirming ? 'Burning...' : 'Burn & Claim Assets'}
            </button>
          )}
        </div>
      )}

      {isSuccess && (
        <div className="mt-4 p-3 bg-green-500/10 backdrop-blur-sm rounded-lg border border-green-500/20">
          <p className="text-sm text-green-400">
            ✅ Transaction successful!
          </p>
        </div>
      )}
    </div>
  );
}
