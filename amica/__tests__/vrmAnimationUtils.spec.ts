import { describe, it, expect } from 'vitest';
import { saturate } from '../src/lib/VRMAnimation/utils/saturate';
import { linearstep } from '../src/lib/VRMAnimation/utils/linearstep';
import { arrayChunk } from '../src/lib/VRMAnimation/utils/arrayChunk';

describe('VRM Animation Utils', () => {
  describe('saturate', () => {
    it('should clamp values between 0 and 1', () => {
      expect(saturate(0.5)).toBe(0.5);
    });

    it('should clamp negative values to 0', () => {
      expect(saturate(-1)).toBe(0);
      expect(saturate(-0.5)).toBe(0);
      expect(saturate(-100)).toBe(0);
    });

    it('should clamp values greater than 1 to 1', () => {
      expect(saturate(2)).toBe(1);
      expect(saturate(1.5)).toBe(1);
      expect(saturate(100)).toBe(1);
    });

    it('should preserve boundary values', () => {
      expect(saturate(0)).toBe(0);
      expect(saturate(1)).toBe(1);
    });

    it('should handle very small positive values', () => {
      expect(saturate(0.001)).toBe(0.001);
      expect(saturate(0.999)).toBe(0.999);
    });
  });

  describe('linearstep', () => {
    it('should return 0 when t equals a', () => {
      expect(linearstep(0, 1, 0)).toBe(0);
      expect(linearstep(5, 10, 5)).toBe(0);
    });

    it('should return 1 when t equals b', () => {
      expect(linearstep(0, 1, 1)).toBe(1);
      expect(linearstep(5, 10, 10)).toBe(1);
    });

    it('should return 0.5 when t is midway between a and b', () => {
      expect(linearstep(0, 1, 0.5)).toBe(0.5);
      expect(linearstep(0, 10, 5)).toBe(0.5);
      expect(linearstep(10, 20, 15)).toBe(0.5);
    });

    it('should return 0 when t is less than a', () => {
      expect(linearstep(0, 1, -1)).toBe(0);
      expect(linearstep(5, 10, 0)).toBe(0);
    });

    it('should return 1 when t is greater than b', () => {
      expect(linearstep(0, 1, 2)).toBe(1);
      expect(linearstep(5, 10, 15)).toBe(1);
    });

    it('should handle negative ranges', () => {
      expect(linearstep(-1, 1, 0)).toBe(0.5);
      expect(linearstep(-10, -5, -7.5)).toBe(0.5);
    });

    it('should handle fractional values', () => {
      expect(linearstep(0, 1, 0.25)).toBe(0.25);
      expect(linearstep(0, 1, 0.75)).toBe(0.75);
    });
  });

  describe('arrayChunk', () => {
    it('should split array into chunks of specified size', () => {
      const result = arrayChunk([1, 2, 3, 4, 5, 6], 2);
      expect(result).toEqual([[1, 2], [3, 4], [5, 6]]);
    });

    it('should handle arrays that do not divide evenly', () => {
      const result = arrayChunk([1, 2, 3, 4, 5], 2);
      expect(result).toEqual([[1, 2], [3, 4], [5]]);
    });

    it('should handle chunk size of 1', () => {
      const result = arrayChunk([1, 2, 3], 1);
      expect(result).toEqual([[1], [2], [3]]);
    });

    it('should handle chunk size equal to array length', () => {
      const result = arrayChunk([1, 2, 3, 4], 4);
      expect(result).toEqual([[1, 2, 3, 4]]);
    });

    it('should handle chunk size greater than array length', () => {
      const result = arrayChunk([1, 2, 3], 5);
      expect(result).toEqual([[1, 2, 3]]);
    });

    it('should handle empty array', () => {
      const result = arrayChunk([], 2);
      expect(result).toEqual([]);
    });

    it('should handle chunk size of 3', () => {
      const result = arrayChunk([1, 2, 3, 4, 5, 6, 7, 8, 9], 3);
      expect(result).toEqual([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
    });

    it('should handle string arrays', () => {
      const result = arrayChunk(['a', 'b', 'c', 'd'], 2);
      expect(result).toEqual([['a', 'b'], ['c', 'd']]);
    });

    it('should handle single element array', () => {
      const result = arrayChunk([42], 2);
      expect(result).toEqual([[42]]);
    });

    it('should handle arrays with partial last chunk', () => {
      const result = arrayChunk([1, 2, 3, 4, 5, 6, 7], 3);
      expect(result).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
    });
  });
});
