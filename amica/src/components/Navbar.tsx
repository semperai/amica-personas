import { ConnectButton } from '@rainbow-me/rainbowkit';
import { AAWalletDisplay } from '@/lib/arbius-wallet';
import { Send } from 'lucide-react';

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 font-[family-name:var(--font-family-fredoka)]">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Left side - Logo and Brand */}
          <div className="flex items-center space-x-4">
            <a
              href="https://personas.heyamica.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-3 bg-white rounded-xl px-4 py-2 shadow-sm h-10 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <img
                src="/AmicaLogo.png"
                alt="Amica Logo"
                className="h-6 w-6"
              />
              <span className="text-xl font-semibold text-gray-900 tracking-tight">
                Amica
              </span>
            </a>

            {/* Telegram Link */}
            <a
              href="https://t.me/arbius_ai"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white rounded-xl px-3 py-2 shadow-sm h-10 flex items-center hover:bg-gray-50 transition-colors cursor-pointer"
              title="Join Arbius on Telegram"
            >
              <Send className="h-5 w-5 text-gray-700" />
            </a>
          </div>

          {/* Right side - Wallet Connections */}
          <div className="flex items-center space-x-4">
            {/* AA Wallet Display */}
            <AAWalletDisplay arbiusLogoSrc="/ArbiusLogo.webp" />

            {/* RainbowKit Connect */}
            <ConnectButton
              chainStatus="icon"
              showBalance={false}
            />
          </div>
        </div>
      </div>
    </nav>
  );
}
