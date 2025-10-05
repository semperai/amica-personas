import {
  parseSubdomain,
  getAmicaVersion,
  buildAmicaConfig,
  escapeHtml,
} from '../utils';
import { Persona } from '../types';

describe('parseSubdomain', () => {
  test('should parse valid subdomain', () => {
    expect(parseSubdomain('test-persona.amica.bot')).toBe('test-persona');
    expect(parseSubdomain('cool-agent.amica.bot')).toBe('cool-agent');
    expect(parseSubdomain('my-ai.amica.bot')).toBe('my-ai');
  });

  test('should handle www subdomain', () => {
    expect(parseSubdomain('www.amica.bot')).toBe('www');
  });

  test('should return null for root domain', () => {
    expect(parseSubdomain('amica.bot')).toBeNull();
  });

  test('should return null for localhost', () => {
    expect(parseSubdomain('localhost')).toBeNull();
    expect(parseSubdomain('localhost:3001')).toBeNull();
  });

  test('should handle nested subdomains', () => {
    expect(parseSubdomain('api.test.amica.bot')).toBe('api');
  });
});

describe('getAmicaVersion', () => {
  test('should return version from metadata', () => {
    const metadata = [
      { key: 'amica_version', value: '2' },
      { key: 'name', value: 'Test' },
    ];
    expect(getAmicaVersion(metadata)).toBe('2');
  });

  test('should return default version when not specified', () => {
    const metadata = [
      { key: 'name', value: 'Test' },
    ];
    expect(getAmicaVersion(metadata)).toBe('1');
  });

  test('should return default version for undefined metadata', () => {
    expect(getAmicaVersion(undefined)).toBe('1');
  });

  test('should return default version for empty array', () => {
    expect(getAmicaVersion([])).toBe('1');
  });

  test('should handle version 1', () => {
    const metadata = [{ key: 'amica_version', value: '1' }];
    expect(getAmicaVersion(metadata)).toBe('1');
  });

  test('should handle future versions', () => {
    const metadata = [{ key: 'amica_version', value: '10' }];
    expect(getAmicaVersion(metadata)).toBe('10');
  });
});

describe('buildAmicaConfig', () => {
  const mockPersona: Persona = {
    id: '1',
    tokenId: '123',
    name: 'Test Persona',
    symbol: 'TEST',
    creator: '0x1234567890123456789012345678901234567890',
    owner: '0x1234567890123456789012345678901234567890',
    erc20Token: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    pairToken: '0x9876543210987654321098765432109876543210',
    agentToken: undefined,
    pairCreated: false,
    pairAddress: undefined,
    createdAt: '2024-01-01T00:00:00Z',
    createdAtBlock: '12345678',
    totalDeposited: '1000000000000000000',
    tokensSold: '500000000000000000',
    graduationThreshold: '850000000000000000',
    totalAgentDeposited: undefined,
    minAgentTokens: undefined,
    chainId: 42161,
    domain: 'test-persona',
    metadata: [
      { key: 'system_prompt', value: 'You are a test AI' },
      { key: 'vrm_url', value: 'https://example.com/avatar.vrm' },
      { key: 'bg_color', value: '#FF5733' },
    ],
  };

  test('should build config from persona', () => {
    const config = buildAmicaConfig(mockPersona);

    expect(config.personaName).toBe('Test Persona');
    expect(config.personaSymbol).toBe('TEST');
    expect(config.chainId).toBe(42161);
    expect(config.tokenId).toBe('123');
    expect(config.domain).toBe('test-persona');
    expect(config.erc20Token).toBe('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd');
    expect(config.creator).toBe('0x1234567890123456789012345678901234567890');
    expect(config.owner).toBe('0x1234567890123456789012345678901234567890');
    expect(config.isGraduated).toBe(false);
  });

  test('should convert metadata array to object', () => {
    const config = buildAmicaConfig(mockPersona);

    expect(config.metadata).toEqual({
      system_prompt: 'You are a test AI',
      vrm_url: 'https://example.com/avatar.vrm',
      bg_color: '#FF5733',
    });
  });

  test('should handle persona without metadata', () => {
    const personaNoMetadata = { ...mockPersona, metadata: undefined };
    const config = buildAmicaConfig(personaNoMetadata);

    expect(config.metadata).toEqual({});
  });

  test('should handle persona with empty metadata', () => {
    const personaEmptyMetadata = { ...mockPersona, metadata: [] };
    const config = buildAmicaConfig(personaEmptyMetadata);

    expect(config.metadata).toEqual({});
  });

  test('should handle graduated persona', () => {
    const graduatedPersona = {
      ...mockPersona,
      pairCreated: true,
      pairAddress: '0xpairaddress',
    };
    const config = buildAmicaConfig(graduatedPersona);

    expect(config.isGraduated).toBe(true);
  });
});

describe('escapeHtml', () => {
  test('should escape HTML special characters', () => {
    const unsafe = '<script>alert("XSS")</script>';
    const escaped = escapeHtml(unsafe);

    expect(escaped).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    expect(escaped).not.toContain('<');
    expect(escaped).not.toContain('>');
  });

  test('should escape ampersands', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  test('should escape quotes', () => {
    expect(escapeHtml('He said "hello"')).toBe('He said &quot;hello&quot;');
    expect(escapeHtml("It's fine")).toBe('It&#039;s fine');
  });

  test('should handle empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  test('should handle string with no special chars', () => {
    expect(escapeHtml('Normal text 123')).toBe('Normal text 123');
  });

  test('should escape multiple special characters', () => {
    const unsafe = `<div class="test" data-value='5 & 6'>Text</div>`;
    const escaped = escapeHtml(unsafe);

    expect(escaped).toContain('&lt;');
    expect(escaped).toContain('&gt;');
    expect(escaped).toContain('&quot;');
    expect(escaped).toContain('&#039;');
    expect(escaped).toContain('&amp;');
  });
});
