import { clsx } from 'clsx';

import { ChevronRightIcon } from '@heroicons/react/20/solid';
import { Link, pagesToLinks } from './common';

export function MenuPage({
  keys,
  menuClick,
}: {
  keys: string[];
  menuClick: (link: Link) => void;
}) {

  const links = pagesToLinks(keys);

  return (
    <ul role="list" className="space-y-1.5">
      {links.map((link) => (
        <li
          key={link.key}
          className="relative flex items-center justify-between bg-white/40 backdrop-blur-xl rounded border border-white/30 hover:bg-white/60 hover:border-white/50 p-2 cursor-pointer transition-all group"
          onClick={() => {
            menuClick(link);
          }}
        >
          <div className="min-w-0 flex-auto">
            <div className="flex items-center gap-x-2">
              <h2 className="min-w-0 text-xs font-semibold text-slate-900">
                <span className={clsx(
                  'whitespace-nowrap flex w-0 flex-1 gap-x-2 items-center',
                  link.className,
                )}>
                  {link.icon}
                  {link.label}
                </span>
              </h2>
            </div>
          </div>
          <ChevronRightIcon className="h-3.5 w-3.5 flex-none text-slate-400 group-hover:text-slate-600 transition-colors" aria-hidden="true" />
        </li>
      ))}
    </ul>
  );
}
