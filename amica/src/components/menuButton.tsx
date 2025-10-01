import * as React from 'react';
import clsx from 'clsx';

export function MenuButton({
  icon,
  onClick,
  large,
  label,
  href,
  target,
  disabled,
}: {
  icon: React.ComponentType<any>,
  onClick?: () => void,
  large: boolean,
  label: string,
  href?: string,
  target?: string,
  disabled?: boolean,
}) {
  const Icon = icon; // Capitalize to use as component

  if (href) {
    onClick = () => {
      window.open(href, target);
    };
  }

  return (
    <div className="flex flex-row items-center space-x-2">
      <button
        disabled={disabled}
        onClick={onClick}
        className={clsx(
          'p-0.5 rounded-lg transition-colors duration-200',
          !disabled && 'hover:bg-white/60',
        )}
      >
        <Icon
          className={clsx(
            large ? 'h-14 w-14' : 'h-7 w-7',
            'text-slate-900',
            disabled && 'cursor-not-allowed opacity-20',
            !disabled && 'opacity-80 hover:opacity-100 active:opacity-100 hover:cursor-pointer',
         )}
          aria-hidden="true"
        />
        <span className="text-slate-900 hidden">{label}</span>
      </button>
    </div>
  );
}
