import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getContractAddress,
  hasAgentTokenSupport,
  hasStakingRewards,
  hasBridgeWrapper,
  validateChainSetup,
  PERSONA_TOKEN_SUPPLY,
  SNAPSHOT_DELAY,
  BASIS_POINTS,
  STANDARD_LIQUIDITY_AMOUNT,
  STANDARD_BONDING_AMOUNT,
  STANDARD_AMICA_AMOUNT,
  AGENT_LIQUIDITY_AMOUNT,
  AGENT_BONDING_AMOUNT,
  AGENT_AMICA_AMOUNT,
  AGENT_REWARDS_AMOUNT,
} from '@/lib/contracts';

// Mock the deployments module
vi.mock('@/lib/deployments', () => ({
  getAddressesForChain: vi.fn((chainId: number) => {
    if (chainId === 8453) {
      // Base chain
      return {
        personaFactory: '0x1234567890123456789012345678901234567890',
        personaFactoryViewer: '0x2234567890123456789012345678901234567890',
        amicaToken: '0x3234567890123456789012345678901234567890',
        bridgeWrapper: '0x4234567890123456789012345678901234567890',
        stakingRewards: '0x5234567890123456789012345678901234567890',
        erc20Implementation: '0x6234567890123456789012345678901234567890',
      };
    }
    if (chainId === 1) {
      // Ethereum mainnet - no bridge wrapper
      return {
        personaFactory: '0x7234567890123456789012345678901234567890',
        personaFactoryViewer: '0x8234567890123456789012345678901234567890',
        amicaToken: '0x9234567890123456789012345678901234567890',
        erc20Implementation: '0xa234567890123456789012345678901234567890',
      };
    }
    if (chainId === 42161) {
      // Arbitrum - missing some contracts
      return {
        personaFactory: '0xb234567890123456789012345678901234567890',
        amicaToken: '0xc234567890123456789012345678901234567890',
        erc20Implementation: '0xd234567890123456789012345678901234567890',
      };
    }
    return undefined;
  }),
  getBridgedAmicaAddress: vi.fn(),
  hasBridgeWrapper: vi.fn((chainId: number) => chainId === 8453),
}));

describe('contracts', () => {
  describe('getContractAddress', () => {
    it('should return correct contract address for Base chain', () => {
      const factoryAddress = getContractAddress(8453, 'factory');
      expect(factoryAddress).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should return correct factoryViewer address', () => {
      const viewerAddress = getContractAddress(8453, 'factoryViewer');
      expect(viewerAddress).toBe('0x2234567890123456789012345678901234567890');
    });

    it('should return undefined for unsupported chain', () => {
      const address = getContractAddress(999999, 'factory');
      expect(address).toBeUndefined();
    });

    it('should return undefined for missing contract on supported chain', () => {
      const address = getContractAddress(1, 'bridgeWrapper');
      expect(address).toBeUndefined();
    });

    it('should handle all contract types', () => {
      expect(getContractAddress(8453, 'factory')).toBeDefined();
      expect(getContractAddress(8453, 'factoryViewer')).toBeDefined();
      expect(getContractAddress(8453, 'amica')).toBeDefined();
      expect(getContractAddress(8453, 'bridgeWrapper')).toBeDefined();
      expect(getContractAddress(8453, 'stakingRewards')).toBeDefined();
      expect(getContractAddress(8453, 'erc20Implementation')).toBeDefined();
    });
  });

  describe('hasAgentTokenSupport', () => {
    it('should return true for chains with deployments', () => {
      expect(hasAgentTokenSupport(8453)).toBe(true);
      expect(hasAgentTokenSupport(1)).toBe(true);
    });

    it('should return false for chains without deployments', () => {
      expect(hasAgentTokenSupport(999999)).toBe(false);
    });
  });

  describe('hasStakingRewards', () => {
    it('should return true when stakingRewards address exists', () => {
      expect(hasStakingRewards(8453)).toBe(true);
    });

    it('should return false when stakingRewards address does not exist', () => {
      expect(hasStakingRewards(1)).toBe(false);
    });

    it('should return false for unsupported chain', () => {
      expect(hasStakingRewards(999999)).toBe(false);
    });
  });

  describe('hasBridgeWrapper', () => {
    it('should return true for chains with bridge wrapper', () => {
      expect(hasBridgeWrapper(8453)).toBe(true);
    });

    it('should return false for mainnet (no bridge)', () => {
      expect(hasBridgeWrapper(1)).toBe(false);
    });
  });

  describe('validateChainSetup', () => {
    it('should validate complete chain setup', () => {
      const result = validateChainSetup(8453);
      expect(result.isValid).toBe(true);
      expect(result.missingContracts).toHaveLength(0);
    });

    it('should detect missing contracts', () => {
      const result = validateChainSetup(42161);
      expect(result.isValid).toBe(false);
      expect(result.missingContracts).toContain('bridgeWrapper');
    });

    it('should handle unsupported chain', () => {
      const result = validateChainSetup(999999);
      expect(result.isValid).toBe(false);
      expect(result.missingContracts).toContain('all');
    });

    it('should not require bridgeWrapper for mainnet', () => {
      const result = validateChainSetup(1);
      expect(result.isValid).toBe(true);
    });
  });

  describe('constants', () => {
    it('should have correct PERSONA_TOKEN_SUPPLY', () => {
      expect(PERSONA_TOKEN_SUPPLY).toBe(BigInt("1000000000000000000000000000"));
    });

    it('should have correct SNAPSHOT_DELAY', () => {
      expect(SNAPSHOT_DELAY).toBe(100);
    });

    it('should have correct BASIS_POINTS', () => {
      expect(BASIS_POINTS).toBe(10000);
    });

    it('should have correct standard token allocations', () => {
      expect(STANDARD_LIQUIDITY_AMOUNT).toBe(BigInt("333333333000000000000000000"));
      expect(STANDARD_BONDING_AMOUNT).toBe(BigInt("333333333000000000000000000"));
      expect(STANDARD_AMICA_AMOUNT).toBe(BigInt("333333334000000000000000000"));
    });

    it('should have correct agent token allocations', () => {
      expect(AGENT_LIQUIDITY_AMOUNT).toBe(BigInt("333333333000000000000000000"));
      expect(AGENT_BONDING_AMOUNT).toBe(BigInt("222222222000000000000000000"));
      expect(AGENT_AMICA_AMOUNT).toBe(BigInt("222222222000000000000000000"));
      expect(AGENT_REWARDS_AMOUNT).toBe(BigInt("222222223000000000000000000"));
    });

    it('should have standard allocations sum to total supply', () => {
      const sum = STANDARD_LIQUIDITY_AMOUNT + STANDARD_BONDING_AMOUNT + STANDARD_AMICA_AMOUNT;
      expect(sum).toBe(PERSONA_TOKEN_SUPPLY);
    });

    it('should have agent allocations sum to total supply', () => {
      const sum = AGENT_LIQUIDITY_AMOUNT + AGENT_BONDING_AMOUNT + AGENT_AMICA_AMOUNT + AGENT_REWARDS_AMOUNT;
      expect(sum).toBe(PERSONA_TOKEN_SUPPLY);
    });
  });
});
