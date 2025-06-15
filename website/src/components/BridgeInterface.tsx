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
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <p className="text-gray-600">Bridge is not available on this chain.</p>
        <p className="text-sm text-gray-500 mt-2">
          Bridge functionality is only available on L2 chains (Base, Arbitrum).
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">AMICA Bridge</h2>

      <div className="flex gap-2 mb-4">
        <button
          className={`px-4 py-2 rounded ${isWrapping ? 'bg-purple-600 text-white' : 'bg-gray-200'}`}
          onClick={() => setIsWrapping(true)}
        >
          Wrap (Bridged → Native)
        </button>
        <button
          className={`px-4 py-2 rounded ${!isWrapping ? 'bg-purple-600 text-white' : 'bg-gray-200'}`}
          onClick={() => setIsWrapping(false)}
        >
          Unwrap (Native → Bridged)
        </button>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          {isWrapping ? 'Bridged AMICA to wrap' : 'Native AMICA to unwrap'}
        </label>
        <input
          type="number"
          placeholder="0.0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full p-3 border rounded-lg"
        />
        {nativeBalance && (
          <p className="text-sm text-gray-500 mt-1">
            Balance: {formatEther(nativeBalance.value)} AMICA
          </p>
        )}
      </div>

      <div className="mb-6 p-4 bg-gray-50 rounded">
        <h3 className="text-sm font-medium mb-2">Bridge Statistics</h3>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Contract Balance:</span>
            <span>{bridgedBalance ? formatEther(bridgedBalance) : '0'} AMICA</span>
          </div>
          <div className="flex justify-between">
            <span>Total Bridged In:</span>
            <span>{totalBridgedIn ? formatEther(totalBridgedIn) : '0'} AMICA</span>
          </div>
          <div className="flex justify-between">
            <span>Total Bridged Out:</span>
            <span>{totalBridgedOut ? formatEther(totalBridgedOut) : '0'} AMICA</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <button
          onClick={handleApprove}
          disabled={!address || !amount || isPending}
          className="w-full bg-gray-200 text-gray-700 py-2 rounded hover:bg-gray-300"
        >
          Step 1: Approve AMICA
        </button>

        <button
          onClick={handleBridge}
          disabled={!address || !amount || isPending}
          className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700"
        >
          Step 2: {isWrapping ? 'Wrap' : 'Unwrap'} AMICA
        </button>
      </div>

      <div className="mt-4 p-3 bg-blue-50 rounded text-xs">
        <p className="font-medium mb-1">How it works:</p>
        <ul className="space-y-1 ml-4 list-disc">
          <li>Wrap: Convert bridged AMICA tokens to native chain AMICA</li>
          <li>Unwrap: Convert native AMICA back to bridged tokens</li>
          <li>1:1 conversion rate, no fees</li>
        </ul>
      </div>
    </div>
  );
}
