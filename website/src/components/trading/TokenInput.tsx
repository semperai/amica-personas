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
    <div className={`p-4 bg-muted rounded-xl border border-border ${className}`}>
      <div className="flex justify-between mb-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">Balance: {balance}</span>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={readOnly}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-2xl text-foreground placeholder-muted-foreground outline-none min-w-0"
        />
        {onMaxClick && !readOnly && (
          <button
            onClick={onMaxClick}
            className="text-xs text-purple-400 hover:text-purple-300 mr-2"
          >
            MAX
          </button>
        )}
        <div className="flex-shrink-0 px-4 py-2 bg-muted/80 rounded-lg text-foreground">
          {tokenSymbol}
        </div>
      </div>
    </div>
  );
}
