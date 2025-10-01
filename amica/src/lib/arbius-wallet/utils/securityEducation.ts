/**
 * This file contains educational examples of security vulnerabilities
 * and how to avoid them. These examples are for educational purposes only.
 * 
 * WARNING: Do not use any of these examples in production code!
 */

/**
 * ⚠️ BAD EXAMPLE - DO NOT USE ⚠️
 * 
 * This example shows how private keys can be leaked through global variables,
 * which is a security vulnerability.
 */
export function badPrivateKeyExample() {
  // ⚠️ NEVER DO THIS - Exposing private key in global scope ⚠️
  // This makes it accessible to any code, including malicious scripts
  (window as any).privateKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  
  // ⚠️ NEVER DO THIS - Storing in localStorage unencrypted ⚠️
  localStorage.setItem('privateKey', '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
  
  // ⚠️ NEVER DO THIS - Logging sensitive information ⚠️
  console.log('Private key:', '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
}

/**
 * ✅ GOOD EXAMPLE - Secure Key Handling ✅
 * 
 * This example shows how to handle private keys securely,
 * reducing the risk of exposure.
 */
export function securePrivateKeyExample() {
  // Use a closure to prevent global access
  function createSecureWallet() {
    // const privateKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'; // unused
    
    // Only expose necessary functions, not the key itself
    return {
      sign: (message: string) => {
        // Use the private key to sign without exposing it
        return signMessage(message);
      },
      getAddress: () => {
        // Derive address from private key without exposing it
        return deriveAddress();
      }
    };
  }
  
  // Mock implementations
  function signMessage(message: string): string {
    // Real implementation would use a crypto library
    return `signed-${message}`;
  }
  
  function deriveAddress(): string {
    // Real implementation would derive address from key
    return '0x1234...5678';
  }
  
  // Use the secure wallet
  const wallet = createSecureWallet();
  const signature = wallet.sign('Hello, world!');
  const address = wallet.getAddress();
  
  // The wallet user has no access to the private key
  return { signature, address };
}

/**
 * Security Best Practices
 * 
 * 1. Never store private keys in global scope
 * 2. Use closures to restrict access to sensitive data
 * 3. Don't log sensitive information
 * 4. Don't store unencrypted keys in localStorage/sessionStorage
 * 5. Use secure key derivation when encryption is needed
 * 6. Consider hardware wallets or secure enclaves for key storage
 * 7. Implement proper error handling that doesn't expose sensitive details
 * 8. Use Content Security Policy to prevent script injection
 * 9. Regularly audit your code for security vulnerabilities
 * 10. Consider using established libraries for cryptographic operations
 */