import { describe, it, expect, vi, beforeEach } from 'vitest';
import { askLLM } from '@/utils/askLlm';
import type { Chat } from '@/features/chat/chat';

// Mock dependencies
vi.mock('@/utils/config', () => ({
  config: vi.fn((key: string) => {
    const configs: Record<string, string> = {
      chatbot_backend: 'echo',
    };
    return configs[key] || 'echo';
  }),
}));

vi.mock('@/features/chat/echoChat', () => ({
  getEchoChatResponseStream: vi.fn(() => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue('Hello, ');
        controller.enqueue('this is ');
        controller.enqueue('a test.');
        controller.close();
      },
    });
    return stream.pipeThrough(new TextDecoderStream());
  }),
}));

vi.mock('@/features/chat/openAIChatProvider', () => ({
  getOpenAiChatResponseStream: vi.fn(() => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue('OpenAI response.');
        controller.close();
      },
    });
    return stream.pipeThrough(new TextDecoderStream());
  }),
}));

vi.mock('@/features/chat/llamaCppChat', () => ({
  getLlamaCppChatResponseStream: vi.fn(() => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue('LlamaCpp response.');
        controller.close();
      },
    });
    return stream.pipeThrough(new TextDecoderStream());
  }),
}));

vi.mock('@/features/chat/ollamaChat', () => ({
  getOllamaChatResponseStream: vi.fn(() => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue('Ollama response.');
        controller.close();
      },
    });
    return stream.pipeThrough(new TextDecoderStream());
  }),
}));

vi.mock('@/features/chat/koboldAIChatProvider', () => ({
  getKoboldAiChatResponseStream: vi.fn(() => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue('KoboldAI response.');
        controller.close();
      },
    });
    return stream.pipeThrough(new TextDecoderStream());
  }),
}));

vi.mock('@/utils/processResponse', () => ({
  processResponse: vi.fn((params) => {
    // Simple pass-through for testing
    return {
      ...params,
      shouldBreak: false,
    };
  }),
}));

describe('askLLM', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset config mock to default
    const { config } = await import('@/utils/config');
    (config as any).mockImplementation((key: string) => {
      const configs: Record<string, string> = {
        chatbot_backend: 'echo',
      };
      return configs[key] || 'echo';
    });

    // Reset echo stream mock
    const { getEchoChatResponseStream } = await import('@/features/chat/echoChat');
    (getEchoChatResponseStream as any).mockImplementation(() => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue('Hello, ');
          controller.enqueue('this is ');
          controller.enqueue('a test.');
          controller.close();
        },
      });
      return stream.pipeThrough(new TextDecoderStream());
    });
  });

  it('should return response from LLM without chat', async () => {
    const result = await askLLM('You are a helpful assistant', 'Hello!', null);

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('should process system and user prompts', async () => {
    const systemPrompt = 'You are a helpful assistant';
    const userPrompt = 'What is 2+2?';

    const result = await askLLM(systemPrompt, userPrompt, null);

    expect(result).toBeDefined();
  });

  it('should use echo backend by default', async () => {
    const { getEchoChatResponseStream } = await import('@/features/chat/echoChat');

    await askLLM('System', 'User', null);

    expect(getEchoChatResponseStream).toHaveBeenCalled();
  });

  it('should use chatgpt backend when configured', async () => {
    const { config } = await import('@/utils/config');
    const { getOpenAiChatResponseStream } = await import('@/features/chat/openAIChatProvider');

    (config as any).mockImplementation((key: string) => {
      if (key === 'chatbot_backend') return 'chatgpt';
      return 'default';
    });

    await askLLM('System', 'User', null);

    expect(getOpenAiChatResponseStream).toHaveBeenCalled();
  });

  it('should use llamacpp backend when configured', async () => {
    const { config } = await import('@/utils/config');
    const { getLlamaCppChatResponseStream } = await import('@/features/chat/llamaCppChat');

    (config as any).mockImplementation((key: string) => {
      if (key === 'chatbot_backend') return 'llamacpp';
      return 'default';
    });

    await askLLM('System', 'User', null);

    expect(getLlamaCppChatResponseStream).toHaveBeenCalled();
  });

  it('should use ollama backend when configured', async () => {
    const { config } = await import('@/utils/config');
    const { getOllamaChatResponseStream } = await import('@/features/chat/ollamaChat');

    (config as any).mockImplementation((key: string) => {
      if (key === 'chatbot_backend') return 'ollama';
      return 'default';
    });

    await askLLM('System', 'User', null);

    expect(getOllamaChatResponseStream).toHaveBeenCalled();
  });

  it('should use koboldai backend when configured', async () => {
    const { config } = await import('@/utils/config');
    const { getKoboldAiChatResponseStream } = await import('@/features/chat/koboldAIChatProvider');

    (config as any).mockImplementation((key: string) => {
      if (key === 'chatbot_backend') return 'koboldai';
      return 'default';
    });

    await askLLM('System', 'User', null);

    expect(getKoboldAiChatResponseStream).toHaveBeenCalled();
  });

  it('should handle stream errors gracefully', async () => {
    const { getEchoChatResponseStream } = await import('@/features/chat/echoChat');

    (getEchoChatResponseStream as any).mockImplementation(() => {
      throw new Error('Stream error');
    });

    const result = await askLLM('System', 'User', null);

    expect(result).toContain('Error');
  });

  it('should handle null stream', async () => {
    const { getEchoChatResponseStream } = await import('@/features/chat/echoChat');

    (getEchoChatResponseStream as any).mockImplementation(() => null);

    const result = await askLLM('System', 'User', null);

    expect(result).toContain('Error');
  });

  it('should process chat with Chat instance', async () => {
    const mockChat = {
      currentStreamIdx: 1,
      ttsJobs: {
        enqueue: vi.fn(),
      },
    } as unknown as Chat;

    const result = await askLLM('System', 'User', mockChat);

    expect(result).toBeDefined();
  });

  it('should handle reader stream processing', async () => {
    const result = await askLLM('System prompt', 'User prompt', null);

    // Should complete without errors
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('should call getEchoChatResponseStream with default backend', async () => {
    const { getEchoChatResponseStream } = await import('@/features/chat/echoChat');

    await askLLM('System', 'User', null);

    // Just verify the stream function was called
    expect(getEchoChatResponseStream).toHaveBeenCalled();
  });

  it('should return a string result', async () => {
    const result = await askLLM('System', 'User', null);

    expect(typeof result).toBe('string');
  });
});
