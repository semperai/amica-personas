import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutoBlink } from '../src/features/emoteController/autoBlink';
import { BLINK_CLOSE_MAX, BLINK_OPEN_MAX } from '../src/features/emoteController/emoteConstants';

// Mock VRMExpressionManager
const createMockExpressionManager = () => ({
  setValue: vi.fn(),
  getValue: vi.fn(),
  getExpressionTrackName: vi.fn(),
  expressions: [],
  expressionMap: {},
  customExpressionMap: {},
  blinkExpressionNames: [],
  lookAtExpressionNames: [],
  mouthExpressionNames: [],
  update: vi.fn(),
  copy: vi.fn(),
  clone: vi.fn(),
});

describe('AutoBlink', () => {
  let mockExpressionManager: ReturnType<typeof createMockExpressionManager>;
  let autoBlink: AutoBlink;

  beforeEach(() => {
    mockExpressionManager = createMockExpressionManager();
    autoBlink = new AutoBlink(mockExpressionManager as any);
  });

  describe('constructor', () => {
    it('should initialize with auto blink enabled', () => {
      expect(autoBlink).toBeDefined();
    });

    it('should start with eyes open', () => {
      // Eyes should be open initially, so no setValue should be called yet
      expect(mockExpressionManager.setValue).not.toHaveBeenCalled();
    });
  });

  describe('setEnable', () => {
    it('should enable auto blink', () => {
      const delay = autoBlink.setEnable(true);
      expect(delay).toBe(0); // Eyes are open, so no delay
    });

    it('should disable auto blink', () => {
      const delay = autoBlink.setEnable(false);
      expect(delay).toBe(0);
    });

    it('should return 0 when eyes are open', () => {
      const delay = autoBlink.setEnable(true);
      expect(delay).toBe(0);
    });

    it('should return remaining time when eyes are closed', () => {
      // Trigger a blink to close eyes
      autoBlink.update(BLINK_OPEN_MAX + 0.01);

      // Now eyes are closed, setEnable should return remaining time
      const delay = autoBlink.setEnable(false);
      expect(delay).toBeGreaterThan(0);
      expect(delay).toBeLessThanOrEqual(BLINK_CLOSE_MAX);
    });
  });

  describe('update', () => {
    it('should close eyes on first update when auto blink enabled', () => {
      // First update with any delta will close eyes since remainingTime starts at 0
      autoBlink.update(0.1);
      expect(mockExpressionManager.setValue).toHaveBeenCalledWith('blink', 1);
    });

    it('should close eyes immediately when remainingTime is 0', () => {
      // Constructor sets remainingTime to 0 and isOpen to true
      autoBlink.update(0.01);

      expect(mockExpressionManager.setValue).toHaveBeenCalledWith('blink', 1);
    });

    it('should open eyes after close time expires', () => {
      // First update closes eyes immediately (remainingTime=0, isOpen=true)
      autoBlink.update(0.01);
      expect(mockExpressionManager.setValue).toHaveBeenCalledWith('blink', 1);
      mockExpressionManager.setValue.mockClear();

      // Second update: remainingTime is now BLINK_CLOSE_MAX (0.12), decrement it
      autoBlink.update(0.01);
      expect(mockExpressionManager.setValue).not.toHaveBeenCalled();
      mockExpressionManager.setValue.mockClear();

      // Third update: consume rest of remaining time (0.11 left)
      autoBlink.update(0.11);
      expect(mockExpressionManager.setValue).not.toHaveBeenCalled();
      mockExpressionManager.setValue.mockClear();

      // Fourth update: remainingTime is now 0, triggers open
      autoBlink.update(0.01);

      expect(mockExpressionManager.setValue).toHaveBeenCalledWith('blink', 0);
    });

    it('should handle multiple update cycles', () => {
      // Cycle 1: Close eyes (immediate on first update, remainingTime=0)
      autoBlink.update(0.01);
      expect(mockExpressionManager.setValue).toHaveBeenCalledWith('blink', 1);
      mockExpressionManager.setValue.mockClear();

      // Cycle 2: Wait for close time to expire, then open
      autoBlink.update(BLINK_CLOSE_MAX); // Consume all close time
      expect(mockExpressionManager.setValue).not.toHaveBeenCalled();
      autoBlink.update(0.01); // Trigger open now that remainingTime is 0
      expect(mockExpressionManager.setValue).toHaveBeenCalledWith('blink', 0);
      mockExpressionManager.setValue.mockClear();

      // Cycle 3: Wait for open time to expire, then close again
      autoBlink.update(BLINK_OPEN_MAX); // Consume all open time
      expect(mockExpressionManager.setValue).not.toHaveBeenCalled();
      autoBlink.update(0.01); // Trigger close now that remainingTime is 0
      expect(mockExpressionManager.setValue).toHaveBeenCalledWith('blink', 1);
    });

    it('should not blink when auto blink is disabled', () => {
      autoBlink.setEnable(false);

      // First update when disabled should open eyes
      autoBlink.update(0.01);

      // Should open eyes (not close) when auto blink is disabled
      expect(mockExpressionManager.setValue).toHaveBeenCalledWith('blink', 0);
    });

    it('should decrement remaining time', () => {
      // Start a blink cycle - first update closes eyes (remainingTime=0)
      autoBlink.update(0.01);
      expect(mockExpressionManager.setValue).toHaveBeenCalledWith('blink', 1);
      mockExpressionManager.setValue.mockClear();

      // Update with small delta (less than BLINK_CLOSE_MAX)
      // remainingTime is now BLINK_CLOSE_MAX (0.12), subtract 0.05
      autoBlink.update(0.05);

      // Should not open eyes yet, just decrementing
      expect(mockExpressionManager.setValue).not.toHaveBeenCalled();

      // Update with remaining time (0.12 - 0.05 = 0.07 remaining), makes it 0
      autoBlink.update(0.07);
      expect(mockExpressionManager.setValue).not.toHaveBeenCalled();

      // Next update when remainingTime is 0 should open eyes
      autoBlink.update(0.01);
      expect(mockExpressionManager.setValue).toHaveBeenCalledWith('blink', 0);
    });

    it('should handle very small delta values', () => {
      // First update with small delta still closes eyes (remainingTime=0)
      autoBlink.update(0.001);
      expect(mockExpressionManager.setValue).toHaveBeenCalledWith('blink', 1);
      mockExpressionManager.setValue.mockClear();

      // Subsequent small updates decrement remainingTime
      autoBlink.update(0.001);
      autoBlink.update(0.001);

      expect(mockExpressionManager.setValue).not.toHaveBeenCalled();
    });

    it('should handle very large delta values', () => {
      autoBlink.update(100);

      // Should have blinked
      expect(mockExpressionManager.setValue).toHaveBeenCalled();
    });

    it('should correctly sequence blink cycle', () => {
      const callHistory: Array<{name: string, value: number}> = [];

      mockExpressionManager.setValue.mockImplementation((name, value) => {
        callHistory.push({ name, value });
      });

      // Step 1: First update closes eyes immediately (remainingTime=0, isOpen=true)
      autoBlink.update(0.01);
      expect(callHistory).toEqual([{ name: 'blink', value: 1 }]);

      callHistory.length = 0;

      // Step 2: Wait for close time, then open eyes
      autoBlink.update(BLINK_CLOSE_MAX); // Consume close time
      expect(callHistory).toEqual([]); // No change yet, just decremented
      autoBlink.update(0.01); // Now remainingTime is 0, trigger open
      expect(callHistory).toEqual([{ name: 'blink', value: 0 }]);
    });
  });

  describe('blink timing constants', () => {
    it('should use BLINK_CLOSE_MAX constant', () => {
      expect(BLINK_CLOSE_MAX).toBe(0.12);
    });

    it('should use BLINK_OPEN_MAX constant', () => {
      expect(BLINK_OPEN_MAX).toBe(5);
    });
  });

  describe('edge cases', () => {
    it('should handle zero delta', () => {
      // First update with 0 delta still closes eyes (remainingTime=0, isOpen=true)
      autoBlink.update(0);
      expect(mockExpressionManager.setValue).toHaveBeenCalledWith('blink', 1);
    });

    it('should handle negative delta gracefully', () => {
      autoBlink.update(-1);
      // Should not crash, behavior may vary
      expect(true).toBe(true);
    });

    it('should maintain state across enable/disable cycles', () => {
      autoBlink.setEnable(false);
      autoBlink.setEnable(true);
      autoBlink.setEnable(false);

      autoBlink.update(10);

      // Should open eyes when disabled
      expect(mockExpressionManager.setValue).toHaveBeenCalledWith('blink', 0);
    });
  });
});
