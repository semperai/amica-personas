// src/components/AgentTokenInfo.tsx
import { formatEther } from 'viem';

interface AgentTokenInfoProps {
  agentToken?: string;
  minAgentTokens?: string;
  totalAgentDeposited?: string;
  isGraduated: boolean;
}

export default function AgentTokenInfo({
  agentToken,
  minAgentTokens,
  totalAgentDeposited,
  isGraduated
}: AgentTokenInfoProps) {
  if (!agentToken || agentToken === '0x0000000000000000000000000000000000000000') {
    return null;
  }

  const hasRequirement = minAgentTokens && BigInt(minAgentTokens) > BigInt(0);
  const deposited = BigInt(totalAgentDeposited || 0);
  const required = BigInt(minAgentTokens || 0);

  const progress = hasRequirement && required > BigInt(0)
    ? Math.min(100, (Number(deposited) * 100) / Number(required))
    : 100;

  const isRequirementMet = !hasRequirement || deposited >= required;

  return (
    <div className="mt-6 pt-6 border-t border-white/10">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-white">Agent Token Integration</h3>
        <span className={`text-xs px-2 py-1 rounded-full ${
          isRequirementMet
            ? 'bg-green-500/20 text-green-400'
            : 'bg-yellow-500/20 text-yellow-400'
        }`}>
          {isRequirementMet ? '✓ Active' : '⚠️ Needs Deposits'}
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-white/50">Agent Token</span>
          <a
            href={`https://etherscan.io/address/${agentToken}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 font-mono text-xs"
          >
            {agentToken.slice(0, 6)}...{agentToken.slice(-4)}
          </a>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-white/50">Total Deposited</span>
          <span className="text-white/80">{formatEther(deposited)} tokens</span>
        </div>

        {hasRequirement && (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Required for Graduation</span>
              <span className="text-white/80">{formatEther(required)} tokens</span>
            </div>

            {!isGraduated && (
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-white/50">Progress</span>
                  <span className="text-white/80">{progress.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-1.5">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {!isRequirementMet && (
                  <p className="text-xs text-yellow-400/80 mt-2">
                    ⚠️ Graduation blocked until requirement is met
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {!hasRequirement && (
          <p className="text-xs text-white/50">
            No minimum requirement - deposits earn rewards but aren&apos;t required for graduation
          </p>
        )}

        <div className="mt-3 p-3 bg-purple-500/10 backdrop-blur-sm rounded-lg">
          <p className="text-xs text-white/70">
            Agent token depositors receive {formatEther(BigInt("222222223000000000000000000"))} persona tokens
            distributed proportionally after graduation.
          </p>
        </div>
      </div>
    </div>
  );
}
