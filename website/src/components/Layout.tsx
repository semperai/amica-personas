// src/components/Layout.tsx
import { ReactNode } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useApiStatus } from '@/components/ApiStatusProvider';
import { ApiSetupGuide } from '@/components/ApiSetupGuide';
import { useAccount } from 'wagmi';
import { hasBridgeWrapper } from '@/lib/contracts';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const router = useRouter();
  const { isOnline, isChecking, isMockMode } = useApiStatus();
  const { chainId } = useAccount();

  const isActive = (path: string) => {
    return router.pathname === path;
  };

  // Check if bridge is available on current chain
  const showBridge = chainId && hasBridgeWrapper(chainId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Mock Mode Banner */}
      {isMockMode && (
        <div className="bg-purple-600/20 backdrop-blur-sm text-white px-4 py-2 text-center text-sm border-b border-purple-500/20">
          <span>🧪 Mock Mode Enabled - Using test data for development</span>
        </div>
      )}

      {/* API Status Banner */}
      {!isChecking && !isOnline && !isMockMode && (
        <div className="bg-yellow-500/20 backdrop-blur-sm text-white px-4 py-2 text-center text-sm border-b border-yellow-500/20">
          <span>⚠️ API service is currently offline. Some features may not work properly.</span>
        </div>
      )}

      {/* Navigation */}
      <nav className="relative z-20 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <Link href="/" className="flex items-center">
                <span className="text-xl font-light text-white tracking-wider">AMICA</span>
              </Link>

              <div className="hidden md:flex items-center space-x-6">
                <Link
                  href="/"
                  className={`text-sm font-light transition-colors ${
                    isActive('/') ? 'text-white' : 'text-white/60 hover:text-white'
                  }`}
                >
                  Explore
                </Link>
                <Link
                  href="/create"
                  className={`text-sm font-light transition-colors ${
                    isActive('/create') ? 'text-white' : 'text-white/60 hover:text-white'
                  }`}
                >
                  Create
                </Link>
                <Link
                  href="/portfolio"
                  className={`text-sm font-light transition-colors ${
                    isActive('/portfolio') ? 'text-white' : 'text-white/60 hover:text-white'
                  }`}
                >
                  Portfolio
                </Link>
                {showBridge && (
                  <Link
                    href="/bridge"
                    className={`text-sm font-light transition-colors ${
                      isActive('/bridge') ? 'text-white' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    Bridge
                  </Link>
                )}
                <Link
                  href="/staking"
                  className={`text-sm font-light transition-colors ${
                    isActive('/staking') ? 'text-white' : 'text-white/60 hover:text-white'
                  }`}
                >
                  Staking
                </Link>
              </div>
            </div>

            <div className="flex items-center">
              <ConnectButton />
            </div>
          </div>
        </div>
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
              © 2024 Amica Protocol
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

      {/* API Setup Guide (development only) */}
      <ApiSetupGuide />
    </div>
  );
};

export default Layout;
