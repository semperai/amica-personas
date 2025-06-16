import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useBalance } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { FACTORY_ABI, AMICA_ABI, getAddressesForChain } from '../lib/contracts';

interface ClaimableToken {
  address: string;
  symbol: string;
  name: string;
  amount: bigint;
  valueUSD: number;
}

export function BurnAndClaim() {
  const { address, chainId } = useAccount();
  const [burnAmount, setBurnAmount] = useState('');
  const [claimableTokens, setClaimableTokens] = useState<ClaimableToken[]>([]);
  const [totalValueUSD, setTotalValueUSD] = useState(0);

  const addresses = chainId ? getAddressesForChain(chainId) : null;
  const { writeContract, isPending } = useWriteContract();

  // Get AMICA balance
  const { data: amicaBalance } = useBalance({
    address: address,
    token: addresses?.amicaToken as `0x${string}`,
  });

  // Get total AMICA supply for calculations
  const { data: totalSupply } = useReadContract({
    address: addresses?.amicaToken as `0x${string}`,
    abi: AMICA_ABI,
    functionName: 'totalSupply',
    query: {
      enabled: !!addresses
    }
  }) as { data: bigint | undefined };

  // Mock calculation of claimable tokens - in reality this would fetch actual balances
  useEffect(() => {
    if (burnAmount && totalSupply && parseFloat(burnAmount) > 0) {
      const burnAmountBigInt = parseEther(burnAmount);
      const sharePercentage = (burnAmountBigInt * BigInt(10000)) / totalSupply; // basis points

      // Mock tokens that can be claimed - replace with actual contract reads
      const mockClaimableTokens: ClaimableToken[] = [
        {
          address: '0x1234567890123456789012345678901234567890',
          symbol: 'WETH',
          name: 'Wrapped Ether',
          amount: (BigInt('50000000000000000000') * sharePercentage) / BigInt(10000), // Mock balance
          valueUSD: 2500.00 // Mock price
        },
        {
          address: '0x2345678901234567890123456789012345678901',
          symbol: 'USDC',
          name: 'USD Coin',
          amount: (BigInt('100000000000') * sharePercentage) / BigInt(10000), // Mock balance (6 decimals)
          valueUSD: 1.00
        },
        {
          address: '0x3456789012345678901234567890123456789012',
          symbol: 'SAGE',
          name: 'CryptoSage AI',
          amount: (BigInt('25000000000000000000000') * sharePercentage) / BigInt(10000), // Mock balance
          valueUSD: 0.15
        }
      ];

      setClaimableTokens(mockClaimableTokens);

      // Calculate total USD value
      let total = 0;
      mockClaimableTokens.forEach(token => {
        const tokenAmount = Number(formatEther(token.amount));
        total += tokenAmount * token.valueUSD;
      });
      setTotalValueUSD(total);
    } else {
      setClaimableTokens([]);
      setTotalValueUSD(0);
    }
  }, [burnAmount, totalSupply]);

  const handleBurnAndClaim = async () => {
    if (!addresses || !burnAmount || parseFloat(burnAmount) <= 0) return;

    try {
      await writeContract({
        address: addresses.personaFactory as `0x${string}`,
        abi: FACTORY_ABI,
        functionName: 'burnAndClaim',
        args: [parseEther(burnAmount)]
      });

      setBurnAmount('');
    } catch (error) {
      console.error('Error burning and claiming:', error);
    }
  };

  const sharePercentage = burnAmount && totalSupply && parseFloat(burnAmount) > 0
    ? ((parseEther(burnAmount) * BigInt(10000)) / totalSupply) / BigInt(100)
    : BigInt(0);

  return (
    <div>
      <h2 className="text-2xl font-light text-white mb-6">Burn & Claim Treasury</h2>

      {/* AMICA Balance Display */}
      <div className="mb-6 p-4 bg-white/5 backdrop-blur-sm rounded-xl">
        <div className="flex justify-between items-center">
          <span className="text-sm text-white/60">Your AMICA Balance</span>
          <span className="text-xl font-light text-white">
            {amicaBalance ? formatEther(amicaBalance.value) : '0'} AMICA
          </span>
        </div>
      </div>

      {/* Burn Amount Input */}
      <div className="mb-6">
        <label className="block text-sm font-light text-white/80 mb-3">Amount to Burn</label>
        <div className="relative">
          <input
            type="number"
            value={burnAmount}
            onChange={(e) => setBurnAmount(e.target.value)}
            placeholder="0.0"
            className="w-full p-4 pr-20 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/40 focus:border-white/40 focus:outline-none transition-colors text-lg"
          />
          <button
            onClick={() => setBurnAmount(amicaBalance ? formatEther(amicaBalance.value) : '0')}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 px-4 py-2 text-sm bg-white/10 rounded-lg hover:bg-white/20 transition-colors text-white/80"
          >
            MAX
          </button>
        </div>
        {burnAmount && parseFloat(burnAmount) > 0 && (
          <p className="text-sm text-white/50 mt-2">
            You will burn {sharePercentage.toString()}% of the total supply
          </p>
        )}
      </div>

      {/* Claimable Tokens Preview */}
      {claimableTokens.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-light text-white/80 mb-3">You Will Receive</h3>
          <div className="space-y-2">
            {claimableTokens.map((token, index) => (
              <div
                key={index}
                className="p-4 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-light text-white">{token.symbol}</p>
                    <p className="text-sm text-white/50">{token.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-light text-white">
                      {formatEther(token.amount)}
                    </p>
                    <p className="text-sm text-white/50">
                      ≈ ${(Number(formatEther(token.amount)) * token.valueUSD).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {/* Total Value */}
            <div className="p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 backdrop-blur-sm rounded-xl border border-purple-500/20 mt-4">
              <div className="flex justify-between items-center">
                <span className="text-white/80">Total Value</span>
                <span className="text-xl font-light text-white">
                  ≈ ${totalValueUSD.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={handleBurnAndClaim}
        disabled={!address || isPending || !burnAmount || parseFloat(burnAmount) <= 0}
        className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 rounded-xl hover:from-orange-600 hover:to-red-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all duration-300 font-light text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
      >
        {isPending ? 'Processing...' : 'Burn AMICA & Claim Treasury'}
      </button>

      {/* Warning */}
      <div className="mt-4 p-4 bg-yellow-500/10 backdrop-blur-sm rounded-xl border border-yellow-500/20">
        <p className="text-sm text-yellow-400/90">
          ⚠️ Warning: Burning AMICA is irreversible. You will receive a proportional share of all tokens in the treasury.
        </p>
      </div>
    </div>
  );
}
