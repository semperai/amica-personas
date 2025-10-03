import { describe, expect, test, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';

// Mock wagmi hooks
const mockUseAccount = vi.fn();
const mockUseWalletClient = vi.fn();
const mockUsePublicClient = vi.fn();

vi.mock('wagmi', () => ({
  useAccount: () => mockUseAccount(),
  useWalletClient: () => mockUseWalletClient(),
  usePublicClient: () => mockUsePublicClient(),
}));

// Mock utils
const mockInitDeterministicWallet = vi.fn();
const mockGetCachedWalletAddress = vi.fn();
const mockGetCachedWallet = vi.fn();

vi.mock('../src/lib/arbius-wallet/utils/viemWalletUtils', () => ({
  initDeterministicWallet: (...args: any[]) => mockInitDeterministicWallet(...args),
  getCachedWalletAddress: (...args: any[]) => mockGetCachedWalletAddress(...args),
  getCachedWallet: (...args: any[]) => mockGetCachedWallet(...args),
}));

// Mock context
const mockContextValue = {
  isConnected: false,
  address: null,
};

const MockAAWalletContext = React.createContext(mockContextValue);

vi.mock('../src/lib/arbius-wallet/components/AAWalletProvider', () => ({
  AAWalletContext: MockAAWalletContext,
}));

describe("useAAWallet", () => {
  let useAAWallet: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset mocks
    mockUseAccount.mockReturnValue({ address: null });
    mockUseWalletClient.mockReturnValue({ data: null });
    mockUsePublicClient.mockReturnValue(null);
    mockGetCachedWalletAddress.mockReturnValue(null);
    mockGetCachedWallet.mockReturnValue(null);

    // Import hook after mocks are set up
    const module = await import('../src/lib/arbius-wallet/hooks/useAAWallet');
    useAAWallet = module.useAAWallet;
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    React.createElement(MockAAWalletContext.Provider, { value: mockContextValue }, children)
  );

  test("should return null values when not connected", () => {
    const { result } = renderHook(() => useAAWallet(), { wrapper });

    expect(result.current.smartAccountAddress).toBeNull();
    expect(result.current.derivedAccount).toBeNull();
    expect(result.current.isInitializing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test("should use cached wallet if available", async () => {
    const mockAddress = '0xUserAddress';
    const mockCachedAddress = '0xCachedWalletAddress';
    const mockCachedAccount = {
      address: mockCachedAddress,
      signMessage: vi.fn(),
    };

    mockUseAccount.mockReturnValue({ address: mockAddress });
    mockUseWalletClient.mockReturnValue({ data: {} });
    mockGetCachedWalletAddress.mockReturnValue(mockCachedAddress);
    mockGetCachedWallet.mockReturnValue(mockCachedAccount);

    const { result } = renderHook(() => useAAWallet(), { wrapper });

    await waitFor(() => {
      expect(result.current.smartAccountAddress).toBe(mockCachedAddress);
      expect(result.current.derivedAccount).toBe(mockCachedAccount);
    });

    expect(mockInitDeterministicWallet).not.toHaveBeenCalled();
  });

  test("should create new wallet if no cache exists", async () => {
    const mockAddress = '0xUserAddress';
    const mockNewAccount = {
      address: '0xNewWalletAddress',
      signMessage: vi.fn(),
    };

    const mockWalletClient = {
      signMessage: vi.fn().mockResolvedValue('0xsignature'),
    };

    mockUseAccount.mockReturnValue({ address: mockAddress });
    mockUseWalletClient.mockReturnValue({ data: mockWalletClient });
    mockGetCachedWalletAddress.mockReturnValue(null);
    mockInitDeterministicWallet.mockResolvedValue(mockNewAccount);

    const { result } = renderHook(() => useAAWallet(), { wrapper });

    await waitFor(() => {
      expect(result.current.smartAccountAddress).toBe('0xNewWalletAddress');
      expect(result.current.derivedAccount).toBe(mockNewAccount);
    });

    expect(mockInitDeterministicWallet).toHaveBeenCalledWith(
      mockAddress,
      expect.any(Function)
    );
  });

  test("should set isInitializing to true during wallet creation", async () => {
    const mockAddress = '0xUserAddress';

    const mockWalletClient = {
      signMessage: vi.fn().mockResolvedValue('0xsignature'),
    };

    mockUseAccount.mockReturnValue({ address: mockAddress });
    mockUseWalletClient.mockReturnValue({ data: mockWalletClient });
    mockGetCachedWalletAddress.mockReturnValue(null);

    // Make initialization take some time
    mockInitDeterministicWallet.mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve({
        address: '0xNewWallet',
        signMessage: vi.fn(),
      }), 100))
    );

    const { result } = renderHook(() => useAAWallet(), { wrapper });

    // Check that isInitializing becomes true
    await waitFor(() => {
      expect(result.current.isInitializing).toBe(true);
    });

    // Wait for completion
    await waitFor(() => {
      expect(result.current.isInitializing).toBe(false);
      expect(result.current.smartAccountAddress).toBe('0xNewWallet');
    }, { timeout: 200 });
  });

  test("should handle initialization error", async () => {
    const mockAddress = '0xUserAddress';
    const errorMessage = 'Failed to sign message';

    const mockWalletClient = {
      signMessage: vi.fn().mockRejectedValue(new Error(errorMessage)),
    };

    mockUseAccount.mockReturnValue({ address: mockAddress });
    mockUseWalletClient.mockReturnValue({ data: mockWalletClient });
    mockGetCachedWalletAddress.mockReturnValue(null);
    mockInitDeterministicWallet.mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useAAWallet(), { wrapper });

    await waitFor(() => {
      expect(result.current.error).toBe(errorMessage);
      expect(result.current.isInitializing).toBe(false);
    });
  });

  test("should not re-initialize for the same address", async () => {
    const mockAddress = '0xUserAddress';
    const mockAccount = {
      address: '0xWalletAddress',
      signMessage: vi.fn(),
    };

    const mockWalletClient = {
      signMessage: vi.fn().mockResolvedValue('0xsignature'),
    };

    mockUseAccount.mockReturnValue({ address: mockAddress });
    mockUseWalletClient.mockReturnValue({ data: mockWalletClient });
    mockGetCachedWalletAddress.mockReturnValue(null);
    mockInitDeterministicWallet.mockResolvedValue(mockAccount);

    const { result, rerender } = renderHook(() => useAAWallet(), { wrapper });

    await waitFor(() => {
      expect(result.current.smartAccountAddress).toBe('0xWalletAddress');
    });

    const callCount = mockInitDeterministicWallet.mock.calls.length;

    // Trigger re-render
    rerender();

    // Should not call init again
    expect(mockInitDeterministicWallet.mock.calls.length).toBe(callCount);
  });

  test("signMessageWithAAWallet should return null if wallet not initialized", async () => {
    const { result } = renderHook(() => useAAWallet(), { wrapper });

    const signature = await result.current.signMessageWithAAWallet('test message');
    expect(signature).toBeNull();
  });

  test("signMessageWithAAWallet should sign message with derived account", async () => {
    const mockAddress = '0xUserAddress';
    const mockSignature = '0xmockedsignature';
    const mockSignMessageFn = vi.fn().mockResolvedValue(mockSignature);

    const mockAccount = {
      address: '0xWalletAddress',
      signMessage: mockSignMessageFn,
    };

    const mockWalletClient = {
      signMessage: vi.fn().mockResolvedValue('0xsignature'),
    };

    mockUseAccount.mockReturnValue({ address: mockAddress });
    mockUseWalletClient.mockReturnValue({ data: mockWalletClient });
    mockGetCachedWalletAddress.mockReturnValue(null);
    mockInitDeterministicWallet.mockResolvedValue(mockAccount);

    const { result } = renderHook(() => useAAWallet(), { wrapper });

    await waitFor(() => {
      expect(result.current.derivedAccount).toBe(mockAccount);
    });

    const signature = await result.current.signMessageWithAAWallet('test message');

    expect(mockSignMessageFn).toHaveBeenCalledWith({ message: 'test message' });
    expect(signature).toBe(mockSignature);
  });

  test("signMessageWithAAWallet should return null on error", async () => {
    const mockAddress = '0xUserAddress';
    const mockSignMessageFn = vi.fn().mockRejectedValue(new Error('Signing failed'));

    const mockAccount = {
      address: '0xWalletAddress',
      signMessage: mockSignMessageFn,
    };

    const mockWalletClient = {
      signMessage: vi.fn().mockResolvedValue('0xsignature'),
    };

    mockUseAccount.mockReturnValue({ address: mockAddress });
    mockUseWalletClient.mockReturnValue({ data: mockWalletClient });
    mockGetCachedWalletAddress.mockReturnValue(null);
    mockInitDeterministicWallet.mockResolvedValue(mockAccount);

    const { result } = renderHook(() => useAAWallet(), { wrapper });

    await waitFor(() => {
      expect(result.current.derivedAccount).toBe(mockAccount);
    });

    const signature = await result.current.signMessageWithAAWallet('test message');

    expect(signature).toBeNull();
  });
});
