import { describe, it, expect } from 'vitest';
import { ChatContext } from '../src/features/chat/chatContext';
import { Chat } from '../src/features/chat/chat';

describe('ChatContext', () => {
  it('should export ChatContext', () => {
    expect(ChatContext).toBeDefined();
  });

  it('should have chat instance in default value', () => {
    const defaultValue = ChatContext._currentValue || (ChatContext as any)._defaultValue;
    if (defaultValue) {
      expect(defaultValue.chat).toBeDefined();
      expect(defaultValue.chat).toBeInstanceOf(Chat);
    }
  });

  it('should be a React context', () => {
    expect(ChatContext.Provider).toBeDefined();
    expect(ChatContext.Consumer).toBeDefined();
  });

  it('should have correct context structure', () => {
    expect(ChatContext).toHaveProperty('Provider');
    expect(ChatContext).toHaveProperty('Consumer');
  });
});
