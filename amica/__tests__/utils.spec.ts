import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { convertNumberToWordsEN } from '../src/utils/numberSpelling';
import { hashCode } from '../src/utils/stringHash';
import { wait } from '../src/utils/sleep';
import { hasOnScreenKeyboard } from '../src/utils/hasOnScreenKeyboard';
import { getMimeType, getExtension } from '../src/utils/getMimeType';

describe('Utils', () => {
  describe('convertNumberToWordsEN', () => {
    it('should convert 0 to zero', () => {
      expect(convertNumberToWordsEN(0)).toBe('zero');
    });

    it('should convert numbers 1-19', () => {
      expect(convertNumberToWordsEN(1)).toBe('one');
      expect(convertNumberToWordsEN(5)).toBe('five');
      expect(convertNumberToWordsEN(10)).toBe('ten');
      expect(convertNumberToWordsEN(15)).toBe('fifteen');
      expect(convertNumberToWordsEN(19)).toBe('nineteen');
    });

    it('should convert tens', () => {
      expect(convertNumberToWordsEN(20)).toBe('twenty ');
      expect(convertNumberToWordsEN(30)).toBe('thirty ');
      expect(convertNumberToWordsEN(50)).toBe('fifty ');
      expect(convertNumberToWordsEN(90)).toBe('ninety ');
    });

    it('should convert two digit numbers', () => {
      expect(convertNumberToWordsEN(21)).toBe('twenty one');
      expect(convertNumberToWordsEN(45)).toBe('forty five');
      expect(convertNumberToWordsEN(99)).toBe('ninety nine');
    });

    it('should convert hundreds', () => {
      expect(convertNumberToWordsEN(100)).toBe('one hundred');
      expect(convertNumberToWordsEN(200)).toBe('two hundred');
      expect(convertNumberToWordsEN(900)).toBe('nine hundred');
    });

    it('should convert hundreds with remainder', () => {
      expect(convertNumberToWordsEN(101)).toBe('one hundred and one');
      expect(convertNumberToWordsEN(250)).toBe('two hundred and fifty ');
      expect(convertNumberToWordsEN(999)).toBe('nine hundred and ninety nine');
    });

    it('should convert thousands', () => {
      expect(convertNumberToWordsEN(1000)).toBe('one thousand');
      expect(convertNumberToWordsEN(2000)).toBe('two thousand');
      expect(convertNumberToWordsEN(9000)).toBe('nine thousand');
    });

    it('should convert thousands with hundreds', () => {
      expect(convertNumberToWordsEN(1100)).toBe('one thousand one hundred');
      expect(convertNumberToWordsEN(2500)).toBe('two thousand five hundred');
    });

    it('should convert thousands with remainder less than 100', () => {
      expect(convertNumberToWordsEN(1001)).toBe('one thousand and one');
      expect(convertNumberToWordsEN(2050)).toBe('two thousand and fifty ');
    });

    it('should convert four digit numbers with all components', () => {
      expect(convertNumberToWordsEN(1234)).toBe('one thousand two hundred and thirty four');
      expect(convertNumberToWordsEN(5678)).toBe('five thousand six hundred and seventy eight');
    });

    it('should handle negative numbers', () => {
      expect(convertNumberToWordsEN(-5)).toBe('negative five');
      expect(convertNumberToWordsEN(-100)).toBe('negative one hundred');
      expect(convertNumberToWordsEN(-1234)).toBe('negative one thousand two hundred and thirty four');
    });

    it('should floor decimal numbers', () => {
      expect(convertNumberToWordsEN(5.9)).toBe('five');
      expect(convertNumberToWordsEN(99.1)).toBe('ninety nine');
      expect(convertNumberToWordsEN(100.7)).toBe('one hundred');
    });

    it('should return empty string for numbers >= 10000', () => {
      expect(convertNumberToWordsEN(10000)).toBe('');
      expect(convertNumberToWordsEN(99999)).toBe('');
    });
  });

  describe('hashCode', () => {
    it('should generate hash for simple strings', () => {
      const hash = hashCode('hello');
      expect(typeof hash).toBe('string');
      expect(hash).toBeTruthy();
    });

    it('should generate consistent hashes', () => {
      const hash1 = hashCode('test');
      const hash2 = hashCode('test');
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different strings', () => {
      const hash1 = hashCode('hello');
      const hash2 = hashCode('world');
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', () => {
      const hash = hashCode('');
      expect(hash).toBe('0');
    });

    it('should handle single character', () => {
      const hash = hashCode('a');
      expect(typeof hash).toBe('string');
      expect(hash).toBeTruthy();
    });

    it('should handle long strings', () => {
      const longString = 'a'.repeat(1000);
      const hash = hashCode(longString);
      expect(typeof hash).toBe('string');
      expect(hash).toBeTruthy();
    });

    it('should handle special characters', () => {
      const hash = hashCode('!@#$%^&*()');
      expect(typeof hash).toBe('string');
      expect(hash).toBeTruthy();
    });

    it('should handle unicode characters', () => {
      const hash = hashCode('こんにちは');
      expect(typeof hash).toBe('string');
      expect(hash).toBeTruthy();
    });
  });

  describe('wait', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should wait for specified milliseconds', async () => {
      const promise = wait(100);

      // Fast-forward time
      vi.advanceTimersByTime(100);

      await expect(promise).resolves.toBeUndefined();
    });

    it('should not resolve before time elapses', async () => {
      const promise = wait(100);
      let resolved = false;
      promise.then(() => { resolved = true; });

      // Advance only 50ms
      vi.advanceTimersByTime(50);
      await Promise.resolve(); // Let microtasks run

      expect(resolved).toBe(false);
    });

    it('should handle zero milliseconds', async () => {
      const promise = wait(0);
      vi.advanceTimersByTime(0);
      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('hasOnScreenKeyboard', () => {
    const originalUserAgent = navigator.userAgent;

    afterEach(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value: originalUserAgent,
        configurable: true
      });
    });

    it('should return boolean', () => {
      const result = hasOnScreenKeyboard();
      expect(typeof result).toBe('boolean');
    });

    it('should detect mobile user agents', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        configurable: true
      });

      expect(hasOnScreenKeyboard()).toBe(true);
    });

    it('should detect Android devices', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Linux; Android 10)',
        configurable: true
      });

      expect(hasOnScreenKeyboard()).toBe(true);
    });

    it('should detect iPad', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
        configurable: true
      });

      expect(hasOnScreenKeyboard()).toBe(true);
    });

    it('should return false for desktop user agents', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        configurable: true
      });

      expect(hasOnScreenKeyboard()).toBe(false);
    });
  });

  describe('getMimeType', () => {
    beforeEach(() => {
      // Mock MediaRecorder for tests
      global.MediaRecorder = {
        isTypeSupported: vi.fn((type: string) => {
          if (type === 'audio/webm' || type === 'video/webm') return true;
          return false;
        })
      } as any;
    });

    afterEach(() => {
      delete (global as any).MediaRecorder;
    });

    it('should return audio mime type', () => {
      const mimeType = getMimeType('audio');
      expect(typeof mimeType).toBe('string');
      expect(mimeType).toBe('audio/webm');
    });

    it('should return video mime type', () => {
      const mimeType = getMimeType('video');
      expect(typeof mimeType).toBe('string');
      expect(mimeType).toBe('video/webm');
    });

    it('should return supported mime types', () => {
      const audioMime = getMimeType('audio');
      const videoMime = getMimeType('video');

      expect(audioMime).toBe('audio/webm');
      expect(videoMime).toBe('video/webm');
    });

    it('should fallback to mp4 when MediaRecorder.isTypeSupported is not available', () => {
      global.MediaRecorder = {} as any; // Has MediaRecorder but no isTypeSupported

      const audioMime = getMimeType('audio');
      const videoMime = getMimeType('video');

      expect(audioMime).toBe('audio/mp4');
      expect(videoMime).toBe('video/mp4');
    });
  });

  describe('getExtension', () => {
    beforeEach(() => {
      global.MediaRecorder = {
        isTypeSupported: vi.fn((type: string) => {
          if (type === 'audio/webm' || type === 'video/webm') return true;
          return false;
        })
      } as any;
    });

    afterEach(() => {
      delete (global as any).MediaRecorder;
    });

    it('should return valid extension for audio', () => {
      const ext = getExtension('audio');
      expect(['mp4', 'mp3', 'webm']).toContain(ext);
    });

    it('should return valid extension for video', () => {
      const ext = getExtension('video');
      expect(['mp4', 'webm']).toContain(ext);
    });

    it('should return webm when mime type is webm', () => {
      const audioExt = getExtension('audio');
      const videoExt = getExtension('video');

      expect(audioExt).toBe('webm');
      expect(videoExt).toBe('webm');
    });

    it('should return mp4 when mime type is mp4', () => {
      global.MediaRecorder = {
        isTypeSupported: vi.fn((type: string) => {
          if (type === 'audio/mp4' || type === 'video/mp4') return true;
          return false;
        })
      } as any;

      const audioExt = getExtension('audio');
      const videoExt = getExtension('video');

      expect(audioExt).toBe('mp4');
      expect(videoExt).toBe('mp4');
    });

    it('should return mp3 when audio mime type is mpeg', () => {
      global.MediaRecorder = {
        isTypeSupported: vi.fn((type: string) => {
          if (type === 'audio/mpeg') return true;
          if (type === 'video/mp4') return true;
          return false;
        })
      } as any;

      const audioExt = getExtension('audio');
      expect(audioExt).toBe('mp3');
    });
  });
});
