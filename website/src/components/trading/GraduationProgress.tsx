// src/components/trading/GraduationProgress.tsx
interface GraduationProgressProps {
  isGraduated: boolean;
  progress: number;
}

export function GraduationProgress({ isGraduated, progress }: GraduationProgressProps) {
  if (isGraduated) return null;

  return (
    <div className="p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-b border-white/10">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-white/80">Graduation Progress</span>
        <span className="text-sm font-medium text-white">{progress.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-white/10 rounded-full h-2">
        <div
          className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      <p className="text-xs text-white/60 mt-2">
        This persona will graduate when {(100 - progress).toFixed(1)}% more tokens are purchased
      </p>
    </div>
  );
}
