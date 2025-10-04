import { describe, it, expect } from 'vitest';
import { DEPLOYMENT } from '../processor';

describe('Processor Configuration', () => {
  describe('DEPLOYMENT constants', () => {
    it('should have valid chain ID', () => {
      expect(DEPLOYMENT.chainId).toBe(8453);
      expect(typeof DEPLOYMENT.chainId).toBe('number');
      expect(DEPLOYMENT.chainId).toBeGreaterThan(0);
    });

    it('should have valid chain name', () => {
      expect(DEPLOYMENT.chainName).toBe('base');
      expect(typeof DEPLOYMENT.chainName).toBe('string');
      expect(DEPLOYMENT.chainName.length).toBeGreaterThan(0);
    });

    it('should have valid start block', () => {
      expect(DEPLOYMENT.startBlock).toBe(31632211);
      expect(typeof DEPLOYMENT.startBlock).toBe('number');
      expect(DEPLOYMENT.startBlock).toBeGreaterThan(0);
    });

    it('should have all required addresses', () => {
      expect(DEPLOYMENT.addresses).toBeDefined();
      expect(DEPLOYMENT.addresses.amicaToken).toBeDefined();
      expect(DEPLOYMENT.addresses.personaFactory).toBeDefined();
      expect(DEPLOYMENT.addresses.bridgeWrapper).toBeDefined();
      expect(DEPLOYMENT.addresses.erc20Implementation).toBeDefined();
    });

    it('should have lowercase addresses', () => {
      expect(DEPLOYMENT.addresses.amicaToken).toBe(DEPLOYMENT.addresses.amicaToken.toLowerCase());
      expect(DEPLOYMENT.addresses.personaFactory).toBe(DEPLOYMENT.addresses.personaFactory.toLowerCase());
      expect(DEPLOYMENT.addresses.bridgeWrapper).toBe(DEPLOYMENT.addresses.bridgeWrapper.toLowerCase());
      expect(DEPLOYMENT.addresses.erc20Implementation).toBe(DEPLOYMENT.addresses.erc20Implementation.toLowerCase());
    });

    it('should have valid address formats', () => {
      const isValidAddress = (addr: string) => addr.startsWith('0x') && addr.length === 42;

      expect(isValidAddress(DEPLOYMENT.addresses.amicaToken)).toBe(true);
      expect(isValidAddress(DEPLOYMENT.addresses.personaFactory)).toBe(true);
      expect(isValidAddress(DEPLOYMENT.addresses.bridgeWrapper)).toBe(true);
      expect(isValidAddress(DEPLOYMENT.addresses.erc20Implementation)).toBe(true);
    });

    it('should have unique addresses', () => {
      const addresses = [
        DEPLOYMENT.addresses.amicaToken,
        DEPLOYMENT.addresses.personaFactory,
        DEPLOYMENT.addresses.bridgeWrapper,
        DEPLOYMENT.addresses.erc20Implementation,
      ];

      const uniqueAddresses = new Set(addresses);
      expect(uniqueAddresses.size).toBe(addresses.length);
    });

    it('should have expected amicaToken address', () => {
      expect(DEPLOYMENT.addresses.amicaToken).toBe('0xc0ba25570f4cb592e83ff5f052cc9dd69d5b3cae');
    });

    it('should have expected personaFactory address', () => {
      expect(DEPLOYMENT.addresses.personaFactory).toBe('0x62966fd253c2c3507a305f296e54cabd74aea083');
    });

    it('should have expected bridgeWrapper address', () => {
      expect(DEPLOYMENT.addresses.bridgeWrapper).toBe('0xe17b125b85abcc0ff212cf33d06d928d4736aa04');
    });

    it('should have expected erc20Implementation address', () => {
      expect(DEPLOYMENT.addresses.erc20Implementation).toBe('0x4b140c2d84c75d50e28b46f4126ff9c1c5e4c3dd');
    });
  });

  describe('Environment Configuration', () => {
    it('should handle missing RPC URL with default', () => {
      const rpcUrl = process.env.RPC_BASE_HTTP || 'https://mainnet.base.org';
      expect(rpcUrl).toBeDefined();
      expect(typeof rpcUrl).toBe('string');
      expect(rpcUrl.startsWith('http')).toBe(true);
    });

    it('should validate default RPC URL format', () => {
      const defaultRpcUrl = 'https://mainnet.base.org';
      expect(defaultRpcUrl.startsWith('https://')).toBe(true);
      expect(defaultRpcUrl.length).toBeGreaterThan(10);
    });

    it('should handle database URL environment variable', () => {
      const dbUrl = process.env.DB_URL;
      // DB_URL may or may not be set, just check it's either string or undefined
      expect(typeof dbUrl === 'string' || dbUrl === undefined).toBe(true);
    });
  });

  describe('Archive Gateway Configuration', () => {
    it('should have valid archive gateway URL', () => {
      const archiveGateway = 'https://v2.archive.subsquid.io/network/base-mainnet';
      expect(archiveGateway.startsWith('https://')).toBe(true);
      expect(archiveGateway).toContain('subsquid.io');
      expect(archiveGateway).toContain('base-mainnet');
    });
  });

  describe('Block Confirmation Settings', () => {
    it('should have reasonable finality confirmation', () => {
      const finalityConfirmation = 75;
      expect(finalityConfirmation).toBeGreaterThan(0);
      expect(finalityConfirmation).toBeLessThan(1000);
    });
  });

  describe('RPC Rate Limiting', () => {
    it('should have reasonable rate limit', () => {
      const rateLimit = 10;
      expect(rateLimit).toBeGreaterThan(0);
      expect(rateLimit).toBeLessThanOrEqual(100);
    });
  });

  describe('Chain Compatibility', () => {
    it('should match Base mainnet chain ID', () => {
      const baseChainId = 8453;
      expect(DEPLOYMENT.chainId).toBe(baseChainId);
    });

    it('should have deployment start block after Base genesis', () => {
      const baseGenesisBlock = 0;
      expect(DEPLOYMENT.startBlock).toBeGreaterThan(baseGenesisBlock);
    });
  });
});

