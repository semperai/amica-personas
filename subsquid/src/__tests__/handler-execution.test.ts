import 'reflect-metadata';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Context, Log } from '../processor';

// Mock model classes
vi.mock('../model', () => ({
  Persona: class Persona { constructor(props: any) { Object.assign(this, props); } },
  PersonaMetadata: class PersonaMetadata { constructor(props: any) { Object.assign(this, props); } },
  AgentDeposit: class AgentDeposit { constructor(props: any) { Object.assign(this, props); } },
  AgentReward: class AgentReward { constructor(props: any) { Object.assign(this, props); } },
  Trade: class Trade { constructor(props: any) { Object.assign(this, props); } },
  Transfer: class Transfer { constructor(props: any) { Object.assign(this, props); } },
  PersonaTransfer: class PersonaTransfer { constructor(props: any) { Object.assign(this, props); } },
  Withdrawal: class Withdrawal { constructor(props: any) { Object.assign(this, props); } },
  TokenWithdrawal: class TokenWithdrawal { constructor(props: any) { Object.assign(this, props); } },
  Config: class Config { constructor(props: any) { Object.assign(this, props); } },
  FeeConfig: class FeeConfig { constructor(props: any) { Object.assign(this, props); } },
  FeeReduction: class FeeReduction { constructor(props: any) { Object.assign(this, props); } },
  FeeReductionUsage: class FeeReductionUsage { constructor(props: any) { Object.assign(this, props); } },
  LiquidityEvent: class LiquidityEvent { constructor(props: any) { Object.assign(this, props); } },
  Metadata: class Metadata { constructor(props: any) { Object.assign(this, props); } },
  DailyStats: class DailyStats { constructor(props: any) { Object.assign(this, props); } },
  GlobalStats: class GlobalStats { constructor(props: any) { Object.assign(this, props); } },
  PersonaDailyStats: class PersonaDailyStats { constructor(props: any) { Object.assign(this, props); } },
  AmicaTransfer: class AmicaTransfer { constructor(props: any) { Object.assign(this, props); } },
  AmicaClaim: class AmicaClaim { constructor(props: any) { Object.assign(this, props); } },
  AmicaDeposit: class AmicaDeposit { constructor(props: any) { Object.assign(this, props); } },
  AmicaWithdrawal: class AmicaWithdrawal { constructor(props: any) { Object.assign(this, props); } },
  AmicaConfiguration: class AmicaConfiguration { constructor(props: any) { Object.assign(this, props); } },
  AmicaTokenConfig: class AmicaTokenConfig { constructor(props: any) { Object.assign(this, props); } },
  BridgeActivity: class BridgeActivity { constructor(props: any) { Object.assign(this, props); } },
  BridgeAction: { WRAP: 'WRAP', UNWRAP: 'UNWRAP' },
  StakingPool: class StakingPool { constructor(props: any) { Object.assign(this, props); } },
  UserSnapshot: class UserSnapshot { constructor(props: any) { Object.assign(this, props); } },
}));

