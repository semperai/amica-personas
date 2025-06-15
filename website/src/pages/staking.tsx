// src/pages/staking.tsx
import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { formatEther, parseEther } from 'viem';
import { getAddressesForChain } from '@/lib/contracts';

// Mock staking pools data (replace with actual contract reads)
const mockPools = [
  {
    id: 0,
    name: "CryptoSage AI / AMICA",
    lpToken: "0x2222222222222222222222222222222222222222",
    allocBasisPoints: 1500, // 15%
    totalStaked: "2500000000000000000000", // 2500 LP tokens
    apy: 125.5,
    isActive: true,
    isAgentPool: false,
    personaTokenId: 0,
    token0: { symbol: "SAGE", address: "0xabcd..." },
    token1: { symbol: "AMICA", address: "0x1234..." }
  },
  {
    id: 1,
    name: "DeFi Assistant / AGENT",
    lpToken: "0x6666666666666666666666666666666666666666",
    allocBasisPoints: 2000, // 20%
    totalStaked: "1800000000000000000000", // 1800 LP tokens
    apy: 168.2,
    isActive: true,
    isAgentPool: true,
    personaTokenId: 2,
    token0: { symbol: "DEFI", address: "0x4444..." },
    token1: { symbol: "AGENT", address: "0x8888..." }
  },
  {
    id: 2,
    name: "Trading Signals / AMICA",
    lpToken: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    allocBasisPoints: 1000, // 10%
    totalStaked: "3200000000000000000000", // 3200 LP tokens
    apy: 95.3,
    isActive: true,
    isAgentPool: false,
    personaTokenId: 4,
    token0: { symbol: "SIGNAL", address: "0x9999..." },
    token1: { symbol: "AMICA", address: "0x1234..." }
  }
];

const lockTiers = [
  { duration: 0, multiplier: 1.0, label: "Flexible", color: "gray" },
  { duration: 30, multiplier: 1.25, label: "1 Month", color: "blue" },
  { duration: 90, multiplier: 1.5, label: "3 Months", color: "purple" },
  { duration: 180, multiplier: 2.0, label: "6 Months", color: "pink" },
  { duration: 365, multiplier: 2.5, label: "1 Year", color: "orange" }
];

interface PoolCardProps {
  pool: typeof mockPools[0];
  userLpBalance?: string;
  userStakedBalance?: string;
  pendingRewards?: string;
}

