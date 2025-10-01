import { useContext, useEffect, useState } from 'react';
import { AAWalletContext } from '../components/AAWalletProvider';
import { AAWalletContextValue } from '../types';
import { ethers } from 'ethers';

// AIUS Token Contract
const AIUS_TOKEN_ADDRESS = '0x4a24B101728e07A52053c13FB4dB2BcF490CAbc3';

// Minimal ERC20 ABI for balance checking
const ERC20_ABI = [
  {
    "constant": true,
    "inputs": [{ "name": "_owner", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "balance", "type": "uint256" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "name": "", "type": "uint8" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "symbol",
    "outputs": [{ "name": "", "type": "string" }],
    "type": "function"
  }
];

// Extended type for our hook return value
interface DerivedWalletContext extends AAWalletContextValue {
  smartAccountAddress: string | null;
  sendDerivedWalletTransaction: (tx: {
    to: string;
    value: string;
    data?: string;
  }) => Promise<string | null>;
  signMessageWithAAWallet: (message: string) => Promise<string | null>;
  withdrawToMainWallet: (options: {
    amount?: string;
    token?: 'ETH' | 'AIUS';
  }) => Promise<string | null>;
}

// Storage key for the derived wallet
const DERIVED_WALLET_STORAGE_KEY = 'derivedWalletCache';

// Type for cache storage
interface WalletCache {
  ownerAddress: string;
  derivedPrivateKey: string;
  derivedAddress: string;
}

export function useAAWallet(): DerivedWalletContext {
  const context = useContext(AAWalletContext);
  const [smartAccountAddress, setSmartAccountAddress] = useState<string | null>(null);
  const [derivedWallet, setDerivedWallet] = useState<ethers.Wallet | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  
  useEffect(() => {
    const initDerivedWallet = async () => {
      if (!context.isConnected || !context.address || !window.ethereum) return;
      
      try {
        // Create ethers provider for Arbitrum
        const provider = new ethers.BrowserProvider(window.ethereum);
        setProvider(provider);
        
        // Check if we already have a cached wallet for this address
        const cachedWalletJson = localStorage.getItem(DERIVED_WALLET_STORAGE_KEY);
        let cachedWallet: WalletCache | null = null;
        
        if (cachedWalletJson) {
          try {
            const parsed = JSON.parse(cachedWalletJson);
            // Ensure the cache is for the current connected address
            if (parsed.ownerAddress.toLowerCase() === context.address.toLowerCase()) {
              cachedWallet = parsed;
              console.log('Found cached derived wallet');
            }
          } catch (e) {
            console.error('Error parsing cached wallet:', e);
            // Clear invalid cache
            localStorage.removeItem(DERIVED_WALLET_STORAGE_KEY);
          }
        }
        
        let walletInstance: ethers.Wallet;
        
        if (cachedWallet) {
          // Use the cached wallet
          walletInstance = new ethers.Wallet(cachedWallet.derivedPrivateKey);
          console.log('Using cached derived wallet:', cachedWallet.derivedAddress);
        } else {
          // We need to create a new wallet
          console.log('No cached wallet found, creating new one...');
          
          // Get the signer for the connected account
          const signer = await provider.getSigner();
          
          // Create a unique message that will be consistent for this address
          const message = `Create deterministic wallet for ${context.address.toLowerCase()}`;
          
          // Check if we have a cached signature for this message
          const signatureCacheKey = `signature_${context.address.toLowerCase()}`;
          let signature = localStorage.getItem(signatureCacheKey);
          
          if (!signature) {
            // Get signature from main wallet only if we don't have it cached
            signature = await signer.signMessage(message);
            // Cache the signature
            localStorage.setItem(signatureCacheKey, signature);
          }
          
          // Use the signature as entropy to create a new deterministic wallet
          walletInstance = new ethers.Wallet(
            ethers.keccak256(ethers.toUtf8Bytes(signature))
          );
          
          // Cache the wallet for future use
          const cacheData: WalletCache = {
            ownerAddress: context.address,
            derivedPrivateKey: walletInstance.privateKey,
            derivedAddress: walletInstance.address
          };
          
          localStorage.setItem(DERIVED_WALLET_STORAGE_KEY, JSON.stringify(cacheData));
          console.log('New derived wallet created and cached');
        }
        
        // Connect the wallet to the provider
        const connectedWallet = walletInstance.connect(provider);
        
        // Save the derived wallet
        setDerivedWallet(connectedWallet);
        
        // Set the wallet address
        setSmartAccountAddress(connectedWallet.address);
        
        console.log('Derived wallet ready:', connectedWallet.address);
      } catch (error) {
        console.error('Failed to initialize derived wallet:', error);
      }
    };
    
    // Add a flag to prevent multiple simultaneous initializations
    let isInitializing = false;
    
    const init = async () => {
      if (isInitializing) return;
      isInitializing = true;
      await initDerivedWallet();
      isInitializing = false;
    };
    
    init();
    
    // Cleanup function
    return () => {
      isInitializing = true; // Prevent any pending initializations
    };
  }, [context.isConnected, context.address]);
  
  // Function to send a transaction using the derived wallet
  const sendDerivedWalletTransaction = async (tx: {
    to: string;
    value: string;
    data?: string;
  }): Promise<string | null> => {
    if (!derivedWallet || !provider) {
      console.error('Derived wallet not initialized');
      return null;
    }
    
    try {
      // Get current wallet balance
      const balance = await provider.getBalance(derivedWallet.address);
      console.log(`Wallet balance: ${ethers.formatEther(balance)} ETH`);
      
      // Create transaction request for gas estimation
      const txRequest = {
        to: tx.to,
        value: ethers.parseEther(tx.value),
        data: tx.data || '0x',
        from: derivedWallet.address
      };
      
      // Estimate gas using eth_estimateGas
      const gasLimit = await provider.estimateGas(txRequest);
      console.log(`Estimated gas limit: ${gasLimit}`);
      
      // Get the current gas price from the network
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || BigInt(100000000); // Fallback to 0.1 Gwei
      
      // Calculate gas cost with 20% buffer for safety
      const gasCost = gasPrice * gasLimit * 120n / 100n;
      console.log(`Estimated gas cost: ${ethers.formatEther(gasCost)} ETH`);
      
      // Calculate maximum amount that can be sent (balance - gas cost)
      let valueToSend = ethers.parseEther(tx.value);
      const maxPossible = balance - gasCost;
      
      // If trying to send more than available (including gas), adjust the amount
      if (valueToSend >= maxPossible) {
        console.log(`Adjusting send amount to account for gas fees`);
        if (maxPossible <= 0n) {
          throw new Error("Insufficient funds to cover gas costs");
        }
        // Leave a small amount for gas price fluctuations
        valueToSend = maxPossible * 95n / 100n; 
        console.log(`Adjusted amount: ${ethers.formatEther(valueToSend)} ETH`);
      }
      
      // Create final transaction request
      const finalTxRequest = {
        to: tx.to,
        value: valueToSend,
        data: tx.data || '0x',
        gasLimit: gasLimit,
        gasPrice: gasPrice
      };
      
      console.log('Sending transaction from derived wallet:', finalTxRequest);
      
      // Sign and send the transaction
      const txResponse = await derivedWallet.sendTransaction(finalTxRequest);
      
      // Wait for the transaction to be mined
      const receipt = await txResponse.wait();
      
      console.log('Transaction confirmed:', receipt);
      return txResponse.hash;
    } catch (error) {
      console.error('Failed to send transaction from derived wallet:', error);
      return null;
    }
  };
  
  // NEW: Function to sign a message using the derived AA wallet
  const signMessageWithAAWallet = async (message: string): Promise<string | null> => {
    if (!derivedWallet) {
      console.error('Derived AA wallet not initialized or available for signing.');
      // Optionally, you could try to re-initialize or prompt for it here if applicable
      return null;
    }
    try {
      const signature = await derivedWallet.signMessage(message);
      return signature;
    } catch (error) {
      console.error('Failed to sign message with AA wallet:', error);
      return null;
    }
  };
  
  // Function to withdraw funds from derived wallet to main wallet
  const withdrawToMainWallet = async (options: {
    amount?: string;
    token?: 'ETH' | 'AIUS';
  }): Promise<string | null> => {
    if (!derivedWallet || !provider || !context.address) {
      console.error('Derived wallet or main wallet not initialized');
      return null;
    }

    try {
      const token = options.token || 'ETH';
      const amount = options.amount;

      if (token === 'ETH') {
        // Get current wallet balance
        const balance = await provider.getBalance(derivedWallet.address);
        
        if (balance === 0n) {
          throw new Error('No ETH available to withdraw');
        }

        // If amount is specified, use it, otherwise withdraw entire balance minus gas
        let valueToSend: bigint;
        if (amount) {
          valueToSend = ethers.parseEther(amount);
          if (valueToSend >= balance) {
            throw new Error('Withdrawal amount exceeds available balance');
          }
        } else {
          // Estimate gas for the withdrawal transaction
          const gasEstimate = await provider.estimateGas({
            from: derivedWallet.address,
            to: context.address,
            value: balance
          });
          
          const feeData = await provider.getFeeData();
          const gasPrice = feeData.gasPrice || BigInt(100000000);
          const gasCost = gasPrice * gasEstimate;
          
          // Leave a small buffer for gas price fluctuations
          valueToSend = balance - (gasCost * 120n / 100n);
          
          if (valueToSend <= 0n) {
            throw new Error('Insufficient funds to cover gas costs');
          }
        }

        // Create and send the withdrawal transaction
        const txResponse = await derivedWallet.sendTransaction({
          to: context.address,
          value: valueToSend,
          gasLimit: await provider.estimateGas({
            from: derivedWallet.address,
            to: context.address,
            value: valueToSend
          })
        });

        // Wait for the transaction to be mined
        const receipt = await txResponse.wait();
        console.log('ETH withdrawal confirmed:', receipt);
        return txResponse.hash;
      } else {
        // Handle AIUS token withdrawal
        const tokenContract = new ethers.Contract(AIUS_TOKEN_ADDRESS, ERC20_ABI, derivedWallet);
        
        // Get token balance
        const balance = await tokenContract.balanceOf(derivedWallet.address);
        
        if (balance === 0n) {
          throw new Error('No AIUS tokens available to withdraw');
        }

        // Get token decimals
        const decimals = await tokenContract.decimals();
        
        // If amount is specified, use it, otherwise withdraw entire balance
        let valueToSend: bigint;
        if (amount) {
          valueToSend = ethers.parseUnits(amount, decimals);
          if (valueToSend >= balance) {
            throw new Error('Withdrawal amount exceeds available balance');
          }
        } else {
          valueToSend = balance;
        }

        // Create and send the token transfer transaction
        const txResponse = await tokenContract.transfer(context.address, valueToSend);
        
        // Wait for the transaction to be mined
        const receipt = await txResponse.wait();
        console.log('AIUS withdrawal confirmed:', receipt);
        return txResponse.hash;
      }
    } catch (error) {
      console.error('Failed to withdraw from derived wallet:', error);
      return null;
    }
  };
  
  if (!context) {
    throw new Error('useAAWallet must be used within an AAWalletProvider');
  }
  
  return {
    ...context,
    smartAccountAddress,
    sendDerivedWalletTransaction,
    signMessageWithAAWallet,
    withdrawToMainWallet,
  };
}