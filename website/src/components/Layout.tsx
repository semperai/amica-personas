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
    return router.pathname === path ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-600 hover:text-purple-600';
  };

  // Check if bridge is available on current chain
  const showBridge = chainId && hasBridgeWrapper(chainId);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mock Mode Banner */}
      {isMockMode && (
        <div className="bg-purple-600 text-white px-4 py-2 text-center text-sm">
          <span>🧪 Mock Mode Enabled - Using test data for development</span>
        </div>
      )}

      {/* API Status Banner */}
      {!isChecking && !isOnline && !isMockMode && (
        <div className="bg-yellow-500 text-white px-4 py-2 text-center text-sm">
          <span>⚠️ API service is currently offline. Some features may not work properly.</span>
        </div>
      )}

      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link href="/" className="flex items-center">
                <span className="text-2xl font-bold text-purple-600">Amica</span>
                <span className="text-2xl font-light text-gray-800 ml-2">Personas</span>
              </Link>

              <div className="ml-10 flex items-center space-x-8">
                <Link href="/" className={`${isActive('/')} px-3 py-2 text-sm font-medium transition-colors`}>
                  Explore
                </Link>
                <Link href="/trending" className={`${isActive('/trending')} px-3 py-2 text-sm font-medium transition-colors`}>
                  Trending
                </Link>
                <Link href="/create" className={`${isActive('/create')} px-3 py-2 text-sm font-medium transition-colors`}>
                  Create
                </Link>
                <Link href="/portfolio" className={`${isActive('/portfolio')} px-3 py-2 text-sm font-medium transition-colors`}>
                  Portfolio
                </Link>
                {showBridge && (
                  <Link href="/bridge" className={`${isActive('/bridge')} px-3 py-2 text-sm font-medium transition-colors`}>
                    Bridge
                  </Link>
                )}
                <Link href="/staking" className={`${isActive('/staking')} px-3 py-2 text-sm font-medium transition-colors`}>
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Protocol</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link href="/create" className="hover:text-purple-600">Create Persona</Link></li>
                <li><Link href="/trending" className="hover:text-purple-600">Trending</Link></li>
                <li><Link href="/staking" className="hover:text-purple-600">Staking</Link></li>
                {showBridge && (
                  <li><Link href="/bridge" className="hover:text-purple-600">Bridge</Link></li>
                )}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Resources</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#" className="hover:text-purple-600">Documentation</a></li>
                <li><a href="#" className="hover:text-purple-600">GitHub</a></li>
                <li><a href="#" className="hover:text-purple-600">Discord</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">About</h3>
              <p className="text-sm text-gray-600">
                Amica Protocol enables the creation and trading of AI persona tokens with integrated agent support.
              </p>
              {isMockMode && <p className="text-xs text-gray-500 mt-2">(Mock Mode Active)</p>}
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              © 2024 Amica Protocol. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* API Setup Guide (development only) */}
      <ApiSetupGuide />
    </div>
  );
};

export default Layout;