// Mock all ABIs
vi.mock('../abi/PersonaTokenFactory', () => ({
  events: {
    PersonaCreated: { decode: vi.fn(), topic: '0x1' },
    Transfer: { decode: vi.fn(), topic: '0x2' },
    TokensPurchased: { decode: vi.fn(), topic: '0x3' },
    TokensSold: { decode: vi.fn(), topic: '0x4' },
    MetadataUpdated: { decode: vi.fn(), topic: '0x5' },
    V4PoolCreated: { decode: vi.fn(), topic: '0x6' },
    FeesCollected: { decode: vi.fn(), topic: '0x7' },
    Graduated: { decode: vi.fn(), topic: '0x8' },
    TokensClaimed: { decode: vi.fn(), topic: '0x9' },
    TokensDistributed: { decode: vi.fn(), topic: '0xa' },
    AgentTokenAssociated: { decode: vi.fn(), topic: '0xb' },
    AgentTokensDeposited: { decode: vi.fn(), topic: '0xc' },
    AgentTokensWithdrawn: { decode: vi.fn(), topic: '0xd' },
    AgentRewardsDistributed: { decode: vi.fn(), topic: '0xe' },
    PairingConfigUpdated: { decode: vi.fn(), topic: '0xf' },
    FeeReductionApplied: { decode: vi.fn(), topic: '0x10' },
  },
  Contract: vi.fn().mockImplementation(() => ({
    metadata: vi.fn().mockResolvedValue('test metadata value'),
    personas: vi.fn().mockResolvedValue({
      positionTokenId: 123n,
      poolId: '0x0000000000000000000000000000000000000000000000000000000000000000',
      pairToken: '0xPAIRTOKEN',
      agentToken: '0x0000000000000000000000000000000000000000',
      agentTokenThreshold: 1000n,
      graduationTimestamp: 0n,
    }),
    ownerOf: vi.fn().mockResolvedValue('0xCREATOR'),
  })),
}));

vi.mock('../abi/AmicaTokenMainnet', () => ({
  events: {
    Transfer: { decode: vi.fn(), topic: '0x11' },
    TokenClaimed: { decode: vi.fn(), topic: '0x12' },
    TokenDeposited: { decode: vi.fn(), topic: '0x13' },
    TokenConfigured: { decode: vi.fn(), topic: '0x14' },
    TokenWithdrawn: { decode: vi.fn(), topic: '0x15' },
  },
}));

vi.mock('../abi/FeeReductionSystem', () => ({
  events: {
    SnapshotUpdated: { decode: vi.fn(), topic: '0x16' },
    SnapshotActivated: { decode: vi.fn(), topic: '0x17' },
    FeeReductionConfigUpdated: { decode: vi.fn(), topic: '0x18' },
    FeeReductionRegistered: { decode: vi.fn(), topic: '0x19' },
    FeeReductionUsed: { decode: vi.fn(), topic: '0x1a' },
    FeeReductionExpired: { decode: vi.fn(), topic: '0x1b' },
    FeeReductionRevoked: { decode: vi.fn(), topic: '0x1c' },
  },
}));

// Import handlers after mocking
import * as agentHandlers from '../handlers/agent';
import * as personaHandlers from '../handlers/persona';
import * as tradingHandlers from '../handlers/trading';
import * as transfersHandlers from '../handlers/transfers';
import * as graduationHandlers from '../handlers/graduation';
import * as liquidityHandlers from '../handlers/liquidity';
import * as metadataHandlers from '../handlers/metadata';
import * as withdrawalsHandlers from '../handlers/withdrawals';
import * as statsHandlers from '../handlers/stats';
import * as amicaTokenHandlers from '../handlers/amica-token';
import * as feeReductionHandlers from '../handlers/feeReduction';
import * as configHandlers from '../handlers/config';

