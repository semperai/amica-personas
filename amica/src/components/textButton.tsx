import { ButtonHTMLAttributes } from "react";
type Props = ButtonHTMLAttributes<HTMLButtonElement>;

export const TextButton = (props: Props) => {
  return (
    <button
      {...props}
      className={`px-3 py-1.5 text-white text-xs font-semibold bg-slate-800 hover:bg-slate-700 active:bg-slate-900 disabled:bg-slate-400 rounded transition-all cursor-pointer ${props.className}`}
    >
      {props.children}
    </button>
  );
};
