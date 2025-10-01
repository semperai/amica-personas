import { ethers as EthersTypes } from 'ethers';

// --- Constants ---
// Storage key for the derived wallet cache
const DERIVED_WALLET_STORAGE_KEY = 'arbiuswallet_derivedWalletCache';
const LEGACY_WALLET_STORAGE_KEY = 'arbiuswallet_legacyWalletCache';

// AIUS Token Contract Address on Arbitrum
const AIUS_TOKEN_ADDRESS = '0x4a24B101728e07A52053c13FB4dB2BcF490CAbc3';

// Allowed domains for wallet creation
const ALLOWED_DOMAINS = ['localhost', 'arbiusplayground.com'];

// Minimal ERC20 ABI required for balance, decimals, and transfer
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

// --- Interfaces ---
interface WalletCache {
  ownerAddress: string;
  derivedPrivateKey: string;
  derivedAddress: string;
  signatureVersion: number; // Add version tracking for future upgrades
  createdAt: string; // ISO timestamp
}

// --- Helper Functions ---
function validateOrigin(): boolean {
  const hostname = window.location.hostname;
  return ALLOWED_DOMAINS.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
}

function generateDeterministicMessage(ownerAddress: string, useLegacyFormat: boolean): string {
  if (useLegacyFormat) {
    return `Create deterministic wallet for ${ownerAddress}`;
  }

  const hostname = window.location.hostname;
  return `Arbius Wallet wants you to create a deterministic wallet
Domain: ${hostname}
Wallet address: ${ownerAddress}
Purpose: Create deterministic wallet for secure transactions

Warning: Make sure the URL matches the official Arbius website: https://arbiusplayground.com`;
}

function validateMessage(message: string): boolean {
  // Check if message follows the new secure format
  const requiredFields = ['Domain:', 'Wallet address:', 'Nonce:', 'Issued At:', 'Purpose:'];
  return requiredFields.every(field => message.includes(field));
}

/**
 * Initializes or retrieves a cached deterministic wallet.
 * This wallet is derived from the owner's signature, is unique to the ownerAddress,
 * and is connected to the provided provider.
 *
 * @param appEthers The ethers.js library object provided by the consuming application.
 *                  Pass the full ethers object (e.g., initDeterministicWallet(ethers, ...))
 * @param ownerAddress The address of the EOA wallet that owns the deterministic wallet.
 * @param signMessage A function that takes a message string and returns a Promise resolving to the signature.
 * @param provider A provider instance.
 * @param useLegacyFormat A boolean indicating whether to use the legacy message format.
 * @returns A Promise that resolves to a Wallet instance of the deterministic wallet.
 */
