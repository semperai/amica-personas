import { describe, it, expect } from 'vitest';
import { bgImages, vrmList, speechT5SpeakerEmbeddingsList, animationList } from '../src/paths';

describe('paths', () => {
  describe('bgImages', () => {
    it('should be an empty array', () => {
      expect(bgImages).toEqual([]);
      expect(Array.isArray(bgImages)).toBe(true);
    });
  });

  describe('vrmList', () => {
    it('should be an empty array', () => {
      expect(vrmList).toEqual([]);
      expect(Array.isArray(vrmList)).toBe(true);
    });
  });

  describe('speechT5SpeakerEmbeddingsList', () => {
    it('should be an empty array', () => {
      expect(speechT5SpeakerEmbeddingsList).toEqual([]);
      expect(Array.isArray(speechT5SpeakerEmbeddingsList)).toBe(true);
    });
  });

  describe('animationList', () => {
    it('should be an array of animation paths', () => {
      expect(Array.isArray(animationList)).toBe(true);
      expect(animationList.length).toBeGreaterThan(0);
    });

    it('should contain .vrma files', () => {
      animationList.forEach(path => {
        expect(path).toMatch(/\.vrma$/);
      });
    });

    it('should contain specific animation files', () => {
      expect(animationList).toContain('/animations/dance.vrma');
      expect(animationList).toContain('/animations/greeting.vrma');
      expect(animationList).toContain('/animations/idle_loop.vrma');
      expect(animationList).toContain('/animations/modelPose.vrma');
      expect(animationList).toContain('/animations/peaceSign.vrma');
      expect(animationList).toContain('/animations/shoot.vrma');
      expect(animationList).toContain('/animations/showFullBody.vrma');
      expect(animationList).toContain('/animations/spin.vrma');
      expect(animationList).toContain('/animations/squat.vrma');
    });

    it('should have paths starting with /animations/', () => {
      animationList.forEach(path => {
        expect(path).toMatch(/^\/animations\//);
      });
    });

    it('should have exactly 9 animation files', () => {
      expect(animationList.length).toBe(9);
    });
  });
});