function PoolCard({ pool, userLpBalance = "0", userStakedBalance = "0", pendingRewards = "0" }: PoolCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTier, setSelectedTier] = useState(0);
  const [stakeAmount, setStakeAmount] = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [activeTab, setActiveTab] = useState<"stake" | "unstake" | "zap">("stake");

  const handleStake = () => {
    console.log("Staking", stakeAmount, "with tier", selectedTier);
    // Implementation here
  };

  const handleUnstake = () => {
    console.log("Unstaking", unstakeAmount);
    // Implementation here
  };

  const handleClaim = () => {
    console.log("Claiming rewards");
    // Implementation here
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Pool Header */}
      <div
        className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-bold">{pool.name}</h3>
              {pool.isAgentPool && (
                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                  Agent Pool
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Pool #{pool.id} • {(pool.allocBasisPoints / 100).toFixed(1)}% of rewards
            </p>
          </div>

          <div className="text-right">
            <p className="text-3xl font-bold text-green-600">{pool.apy.toFixed(1)}%</p>
            <p className="text-sm text-gray-500">APY</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4">
          <div>
            <p className="text-sm text-gray-500">Total Staked</p>
            <p className="font-semibold">${(Number(formatEther(BigInt(pool.totalStaked))) * 1.5).toFixed(0)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Your Stake</p>
            <p className="font-semibold">{formatEther(BigInt(userStakedBalance))} LP</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Pending Rewards</p>
            <p className="font-semibold text-green-600">{formatEther(BigInt(pendingRewards))} AMICA</p>
          </div>
        </div>

        <div className="flex justify-center mt-4">
          <svg
            className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-200">
          {/* Action Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              className={`flex-1 py-3 text-sm font-medium ${
                activeTab === "stake"
                  ? "border-b-2 border-purple-600 text-purple-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("stake")}
            >
              Stake LP
            </button>
            <button
              className={`flex-1 py-3 text-sm font-medium ${
                activeTab === "unstake"
                  ? "border-b-2 border-purple-600 text-purple-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("unstake")}
            >
              Unstake
            </button>
            <button
              className={`flex-1 py-3 text-sm font-medium ${
                activeTab === "zap"
                  ? "border-b-2 border-purple-600 text-purple-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("zap")}
            >
              Zap In
            </button>
          </div>

          <div className="p-6">
            {/* Stake Tab */}
            {activeTab === "stake" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Amount to Stake</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(e.target.value)}
                      placeholder="0.0"
                      className="w-full p-3 pr-16 border rounded-lg"
                    />
                    <button
                      onClick={() => setStakeAmount(formatEther(BigInt(userLpBalance)))}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
                    >
                      MAX
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Balance: {formatEther(BigInt(userLpBalance))} LP tokens
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Lock Duration</label>
                  <div className="grid grid-cols-5 gap-2">
                    {lockTiers.map((tier, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedTier(index)}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          selectedTier === index
                            ? "border-purple-600 bg-purple-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <p className="text-sm font-medium">{tier.label}</p>
                        <p className="text-lg font-bold text-purple-600">{tier.multiplier}x</p>
                      </button>
                    ))}
                  </div>
                </div>

                {stakeAmount && (
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm text-gray-600">Estimated Rewards</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {(parseFloat(stakeAmount) * pool.apy * lockTiers[selectedTier].multiplier / 100).toFixed(2)} AMICA
                    </p>
                    <p className="text-xs text-gray-500">per year at current APY</p>
                  </div>
                )}

                <button
                  onClick={handleStake}
                  disabled={!stakeAmount || parseFloat(stakeAmount) <= 0}
                  className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Stake LP Tokens
                </button>
              </div>
            )}

            {/* Unstake Tab */}
            {activeTab === "unstake" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Amount to Unstake</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={unstakeAmount}
                      onChange={(e) => setUnstakeAmount(e.target.value)}
                      placeholder="0.0"
                      className="w-full p-3 pr-16 border rounded-lg"
                    />
                    <button
                      onClick={() => setUnstakeAmount(formatEther(BigInt(userStakedBalance)))}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
                    >
                      MAX
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Staked: {formatEther(BigInt(userStakedBalance))} LP tokens
                  </p>
                </div>

                {Number(pendingRewards) > 0 && (
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-gray-600">Pending Rewards</p>
                        <p className="text-xl font-bold text-green-600">
                          {formatEther(BigInt(pendingRewards))} AMICA
                        </p>
                      </div>
                      <button
                        onClick={handleClaim}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                      >
                        Claim
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleUnstake}
                  disabled={!unstakeAmount || parseFloat(unstakeAmount) <= 0}
                  className="w-full bg-gray-600 text-white py-3 rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Unstake LP Tokens
                </button>
              </div>
            )}

            {/* Zap Tab */}
            {activeTab === "zap" && (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium mb-2">⚡ One-Click Liquidity</h4>
                  <p className="text-sm text-gray-600">
                    Provide liquidity using a single token. We&apos;ll automatically swap half and add liquidity for you.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Select Token</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button className="p-3 border-2 border-purple-600 bg-purple-50 rounded-lg">
                      <p className="font-medium">{pool.token0.symbol}</p>
                      <p className="text-xs text-gray-500">Balance: 1,234.56</p>
                    </button>
                    <button className="p-3 border-2 border-gray-200 hover:border-gray-300 rounded-lg">
                      <p className="font-medium">{pool.token1.symbol}</p>
                      <p className="text-xs text-gray-500">Balance: 5,678.90</p>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Amount</label>
                  <input
                    type="number"
                    placeholder="0.0"
                    className="w-full p-3 border rounded-lg"
                  />
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Est. LP Tokens</span>
                    <span className="font-medium">~123.45 LP</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Price Impact</span>
                    <span className="font-medium text-green-600">0.15%</span>
                  </div>
                </div>

                <button className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700">
                  Zap & Stake
                </button>
              </div>
            )}
          </div>

          {/* Pool Info */}
          <div className="px-6 pb-6">
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-2">Pool Information</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">LP Token</span>
                  <a href="#" className="text-purple-600 hover:text-purple-700 font-mono text-xs">
                    {pool.lpToken.slice(0, 6)}...{pool.lpToken.slice(-4)}
                  </a>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Pool Type</span>
                  <span>{pool.isAgentPool ? "Agent Pool" : "Standard Pool"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StakingPage() {
  const { address, chainId } = useAccount();
  const [totalValueLocked, setTotalValueLocked] = useState("12,345,678");
  const [totalRewardsDistributed, setTotalRewardsDistributed] = useState("2,456,789");
  const [amicaPerBlock, setAmicaPerBlock] = useState("100");

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Staking Rewards</h1>
          <p className="text-xl text-gray-600">
            Stake LP tokens to earn AMICA rewards. Lock for longer periods to multiply your rewards.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500 mb-1">Total Value Locked</p>
            <p className="text-2xl font-bold">${totalValueLocked}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500 mb-1">Total Rewards Distributed</p>
            <p className="text-2xl font-bold">{totalRewardsDistributed} AMICA</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500 mb-1">Active Pools</p>
            <p className="text-2xl font-bold">{mockPools.filter(p => p.isActive).length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-500 mb-1">Rewards Per Block</p>
            <p className="text-2xl font-bold">{amicaPerBlock} AMICA</p>
          </div>
        </div>

        {/* Lock Multipliers */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg shadow-lg p-6 mb-8 text-white">
          <h2 className="text-2xl font-bold mb-4">🔒 Lock Duration Multipliers</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {lockTiers.map((tier, index) => (
              <div key={index} className="text-center">
                <p className="text-3xl font-bold">{tier.multiplier}x</p>
                <p className="text-sm opacity-90">{tier.label}</p>
              </div>
            ))}
          </div>
        </div>

        {!address ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <h2 className="text-xl font-semibold mb-4">Connect Your Wallet</h2>
            <p className="text-gray-600 mb-6">
              Please connect your wallet to view staking pools
            </p>
            <div className="flex justify-center">
              <ConnectButton />
            </div>
          </div>
        ) : (
          <>
            {/* Filter/Sort */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-purple-600 text-white rounded-lg">
                  All Pools
                </button>
                <button className="px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50">
                  My Positions
                </button>
                <button className="px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50">
                  Agent Pools
                </button>
              </div>
              <select className="px-4 py-2 border rounded-lg">
                <option>Sort by APY</option>
                <option>Sort by TVL</option>
                <option>Sort by My Stake</option>
              </select>
            </div>

            {/* Pools List */}
            <div className="space-y-4">
              {mockPools.map((pool) => (
                <PoolCard
                  key={pool.id}
                  pool={pool}
                  userLpBalance="1234560000000000000000"
                  userStakedBalance="500000000000000000000"
                  pendingRewards="125000000000000000000"
                />
              ))}
            </div>

            {/* Info Section */}
            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">How to Maximize Rewards</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start">
                    <span className="text-purple-600 mr-2">•</span>
                    Lock your LP tokens for longer periods to earn up to 2.5x rewards
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-600 mr-2">•</span>
                    Use the Zap feature to provide liquidity with a single token
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-600 mr-2">•</span>
                    Agent pools often have higher APY due to additional incentives
                  </li>
                  <li className="flex items-start">
                    <span className="text-purple-600 mr-2">•</span>
                    Compound your rewards by claiming and restaking regularly
                  </li>
                </ul>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Important Information</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start">
                    <span className="text-yellow-500 mr-2">⚠️</span>
                    Locked tokens cannot be withdrawn until the lock period ends
                  </li>
                  <li className="flex items-start">
                    <span className="text-yellow-500 mr-2">⚠️</span>
                    APY rates are variable and depend on total staked amount
                  </li>
                  <li className="flex items-start">
                    <span className="text-yellow-500 mr-2">⚠️</span>
                    Impermanent loss risk exists when providing liquidity
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    Emergency withdrawal available (forfeits pending rewards)
                  </li>
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
