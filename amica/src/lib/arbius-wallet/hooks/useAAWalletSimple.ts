import { useContext, useEffect, useState, useCallback } from 'react';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';
import { type Hex, type PrivateKeyAccount } from 'viem';
import { AAWalletContext } from '../components/AAWalletProvider';
import { initDeterministicWallet, getCachedWalletAddress } from '../utils/viemWalletUtils';

export function useAAWallet() {
  const context = useContext(AAWalletContext);
  const { address: connectedAddress } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [smartAccountAddress, setSmartAccountAddress] = useState<string | null>(null);
  const [derivedAccount, setDerivedAccount] = useState<PrivateKeyAccount | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // Initialize derived wallet when connected
  useEffect(() => {
    const initWallet = async () => {
      if (!connectedAddress || !walletClient || isInitializing) return;

      // Check if we already have a cached address
      const cachedAddress = getCachedWalletAddress(connectedAddress);
      if (cachedAddress) {
        setSmartAccountAddress(cachedAddress);
        console.log('Found cached AA wallet:', cachedAddress);
        return;
      }

      setIsInitializing(true);
      try {
        const signMessage = async (message: string): Promise<Hex> => {
          const signature = await walletClient.signMessage({
            account: connectedAddress,
            message
          });
          return signature;
        };

        const account = await initDeterministicWallet(connectedAddress, signMessage);
        setDerivedAccount(account);
        setSmartAccountAddress(account.address);
        console.log('Derived AA wallet initialized:', account.address);
      } catch (error) {
        console.error('Failed to initialize AA wallet:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    initWallet();
  }, [connectedAddress, walletClient]);

  const signMessageWithAAWallet = useCallback(async (message: string): Promise<Hex | null> => {
    if (!derivedAccount) {
      console.error('AA wallet not initialized');
      return null;
    }

    try {
      const signature = await derivedAccount.signMessage({ message });
      return signature;
    } catch (error) {
      console.error('Failed to sign message with AA wallet:', error);
      return null;
    }
  }, [derivedAccount]);

  return {
    ...context,
    smartAccountAddress,
    derivedAccount,
    signMessageWithAAWallet,
    isInitializing,
  };
}
