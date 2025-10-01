'use client';

interface BasicInfoFormProps {
  name: string;
  symbol: string;
  onNameChange: (value: string) => void;
  onSymbolChange: (value: string) => void;
}

export default function BasicInfoForm({
  name,
  symbol,
  onNameChange,
  onSymbolChange
}: BasicInfoFormProps) {
  return (
    <>
      <div className="mb-8">
        <label className="block text-sm font-light text-white/80 mb-3">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="w-full p-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/40 focus:border-white/40 focus:outline-none transition-colors"
          placeholder="My Awesome Persona"
        />
        <p className="text-xs text-white/50 mt-2">Choose a unique and memorable name</p>
      </div>

      <div className="mb-8">
        <label className="block text-sm font-light text-white/80 mb-3">Symbol</label>
        <input
          type="text"
          value={symbol}
          onChange={(e) => onSymbolChange(e.target.value.toUpperCase())}
          className="w-full p-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/40 focus:border-white/40 focus:outline-none transition-colors"
          placeholder="AWESOME"
          maxLength={10}
        />
        <p className="text-xs text-white/50 mt-2">3-10 characters, letters only</p>
      </div>
    </>
  );
}
