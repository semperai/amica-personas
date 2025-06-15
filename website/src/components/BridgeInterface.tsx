// src/components/BridgeInterface.tsx
import { useState } from 'react';
import { useAccount, useReadContract, useWriteContract, useBalance } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { BRIDGE_WRAPPER_ABI, AMICA_ABI, getAddressesForChain, hasBridgeWrapper } from '../lib/contracts';

export default function BridgeInterface() {
  const { address, chainId } = useAccount();
  const [amount, setAmount] = useState('');
  const [isWrapping, setIsWrapping] = useState(true);

  const addresses = chainId ? getAddressesForChain(chainId) : null;
  const hasBridge = chainId ? hasBridgeWrapper(chainId) : false;

  const { writeContract, isPending } = useWriteContract();

  // Get balances
  const { data: nativeBalance } = useBalance({
    address: address,
    token: addresses?.amica as `0x${string}`,
  });

  const { data: bridgedBalance } = useReadContract({
    address: addresses?.bridgeWrapper as `0x${string}`,
    abi: BRIDGE_WRAPPER_ABI,
    functionName: 'bridgedBalance',
    query: {
      enabled: !!addresses?.bridgeWrapper
    }
  }) as { data: bigint | undefined };

  const { data: totalBridgedIn } = useReadContract({
    address: addresses?.bridgeWrapper as `0x${string}`,
    abi: BRIDGE_WRAPPER_ABI,
    functionName: 'totalBridgedIn',
    query: {
      enabled: !!addresses?.bridgeWrapper
    }
  }) as { data: bigint | undefined };

  const { data: totalBridgedOut } = useReadContract({
    address: addresses?.bridgeWrapper as `0x${string}`,
    abi: BRIDGE_WRAPPER_ABI,
    functionName: 'totalBridgedOut',
    query: {
      enabled: !!addresses?.bridgeWrapper
    }
  }) as { data: bigint | undefined };

  const handleApprove = async () => {
    if (!addresses || !amount) return;

    const tokenToApprove = isWrapping ? addresses.amica : addresses.amica; // Bridged token address
    const spender = addresses.bridgeWrapper;

    await writeContract({
      address: tokenToApprove as `0x${string}`,
      abi: AMICA_ABI,
      functionName: 'approve',
      args: [spender as `0x${string}`, parseEther(amount)]
    });
  };

  const handleBridge = async () => {
    if (!addresses?.bridgeWrapper || !amount) return;

    if (isWrapping) {
      await writeContract({
        address: addresses.bridgeWrapper as `0x${string}`,
        abi: BRIDGE_WRAPPER_ABI,
        functionName: 'wrap',
        args: [parseEther(amount)]
      });
    } else {
      await writeContract({
        address: addresses.bridgeWrapper as `0x${string}`,
        abi: BRIDGE_WRAPPER_ABI,
        functionName: 'unwrap',
        args: [parseEther(amount)]
      });
    }

    setAmount('');
  };

  if (!hasBridge || !addresses?.bridgeWrapper) {
    return (
      <div className="bg-white/5 backdrop-blur-md rounded-2xl p-8 border border-white/10 text-center">
        <p className="text-white/60 text-lg">Bridge is not available on this chain.</p>
        <p className="text-sm text-white/40 mt-2">
          Bridge functionality is only available on L2 chains (Base, Arbitrum).
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-2xl p-8 border border-white/10">
      <h2 className="text-2xl font-light text-white mb-6">Convert Tokens</h2>

      <div className="flex gap-2 mb-6">
        <button
          className={`flex-1 px-4 py-3 rounded-xl font-light transition-all duration-300 ${
            isWrapping
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
              : 'bg-white/10 text-white/70 hover:text-white hover:bg-white/20'
          }`}
          onClick={() => setIsWrapping(true)}
        >
          Wrap (Bridged → Native)
        </button>
        <button
          className={`flex-1 px-4 py-3 rounded-xl font-light transition-all duration-300 ${
            !isWrapping
              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
              : 'bg-white/10 text-white/70 hover:text-white hover:bg-white/20'
          }`}
          onClick={() => setIsWrapping(false)}
        >
          Unwrap (Native → Bridged)
        </button>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-light text-white/80 mb-3">
          {isWrapping ? 'Bridged AMICA to wrap' : 'Native AMICA to unwrap'}
        </label>
        <input
          type="number"
          placeholder="0.0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full p-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/40 focus:border-white/40 focus:outline-none transition-colors text-lg"
        />
        {nativeBalance && (
          <p className="text-sm text-white/50 mt-2">
            Balance: {formatEther(nativeBalance.value)} AMICA
          </p>
        )}
      </div>

      <div className="mb-8 p-6 bg-white/5 backdrop-blur-sm rounded-xl">
        <h3 className="text-sm font-light text-white/80 mb-4">Bridge Statistics</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-white/60">Contract Balance:</span>
            <span className="text-white font-light">{bridgedBalance ? formatEther(bridgedBalance) : '0'} AMICA</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Total Bridged In:</span>
            <span className="text-white font-light">{totalBridgedIn ? formatEther(totalBridgedIn) : '0'} AMICA</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Total Bridged Out:</span>
            <span className="text-white font-light">{totalBridgedOut ? formatEther(totalBridgedOut) : '0'} AMICA</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <button
          onClick={handleApprove}
          disabled={!address || !amount || isPending}
          className="w-full bg-white/10 backdrop-blur-sm text-white py-4 rounded-xl hover:bg-white/20 transition-all duration-300 font-light disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Step 1: Approve AMICA
        </button>

        <button
          onClick={handleBridge}
          disabled={!address || !amount || isPending}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all duration-300 font-light shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Step 2: {isWrapping ? 'Wrap' : 'Unwrap'} AMICA
        </button>
      </div>

      <div className="mt-6 p-4 bg-blue-500/10 backdrop-blur-sm rounded-xl border border-blue-500/20">
        <p className="font-light text-white/90 mb-2 text-sm">How it works:</p>
        <ul className="space-y-1 ml-4 list-disc text-xs text-white/70">
          <li>Wrap: Convert bridged AMICA tokens to native chain AMICA</li>
          <li>Unwrap: Convert native AMICA back to bridged tokens</li>
          <li>1:1 conversion rate, no fees</li>
        </ul>
      </div>
    </div>
  );
}
