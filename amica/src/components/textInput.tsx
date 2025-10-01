type Props = {
  value: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  readOnly?: boolean;
}

export const TextInput = ({
  value,
  onChange,
  readOnly,
  ...rest
}: Props) => {
  return (
    <input
      className="block w-full rounded px-2.5 py-1.5 text-xs text-slate-900 bg-white/50 backdrop-blur-xl border border-white/30 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-transparent transition-all"
      type="text"
      value={value}
      onChange={onChange}
      readOnly={readOnly}
      {...rest}
    />
  );
};
