// src/components/trading/TokenInput.tsx
interface TokenInputProps {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  onMaxClick?: () => void;
  readOnly?: boolean;
  placeholder?: string;
  balance: string;
  tokenSymbol: string;
  className?: string;
}

export function TokenInput({
  label,
  value,
  onChange,
  onMaxClick,
  readOnly = false,
  placeholder = "0.0",
  balance,
  tokenSymbol,
  className = ""
}: TokenInputProps) {
  return (
    <div className={`p-4 bg-white/5 rounded-xl border border-white/10 ${className}`}>
      <div className="flex justify-between mb-2">
        <span className="text-sm text-white/60">{label}</span>
        <span className="text-xs text-white/50">Balance: {balance}</span>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={readOnly}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-2xl text-white placeholder-white/30 outline-none min-w-0"
        />
        {onMaxClick && !readOnly && (
          <button 
            onClick={onMaxClick}
            className="text-xs text-purple-400 hover:text-purple-300 mr-2"
          >
            MAX
          </button>
        )}
        <div className="flex-shrink-0 px-4 py-2 bg-white/10 rounded-lg text-white">
          {tokenSymbol}
        </div>
      </div>
    </div>
  );
}
