import { useAAWallet } from '../hooks/useAAWallet';
import { useState } from 'react';
import { AAWalletModal } from './AAWalletModal';

interface AAWalletDisplayProps {
  arbiusLogoSrc?: string;
}

export function AAWalletDisplay({ arbiusLogoSrc }: AAWalletDisplayProps) {
  const { smartAccountAddress, isInitializing } = useAAWallet();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleClick = () => {
    if (smartAccountAddress) {
      setIsModalOpen(true);
    }
  };

  if (isInitializing) {
    return (
      <div className="text-base text-gray-900 px-4 py-2 bg-white rounded-xl shadow-sm h-10 flex items-center font-[family-name:var(--font-family-fredoka)] font-medium">
        Initializing...
      </div>
    );
  }

  if (!smartAccountAddress) {
    return null;
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="text-base text-gray-700 font-[family-name:var(--font-family-fredoka)] font-medium bg-white rounded-xl px-4 py-2 shadow-sm h-10 flex items-center space-x-2 hover:bg-gray-50 hover:scale-105 transition-all cursor-pointer"
      >
        {arbiusLogoSrc && (
          <img src={arbiusLogoSrc} alt="Arbius" className="h-5 w-5" />
        )}
        <span>
          0x{smartAccountAddress.slice(2, 4)}...{smartAccountAddress.slice(-4)}
        </span>
      </button>

      <AAWalletModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        smartAccountAddress={smartAccountAddress}
      />
    </>
  );
}
