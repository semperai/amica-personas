// src/components/trading/GraduationProgress.tsx - Enhanced with agent token support
interface GraduationProgressProps {
  isGraduated: boolean;
  progress: number;
  agentTokenProgress?: number;
  hasAgentToken?: boolean;
  agentTokensRequired?: string;
  agentTokensDeposited?: string;
  agentTokenSymbol?: string;
}

export function GraduationProgress({ 
  isGraduated, 
  progress, 
  agentTokenProgress = 100, 
  hasAgentToken = false,
  agentTokensRequired,
  agentTokensDeposited,
  agentTokenSymbol = 'tokens'
}: GraduationProgressProps) {
  if (isGraduated) return null;

  const tvlComplete = progress >= 100;
  const agentComplete = agentTokenProgress >= 100;
  const canGraduate = tvlComplete && agentComplete;

  return (
    <div className="p-4 bg-muted border-b border-border">
      <div className="space-y-4">
        {/* TVL Progress */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-foreground/80">TVL Progress</span>
              {tvlComplete && (
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">✓</span>
              )}
            </div>
            <span className="text-sm font-medium text-foreground">{progress.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-background rounded-full h-4 overflow-hidden">
            <div
              className={`h-4 rounded-full transition-all duration-500 shadow-lg relative ${
                tvlComplete
                  ? 'bg-emerald-500'
                  : 'bg-brand-blue'
              }`}
              style={{
                width: `${Math.min(progress, 100)}%`,
                animation: tvlComplete ? 'none' : 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
              }}
            >
              {!tvlComplete && (
                <div className="absolute inset-0 bg-white/20 rounded-full animate-ping" style={{ animationDuration: '2s' }}></div>
              )}
            </div>
          </div>
        </div>

        {/* Agent Token Progress */}
        {hasAgentToken && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground/80">Agent Token Progress</span>
                {agentComplete && (
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">✓</span>
                )}
                {!agentComplete && agentTokensRequired && Number(agentTokensRequired) === 0 && (
                  <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">Optional</span>
                )}
              </div>
              <span className="text-sm font-medium text-foreground">{agentTokenProgress.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-background rounded-full h-4 overflow-hidden">
              <div
                className={`h-4 rounded-full transition-all duration-500 shadow-lg relative ${
                  agentComplete
                    ? 'bg-emerald-500'
                    : 'bg-orange-500'
                }`}
                style={{
                  width: `${Math.min(agentTokenProgress, 100)}%`,
                  animation: agentComplete ? 'none' : 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                }}
              >
                {!agentComplete && (
                  <div className="absolute inset-0 bg-white/20 rounded-full animate-ping" style={{ animationDuration: '2s' }}></div>
                )}
              </div>
            </div>
            {agentTokensDeposited && agentTokensRequired && (
              <p className="text-xs text-muted-foreground mt-1">
                {agentTokensDeposited} / {agentTokensRequired} {agentTokenSymbol} deposited
              </p>
            )}
          </div>
        )}

        {/* Overall Status */}
        <div className="pt-2 border-t border-border">
          {canGraduate ? (
            <div className="flex items-center gap-2">
              <span className="text-xs bg-green-500/20 text-green-400 px-3 py-1 rounded-full font-medium">
                🎉 Ready to Graduate!
              </span>
              <p className="text-xs text-muted-foreground">
                All requirements met - next trade will trigger graduation
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {!tvlComplete && !agentComplete 
                ? `Need ${(100 - progress).toFixed(1)}% more TVL and ${(100 - agentTokenProgress).toFixed(1)}% more agent tokens`
                : !tvlComplete 
                ? `Need ${(100 - progress).toFixed(1)}% more TVL to graduate`
                : !agentComplete
                ? `Need ${(100 - agentTokenProgress).toFixed(1)}% more agent tokens to graduate`
                : 'All requirements met!'
              }
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
