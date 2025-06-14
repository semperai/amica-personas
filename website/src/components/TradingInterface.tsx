import { useState } from 'react';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { FACTORY_ABI, FACTORY_ADDRESS } from '../lib/contracts';

interface TradingInterfaceProps {
  chainId: string;
  tokenId: string;
}

export default function TradingInterface({ chainId, tokenId }: TradingInterfaceProps) {
  const { address } = useAccount();
  const [amount, setAmount] = useState('');
  const [isBuying, setIsBuying] = useState(true);
  
  // TODO: Use chainId to get the correct factory address for the current chain
  console.log('Trading on chain:', chainId);
  
  // Get quote
  const { data: quote } = useReadContract({
    address: FACTORY_ADDRESS as `0x${string}`,
    abi: FACTORY_ABI,
    functionName: 'getAmountOutForUser',
    args: address && amount ? [BigInt(tokenId), parseEther(amount), address] : undefined,
    query: {
      enabled: !!amount && !!address && parseFloat(amount) > 0
    }
  });

  const { writeContract } = useWriteContract();

  const handleTrade = async () => {
    if (!address || !amount) return;

    if (isBuying) {
      await writeContract({
        address: FACTORY_ADDRESS as `0x${string}`,
        abi: FACTORY_ABI,
        functionName: 'swapExactTokensForTokens',
        args: [
          BigInt(tokenId),
          parseEther(amount),
          BigInt(0), // amountOutMin - should calculate with slippage
          address,
          BigInt(Math.floor(Date.now() / 1000) + 300) // 5 min deadline
        ]
      });
    } else {
      // TODO: Implement selling logic
      console.log('Selling not implemented yet');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4">Trade</h2>
      
      <div className="flex gap-2 mb-4">
        <button
          className={`px-4 py-2 rounded ${isBuying ? 'bg-green-500 text-white' : 'bg-gray-200'}`}
          onClick={() => setIsBuying(true)}
        >
          Buy
        </button>
        <button
          className={`px-4 py-2 rounded ${!isBuying ? 'bg-red-500 text-white' : 'bg-gray-200'}`}
          onClick={() => setIsBuying(false)}
        >
          Sell
        </button>
      </div>

      <input
        type="number"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full p-2 border rounded mb-4"
      />

      {quote !== undefined && quote !== null && (
        <div className="mb-4 p-2 bg-gray-100 rounded">
          You will receive: {formatEther(quote as bigint)} tokens
        </div>
      )}

      <button
        onClick={handleTrade}
        className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600"
        disabled={!address || !amount || parseFloat(amount) <= 0}
      >
        {isBuying ? 'Buy' : 'Sell'} Tokens
      </button>
    </div>
  );
}
