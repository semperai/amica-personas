import { isValidConfigKey, AMICA_CONFIG_KEYS, AMICA_LOCALSTORAGE_PREFIX } from '../amica-config-keys';

describe('amica-config-keys', () => {
  describe('AMICA_CONFIG_KEYS', () => {
    test('should contain expected config keys', () => {
      expect(AMICA_CONFIG_KEYS).toContain('name');
      expect(AMICA_CONFIG_KEYS).toContain('system_prompt');
      expect(AMICA_CONFIG_KEYS).toContain('vrm_url');
      expect(AMICA_CONFIG_KEYS).toContain('bg_color');
      expect(AMICA_CONFIG_KEYS).toContain('bg_url');
      expect(AMICA_CONFIG_KEYS).toContain('animation_url');
      expect(AMICA_CONFIG_KEYS).toContain('chatbot_backend');
      expect(AMICA_CONFIG_KEYS).toContain('tts_backend');
      expect(AMICA_CONFIG_KEYS).toContain('stt_backend');
    });

    test('should contain API-related keys', () => {
      expect(AMICA_CONFIG_KEYS).toContain('openai_apikey');
      expect(AMICA_CONFIG_KEYS).toContain('openai_url');
      expect(AMICA_CONFIG_KEYS).toContain('openai_model');
      expect(AMICA_CONFIG_KEYS).toContain('elevenlabs_apikey');
      expect(AMICA_CONFIG_KEYS).toContain('elevenlabs_voiceid');
    });

    test('should not be empty', () => {
      expect(AMICA_CONFIG_KEYS.length).toBeGreaterThan(0);
    });

    test('should have unique values', () => {
      const uniqueKeys = new Set(AMICA_CONFIG_KEYS);
      expect(uniqueKeys.size).toBe(AMICA_CONFIG_KEYS.length);
    });
  });

  describe('isValidConfigKey', () => {
    test('should return true for valid config keys', () => {
      expect(isValidConfigKey('name')).toBe(true);
      expect(isValidConfigKey('system_prompt')).toBe(true);
      expect(isValidConfigKey('vrm_url')).toBe(true);
      expect(isValidConfigKey('bg_color')).toBe(true);
      expect(isValidConfigKey('openai_apikey')).toBe(true);
    });

    test('should return false for invalid config keys', () => {
      expect(isValidConfigKey('invalid_key')).toBe(false);
      expect(isValidConfigKey('fake_config')).toBe(false);
      expect(isValidConfigKey('random_string')).toBe(false);
      expect(isValidConfigKey('')).toBe(false);
    });

    test('should be case sensitive', () => {
      expect(isValidConfigKey('name')).toBe(true);
      expect(isValidConfigKey('Name')).toBe(false);
      expect(isValidConfigKey('NAME')).toBe(false);
    });

    test('should handle special characters', () => {
      expect(isValidConfigKey('name!')).toBe(false);
      expect(isValidConfigKey('name ')).toBe(false);
      expect(isValidConfigKey(' name')).toBe(false);
    });

    test('should validate all keys in AMICA_CONFIG_KEYS', () => {
      AMICA_CONFIG_KEYS.forEach(key => {
        expect(isValidConfigKey(key)).toBe(true);
      });
    });
  });

  describe('AMICA_LOCALSTORAGE_PREFIX', () => {
    test('should be correct prefix', () => {
      expect(AMICA_LOCALSTORAGE_PREFIX).toBe('chatvrm_');
    });

    test('should end with underscore', () => {
      expect(AMICA_LOCALSTORAGE_PREFIX.endsWith('_')).toBe(true);
    });
  });
});
