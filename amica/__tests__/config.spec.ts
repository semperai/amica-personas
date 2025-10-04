import { describe, it, expect, vi } from 'vitest';
import {
  config,
  defaultConfig,
  setConfig
} from '../src/utils/config';

describe('config', () => {

  describe('defaultConfig', () => {
    it('should return default value for existing keys', () => {
      expect(defaultConfig('chatbot_backend')).toBe('chatgpt');
      expect(defaultConfig('tts_muted')).toBe('false');
      expect(defaultConfig('name')).toBe('Amica');
    });

    it('should throw error for non-existent keys', () => {
      expect(() => defaultConfig('non_existent_key')).toThrow('config key not found: non_existent_key');
    });

    it('should return autosend_from_mic default', () => {
      expect(defaultConfig('autosend_from_mic')).toBe('true');
    });

    it('should return wake_word_enabled default', () => {
      expect(defaultConfig('wake_word_enabled')).toBe('false');
    });

    it('should return time_before_idle_sec default', () => {
      expect(defaultConfig('time_before_idle_sec')).toBe('20');
    });
  });

  describe('config', () => {
    it('should throw error for non-existent keys', () => {
      expect(() => config('non_existent_key_xyz123')).toThrow('config key not found: non_existent_key_xyz123');
    });

    it('should return config value (default or loaded)', () => {
      const value = config('chatbot_backend');
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    });

    it('should return loaded config value over default when set', () => {
      setConfig('test_config_key_unique', 'test_value');
      expect(config('test_config_key_unique')).toBe('test_value');
    });

    it('should support multiple config overrides', () => {
      setConfig('test_key_1', 'value_1');
      setConfig('test_key_2', 'value_2');
      setConfig('test_key_3', 'value_3');

      expect(config('test_key_1')).toBe('value_1');
      expect(config('test_key_2')).toBe('value_2');
      expect(config('test_key_3')).toBe('value_3');
    });
  });

  describe('setConfig', () => {
    it('should set configuration value', () => {
      setConfig('unique_test_key_123', 'test_value_123');
      expect(config('unique_test_key_123')).toBe('test_value_123');
    });

    it('should override existing values', () => {
      setConfig('override_key', 'value1');
      expect(config('override_key')).toBe('value1');
      setConfig('override_key', 'value2');
      expect(config('override_key')).toBe('value2');
    });

    it('should allow empty string values', () => {
      setConfig('empty_key_test', '');
      expect(config('empty_key_test')).toBe('');
    });

    it('should handle special characters', () => {
      setConfig('special_key', 'value with spaces & symbols!');
      expect(config('special_key')).toBe('value with spaces & symbols!');
    });
  });
});
