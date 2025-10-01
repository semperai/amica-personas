import { keccak256, toBytes, toHex, type Hex } from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';

// Storage keys
const DERIVED_WALLET_STORAGE_KEY = 'arbiuswallet_derivedWalletCache';

// Allowed domains
const ALLOWED_DOMAINS = ['localhost', 'heyamica.com', 'amica.arbius.ai'];

interface WalletCache {
  ownerAddress: string;
  derivedPrivateKey: Hex;
  derivedAddress: string;
  signatureVersion: number;
  createdAt: string;
}

function validateOrigin(): boolean {
  const hostname = window.location.hostname;
  return ALLOWED_DOMAINS.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
}

function generateDeterministicMessage(ownerAddress: string): string {
  const hostname = window.location.hostname;
  return `Amica wants you to create a deterministic wallet
Domain: ${hostname}
Wallet address: ${ownerAddress}
Purpose: Create deterministic wallet for AI agent interactions

Warning: Make sure the URL matches the official Amica website`;
}

export async function initDeterministicWallet(
  ownerAddress: string,
  signMessage: (message: string) => Promise<Hex>
): Promise<PrivateKeyAccount> {
  if (!ownerAddress || !signMessage) {
    throw new Error("ownerAddress and signMessage are required.");
  }

  // Validate origin
  if (!validateOrigin()) {
    throw new Error("Wallet creation is only allowed on authorized domains");
  }

  const lowerOwnerAddress = ownerAddress.toLowerCase();
  const cached = localStorage.getItem(DERIVED_WALLET_STORAGE_KEY);

  if (cached) {
    try {
      const parsed: WalletCache = JSON.parse(cached);
      if (parsed.ownerAddress.toLowerCase() === lowerOwnerAddress) {
        const account = privateKeyToAccount(parsed.derivedPrivateKey);
        console.log('Using cached derived wallet:', account.address);
        return account;
      }
    } catch (e) {
      localStorage.removeItem(DERIVED_WALLET_STORAGE_KEY);
    }
  }

  // Create new wallet
  console.log('Creating new deterministic wallet for', lowerOwnerAddress);
  const messageToSign = generateDeterministicMessage(lowerOwnerAddress);
  const signature = await signMessage(messageToSign);

  // Hash the signature to create a private key
  const hashedSignature = keccak256(toBytes(signature));
  const account = privateKeyToAccount(hashedSignature);

  // Cache the wallet
  const cacheData: WalletCache = {
    ownerAddress: lowerOwnerAddress,
    derivedPrivateKey: hashedSignature,
    derivedAddress: account.address,
    signatureVersion: 1,
    createdAt: new Date().toISOString()
  };

  localStorage.setItem(DERIVED_WALLET_STORAGE_KEY, JSON.stringify(cacheData));
  console.log('New deterministic wallet created and cached:', account.address);

  return account;
}

export function getCachedWalletAddress(ownerAddress: string): string | null {
  const cached = localStorage.getItem(DERIVED_WALLET_STORAGE_KEY);
  if (!cached) return null;

  try {
    const parsed: WalletCache = JSON.parse(cached);
    if (parsed.ownerAddress.toLowerCase() === ownerAddress.toLowerCase()) {
      return parsed.derivedAddress;
    }
  } catch (e) {
    return null;
  }

  return null;
}

export function getCachedWallet(address: string): PrivateKeyAccount | null {
  const cached = localStorage.getItem(DERIVED_WALLET_STORAGE_KEY);
  if (!cached) return null;

  try {
    const parsed: WalletCache = JSON.parse(cached);
    if (parsed.derivedAddress.toLowerCase() === address.toLowerCase()) {
      return privateKeyToAccount(parsed.derivedPrivateKey);
    }
  } catch (e) {
    return null;
  }

  return null;
}
