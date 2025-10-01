import React from 'react';
import { useAAWallet } from '../hooks/useAAWallet';

interface ConnectButtonProps {
  className?: string;
  connectText?: string;
  disconnectText?: string;
  loadingText?: string;
}

export const ConnectButton: React.FC<ConnectButtonProps> = ({ 
  className = '',
  connectText = 'Connect',
  disconnectText = 'Disconnect',
  loadingText = 'Connecting...',
}) => {
  const { isConnected, connect, disconnect, address } = useAAWallet();
  const [isLoading, setIsLoading] = React.useState(false);
  
  const handleConnect = async () => {
    setIsLoading(true);
    try {
      await connect();
    } catch (error) {
      console.error('Failed to connect:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDisconnect = () => {
    disconnect();
  };
  
  const buttonClass = `
    ${isConnected ? 'px-3 py-0.5 text-sm' : 'px-8 py-2 text-lg'}
    rounded-full font-medium transition-colors
    bg-[#0A0047] hover:bg-[#07003a] text-white
    ${isLoading ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}
    ${className}
  `;
  
  const displayAddress = address 
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '';
    
  return (
    <button
      className={buttonClass}
      onClick={isConnected ? handleDisconnect : handleConnect}
      disabled={isLoading}
    >
      {isLoading ? loadingText : isConnected ? `${disconnectText} (${displayAddress})` : connectText}
    </button>
  );
};