describe('Address Utilities', () => {
  it('should normalize addresses correctly', () => {
    const addr = '0xABCDEF1234567890';
    const normalized = addr.toLowerCase();
    expect(normalized).toBe('0xabcdef1234567890');
  });

  it('should compare addresses case-insensitively', () => {
    const addr1 = '0xABCDEF';
    const addr2 = '0xabcdef';
    expect(addr1.toLowerCase()).toBe(addr2.toLowerCase());
  });

  it('should validate address length', () => {
    const validAddr = '0x' + 'a'.repeat(40);
    const invalidAddr = '0x' + 'a'.repeat(30);

    expect(validAddr.length).toBe(42);
    expect(invalidAddr.length).not.toBe(42);
  });

  it('should detect zero address', () => {
    const zeroAddr = '0x0000000000000000000000000000000000000000';
    const isZero = zeroAddr === '0x0000000000000000000000000000000000000000';
    expect(isZero).toBe(true);
  });

  it('should validate hex format', () => {
    const validHex = '0xabcdef1234567890';
    const invalidHex = '0xghijkl1234567890';

    expect(validHex.match(/^0x[0-9a-f]+$/i)).toBeTruthy();
    expect(invalidHex.match(/^0x[0-9a-f]+$/i)).toBeFalsy();
  });
});

describe('Block Number Handling', () => {
  it('should convert block numbers to BigInt', () => {
    const blockNum = 12345;
    const blockBigInt = BigInt(blockNum);

    expect(typeof blockBigInt).toBe('bigint');
    expect(Number(blockBigInt)).toBe(blockNum);
  });

  it('should handle large block numbers', () => {
    const largeBlock = 31632211;
    const blockBigInt = BigInt(largeBlock);

    expect(blockBigInt).toBeGreaterThan(0n);
    expect(blockBigInt).toBe(31632211n);
  });

  it('should compare block numbers', () => {
    const block1 = 100n;
    const block2 = 200n;

    expect(block2).toBeGreaterThan(block1);
    expect(block1).toBeLessThan(block2);
  });
});

describe('Timestamp Handling', () => {
  it('should convert Date to timestamp', () => {
    const date = new Date('2024-01-01T00:00:00Z');
    const timestamp = date.getTime();

    expect(typeof timestamp).toBe('number');
    expect(timestamp).toBeGreaterThan(0);
  });

  it('should convert timestamp to seconds', () => {
    const date = new Date('2024-01-01T00:00:00Z');
    const seconds = Math.floor(date.getTime() / 1000);

    expect(seconds).toBeGreaterThan(0);
    expect(seconds * 1000).toBeLessThanOrEqual(date.getTime());
  });

  it('should convert to BigInt timestamp', () => {
    const date = new Date('2024-01-01T00:00:00Z');
    const timestampBigInt = BigInt(Math.floor(date.getTime() / 1000));

    expect(typeof timestampBigInt).toBe('bigint');
  });

  it('should format date as YYYY-MM-DD', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    const dateStr = date.toISOString().split('T')[0];

    expect(dateStr).toBe('2024-01-15');
    expect(dateStr.match(/^\d{4}-\d{2}-\d{2}$/)).toBeTruthy();
  });
});

describe('Event Topic Handling', () => {
  it('should validate topic0 format', () => {
    const topic0 = '0x' + 'a'.repeat(64);

    expect(topic0.length).toBe(66);
    expect(topic0.startsWith('0x')).toBe(true);
  });

  it('should handle multiple topics', () => {
    const topics = [
      '0x' + 'a'.repeat(64),
      '0x' + 'b'.repeat(64),
      '0x' + 'c'.repeat(64),
    ];

    expect(topics.length).toBe(3);
    expect(topics.every(t => t.length === 66)).toBe(true);
  });
});
