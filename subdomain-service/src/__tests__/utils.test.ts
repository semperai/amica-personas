import {
  parseSubdomain,
  getAmicaVersion,
  buildAmicaConfig,
  injectConfig,
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

describe('injectConfig', () => {
  const mockConfig = {
    personaName: 'Test AI',
    personaSymbol: 'TEST',
    chainId: 42161,
    tokenId: '123',
    domain: 'test-ai',
    erc20Token: '0xtoken',
    creator: '0xcreator',
    owner: '0xowner',
    isGraduated: false,
    metadata: {
      system_prompt: 'You are a helpful AI',
      vrm_url: 'https://example.com/avatar.vrm',
      bg_color: '#FF5733',
      bg_url: 'https://example.com/bg.jpg',
      openai_apikey: 'sk-test-key',
      chatbot_backend: 'openai',
    },
  };

  test('should inject script before </head>', () => {
    const html = '<html><head><title>Test</title></head><body></body></html>';
    const result = injectConfig(html, mockConfig);

    expect(result).toContain('<script>');
    expect(result).toContain('window.__AMICA_PERSONA__');
    expect(result).toContain('</script>');
    expect(result.indexOf('</script>')).toBeLessThan(result.indexOf('</head>'));
  });

  test('should inject script at beginning of <body> if no </head>', () => {
    const html = '<html><body><h1>Test</h1></body></html>';
    const result = injectConfig(html, mockConfig);

    expect(result).toContain('<script>');
    expect(result.indexOf('<script>')).toBeLessThan(result.indexOf('<h1>'));
  });

  test('should inject script at beginning if no standard tags', () => {
    const html = '<div>Test</div>';
    const result = injectConfig(html, mockConfig);

    expect(result).toContain('<script>');
    expect(result.indexOf('<script>')).toBe(0);
  });

  test('should inject persona name as localStorage', () => {
    const html = '<html><head></head><body></body></html>';
    const result = injectConfig(html, mockConfig);

    expect(result).toContain("localStorage.setItem('chatvrm_name', \"Test AI\")");
  });

  test('should inject all valid metadata as localStorage', () => {
    const html = '<html><head></head><body></body></html>';
    const result = injectConfig(html, mockConfig);

    expect(result).toContain("localStorage.setItem('chatvrm_system_prompt'");
    expect(result).toContain("localStorage.setItem('chatvrm_vrm_url'");
    expect(result).toContain("localStorage.setItem('chatvrm_bg_color'");
    expect(result).toContain("localStorage.setItem('chatvrm_bg_url'");
    expect(result).toContain("localStorage.setItem('chatvrm_openai_apikey'");
    expect(result).toContain("localStorage.setItem('chatvrm_chatbot_backend'");
  });

  test('should not inject invalid config keys as localStorage', () => {
    const configWithInvalidKeys = {
      ...mockConfig,
      metadata: {
        system_prompt: 'Test',
        invalid_key_that_doesnt_exist: 'Should not be injected',
        another_fake_key: 'Also should not appear',
      },
    };

    const html = '<html><head></head><body></body></html>';
    const result = injectConfig(html, configWithInvalidKeys);

    // Valid key should be injected
    expect(result).toContain("localStorage.setItem('chatvrm_system_prompt'");

    // Invalid keys should NOT be in localStorage.setItem calls
    expect(result).not.toContain("localStorage.setItem('chatvrm_invalid_key_that_doesnt_exist'");
    expect(result).not.toContain("localStorage.setItem('chatvrm_another_fake_key'");

    // But they will still appear in window.__AMICA_PERSONA__ (full config storage)
    expect(result).toContain('window.__AMICA_PERSONA__');
  });

  test('should store full persona config in window.__AMICA_PERSONA__', () => {
    const html = '<html><head></head><body></body></html>';
    const result = injectConfig(html, mockConfig);

    expect(result).toContain('window.__AMICA_PERSONA__ =');
    expect(result).toContain('"personaName": "Test AI"');
    expect(result).toContain('"chainId": 42161');
    expect(result).toContain('"tokenId": "123"');
  });

  test('should properly escape JSON strings', () => {
    const configWithSpecialChars = {
      ...mockConfig,
      metadata: {
        system_prompt: 'You are "AI" with \'quotes\' and\nnewlines',
      },
    };

    const html = '<html><head></head><body></body></html>';
    const result = injectConfig(html, configWithSpecialChars);

    // Should not break the script
    expect(result).toContain('<script>');
    expect(result).toContain('</script>');
    // Should be valid JSON
    expect(() => {
      const scriptMatch = result.match(/window\.__AMICA_PERSONA__ = ({.*?});/s);
      if (scriptMatch) {
        JSON.parse(scriptMatch[1]);
      }
    }).not.toThrow();
  });

  test('should handle empty metadata', () => {
    const configNoMetadata = {
      ...mockConfig,
      metadata: {},
    };

    const html = '<html><head></head><body></body></html>';
    const result = injectConfig(html, configNoMetadata);

    // Should still inject persona name
    expect(result).toContain("localStorage.setItem('chatvrm_name'");
    // Should still have the persona config
    expect(result).toContain('window.__AMICA_PERSONA__');
  });

  test('should handle all config keys dynamically', () => {
    const allConfigKeys = {
      ...mockConfig,
      metadata: {
        // Test a variety of config keys
        language: 'es',
        tts_backend: 'elevenlabs',
        stt_backend: 'whisper',
        wake_word: 'Hey AI',
        elevenlabs_apikey: 'test-key',
        openai_model: 'gpt-4',
        bg_color: '#000000',
        animation_url: '/animations/custom.vrma',
        voice_url: '/voices/custom.wav',
      },
    };

    const html = '<html><head></head><body></body></html>';
    const result = injectConfig(html, allConfigKeys);

    // All should be injected
    expect(result).toContain("localStorage.setItem('chatvrm_language'");
    expect(result).toContain("localStorage.setItem('chatvrm_tts_backend'");
    expect(result).toContain("localStorage.setItem('chatvrm_stt_backend'");
    expect(result).toContain("localStorage.setItem('chatvrm_wake_word'");
    expect(result).toContain("localStorage.setItem('chatvrm_elevenlabs_apikey'");
    expect(result).toContain("localStorage.setItem('chatvrm_openai_model'");
    expect(result).toContain("localStorage.setItem('chatvrm_bg_color'");
    expect(result).toContain("localStorage.setItem('chatvrm_animation_url'");
    expect(result).toContain("localStorage.setItem('chatvrm_voice_url'");
  });
});
