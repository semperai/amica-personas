import { describe, expect, test, beforeEach, jest, afterEach } from "vitest";

// Store original location
const originalLocation = window.location;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

// Mock viem functions
const mockKeccak256 = vi.fn();
const mockToBytes = vi.fn();
const mockPrivateKeyToAccount = vi.fn();

vi.mock('viem', () => ({
  keccak256: (...args: any[]) => mockKeccak256(...args),
  toBytes: (...args: any[]) => mockToBytes(...args),
}));

vi.mock('viem/accounts', () => ({
  privateKeyToAccount: (...args: any[]) => mockPrivateKeyToAccount(...args),
}));

describe("viemWalletUtils", () => {
  let initDeterministicWallet: any;
  let getCachedWalletAddress: any;
  let getCachedWallet: any;

  beforeEach(async () => {
    // Clear localStorage before each test
    localStorageMock.clear();

    // Mock window.location
    delete (global as any).window;
    (global as any).window = {
      location: {
        hostname: 'test.example.com',
      },
    };

    // Reset mocks
    mockKeccak256.mockClear();
    mockToBytes.mockClear();
    mockPrivateKeyToAccount.mockClear();

    // Mock implementations
    mockKeccak256.mockImplementation((data: any) => '0xmockedhash' as any);
    mockToBytes.mockImplementation((data: any) => new Uint8Array());
    mockPrivateKeyToAccount.mockReturnValue({
      address: '0xMockedAddress',
      signMessage: vi.fn(),
    });

    // Import functions after mocks are set up
    const module = await import('../src/lib/arbius-wallet/utils/viemWalletUtils');
    initDeterministicWallet = module.initDeterministicWallet;
    getCachedWalletAddress = module.getCachedWalletAddress;
    getCachedWallet = module.getCachedWallet;
  });

  afterEach(() => {
    // Restore original window if needed
    if (typeof originalLocation !== 'undefined') {
      (global as any).window = { location: originalLocation };
    }
  });

  describe("initDeterministicWallet", () => {
    test("should throw error if ownerAddress is not provided", async () => {
      await expect(initDeterministicWallet('', async () => '0xsig' as any))
        .rejects.toThrow("ownerAddress and signMessage are required.");
    });

    test("should throw error if signMessage is not provided", async () => {
      await expect(initDeterministicWallet('0xOwner', null as any))
        .rejects.toThrow("ownerAddress and signMessage are required.");
    });

    test("should use cached wallet if available", async () => {
      const cachedData = {
        ownerAddress: '0xowner',
        derivedPrivateKey: '0xcachedkey',
        derivedAddress: '0xCachedAddress',
        signatureVersion: 1,
        createdAt: new Date().toISOString(),
      };

      localStorageMock.setItem('arbiuswallet_derivedWalletCache', JSON.stringify(cachedData));

      const mockSignMessage = vi.fn();
      const result = await initDeterministicWallet('0xOwner', mockSignMessage);

      expect(mockSignMessage).not.toHaveBeenCalled();
      expect(mockPrivateKeyToAccount).toHaveBeenCalledWith('0xcachedkey');
    });

    test("should create new wallet if no cache exists", async () => {
      const mockSignature = '0xsignature123';
      const mockSignMessage = vi.fn().mockResolvedValue(mockSignature);

      await initDeterministicWallet('0xNewOwner', mockSignMessage, 'TestApp');

      expect(mockSignMessage).toHaveBeenCalledWith(
        expect.stringContaining('TestApp wants you to create a deterministic wallet')
      );
      expect(mockKeccak256).toHaveBeenCalled();
      expect(mockPrivateKeyToAccount).toHaveBeenCalled();
    });

    test("should cache new wallet after creation", async () => {
      const mockSignature = '0xsignature123';
      const mockSignMessage = vi.fn().mockResolvedValue(mockSignature);

      await initDeterministicWallet('0xNewOwner', mockSignMessage, 'TestApp');

      const cached = localStorageMock.getItem('arbiuswallet_derivedWalletCache');
      expect(cached).toBeTruthy();

      const parsedCache = JSON.parse(cached!);
      expect(parsedCache.ownerAddress).toBe('0xnewowner'); // lowercase
      expect(parsedCache.signatureVersion).toBe(1);
    });

    test("should use custom title in message", async () => {
      const mockSignMessage = vi.fn().mockResolvedValue('0xsig');

      await initDeterministicWallet('0xOwner', mockSignMessage, 'MyCustomApp');

      expect(mockSignMessage).toHaveBeenCalledWith(
        expect.stringContaining('MyCustomApp wants you to create a deterministic wallet')
      );
      expect(mockSignMessage).toHaveBeenCalledWith(
        expect.stringContaining('Warning: Make sure the URL matches the official MyCustomApp website')
      );
    });

    test("should default to 'Amica' title if not provided", async () => {
      const mockSignMessage = vi.fn().mockResolvedValue('0xsig');

      await initDeterministicWallet('0xOwner', mockSignMessage);

      expect(mockSignMessage).toHaveBeenCalledWith(
        expect.stringContaining('Amica wants you to create a deterministic wallet')
      );
    });

    test("should include domain in message", async () => {
      const mockSignMessage = vi.fn().mockResolvedValue('0xsig');

      await initDeterministicWallet('0xOwner', mockSignMessage);

      // Check that domain is included (will be either test.example.com or localhost depending on environment)
      const callArg = mockSignMessage.mock.calls[0][0];
      expect(callArg).toContain('Domain:');
    });

    test("should handle invalid cached data gracefully", async () => {
      localStorageMock.setItem('arbiuswallet_derivedWalletCache', 'invalid json');

      const mockSignMessage = vi.fn().mockResolvedValue('0xsig');
      await initDeterministicWallet('0xOwner', mockSignMessage);

      // Should create new wallet and clear invalid cache
      expect(localStorageMock.getItem('arbiuswallet_derivedWalletCache')).toBeTruthy();
      expect(mockSignMessage).toHaveBeenCalled();
    });

    test("should normalize owner address to lowercase", async () => {
      const mockSignMessage = vi.fn().mockResolvedValue('0xsig');

      await initDeterministicWallet('0xABCDEF', mockSignMessage);

      const cached = JSON.parse(localStorageMock.getItem('arbiuswallet_derivedWalletCache')!);
      expect(cached.ownerAddress).toBe('0xabcdef');
    });
  });

  describe("getCachedWalletAddress", () => {
    test("should return null if no cache exists", () => {
      const result = getCachedWalletAddress('0xOwner');
      expect(result).toBeNull();
    });

    test("should return cached address if owner matches", () => {
      const cachedData = {
        ownerAddress: '0xowner',
        derivedPrivateKey: '0xkey',
        derivedAddress: '0xDerivedAddress',
        signatureVersion: 1,
        createdAt: new Date().toISOString(),
      };

      localStorageMock.setItem('arbiuswallet_derivedWalletCache', JSON.stringify(cachedData));

      const result = getCachedWalletAddress('0xOwner');
      expect(result).toBe('0xDerivedAddress');
    });

    test("should return null if owner doesn't match", () => {
      const cachedData = {
        ownerAddress: '0xdifferentowner',
        derivedPrivateKey: '0xkey',
        derivedAddress: '0xDerivedAddress',
        signatureVersion: 1,
        createdAt: new Date().toISOString(),
      };

      localStorageMock.setItem('arbiuswallet_derivedWalletCache', JSON.stringify(cachedData));

      const result = getCachedWalletAddress('0xOwner');
      expect(result).toBeNull();
    });

    test("should handle invalid JSON gracefully", () => {
      localStorageMock.setItem('arbiuswallet_derivedWalletCache', 'invalid json');

      const result = getCachedWalletAddress('0xOwner');
      expect(result).toBeNull();
    });

    test("should be case insensitive for address comparison", () => {
      const cachedData = {
        ownerAddress: '0xabcdef',
        derivedPrivateKey: '0xkey',
        derivedAddress: '0xDerivedAddress',
        signatureVersion: 1,
        createdAt: new Date().toISOString(),
      };

      localStorageMock.setItem('arbiuswallet_derivedWalletCache', JSON.stringify(cachedData));

      const result = getCachedWalletAddress('0xABCDEF');
      expect(result).toBe('0xDerivedAddress');
    });
  });

  describe("getCachedWallet", () => {
    test("should return null if no cache exists", () => {
      const result = getCachedWallet('0xAddress');
      expect(result).toBeNull();
    });

    test("should return account if derived address matches", () => {
      const cachedData = {
        ownerAddress: '0xowner',
        derivedPrivateKey: '0xprivatekey',
        derivedAddress: '0xaddress',
        signatureVersion: 1,
        createdAt: new Date().toISOString(),
      };

      localStorageMock.setItem('arbiuswallet_derivedWalletCache', JSON.stringify(cachedData));

      const result = getCachedWallet('0xAddress');
      expect(result).toBeTruthy();
      expect(mockPrivateKeyToAccount).toHaveBeenCalledWith('0xprivatekey');
    });

    test("should return null if address doesn't match", () => {
      const cachedData = {
        ownerAddress: '0xowner',
        derivedPrivateKey: '0xprivatekey',
        derivedAddress: '0xdifferent',
        signatureVersion: 1,
        createdAt: new Date().toISOString(),
      };

      localStorageMock.setItem('arbiuswallet_derivedWalletCache', JSON.stringify(cachedData));

      const result = getCachedWallet('0xAddress');
      expect(result).toBeNull();
    });

    test("should handle invalid JSON gracefully", () => {
      localStorageMock.setItem('arbiuswallet_derivedWalletCache', 'invalid json');

      const result = getCachedWallet('0xAddress');
      expect(result).toBeNull();
    });

    test("should be case insensitive for address comparison", () => {
      const cachedData = {
        ownerAddress: '0xowner',
        derivedPrivateKey: '0xprivatekey',
        derivedAddress: '0xabcdef',
        signatureVersion: 1,
        createdAt: new Date().toISOString(),
      };

      localStorageMock.setItem('arbiuswallet_derivedWalletCache', JSON.stringify(cachedData));

      const result = getCachedWallet('0xABCDEF');
      expect(result).toBeTruthy();
    });
  });
});
