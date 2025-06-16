// src/components/BridgeInterface.tsx
import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useBalance, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { BRIDGE_WRAPPER_ABI, AMICA_ABI, getAddressesForChain, getBridgedAmicaAddress } from '../lib/contracts';

export default function BridgeInterface() {
  const { address, chainId } = useAccount();
  const [amount, setAmount] = useState('');
  const [isWrapping, setIsWrapping] = useState(true);
  const [needsApproval, setNeedsApproval] = useState(false);

  // Get contract addresses
  const addresses = chainId ? getAddressesForChain(chainId) : null;
  const bridgedAmicaAddress = chainId ? getBridgedAmicaAddress(chainId) : null;
  const hasBridge = !!addresses?.bridgeWrapper && chainId !== 1; // No bridge on mainnet

  // Transaction handling
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Get native AMICA balance
  const { data: nativeBalance } = useBalance({
    address: address,
    token: addresses?.amicaToken as `0x${string}`,
  });

  // Get bridged AMICA balance
  const { data: bridgedAmicaBalance } = useBalance({
    address: address,
    token: bridgedAmicaAddress as `0x${string}`,
  });

  // Get bridge wrapper stats
  const { data: bridgedBalance } = useReadContract({
    address: addresses?.bridgeWrapper as `0x${string}`,
    abi: BRIDGE_WRAPPER_ABI,
    functionName: 'bridgedBalance',
    query: {
      enabled: !!addresses?.bridgeWrapper
    }
  });

  const { data: totalBridgedIn } = useReadContract({
    address: addresses?.bridgeWrapper as `0x${string}`,
    abi: BRIDGE_WRAPPER_ABI,
    functionName: 'totalBridgedIn',
    query: {
      enabled: !!addresses?.bridgeWrapper
    }
  });

  const { data: totalBridgedOut } = useReadContract({
    address: addresses?.bridgeWrapper as `0x${string}`,
    abi: BRIDGE_WRAPPER_ABI,
    functionName: 'totalBridgedOut',
    query: {
      enabled: !!addresses?.bridgeWrapper
    }
  });

  // Check allowance for wrapping (bridged -> native)
  const { data: allowance } = useReadContract({
    address: bridgedAmicaAddress as `0x${string}`,
    abi: AMICA_ABI,
    functionName: 'allowance',
    args: address && addresses?.bridgeWrapper ? [address, addresses.bridgeWrapper as `0x${string}`] : undefined,
    query: {
      enabled: !!address && !!bridgedAmicaAddress && !!addresses?.bridgeWrapper && isWrapping
    }
  });

  // Check allowance for unwrapping (native -> bridged)
  const { data: nativeAllowance } = useReadContract({
    address: addresses?.amicaToken as `0x${string}`,
    abi: AMICA_ABI,
    functionName: 'allowance',
    args: address && addresses?.bridgeWrapper ? [address, addresses.bridgeWrapper as `0x${string}`] : undefined,
    query: {
      enabled: !!address && !!addresses?.amicaToken && !!addresses?.bridgeWrapper && !isWrapping
    }
  });

  // Update needsApproval when amount or allowance changes
  useEffect(() => {
    if (!amount || parseFloat(amount) === 0) {
      setNeedsApproval(false);
      return;
    }

    const amountWei = parseEther(amount);
    
    if (isWrapping && allowance !== undefined) {
      setNeedsApproval(amountWei > (allowance as bigint));
    } else if (!isWrapping && nativeAllowance !== undefined) {
      setNeedsApproval(amountWei > (nativeAllowance as bigint));
    }
  }, [amount, isWrapping, allowance, nativeAllowance]);

  // Reset form on success
  useEffect(() => {
    if (isSuccess) {
      setAmount('');
    }
  }, [isSuccess]);

  const handleApprove = async () => {
    if (!addresses || !amount || !bridgedAmicaAddress) return;

    const tokenToApprove = isWrapping ? bridgedAmicaAddress : addresses.amicaToken;
    const spender = addresses.bridgeWrapper;

    try {
      await writeContract({
        address: tokenToApprove as `0x${string}`,
        abi: AMICA_ABI,
        functionName: 'approve',
        args: [spender as `0x${string}`, parseEther(amount)]
      });
    } catch (err) {
      console.error('Approval error:', err);
    }
  };

  const handleBridge = async () => {
    if (!addresses?.bridgeWrapper || !amount) return;

    try {
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
    } catch (err) {
      console.error('Bridge error:', err);
    }
  };

  const handleMaxClick = () => {
    if (isWrapping && bridgedAmicaBalance) {
      setAmount(formatEther(bridgedAmicaBalance.value));
    } else if (!isWrapping && nativeBalance) {
      setAmount(formatEther(nativeBalance.value));
    }
  };

  // Show loading state if chain not detected
  if (!chainId) {
    return (
      <div className="bg-white/5 backdrop-blur-md rounded-2xl p-8 border border-white/10 text-center">
        <p className="text-white/60 text-lg">Loading...</p>
      </div>
    );
  }

  // Show error if bridge not available
  if (!hasBridge) {
    return (
      <div className="bg-white/5 backdrop-blur-md rounded-2xl p-8 border border-white/10 text-center">
        <p className="text-white/60 text-lg">Bridge is not available on this chain.</p>
        <p className="text-sm text-white/40 mt-2">
          {chainId === 1 
            ? "Bridge wrapper is not available on Ethereum mainnet. Use the official bridge to move tokens to L2."
            : "Bridge functionality is only available on supported L2 chains."}
        </p>
        {addresses && (
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-white/40 hover:text-white/60 text-sm">Debug Info</summary>
            <div className="mt-2 p-4 bg-black/20 rounded text-xs font-mono text-white/40">
              <p>Chain ID: {chainId}</p>
              <p>Bridge Wrapper: {addresses.bridgeWrapper || 'Not configured'}</p>
              <p>Native AMICA: {addresses.amicaToken || 'Not configured'}</p>
              <p>Bridged AMICA: {bridgedAmicaAddress || 'Not configured'}</p>
            </div>
          </details>
        )}
      </div>
    );
  }

  const currentBalance = isWrapping ? bridgedAmicaBalance : nativeBalance;
  const currentBalanceFormatted = currentBalance ? formatEther(currentBalance.value) : '0';

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
        <div className="relative">
          <input
            type="number"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full p-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/40 focus:border-white/40 focus:outline-none transition-colors text-lg pr-16"
          />
          <button
            onClick={handleMaxClick}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
          >
            MAX
          </button>
        </div>
        <p className="text-sm text-white/50 mt-2">
          Balance: {currentBalanceFormatted} AMICA
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4">
          <p className="text-xs text-white/60 mb-1">Bridged Balance</p>
          <p className="text-lg font-light text-white">
            {bridgedAmicaBalance ? formatEther(bridgedAmicaBalance.value) : '0'}
          </p>
        </div>
        <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4">
          <p className="text-xs text-white/60 mb-1">Native Balance</p>
          <p className="text-lg font-light text-white">
            {nativeBalance ? formatEther(nativeBalance.value) : '0'}
          </p>
        </div>
      </div>

      <div className="mb-8 p-6 bg-white/5 backdrop-blur-sm rounded-xl">
        <h3 className="text-sm font-light text-white/80 mb-4">Bridge Statistics</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-white/60">Contract Balance:</span>
            <span className="text-white font-light">
              {bridgedBalance ? formatEther(bridgedBalance as bigint) : '0'} AMICA
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Total Wrapped:</span>
            <span className="text-white font-light">
              {totalBridgedIn ? formatEther(totalBridgedIn as bigint) : '0'} AMICA
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/60">Total Unwrapped:</span>
            <span className="text-white font-light">
              {totalBridgedOut ? formatEther(totalBridgedOut as bigint) : '0'} AMICA
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {needsApproval ? (
          <button
            onClick={handleApprove}
            disabled={!address || !amount || isPending || isConfirming}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all duration-300 font-light shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending || isConfirming ? 'Approving...' : 'Approve AMICA'}
          </button>
        ) : (
          <button
            onClick={handleBridge}
            disabled={!address || !amount || parseFloat(amount) === 0 || isPending || isConfirming}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all duration-300 font-light shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending || isConfirming 
              ? (isWrapping ? 'Wrapping...' : 'Unwrapping...') 
              : (isWrapping ? 'Wrap AMICA' : 'Unwrap AMICA')}
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-500/10 backdrop-blur-sm rounded-xl border border-red-500/20">
          <p className="text-sm text-red-400">Error: {error.message}</p>
        </div>
      )}

      {isSuccess && (
        <div className="mt-4 p-4 bg-green-500/10 backdrop-blur-sm rounded-xl border border-green-500/20">
          <p className="text-sm text-green-400">Transaction successful!</p>
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-500/10 backdrop-blur-sm rounded-xl border border-blue-500/20">
        <p className="font-light text-white/90 mb-2 text-sm">How it works:</p>
        <ul className="space-y-1 ml-4 list-disc text-xs text-white/70">
          <li>Wrap: Convert bridged AMICA tokens to native chain AMICA</li>
          <li>Unwrap: Convert native AMICA back to bridged tokens</li>
          <li>1:1 conversion rate, no fees</li>
          <li>Native AMICA required for fee discounts on persona trading</li>
        </ul>
      </div>

      {/* Debug info - remove in production */}
      <details className="mt-4">
        <summary className="cursor-pointer text-white/40 hover:text-white/60 text-xs">Contract Addresses</summary>
        <div className="mt-2 p-4 bg-black/20 rounded text-xs font-mono text-white/40">
          <p>Bridge Wrapper: {addresses?.bridgeWrapper}</p>
          <p>Native AMICA: {addresses?.amicaToken}</p>
          <p>Bridged AMICA: {bridgedAmicaAddress}</p>
        </div>
      </details>
    </div>
  );
}
