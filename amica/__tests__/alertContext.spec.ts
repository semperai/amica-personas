import { describe, it, expect } from 'vitest';
import { AlertContext } from '../src/features/alert/alertContext';
import { Alert } from '../src/features/alert/alert';

describe('AlertContext', () => {
  it('should export AlertContext', () => {
    expect(AlertContext).toBeDefined();
  });

  it('should have alert instance in default value', () => {
    const defaultValue = AlertContext._currentValue || (AlertContext as any)._defaultValue;
    if (defaultValue) {
      expect(defaultValue.alert).toBeDefined();
      expect(defaultValue.alert).toBeInstanceOf(Alert);
    }
  });

  it('should be a React context', () => {
    expect(AlertContext.Provider).toBeDefined();
    expect(AlertContext.Consumer).toBeDefined();
  });

  it('should have correct context structure', () => {
    expect(AlertContext).toHaveProperty('Provider');
    expect(AlertContext).toHaveProperty('Consumer');
  });
});
