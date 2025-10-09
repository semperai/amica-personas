import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getDeployment,
  getAddressesForChain,
  getContractAddress,
  hasBridgeWrapper,
  getBridgedAmicaAddress,
  hasDeployment,
  getDeployedChains,
  type DeploymentAddresses,
  type Deployment,
} from '@/lib/deployments';

// Mock the deployment JSON file
vi.mock('@/deployments/8453.json', () => ({
  default: {
    chainId: 8453,
    chainName: 'base',
    addresses: {
      amicaToken: '0x1111111111111111111111111111111111111111',
      amicaTokenImpl: '0x2222222222222222222222222222222222222222',
      personaFactory: '0x3333333333333333333333333333333333333333',
      personaFactoryImpl: '0x4444444444444444444444444444444444444444',
      personaFactoryViewer: '0x5555555555555555555555555555555555555555',
      proxyAdmin: '0x6666666666666666666666666666666666666666',
      erc20Implementation: '0x7777777777777777777777777777777777777777',
      bridgeWrapper: '0x8888888888888888888888888888888888888888',
      bridgeWrapperImpl: '0x9999999999999999999999999999999999999999',
      bridgedAmicaAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      stakingRewards: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    },
    blockNumber: 12345678,
    timestamp: '2024-01-01T00:00:00Z',
    deployer: '0xcccccccccccccccccccccccccccccccccccccccc',
    transactionHashes: {
      amicaToken: '0xhash1',
      personaFactory: '0xhash2',
    },
  },
}));

describe('deployments', () => {
  describe('getDeployment', () => {
    it('should return deployment for Base chain', () => {
      const deployment = getDeployment(8453);
      expect(deployment).toBeDefined();
      expect(deployment?.chainId).toBe(8453);
      expect(deployment?.chainName).toBe('base');
    });

    it('should return undefined for unsupported chain', () => {
      const deployment = getDeployment(999999);
      expect(deployment).toBeUndefined();
    });

    it('should include all required deployment fields', () => {
      const deployment = getDeployment(8453);
      expect(deployment).toHaveProperty('chainId');
      expect(deployment).toHaveProperty('chainName');
      expect(deployment).toHaveProperty('addresses');
      expect(deployment).toHaveProperty('blockNumber');
      expect(deployment).toHaveProperty('timestamp');
      expect(deployment).toHaveProperty('deployer');
      expect(deployment).toHaveProperty('transactionHashes');
    });
  });

  describe('getAddressesForChain', () => {
    it('should return addresses for Base chain', () => {
      const addresses = getAddressesForChain(8453);
      expect(addresses).toBeDefined();
      expect(addresses?.amicaToken).toBe('0x1111111111111111111111111111111111111111');
      expect(addresses?.personaFactory).toBe('0x3333333333333333333333333333333333333333');
    });

    it('should return undefined for unsupported chain', () => {
      const addresses = getAddressesForChain(999999);
      expect(addresses).toBeUndefined();
    });

    it('should include all required address fields', () => {
      const addresses = getAddressesForChain(8453);
      expect(addresses).toHaveProperty('amicaToken');
      expect(addresses).toHaveProperty('amicaTokenImpl');
      expect(addresses).toHaveProperty('personaFactory');
      expect(addresses).toHaveProperty('personaFactoryImpl');
      expect(addresses).toHaveProperty('personaFactoryViewer');
      expect(addresses).toHaveProperty('proxyAdmin');
      expect(addresses).toHaveProperty('erc20Implementation');
    });

    it('should include optional address fields for Base', () => {
      const addresses = getAddressesForChain(8453);
      expect(addresses).toHaveProperty('bridgeWrapper');
      expect(addresses).toHaveProperty('bridgeWrapperImpl');
      expect(addresses).toHaveProperty('bridgedAmicaAddress');
      expect(addresses).toHaveProperty('stakingRewards');
    });
  });

  describe('getContractAddress', () => {
    it('should return specific contract address', () => {
      const amicaAddress = getContractAddress(8453, 'amicaToken');
      expect(amicaAddress).toBe('0x1111111111111111111111111111111111111111');
    });

    it('should return factory address', () => {
      const factoryAddress = getContractAddress(8453, 'personaFactory');
      expect(factoryAddress).toBe('0x3333333333333333333333333333333333333333');
    });

    it('should return undefined for unsupported chain', () => {
      const address = getContractAddress(999999, 'amicaToken');
      expect(address).toBeUndefined();
    });

    it('should handle all contract types', () => {
      expect(getContractAddress(8453, 'amicaToken')).toBeDefined();
      expect(getContractAddress(8453, 'amicaTokenImpl')).toBeDefined();
      expect(getContractAddress(8453, 'personaFactory')).toBeDefined();
      expect(getContractAddress(8453, 'personaFactoryImpl')).toBeDefined();
      expect(getContractAddress(8453, 'personaFactoryViewer')).toBeDefined();
      expect(getContractAddress(8453, 'proxyAdmin')).toBeDefined();
      expect(getContractAddress(8453, 'erc20Implementation')).toBeDefined();
      expect(getContractAddress(8453, 'bridgeWrapper')).toBeDefined();
      expect(getContractAddress(8453, 'stakingRewards')).toBeDefined();
    });
  });

  describe('hasBridgeWrapper', () => {
    it('should return true for Base chain with bridge wrapper', () => {
      expect(hasBridgeWrapper(8453)).toBe(true);
    });

    it('should return false for unsupported chain', () => {
      expect(hasBridgeWrapper(999999)).toBe(false);
    });
  });

  describe('getBridgedAmicaAddress', () => {
    it('should return bridged AMICA address for Base', () => {
      const address = getBridgedAmicaAddress(8453);
      expect(address).toBe('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    });

    it('should return undefined for unsupported chain', () => {
      const address = getBridgedAmicaAddress(999999);
      expect(address).toBeUndefined();
    });
  });

  describe('hasDeployment', () => {
    it('should return true for Base chain', () => {
      expect(hasDeployment(8453)).toBe(true);
    });

    it('should return false for unsupported chain', () => {
      expect(hasDeployment(999999)).toBe(false);
    });
  });

  describe('getDeployedChains', () => {
    it('should return array of deployed chain IDs', () => {
      const chains = getDeployedChains();
      expect(Array.isArray(chains)).toBe(true);
      expect(chains).toContain(8453);
    });

    it('should return numeric chain IDs', () => {
      const chains = getDeployedChains();
      chains.forEach(chainId => {
        expect(typeof chainId).toBe('number');
      });
    });
  });
});