describe('Handler Execution Tests', () => {
  let mockCtx: Context;
  let mockLog: Log;
  const timestamp = new Date('2024-01-01T00:00:00Z');
  const blockNumber = 12345n;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCtx = {
      store: {
        get: vi.fn().mockResolvedValue(null),
        find: vi.fn().mockResolvedValue([]),
        findBy: vi.fn().mockResolvedValue([]),
        save: vi.fn().mockResolvedValue(undefined),
        insert: vi.fn().mockResolvedValue(undefined),
      },
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
      blocks: [],
      _chain: {
        client: {
          call: vi.fn().mockResolvedValue('0x'),
        },
      },
    } as unknown as Context;

    mockLog = {
      transactionHash: '0x123',
      logIndex: 0,
      address: '0xcontract',
      data: '0xdata',
      topics: ['0xtopic0', '0xtopic1'],
      block: {
        height: Number(blockNumber),
        timestamp: Math.floor(timestamp.getTime() / 1000),
      },
    } as unknown as Log;
  });

  describe('Agent Handlers', () => {
    it('should execute handleAgentTokenAssociated - persona not found', async () => {
      const factoryAbi = await import('../abi/PersonaTokenFactory');
      (factoryAbi.events.AgentTokenAssociated.decode as any).mockReturnValue({
        tokenId: 1n,
        agentToken: '0xAGENT',
      });

      (mockCtx.store.get as any).mockResolvedValue(null);

      await agentHandlers.handleAgentTokenAssociated(mockCtx, mockLog);

      expect(mockCtx.log.error).toHaveBeenCalled();
      expect(mockCtx.store.save).not.toHaveBeenCalled();
    });

    it('should execute handleAgentTokenAssociated - success path', async () => {
      const factoryAbi = await import('../abi/PersonaTokenFactory');
      (factoryAbi.events.AgentTokenAssociated.decode as any).mockReturnValue({
        tokenId: 1n,
        agentToken: '0xAGENT',
      });

      const mockPersona = { id: '1', agentToken: null };
      (mockCtx.store.get as any).mockResolvedValue(mockPersona);

      await agentHandlers.handleAgentTokenAssociated(mockCtx, mockLog);

      expect(mockPersona.agentToken).toBe('0xagent');
      expect(mockCtx.store.save).toHaveBeenCalledWith(mockPersona);
    });

    it('should execute handleAgentTokensDeposited - persona not found', async () => {
      const factoryAbi = await import('../abi/PersonaTokenFactory');
      (factoryAbi.events.AgentTokensDeposited.decode as any).mockReturnValue({
        tokenId: 1n,
        depositor: '0xDEPOSITOR',
        amount: 1000n,
      });

      (mockCtx.store.get as any).mockResolvedValue(null);

      await agentHandlers.handleAgentTokensDeposited(mockCtx, mockLog, timestamp, blockNumber);

      expect(mockCtx.log.error).toHaveBeenCalled();
    });

    it('should execute handleAgentTokensDeposited - success path', async () => {
      const factoryAbi = await import('../abi/PersonaTokenFactory');
      (factoryAbi.events.AgentTokensDeposited.decode as any).mockReturnValue({
        tokenId: 1n,
        depositor: '0xDEPOSITOR',
        amount: 1000n,
      });

      const mockPersona = { id: '1', totalAgentDeposited: 0n };
      (mockCtx.store.get as any).mockResolvedValue(mockPersona);

      await agentHandlers.handleAgentTokensDeposited(mockCtx, mockLog, timestamp, blockNumber);

      expect(mockCtx.store.insert).toHaveBeenCalled();
      expect(mockPersona.totalAgentDeposited).toBe(1000n);
      expect(mockCtx.store.save).toHaveBeenCalledWith(mockPersona);
    });

    it('should execute handleAgentTokensWithdrawn - persona not found', async () => {
      const factoryAbi = await import('../abi/PersonaTokenFactory');
      (factoryAbi.events.AgentTokensWithdrawn.decode as any).mockReturnValue({
        tokenId: 1n,
        depositor: '0xUSER',
        amount: 500n,
      });

      (mockCtx.store.get as any).mockResolvedValue(null);

      await agentHandlers.handleAgentTokensWithdrawn(mockCtx, mockLog);

      expect(mockCtx.log.error).toHaveBeenCalled();
    });

    it('should execute handleAgentTokensWithdrawn - success path with deposits', async () => {
      const factoryAbi = await import('../abi/PersonaTokenFactory');
      (factoryAbi.events.AgentTokensWithdrawn.decode as any).mockReturnValue({
        tokenId: 1n,
        depositor: '0xUSER',
        amount: 500n,
      });

      const mockPersona = { id: '1', totalAgentDeposited: 1000n };
      const mockDeposits = [
        { id: '1-1', amount: 300n, withdrawn: false },
        { id: '1-2', amount: 400n, withdrawn: false },
      ];

      (mockCtx.store.get as any).mockResolvedValue(mockPersona);
      (mockCtx.store.find as any).mockResolvedValue(mockDeposits);

      await agentHandlers.handleAgentTokensWithdrawn(mockCtx, mockLog);

      expect(mockDeposits[0].withdrawn).toBe(true);
      expect(mockDeposits[1].withdrawn).toBe(false);
      expect(mockPersona.totalAgentDeposited).toBe(500n);
      expect(mockCtx.store.save).toHaveBeenCalled();
    });

    it('should execute handleAgentRewardsDistributed - persona not found', async () => {
      const factoryAbi = await import('../abi/PersonaTokenFactory');
      (factoryAbi.events.AgentRewardsDistributed.decode as any).mockReturnValue({
        tokenId: 1n,
        recipient: '0xRECIPIENT',
        personaTokens: 1000n,
      });

      (mockCtx.store.get as any).mockResolvedValue(null);

      await agentHandlers.handleAgentRewardsDistributed(mockCtx, mockLog, timestamp, blockNumber);

      expect(mockCtx.log.error).toHaveBeenCalled();
    });

    it('should execute handleAgentRewardsDistributed - success path', async () => {
      const factoryAbi = await import('../abi/PersonaTokenFactory');
      (factoryAbi.events.AgentRewardsDistributed.decode as any).mockReturnValue({
        tokenId: 1n,
        recipient: '0xRECIPIENT',
        personaTokens: 1000n,
      });

      const mockPersona = { id: '1' };
      const mockDeposits = [
        { id: '1-1', rewardsClaimed: false },
        { id: '1-2', rewardsClaimed: false },
      ];

      (mockCtx.store.get as any).mockResolvedValue(mockPersona);
      (mockCtx.store.find as any).mockResolvedValue(mockDeposits);

      await agentHandlers.handleAgentRewardsDistributed(mockCtx, mockLog, timestamp, blockNumber);

      expect(mockCtx.store.insert).toHaveBeenCalled();
      expect(mockDeposits[0].rewardsClaimed).toBe(true);
      expect(mockDeposits[1].rewardsClaimed).toBe(true);
    });
  });

  describe('Persona Handlers', () => {
    it('should execute handlePersonaCreated - persona already exists', async () => {
      const factoryAbi = await import('../abi/PersonaTokenFactory');
      (factoryAbi.events.PersonaCreated.decode as any).mockReturnValue({
        tokenId: 1n,
        domain: '0x' + Buffer.from('test').toString('hex').padEnd(64, '0'),
        token: '0xTOKEN',
      });

      // Mock existing persona
      (mockCtx.store.get as any).mockResolvedValue({ id: '1' });

      await personaHandlers.handlePersonaCreated(mockCtx, mockLog, timestamp, blockNumber);

      expect(mockCtx.log.warn).toHaveBeenCalled();
      expect(mockCtx.store.insert).not.toHaveBeenCalled();
    });

    it('should execute handlePersonaCreated - success path', async () => {
      const factoryAbi = await import('../abi/PersonaTokenFactory');
      (factoryAbi.events.PersonaCreated.decode as any).mockReturnValue({
        tokenId: 1n,
        domain: '0x' + Buffer.from('test').toString('hex').padEnd(64, '0'),
        token: '0xTOKEN',
      });

      // Mock no existing persona
      (mockCtx.store.get as any).mockResolvedValue(null);

      await personaHandlers.handlePersonaCreated(mockCtx, mockLog, timestamp, blockNumber);

      expect(mockCtx.store.insert).toHaveBeenCalled();
      expect(mockCtx.log.info).toHaveBeenCalled();
    });

    it('should execute handlePersonaCreated - contract error fallback', async () => {
      const factoryAbi = await import('../abi/PersonaTokenFactory');
      (factoryAbi.events.PersonaCreated.decode as any).mockReturnValue({
        tokenId: 1n,
        domain: '0x' + Buffer.from('test').toString('hex').padEnd(64, '0'),
        token: '0xTOKEN',
      });

      // Mock no existing persona
      (mockCtx.store.get as any).mockResolvedValue(null);

      // Mock contract to throw error
      (factoryAbi.Contract as any).mockImplementationOnce(() => ({
        personas: vi.fn().mockRejectedValue(new Error('Contract error')),
      }));

      await personaHandlers.handlePersonaCreated(mockCtx, mockLog, timestamp, blockNumber);

      expect(mockCtx.log.error).toHaveBeenCalled();
      expect(mockCtx.store.insert).toHaveBeenCalled(); // Still inserts with minimal data
    });
  });

  describe('Transfer Handlers', () => {
    it('should execute handleTransfer - persona not found', async () => {
      const factoryAbi = await import('../abi/PersonaTokenFactory');
      (factoryAbi.events.Transfer.decode as any).mockReturnValue({
        from: '0xFROM',
        to: '0xTO',
        tokenId: 1n,
      });

      (mockCtx.store.get as any).mockResolvedValue(null);

      await transfersHandlers.handleTransfer(mockCtx, mockLog, timestamp, blockNumber);

      expect(mockCtx.log.error).toHaveBeenCalled();
      expect(mockCtx.store.save).not.toHaveBeenCalled();
    });

    it('should execute handleTransfer - success path', async () => {
      const factoryAbi = await import('../abi/PersonaTokenFactory');
      (factoryAbi.events.Transfer.decode as any).mockReturnValue({
        from: '0xFROM',
        to: '0xTO',
        tokenId: 1n,
      });

      const mockPersona = { id: '1', owner: '0xfrom' };
      (mockCtx.store.get as any).mockResolvedValue(mockPersona);

      await transfersHandlers.handleTransfer(mockCtx, mockLog, timestamp, blockNumber);

      expect(mockPersona.owner).toBe('0xto');
      expect(mockCtx.store.save).toHaveBeenCalledWith(mockPersona);
      expect(mockCtx.store.insert).toHaveBeenCalled();
    });
  });

  describe('Trading Handlers', () => {
    it('should execute handleTokensPurchased', async () => {
      const factoryAbi = await import('../abi/PersonaTokenFactory');
      (factoryAbi.events.TokensPurchased.decode as any).mockReturnValue({
        tokenId: 1n,
        buyer: '0xBUYER',
        amountSpent: 1000n,
        tokensReceived: 500n,
      });

      // Mock persona lookup to return a valid persona
      const mockPersona = {
        id: '1',
        totalDeposited: 0n,
        tokensSold: 0n,
      };
      (mockCtx.store.get as any).mockResolvedValue(mockPersona);

      await tradingHandlers.handleTokensPurchased(mockCtx, mockLog, timestamp, blockNumber);

      expect(mockCtx.store.insert).toHaveBeenCalled();
      expect(mockCtx.store.save).toHaveBeenCalledWith(mockPersona);
    });

    it('should execute handleTokensSold', async () => {
      const factoryAbi = await import('../abi/PersonaTokenFactory');
      (factoryAbi.events.TokensSold.decode as any).mockReturnValue({
        tokenId: 1n,
        seller: '0xSELLER',
        amountReceived: 1000n,
        tokensSold: 500n,
      });

      // Mock persona lookup
      const mockPersona = {
        id: '1',
        totalWithdrawn: 0n,
        tokensBought: 0n,
      };
      (mockCtx.store.get as any).mockResolvedValue(mockPersona);

      await tradingHandlers.handleTokensSold(mockCtx, mockLog, timestamp, blockNumber);

      expect(mockCtx.store.insert).toHaveBeenCalled();
      expect(mockCtx.store.save).toHaveBeenCalledWith(mockPersona);
    });
  });

  describe('Other Handlers', () => {
    it('should execute handleGraduated', async () => {
      const factoryAbi = await import('../abi/PersonaTokenFactory');
      (factoryAbi.events.Graduated.decode as any).mockReturnValue({
        tokenId: 1n,
        bondingCurve: '0xBONDING',
        poolId: '0x' + '1'.repeat(64),
        liquidityLocked: 10000n,
      });

      // Mock persona lookup
      const mockPersona = {
        id: '1',
        graduated: false,
        poolId: null,
      };
      (mockCtx.store.get as any).mockResolvedValue(mockPersona);

      await graduationHandlers.handleGraduated(mockCtx, mockLog, timestamp);

      expect(mockCtx.store.save).toHaveBeenCalledWith(mockPersona);
    });

    it('should execute handleTokensClaimed', async () => {
      const factoryAbi = await import('../abi/PersonaTokenFactory');
      (factoryAbi.events.TokensClaimed.decode as any).mockReturnValue({
        tokenId: 1n,
        user: '0xUSER',
        amount: 100n,
      });

      // Mock persona lookup
      const mockPersona = { id: '1' };
      (mockCtx.store.get as any).mockResolvedValue(mockPersona);

      await withdrawalsHandlers.handleTokensClaimed(mockCtx, mockLog, timestamp);

      expect(mockCtx.store.insert).toHaveBeenCalled();
    });

    it('should execute handleMetadataUpdated - persona not found', async () => {
      const factoryAbi = await import('../abi/PersonaTokenFactory');
      (factoryAbi.events.MetadataUpdated.decode as any).mockReturnValue({
        tokenId: 1n,
        key: '0x' + Buffer.from('image').toString('hex').padEnd(64, '0'),
      });

      // Mock no persona
      (mockCtx.store.get as any).mockResolvedValue(null);

      await metadataHandlers.handleMetadataUpdated(mockCtx, mockLog, timestamp, blockNumber);

      expect(mockCtx.log.error).toHaveBeenCalled();
      expect(mockCtx.store.save).not.toHaveBeenCalled();
    });

    it('should execute handleMetadataUpdated - create new metadata', async () => {
      const factoryAbi = await import('../abi/PersonaTokenFactory');
      (factoryAbi.events.MetadataUpdated.decode as any).mockReturnValue({
        tokenId: 1n,
        key: '0x' + Buffer.from('image').toString('hex').padEnd(64, '0'),
      });

      const mockPersona = { id: '1' };

      // First call returns persona, second call returns null (no existing metadata)
      (mockCtx.store.get as any)
        .mockResolvedValueOnce(mockPersona)
        .mockResolvedValueOnce(null);

      await metadataHandlers.handleMetadataUpdated(mockCtx, mockLog, timestamp, blockNumber);

      expect(mockCtx.store.save).toHaveBeenCalled();
      expect(mockCtx.log.info).toHaveBeenCalled();
    });

    it('should execute handleMetadataUpdated - update existing metadata', async () => {
      const factoryAbi = await import('../abi/PersonaTokenFactory');
      (factoryAbi.events.MetadataUpdated.decode as any).mockReturnValue({
        tokenId: 1n,
        key: '0x' + Buffer.from('image').toString('hex').padEnd(64, '0'),
      });

      const mockPersona = { id: '1' };
      const mockExistingMetadata = {
        id: '1-key',
        value: 'old value',
        updatedAt: new Date('2024-01-01'),
      };

      // First call returns persona, second call returns existing metadata
      (mockCtx.store.get as any)
        .mockResolvedValueOnce(mockPersona)
        .mockResolvedValueOnce(mockExistingMetadata);

      await metadataHandlers.handleMetadataUpdated(mockCtx, mockLog, timestamp, blockNumber);

      expect(mockExistingMetadata.value).toBe('test metadata value');
      expect(mockCtx.store.save).toHaveBeenCalled();
    });

    it('should execute handleMetadataUpdated - contract error', async () => {
      const factoryAbi = await import('../abi/PersonaTokenFactory');
      (factoryAbi.events.MetadataUpdated.decode as any).mockReturnValue({
        tokenId: 1n,
        key: '0x' + Buffer.from('image').toString('hex').padEnd(64, '0'),
      });

      const mockPersona = { id: '1' };
      (mockCtx.store.get as any).mockResolvedValue(mockPersona);

      // Mock contract to throw error
      (factoryAbi.Contract as any).mockImplementationOnce(() => ({
        metadata: vi.fn().mockRejectedValue(new Error('Contract error')),
      }));

      await metadataHandlers.handleMetadataUpdated(mockCtx, mockLog, timestamp, blockNumber);

      expect(mockCtx.log.error).toHaveBeenCalled();
      expect(mockCtx.store.save).not.toHaveBeenCalled();
    });

    it('should execute handleV4PoolCreated', async () => {
      const factoryAbi = await import('../abi/PersonaTokenFactory');
      (factoryAbi.events.V4PoolCreated.decode as any).mockReturnValue({
        tokenId: 1n,
        pool: '0xPOOL',
        poolId: '0x' + '2'.repeat(64),
        liquidity: 10000n,
      });

      // Mock persona lookup
      const mockPersona = { id: '1' };
      (mockCtx.store.get as any).mockResolvedValue(mockPersona);

      await liquidityHandlers.handleV4PoolCreated(mockCtx, mockLog, timestamp, blockNumber);

      expect(mockCtx.store.save).toHaveBeenCalled();
    });

    it('should execute handleFeesCollected', async () => {
      const factoryAbi = await import('../abi/PersonaTokenFactory');
      (factoryAbi.events.FeesCollected.decode as any).mockReturnValue({
        tokenId: 1n,
        poolId: '0x' + '1'.repeat(64),
        amount0: 100n,
        amount1: 50n,
      });

      // Mock persona lookup
      const mockPersona = { id: '1' };
      (mockCtx.store.get as any).mockResolvedValue(mockPersona);

      await tradingHandlers.handleFeesCollected(mockCtx, mockLog, timestamp, blockNumber);

      // This handler just logs, so verify it was called
      expect(factoryAbi.events.FeesCollected.decode).toHaveBeenCalled();
    });

    it('should execute handleTokensDistributed', async () => {
      const factoryAbi = await import('../abi/PersonaTokenFactory');
      (factoryAbi.events.TokensDistributed.decode as any).mockReturnValue({
        tokenId: 1n,
        toAmica: 100n,
        toLiquidity: 200n,
        toAgentRewards: 300n,
      });

      // Mock persona lookup
      const mockPersona = { id: '1' };
      (mockCtx.store.get as any).mockResolvedValue(mockPersona);

      await graduationHandlers.handleTokensDistributed(mockCtx, mockLog, timestamp, blockNumber);

      // This handler just logs, so verify it was called
      expect(factoryAbi.events.TokensDistributed.decode).toHaveBeenCalled();
    });
  });

  describe('AMICA Token Handlers', () => {
    it('should execute handleAmicaTransfer', async () => {
      const amicaAbi = await import('../abi/AmicaTokenMainnet');
      (amicaAbi.events.Transfer.decode as any).mockReturnValue({
        from: '0xFROM',
        to: '0xTO',
        value: 1000n,
      });

      await amicaTokenHandlers.handleAmicaTransfer(mockCtx, mockLog, timestamp, blockNumber);

      expect(amicaAbi.events.Transfer.decode).toHaveBeenCalled();
    });

    it('should execute handleAmicaTokenClaimed', async () => {
      const amicaAbi = await import('../abi/AmicaTokenMainnet');
      (amicaAbi.events.TokenClaimed.decode as any).mockReturnValue({
        user: '0xUSER',
        claimedToken: '0xCLAIMEDTOKEN',
        amountBurned: 500n,
        amountClaimed: 1000n,
      });

      await amicaTokenHandlers.handleAmicaTokenClaimed(mockCtx, mockLog, timestamp, blockNumber);

      expect(mockCtx.store.insert).toHaveBeenCalled();
    });

    it('should execute handleAmicaTokenDeposited', async () => {
      const amicaAbi = await import('../abi/AmicaTokenMainnet');
      (amicaAbi.events.TokenDeposited.decode as any).mockReturnValue({
        user: '0xUSER',
        token: '0xTOKEN',
        amountDeposited: 500n,
        amountMinted: 1000n,
      });

      await amicaTokenHandlers.handleAmicaTokenDeposited(mockCtx, mockLog, timestamp, blockNumber);

      expect(mockCtx.store.insert).toHaveBeenCalled();
    });

    it('should execute handleAmicaTokenConfigured', async () => {
      const amicaAbi = await import('../abi/AmicaTokenMainnet');
      (amicaAbi.events.TokenConfigured.decode as any).mockReturnValue({
        token: '0xTOKEN',
        enabled: true,
        exchangeRate: 1000n,
        decimals: 18,
      });

      await amicaTokenHandlers.handleAmicaTokenConfigured(mockCtx, mockLog, timestamp, blockNumber);

      expect(amicaAbi.events.TokenConfigured.decode).toHaveBeenCalled();
    });

    it('should execute handleAmicaTokenWithdrawn', async () => {
      const amicaAbi = await import('../abi/AmicaTokenMainnet');
      (amicaAbi.events.TokenWithdrawn.decode as any).mockReturnValue({
        token: '0xTOKEN',
        to: '0xTO',
        amount: 500n,
      });

      await amicaTokenHandlers.handleAmicaTokenWithdrawn(mockCtx, mockLog, timestamp, blockNumber);

      expect(mockCtx.store.insert).toHaveBeenCalled();
    });
  });

  describe('Fee Reduction Handlers', () => {
    it('should execute handleSnapshotUpdated', async () => {
      const feeReductionAbi = await import('../abi/FeeReductionSystem');
      (feeReductionAbi.events.SnapshotUpdated.decode as any).mockReturnValue({
        user: '0xUSER',
        balance: 1000n,
        blockNumber: blockNumber,
      });

      await feeReductionHandlers.handleSnapshotUpdated(mockCtx, mockLog, timestamp);

      expect(feeReductionAbi.events.SnapshotUpdated.decode).toHaveBeenCalled();
    });

    it('should execute handleSnapshotActivated', async () => {
      const feeReductionAbi = await import('../abi/FeeReductionSystem');
      (feeReductionAbi.events.SnapshotActivated.decode as any).mockReturnValue({
        user: '0xUSER',
        activeBalance: 1000n,
        activationBlock: blockNumber,
      });

      await feeReductionHandlers.handleSnapshotActivated(mockCtx, mockLog, timestamp);

      expect(feeReductionAbi.events.SnapshotActivated.decode).toHaveBeenCalled();
    });

    it('should execute handleFeeReductionConfigUpdated', async () => {
      const feeReductionAbi = await import('../abi/FeeReductionSystem');
      (feeReductionAbi.events.FeeReductionConfigUpdated.decode as any).mockReturnValue({
        tier: 1n,
        minBalance: 1000n,
        reductionBps: 500n,
      });

      await feeReductionHandlers.handleFeeReductionConfigUpdated(mockCtx, mockLog, timestamp);

      expect(feeReductionAbi.events.FeeReductionConfigUpdated.decode).toHaveBeenCalled();
    });
  });

  describe('Stats Handlers', () => {
    it('should execute updateDailyStats', async () => {
      const dateStr = '2024-01-01';

      // Mock get and findBy to return empty results
      (mockCtx.store.get as any).mockResolvedValue(null);
      (mockCtx.store.findBy as any).mockResolvedValue([]);

      await statsHandlers.updateDailyStats(mockCtx, dateStr);

      expect(mockCtx.store.save).toHaveBeenCalled();
    });

    it('should execute updateGlobalStats', async () => {
      // Mock get to return null (no existing global stats)
      (mockCtx.store.get as any).mockResolvedValue(null);
      (mockCtx.store.findBy as any).mockResolvedValue([]);

      await statsHandlers.updateGlobalStats(mockCtx);

      expect(mockCtx.store.save).toHaveBeenCalled();
    });
  });
});
