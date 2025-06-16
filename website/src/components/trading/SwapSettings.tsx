// src/components/trading/SwapSettings.tsx
import { useState } from 'react';

interface SwapSettingsProps {
  slippage: string;
  onSlippageChange: (value: string) => void;
}

export function SwapSettings({ slippage, onSlippageChange }: SwapSettingsProps) {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
      >
        <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {showSettings && (
        <div className="absolute right-0 mt-2 w-80 bg-slate-800/95 backdrop-blur-xl rounded-xl shadow-xl border border-white/10 p-4 z-20">
          <h3 className="text-sm font-medium text-white mb-3">Transaction Settings</h3>
          <div className="mb-4">
            <label className="text-xs text-white/60 block mb-2">Slippage Tolerance</label>
            <div className="flex gap-2">
              {['0.1', '0.5', '1.0'].map((value) => (
                <button
                  key={value}
                  onClick={() => onSlippageChange(value)}
                  className={`px-3 py-1 rounded-lg text-sm ${
                    slippage === value
                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {value}%
                </button>
              ))}
              <input
                type="number"
                value={slippage}
                onChange={(e) => onSlippageChange(e.target.value)}
                className="flex-1 px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
                placeholder="Custom"
                step="0.1"
                min="0.1"
                max="50"
              />
            </div>
          </div>
          <p className="text-xs text-white/50">
            Your transaction will revert if the price changes unfavorably by more than this percentage.
          </p>
        </div>
      )}
    </div>
  );
}
