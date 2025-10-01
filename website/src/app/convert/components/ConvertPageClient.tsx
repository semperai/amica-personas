'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import Layout from '@/components/Layout';
import { getAddressesForChain } from '@/lib/contracts';
import Link from 'next/link';

const AIUS_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
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

const CONVERTER_ABI = [
  {
    name: 'convertAiusToAmica',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: []
  },
  {
    name: 'conversionRate',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  }
] as const;

export default function ConvertPageClient() {
  const { address, chainId } = useAccount();
  const [amount, setAmount] = useState('');
  const [isApproving, setIsApproving] = useState(false);

  const addresses = chainId ? getAddressesForChain(chainId) : null;
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // Mock addresses - replace with actual contract addresses
  const aiusTokenAddress = '0x0000000000000000000000000000000000000000'; // TODO: Add real AIUS address
  const converterAddress = '0x0000000000000000000000000000000000000000'; // TODO: Add real converter address

  // Get AIUS balance
  const { data: aiusBalance, refetch: refetchBalance } = useReadContract({
    address: aiusTokenAddress as `0x${string}`,
    abi: AIUS_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && aiusTokenAddress !== '0x0000000000000000000000000000000000000000'
    }
  }) as { data: bigint | undefined, refetch: () => void };

  // Get allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: aiusTokenAddress as `0x${string}`,
    abi: AIUS_ABI,
    functionName: 'allowance',
    args: address ? [address, converterAddress as `0x${string}`] : undefined,
    query: {
      enabled: !!address && aiusTokenAddress !== '0x0000000000000000000000000000000000000000'
    }
  }) as { data: bigint | undefined, refetch: () => void };

  // Get conversion rate
  const { data: conversionRate } = useReadContract({
    address: converterAddress as `0x${string}`,
    abi: CONVERTER_ABI,
    functionName: 'conversionRate',
    query: {
      enabled: converterAddress !== '0x0000000000000000000000000000000000000000'
    }
  }) as { data: bigint | undefined };

  const needsApproval = allowance !== undefined && amount && parseFloat(amount) > 0 &&
    parseEther(amount) > allowance;

  const amicaReceived = amount && conversionRate
    ? (parseEther(amount) * conversionRate) / BigInt(10 ** 18)
    : BigInt(0);

  // Reset on success
  useEffect(() => {
    if (isSuccess) {
      setAmount('');
      refetchBalance();
      refetchAllowance();
    }
  }, [isSuccess, refetchBalance, refetchAllowance]);

  const handleApprove = async () => {
    if (!address || aiusTokenAddress === '0x0000000000000000000000000000000000000000') return;

    setIsApproving(true);
    try {
      await writeContract({
        address: aiusTokenAddress as `0x${string}`,
        abi: AIUS_ABI,
        functionName: 'approve',
        args: [converterAddress as `0x${string}`, parseEther('1000000000')]
      });
    } catch (error) {
      console.error('Approval error:', error);
    } finally {
      setIsApproving(false);
    }
  };

  const handleConvert = async () => {
    if (!address || !amount || parseFloat(amount) <= 0 || converterAddress === '0x0000000000000000000000000000000000000000') return;

    try {
      await writeContract({
        address: converterAddress as `0x${string}`,
        abi: CONVERTER_ABI,
        functionName: 'convertAiusToAmica',
        args: [parseEther(amount)]
      });
    } catch (error) {
      console.error('Conversion error:', error);
    }
  };

  const handleMax = () => {
    if (aiusBalance) {
      setAmount(formatEther(aiusBalance));
    }
  };

  if (!address) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-6 py-12">
          <div className="bg-card backdrop-blur-md rounded-2xl p-8 border border-border text-center">
            <h2 className="text-2xl font-semibold text-foreground mb-4">Connect Your Wallet</h2>
            <p className="text-muted-foreground">
              Please connect your wallet to convert AIUS to AMICA.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  if (aiusTokenAddress === '0x0000000000000000000000000000000000000000' || converterAddress === '0x0000000000000000000000000000000000000000') {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-6 py-12">
          <div className="bg-card backdrop-blur-md rounded-2xl p-8 border border-border text-center">
            <h2 className="text-2xl font-semibold text-foreground mb-4">Coming Soon</h2>
            <p className="text-muted-foreground mb-6">
              The AIUS to AMICA converter is not yet deployed on this network.
            </p>
            <Link
              href="/docs/aius-conversion"
              className="inline-block bg-brand-blue text-white px-6 py-3 rounded-xl hover:bg-blue-500 transition-colors"
            >
              Learn More
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-semibold text-foreground mb-2">AIUS to AMICA Converter</h1>
        <p className="text-muted-foreground mb-8">
          Convert your AIUS tokens to AMICA and join the Amica ecosystem
        </p>

        <div className="bg-card backdrop-blur-md rounded-2xl p-6 border border-border space-y-6">
          {/* Balance Display */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Your AIUS Balance</span>
            <span className="text-lg font-semibold text-foreground">
              {aiusBalance ? formatEther(aiusBalance) : '0'} AIUS
            </span>
          </div>

          {/* Conversion Rate */}
          {conversionRate && (
            <div className="p-4 bg-muted rounded-lg border border-border">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Conversion Rate</span>
                <span className="text-sm font-medium text-foreground">
                  1 AIUS = {formatEther(conversionRate)} AMICA
                </span>
              </div>
            </div>
          )}

          {/* Input Amount */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Amount to Convert
            </label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                className="w-full px-4 py-3 bg-background text-foreground border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-blue"
              />
              <button
                onClick={handleMax}
                className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-brand-blue text-white rounded-full hover:bg-blue-500 transition-colors text-xs font-medium cursor-pointer"
              >
                MAX
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Balance: {aiusBalance ? formatEther(aiusBalance) : '0'} AIUS
            </p>
          </div>

          {/* You Will Receive */}
          {amount && parseFloat(amount) > 0 && (
            <div className="p-4 bg-brand-blue/10 backdrop-blur-sm rounded-lg border border-brand-blue/20">
              <div className="flex justify-between items-center">
                <span className="text-sm text-foreground">You Will Receive</span>
                <span className="text-xl font-semibold text-brand-blue">
                  {formatEther(amicaReceived)} AMICA
                </span>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="p-4 bg-blue-500/10 backdrop-blur-sm rounded-lg border border-blue-500/20">
            <p className="text-sm text-blue-400">
              ℹ️ Your AIUS will be added to the AMICA treasury, increasing the backing value for all AMICA holders.
            </p>
          </div>

          {/* Action Button */}
          {needsApproval ? (
            <button
              onClick={handleApprove}
              disabled={isApproving || isPending || isConfirming}
              className="w-full bg-orange-600 text-white py-4 rounded-xl hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-lg cursor-pointer"
            >
              {isApproving || isPending || isConfirming ? 'Approving...' : 'Approve AIUS'}
            </button>
          ) : (
            <button
              onClick={handleConvert}
              disabled={!amount || parseFloat(amount) <= 0 || isPending || isConfirming}
              className="w-full bg-brand-blue text-white py-4 rounded-xl hover:bg-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium text-lg cursor-pointer"
            >
              {isPending || isConfirming ? 'Converting...' : 'Convert to AMICA'}
            </button>
          )}

          {/* Success Message */}
          {isSuccess && (
            <div className="p-4 bg-green-500/10 backdrop-blur-sm rounded-lg border border-green-500/20">
              <p className="text-sm text-green-400 text-center">
                ✅ Successfully converted {amount} AIUS to {formatEther(amicaReceived)} AMICA!
              </p>
            </div>
          )}
        </div>

        {/* Learn More */}
        <div className="mt-6 text-center">
          <Link
            href="/docs/aius-conversion"
            className="text-sm text-brand-blue hover:text-brand-cyan"
          >
            Learn more about AIUS to AMICA conversion →
          </Link>
        </div>
      </div>
    </Layout>
  );
}