export async function initDeterministicWallet(
  appEthers: any,
  ownerAddress: string,
  signMessage: (message: string) => Promise<string>,
  provider: any,
  useLegacyFormat: boolean = false
): Promise<any> {
  if (!appEthers || !ownerAddress || !signMessage || !provider) {
    throw new Error("appEthers, ownerAddress, signMessage, and provider are required.");
  }

  // Validate origin before proceeding
  if (!validateOrigin()) {
    throw new Error("Wallet creation is only allowed on authorized domains");
  }

  // Determine if we're using ethers v5 or v6
  const isV5 = typeof appEthers.utils !== 'undefined' || typeof appEthers.keccak256 === 'undefined';
  
  // If we only have utils, we need to get the full ethers object
  const fullEthers = appEthers.Wallet ? appEthers : (window as any).ethers;
  
  if (!fullEthers || !fullEthers.Wallet) {
    throw new Error("Could not find the Wallet constructor. Make sure you're passing the full ethers object.");
  }

  const lowerOwnerAddress = ownerAddress.toLowerCase();
  const legacyKey = 'arbiuswallet_legacyWalletCache';
  const newKey = 'arbiuswallet_derivedWalletCache';

  if (useLegacyFormat) {
    const cached = localStorage.getItem(legacyKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.signatureVersion === 0 && parsed.ownerAddress.toLowerCase() === lowerOwnerAddress) {
          const walletInstance = new fullEthers.Wallet(parsed.derivedPrivateKey);
          console.log('Using cached legacy wallet:', walletInstance.address);
          return walletInstance.connect(provider);
        }
      } catch (e) {
        localStorage.removeItem(legacyKey);
      }
    }
    // Create and store legacy wallet ONLY in legacyKey
    console.log('Creating new legacy wallet for', lowerOwnerAddress);
    const messageToSign = generateDeterministicMessage(lowerOwnerAddress, true);
    const signature = await signMessage(messageToSign);
    const utf8Bytes = new TextEncoder().encode(signature);
    let hashedSignature: string;
    if (isV5) {
      hashedSignature = fullEthers.utils.keccak256(fullEthers.utils.toUtf8Bytes(signature));
    } else {
      hashedSignature = appEthers.keccak256(utf8Bytes);
    }
    const walletInstance = new fullEthers.Wallet(hashedSignature);
    const newCacheData: WalletCache = {
      ownerAddress: lowerOwnerAddress,
      derivedPrivateKey: walletInstance.privateKey,
      derivedAddress: walletInstance.address,
      signatureVersion: 0,
      createdAt: new Date().toISOString()
    };
    localStorage.setItem(legacyKey, JSON.stringify(newCacheData));
    console.log('New legacy wallet created and cached:', walletInstance.address);
    return walletInstance.connect(provider);
  } else {
    const cached = localStorage.getItem(newKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.signatureVersion === 1 && parsed.ownerAddress.toLowerCase() === lowerOwnerAddress) {
          const walletInstance = new fullEthers.Wallet(parsed.derivedPrivateKey);
          console.log('Using cached new-format wallet:', walletInstance.address);
          return walletInstance.connect(provider);
        }
      } catch (e) {
        localStorage.removeItem(newKey);
      }
    }
    // Create and store new-format wallet ONLY in newKey
    console.log('Creating new wallet with secure format for', lowerOwnerAddress);
    const messageToSign = generateDeterministicMessage(lowerOwnerAddress, false);
    const signature = await signMessage(messageToSign);
    const utf8Bytes = new TextEncoder().encode(signature);
    let hashedSignature: string;
    if (isV5) {
      hashedSignature = fullEthers.utils.keccak256(fullEthers.utils.toUtf8Bytes(signature));
    } else {
      hashedSignature = appEthers.keccak256(utf8Bytes);
    }
    const walletInstance = new fullEthers.Wallet(hashedSignature);
    const newCacheData: WalletCache = {
      ownerAddress: lowerOwnerAddress,
      derivedPrivateKey: walletInstance.privateKey,
      derivedAddress: walletInstance.address,
      signatureVersion: 1,
      createdAt: new Date().toISOString()
    };
    localStorage.setItem(newKey, JSON.stringify(newCacheData));
    console.log('New wallet created and cached:', walletInstance.address);
    return walletInstance.connect(provider);
  }
}

/**
 * Retrieves the address of the deterministic wallet for deposit purposes.
 * It ensures the wallet is initialized (created and cached if it's the first time).
 *
 * @param appEthers The ethers.js library object provided by the consuming application.
 * @param ownerAddress The address of the EOA wallet.
 * @param signMessage A function that takes a message string and returns a Promise resolving to the signature.
 * @param provider A provider instance.
 * @returns A Promise that resolves to the address (string) of the deterministic wallet.
 */
export async function getDeterministicWalletAddressForDeposit(
  appEthers: any,
  ownerAddress: string,
  signMessage: (message: string) => Promise<string>,
  provider: any
): Promise<string> {
  const wallet = await initDeterministicWallet(appEthers, ownerAddress, signMessage, provider);
  return wallet.address;
}

/**
 * Withdraws funds (ETH or AIUS token) from the deterministic wallet to a recipient address.
 *
 * @param appEthers The ethers.js library object provided by the consuming application.
 * @param deterministicWallet The initialized ethers.Wallet instance of the deterministic wallet (should be from appEthers.Wallet).
 * @param recipientAddress The address to withdraw funds to (typically the owner's EOA).
 * @param options An object containing withdrawal options:
 *                - amount?: The amount to withdraw (string). If not provided for ETH, attempts to withdraw max.
 *                          For AIUS, if not provided, withdraws the entire token balance.
 *                - token: Specifies whether to withdraw 'ETH' or 'AIUS'.
 * @returns A Promise that resolves to the transaction hash (string) if successful, or null otherwise.
 * @throws Will throw an error if the withdrawal process fails.
 */
