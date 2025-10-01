// src/components/Layout.tsx
import { Yomogi } from 'next/font/google'
import clsx from 'clsx';
import { ReactNode, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAccount } from 'wagmi';
import { hasBridgeWrapper } from '@/lib/contracts';
import Image from 'next/image';

interface LayoutProps {
  children: ReactNode;
}

const yomogi = Yomogi({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
});

const Layout = ({ children }: LayoutProps) => {
  const pathname = usePathname();
  const { chainId } = useAccount();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => {
    return pathname === path;
  };

  // Check if bridge is available on current chain
  const showBridge = chainId && hasBridgeWrapper(chainId);

  const isMockMode = process.env.NEXT_PUBLIC_MOCK_MODE === 'true';

  const navItems = [
    { href: '/', label: 'Explore' },
    { href: '/create', label: 'Create' },
    { href: '/portfolio', label: 'Portfolio' },
    // ...(showBridge ? [{ href: '/bridge', label: 'Bridge' }] : []),
    // { href: '/staking', label: 'Staking' },
  ];

  return (
    <div className={clsx("min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900", yomogi.className)}>
      {/* Mock Mode Banner */}
      {isMockMode && (
        <div className="bg-purple-600/20 backdrop-blur-sm text-white px-4 py-2 text-center text-sm border-b border-purple-500/20">
          <span>🧪 Mock Mode Enabled - Using test data for development</span>
        </div>
      )}

      {/* Navigation */}
      <nav className="relative z-20">
        <div className="absolute inset-0 bg-white/5 backdrop-blur-xl border-b border-white/10" />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-12">
              <Link href="/" className="flex items-center group">
                {/* Logo Image */}
                <Image 
                  src="/logo.png"
                  alt="Amica Logo"
                  width={32}
                  height={32}
                  className="mr-3 group-hover:opacity-80 transition-opacity"
                />
                <span className="text-2xl font-extrabold text-white tracking-wider group-hover:text-white/80 transition-colors">AMICA</span>
              </Link>

              {/* Desktop Navigation */}
              <div className="hidden md:flex items-center">
                <div className="flex items-center bg-white/10 backdrop-blur-md rounded-full p-1 gap-1">
                  {navItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`px-5 py-2 rounded-full text-sm font-light transition-all duration-300 ${
                        isActive(item.href)
                          ? 'bg-white/20 text-white shadow-lg'
                          : 'text-white/70 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden text-white/70 hover:text-white p-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>

              {/* Connect Button - no wrapper div */}
              <ConnectButton />
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-b border-white/10">
            <div className="px-6 py-4 space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-3 rounded-lg text-sm font-light transition-all duration-300 ${
                    isActive(item.href)
                      ? 'bg-white/20 text-white'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="relative z-10">
        {children}
      </main>

      {/* Minimal Footer */}
      <footer className="relative z-10 border-t border-white/10 mt-20">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-white/40 text-sm">
              © {(new Date()).getFullYear()} Amica Protocol
            </div>
            <div className="flex space-x-6">
              <a href="#" className="text-white/40 hover:text-white/60 text-sm transition-colors">Docs</a>
              <a href="#" className="text-white/40 hover:text-white/60 text-sm transition-colors">GitHub</a>
              <a href="#" className="text-white/40 hover:text-white/60 text-sm transition-colors">Discord</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-purple-500/10 rounded-full blur-3xl" />
      </div>
    </div>
  );
};

export default Layout;
