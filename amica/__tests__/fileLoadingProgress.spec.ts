import { describe, it, expect, beforeEach } from 'vitest';
import { updateFileProgress } from '../src/utils/fileLoadingProgress';

describe('fileLoadingProgress', () => {
  beforeEach(() => {
    // Clean up window properties before each test
    if (typeof window !== 'undefined') {
      delete (window as any).chatvrm_loading_progress;
      delete (window as any).chatvrm_loading_progress_cnt;
    }
  });

  describe('updateFileProgress', () => {
    it('should initialize loading progress object on first call', () => {
      updateFileProgress('test.vrm', 50);

      expect((window as any).chatvrm_loading_progress).toBeDefined();
      expect((window as any).chatvrm_loading_progress_cnt).toBeDefined();
    });

    it('should set progress for a file', () => {
      updateFileProgress('test.vrm', 50);

      expect((window as any).chatvrm_loading_progress['test.vrm']).toBe(50);
    });

    it('should update progress for a file', () => {
      updateFileProgress('test.vrm', 30);
      expect((window as any).chatvrm_loading_progress['test.vrm']).toBe(30);

      updateFileProgress('test.vrm', 70);
      expect((window as any).chatvrm_loading_progress['test.vrm']).toBe(70);
    });

    it('should remove file from progress when progress is 100', () => {
      updateFileProgress('test.vrm', 50);
      expect((window as any).chatvrm_loading_progress['test.vrm']).toBe(50);

      updateFileProgress('test.vrm', 100);
      expect((window as any).chatvrm_loading_progress['test.vrm']).toBeUndefined();
    });

    it('should track multiple files independently', () => {
      updateFileProgress('file1.vrm', 30);
      updateFileProgress('file2.vrm', 60);
      updateFileProgress('file3.vrm', 90);

      expect((window as any).chatvrm_loading_progress['file1.vrm']).toBe(30);
      expect((window as any).chatvrm_loading_progress['file2.vrm']).toBe(60);
      expect((window as any).chatvrm_loading_progress['file3.vrm']).toBe(90);
    });

    it('should increment counter on each call', () => {
      updateFileProgress('test.vrm', 25);
      expect((window as any).chatvrm_loading_progress_cnt).toBe(1);

      updateFileProgress('test.vrm', 50);
      expect((window as any).chatvrm_loading_progress_cnt).toBe(2);

      updateFileProgress('test.vrm', 75);
      expect((window as any).chatvrm_loading_progress_cnt).toBe(3);
    });

    it('should increment counter even when removing file at 100%', () => {
      updateFileProgress('test.vrm', 50);
      const cnt1 = (window as any).chatvrm_loading_progress_cnt;

      updateFileProgress('test.vrm', 100);
      const cnt2 = (window as any).chatvrm_loading_progress_cnt;

      expect(cnt2).toBe(cnt1 + 1);
    });

    it('should handle 0 progress', () => {
      updateFileProgress('test.vrm', 0);
      expect((window as any).chatvrm_loading_progress['test.vrm']).toBe(0);
    });

    it('should handle progress values between 0 and 100', () => {
      updateFileProgress('test.vrm', 1);
      expect((window as any).chatvrm_loading_progress['test.vrm']).toBe(1);

      updateFileProgress('test.vrm', 50);
      expect((window as any).chatvrm_loading_progress['test.vrm']).toBe(50);

      updateFileProgress('test.vrm', 99);
      expect((window as any).chatvrm_loading_progress['test.vrm']).toBe(99);
    });

    it('should preserve existing progress object when already initialized', () => {
      updateFileProgress('file1.vrm', 30);
      const progressObj = (window as any).chatvrm_loading_progress;

      updateFileProgress('file2.vrm', 60);

      expect((window as any).chatvrm_loading_progress).toBe(progressObj);
      expect((window as any).chatvrm_loading_progress['file1.vrm']).toBe(30);
      expect((window as any).chatvrm_loading_progress['file2.vrm']).toBe(60);
    });
  });
});