export async function withdrawFromDeterministicWallet(
  appEthers: any,
  deterministicWallet: any,
  recipientAddress: string,
  options: {
    amount?: string;
    token: 'ETH' | 'AIUS';
  }
): Promise<string | null> {
  if (!deterministicWallet.provider) {
    console.error('Deterministic wallet is not connected to a provider.');
    throw new Error('Deterministic wallet is not connected to a provider.');
  }
  // The provider is already part of the connected deterministicWallet instance
  const provider = deterministicWallet.provider;

  try {
    const tokenType = options.token;
    const specifiedAmountStr = options.amount;

    if (tokenType === 'ETH') {
      const balance = await provider.getBalance(deterministicWallet.address);
      if (balance === 0n && !specifiedAmountStr) { // Only throw if trying to withdraw max from zero balance
          throw new Error('No ETH available to withdraw from deterministic wallet.');
      }
      if (balance === 0n && specifiedAmountStr && appEthers.parseEther(specifiedAmountStr) > 0n) {
          throw new Error('No ETH available to withdraw, requested amount cannot be fulfilled.');
      }


      let valueToSend: bigint;

      if (specifiedAmountStr) {
        const parsedAmount = appEthers.parseEther(specifiedAmountStr);
        if (parsedAmount <= 0n) {
            throw new Error('ETH withdrawal amount must be greater than zero.');
        }
        // Estimate gas for the specified amount
        const gasEstimate = await provider.estimateGas({
            from: deterministicWallet.address,
            to: recipientAddress,
            value: parsedAmount,
        });
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice || appEthers.parseUnits("1", "gwei"); // Fallback
        const gasCost = gasEstimate * gasPrice;

        if (parsedAmount + gasCost > balance) {
            throw new Error(
              `Withdrawal amount (${appEthers.formatEther(parsedAmount)} ETH) plus estimated gas ` +
              `(${appEthers.formatEther(gasCost)} ETH) exceeds available balance (${appEthers.formatEther(balance)} ETH).`
            );
        }
        valueToSend = parsedAmount;
      } else { // Withdraw max ETH
        if (balance === 0n) throw new Error('No ETH available to withdraw.');
        const gasEstimate = await provider.estimateGas({
          from: deterministicWallet.address,
          to: recipientAddress,
          value: balance, // Estimate for potentially full balance transfer
        });
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice || appEthers.parseUnits("1", "gwei");
        const gasCost = gasEstimate * gasPrice;
        
        // Apply a 20% buffer to the calculated gas cost for safety
        const bufferedGasCost = BigInt(gasCost) * BigInt(120) / BigInt(100);
        valueToSend = balance - bufferedGasCost;
        
        if (valueToSend <= 0n) {
          throw new Error(
            `Insufficient ETH balance (${appEthers.formatEther(balance)} ETH) to cover estimated gas costs ` +
            `(${appEthers.formatEther(bufferedGasCost)} ETH) for withdrawal.`
          );
        }
      }

      const txResponse = await deterministicWallet.sendTransaction({
        to: recipientAddress,
        value: valueToSend,
      });
      await txResponse.wait(); // Wait for confirmation
      console.log('ETH withdrawal successful. TxHash:', txResponse.hash);
      return txResponse.hash;

    } else if (tokenType === 'AIUS') {
      const tokenContract = new appEthers.Contract(AIUS_TOKEN_ADDRESS, ERC20_ABI, deterministicWallet);
      const tokenBalance = await tokenContract.balanceOf(deterministicWallet.address);

      if (tokenBalance === 0n && !specifiedAmountStr) {
          throw new Error('No AIUS tokens available to withdraw.');
      }
       if (tokenBalance === 0n && specifiedAmountStr && appEthers.parseUnits(specifiedAmountStr, await tokenContract.decimals()) > 0n) {
          throw new Error('No AIUS tokens available to withdraw, requested amount cannot be fulfilled.');
      }


      const decimals = await tokenContract.decimals() as bigint; // Ethers v6 returns bigint for decimals()
      let valueToSend: bigint;

      if (specifiedAmountStr) {
        valueToSend = appEthers.parseUnits(specifiedAmountStr, Number(decimals)); // parseUnits takes number for decimals
        if (valueToSend <= 0n) {
            throw new Error('AIUS withdrawal amount must be greater than zero.');
        }
        if (valueToSend > tokenBalance) {
          throw new Error(
            `Withdrawal amount (${specifiedAmountStr} AIUS) exceeds available token balance ` +
            `(${appEthers.formatUnits(tokenBalance, Number(decimals))} AIUS).`
          );
        }
      } else { // Withdraw max AIUS
        if (tokenBalance === 0n) throw new Error('No AIUS tokens available to withdraw.');
        valueToSend = tokenBalance;
      }
      
      // Check ETH balance for gas on token transfer
      const ethBalance = await provider.getBalance(deterministicWallet.address);
      const transferTxPopulated = await tokenContract.transfer.populateTransaction(recipientAddress, valueToSend);
      const gasEstimate = await provider.estimateGas({
          ...transferTxPopulated,
          from: deterministicWallet.address // Gas is paid by the deterministic wallet
      });
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || appEthers.parseUnits("1", "gwei");
      const gasCost = gasEstimate * gasPrice;

      if (gasCost > ethBalance) {
          throw new Error(
            `Insufficient ETH in deterministic wallet (${appEthers.formatEther(ethBalance)} ETH) to cover gas costs ` +
            `(${appEthers.formatEther(gasCost)} ETH) for AIUS withdrawal.`
          );
      }

      const txResponse = await tokenContract.transfer(recipientAddress, valueToSend);
      await txResponse.wait(); // Wait for confirmation
      console.log('AIUS withdrawal successful. TxHash:', txResponse.hash);
      return txResponse.hash;
    } else {
      // Should not happen due to TypeScript types, but good for robustness
      console.error('Invalid token type specified:', options.token);
      throw new Error("Invalid token type specified. Must be 'ETH' or 'AIUS'.");
    }
  } catch (error) {
    console.error('Failed to withdraw funds from deterministic wallet:', error);
    // Rethrow the error so the calling application can handle it
    if (error instanceof Error) {
        throw error;
    }
    throw new Error(String(error)); // Ensure it's always an Error object
  }
}

/**
 * Sends a transaction from the deterministic wallet to a contract
 * @param appEthers The ethers instance from the application
 * @param wallet The deterministic wallet instance
 * @param to The contract address to call
 * @param data The encoded function data
 * @param value Optional ETH value to send with the transaction
 * @returns Transaction hash or null if failed
 */
export async function sendContractTransaction(
  appEthers: any,
  wallet: any,
  to: string,
  data: string,
  value: string = '0'
): Promise<{ hash: string | null; error?: { message: string; code?: string; data?: any; transaction?: any } }> {
  try {
    // Get the current gas price with a 20% buffer for price fluctuations
    const gasPrice = await wallet.provider?.getFeeData();
    if (!gasPrice?.gasPrice) {
      return {
        hash: null,
        error: {
          message: 'Failed to get gas price',
          code: 'GAS_PRICE_ERROR'
        }
      };
    }
    
    // Use BigNumber operations instead of BigInt
    const bufferedGasPrice = gasPrice.gasPrice.mul(120).div(100);

    // Estimate gas for the transaction
    const gasEstimate = await wallet.provider?.estimateGas({
      to,
      data,
      value: appEthers.parseEther(value)
    });

    if (!gasEstimate) {
      return {
        hash: null,
        error: {
          message: 'Failed to estimate gas',
          code: 'GAS_ESTIMATE_ERROR'
        }
      };
    }

    // Use BigNumber operations instead of BigInt
    const bufferedGasLimit = gasEstimate.mul(120).div(100);

    // Send the transaction
    const tx = await wallet.sendTransaction({
      to,
      data,
      value: appEthers.parseEther(value),
      gasPrice: bufferedGasPrice,
      gasLimit: bufferedGasLimit
    });

    return { hash: tx.hash };
  } catch (error: any) {
    return {
      hash: null,
      error: {
        message: error?.message || 'Unknown error',
        code: error?.code || 'UNKNOWN_ERROR',
        data: error?.data,
        transaction: error?.transaction
      }
    };
  }
}

/**
 * Gets the ETH and AIUS token balances of the deterministic wallet
 * @param appEthers The ethers instance from the application
 * @param wallet The deterministic wallet instance
 * @returns Object containing ETH and AIUS balances in string format
 */
export async function getDeterministicWalletBalances(
  appEthers: any,
  wallet: any
): Promise<{ eth: string; aius: string }> {
  if (!wallet.provider) {
    throw new Error('Deterministic wallet is not connected to a provider');
  }

  try {
    // Get ETH balance
    const ethBalance = await wallet.provider.getBalance(wallet.address);
    const formattedEthBalance = appEthers.formatEther(ethBalance);

    // Get AIUS balance
    const tokenContract = new appEthers.Contract(AIUS_TOKEN_ADDRESS, ERC20_ABI, wallet);
    const aiusBalance = await tokenContract.balanceOf(wallet.address);
    const decimals = await tokenContract.decimals();
    const formattedAiusBalance = appEthers.formatUnits(aiusBalance, decimals);

    return {
      eth: formattedEthBalance,
      aius: formattedAiusBalance
    };
  } catch (error) {
    console.error('Failed to get wallet balances:', error);
    throw error;
  }
} 