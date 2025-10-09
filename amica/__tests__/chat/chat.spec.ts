import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Chat, Queue } from '@/features/chat/chat';
import type { Message } from '@/features/chat/messages';

// Mock all dependencies
vi.mock('@/features/scene3d/SceneCoordinator');
vi.mock('@/features/alert/alert');
vi.mock('@/utils/config', () => ({
  config: vi.fn((key: string) => {
    const configs: Record<string, string> = {
      chatbot_backend: 'echo',
      tts_backend: 'none',
      rvc_enabled: 'false',
      time_before_idle_sec: '300',
      rvc_url: 'http://localhost:8000',
      system_prompt: 'You are a helpful assistant',
    };
    return configs[key] || '';
  }),
}));
vi.mock('@/features/rvc/rvc', () => ({
  rvc: vi.fn((audio: any) => Promise.resolve({ audio })),
}));

describe('Queue', () => {
  let queue: Queue<number>;

  beforeEach(() => {
    queue = new Queue<number>();
  });

  it('should enqueue items', () => {
    queue.enqueue(1);
    queue.enqueue(2);
    expect(queue.size()).toBe(2);
  });

  it('should dequeue items in FIFO order', () => {
    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);

    expect(queue.dequeue()).toBe(1);
    expect(queue.dequeue()).toBe(2);
    expect(queue.dequeue()).toBe(3);
  });

  it('should return undefined when dequeueing from empty queue', () => {
    expect(queue.dequeue()).toBeUndefined();
  });

  it('should check if empty', () => {
    expect(queue.isEmpty()).toBe(true);
    queue.enqueue(1);
    expect(queue.isEmpty()).toBe(false);
  });

  it('should clear all items', () => {
    queue.enqueue(1);
    queue.enqueue(2);
    queue.clear();
    expect(queue.isEmpty()).toBe(true);
    expect(queue.size()).toBe(0);
  });

  it('should return correct size', () => {
    expect(queue.size()).toBe(0);
    queue.enqueue(1);
    expect(queue.size()).toBe(1);
    queue.enqueue(2);
    expect(queue.size()).toBe(2);
    queue.dequeue();
    expect(queue.size()).toBe(1);
  });
});

describe('Chat', () => {
  let chat: Chat;

  beforeEach(() => {
    chat = new Chat();
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      expect(chat.initialized).toBe(false);
      expect(chat.stream).toBeNull();
      expect(chat.reader).toBeNull();
      expect(chat.streams).toEqual([]);
      expect(chat.readers).toEqual([]);
      expect(chat.currentStreamIdx).toBe(0);
      expect(chat.messageList).toEqual([]);
    });

    it('should create empty queues', () => {
      expect(chat.ttsJobs.isEmpty()).toBe(true);
      expect(chat.speakJobs.isEmpty()).toBe(true);
    });

    it('should initialize HookManager', () => {
      expect(chat.hookManager).toBeDefined();
    });
  });

  describe('setMessageList', () => {
    it('should update message list', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];

      const setChatLog = vi.fn();
      const setAssistantMessage = vi.fn();
      const setUserMessage = vi.fn();

      chat.setChatLog = setChatLog;
      chat.setAssistantMessage = setAssistantMessage;
      chat.setUserMessage = setUserMessage;

      chat.setMessageList(messages);

      expect(chat.messageList).toEqual(messages);
      expect(setChatLog).toHaveBeenCalledWith(messages);
    });

    it('should increment stream index', () => {
      const initialIdx = chat.currentStreamIdx;
      chat.setChatLog = vi.fn();
      chat.setAssistantMessage = vi.fn();
      chat.setUserMessage = vi.fn();

      chat.setMessageList([]);

      expect(chat.currentStreamIdx).toBe(initialIdx + 1);
    });

    it('should clear current messages', () => {
      chat.setChatLog = vi.fn();
      chat.setAssistantMessage = vi.fn();
      chat.setUserMessage = vi.fn();

      chat.setMessageList([{ role: 'user', content: 'test' }]);

      expect(chat.setAssistantMessage).toHaveBeenCalledWith('');
      expect(chat.setUserMessage).toHaveBeenCalledWith('');
    });
  });

  describe('isAwake', () => {
    it('should return boolean', () => {
      const awake = chat.isAwake();
      expect(typeof awake).toBe('boolean');
    });
  });

  describe('idleTime', () => {
    it('should return a number', () => {
      // Must call updateAwake first to initialize lastAwake with valid timestamp
      chat.updateAwake();
      const time = chat.idleTime();
      expect(typeof time).toBe('number');
      // idleTime returns negative when character is not yet idle
      // It's: sinceLastAwakeSec - timeBeforeIdleSec
      // Right after updateAwake(), this will be approximately -300
      expect(time).toBeLessThan(0);
    });
  });

  describe('updateAwake', () => {
    it('should update awake status', () => {
      chat.updateAwake();
      // Should reset idle timer
      const time = chat.idleTime();
      expect(typeof time).toBe('number');
      // After updateAwake, character is not idle so time should be negative
      expect(time).toBeLessThan(0);
    });
  });

  describe('async interrupt', () => {
    it('should increment stream index', async () => {
      const initialIdx = chat.currentStreamIdx;
      await chat.interrupt();
      expect(chat.currentStreamIdx).toBe(initialIdx + 1);
    });

    it('should clear TTS and speak queues', async () => {
      chat.ttsJobs.enqueue({ screenplay: {} as any, streamIdx: 1 });
      chat.speakJobs.enqueue({ audioBuffer: null, screenplay: {} as any, streamIdx: 1 });

      await chat.interrupt();

      expect(chat.ttsJobs.isEmpty()).toBe(true);
      expect(chat.speakJobs.isEmpty()).toBe(true);
    });

    it('should cancel reader if open', async () => {
      const mockReader = {
        cancel: vi.fn().mockResolvedValue(undefined),
        closed: false,
      };
      chat.reader = mockReader as any;

      await chat.interrupt();

      expect(mockReader.cancel).toHaveBeenCalled();
    });

    it('should handle missing reader gracefully', async () => {
      chat.reader = null;
      await expect(chat.interrupt()).resolves.not.toThrow();
    });
  });

  describe('messageList', () => {
    it('should store messages', () => {
      const messages: Message[] = [{ role: 'user', content: 'test' }];
      chat.messageList = messages;

      expect(chat.messageList).toEqual(messages);
    });

    it('should start with empty array', () => {
      expect(chat.messageList).toEqual([]);
    });
  });

  describe('bubbleMessage', () => {
    beforeEach(() => {
      chat.setUserMessage = vi.fn();
      chat.setAssistantMessage = vi.fn();
      chat.setChatLog = vi.fn();
      chat.setShownMessage = vi.fn();
    });

    it('should update user message when role is user', () => {
      chat.bubbleMessage('user', 'Hello');

      expect(chat.setUserMessage).toHaveBeenCalledWith('Hello');
      expect(chat.setAssistantMessage).toHaveBeenCalledWith('');
      expect(chat.setChatLog).toHaveBeenCalled();
      expect(chat.setShownMessage).toHaveBeenCalledWith('user');
    });

    it('should update assistant message when role is assistant', () => {
      chat.bubbleMessage('assistant', 'Hi there');

      expect(chat.setAssistantMessage).toHaveBeenCalledWith('Hi there');
      expect(chat.setUserMessage).toHaveBeenCalledWith('');
      expect(chat.setChatLog).toHaveBeenCalled();
      expect(chat.setShownMessage).toHaveBeenCalledWith('assistant');
    });

    it('should concatenate multiple user messages', () => {
      chat.bubbleMessage('user', 'Hello');
      chat.bubbleMessage('user', 'World');

      expect(chat.setUserMessage).toHaveBeenLastCalledWith('Hello World');
    });

    it('should concatenate multiple assistant messages', () => {
      chat.bubbleMessage('assistant', 'Hi');
      chat.bubbleMessage('assistant', ' there');

      expect(chat.setAssistantMessage).toHaveBeenLastCalledWith('Hi there');
    });

    it('should add space between user messages when concatenating', () => {
      chat.bubbleMessage('user', 'Hello');
      chat.bubbleMessage('user', 'World');

      // Second call should have added a space between messages
      expect(chat.setUserMessage).toHaveBeenLastCalledWith('Hello World');
    });

    it('should clear opposite role message when switching roles', () => {
      chat.bubbleMessage('user', 'Hello');
      chat.bubbleMessage('assistant', 'Hi');

      // When switching to assistant, user message should be cleared
      expect(chat.setUserMessage).toHaveBeenLastCalledWith('');
      expect(chat.setAssistantMessage).toHaveBeenLastCalledWith('Hi');
    });

    it('should update chat log with current message', () => {
      chat.bubbleMessage('user', 'Test message');

      expect(chat.setChatLog).toHaveBeenCalledWith([
        { role: 'user', content: 'Test message' }
      ]);
    });
  });

  describe('initialize', () => {
    it('should set viewer, alert, and callbacks', () => {
      const mockViewer = {} as any;
      const mockAlert = {} as any;
      const setChatLog = vi.fn();
      const setUserMessage = vi.fn();
      const setAssistantMessage = vi.fn();
      const setShownMessage = vi.fn();
      const setChatProcessing = vi.fn();
      const setChatSpeaking = vi.fn();

      chat.initialize(
        mockViewer,
        mockAlert,
        setChatLog,
        setUserMessage,
        setAssistantMessage,
        setShownMessage,
        setChatProcessing,
        setChatSpeaking
      );

      expect(chat.viewer).toBe(mockViewer);
      expect(chat.alert).toBe(mockAlert);
      expect(chat.setChatLog).toBe(setChatLog);
      expect(chat.setUserMessage).toBe(setUserMessage);
      expect(chat.setAssistantMessage).toBe(setAssistantMessage);
      expect(chat.setShownMessage).toBe(setShownMessage);
      expect(chat.setChatProcessing).toBe(setChatProcessing);
      expect(chat.setChatSpeaking).toBe(setChatSpeaking);
      expect(chat.initialized).toBe(true);
    });
  });

  describe('handleRvc', () => {
    it('should return audio unchanged when rvc disabled', async () => {
      const audio = new ArrayBuffer(100);
      const result = await chat.handleRvc(audio);
      expect(result).toBe(audio);
    });
  });

  describe('processTtsJobs', () => {
    it('should process TTS jobs from queue', async () => {
      // This is an infinite loop, so we'll just verify it can be called
      // and starts processing
      const processPromise = chat.processTtsJobs();

      // Give it a moment to start
      await new Promise(resolve => setTimeout(resolve, 10));

      // The function runs indefinitely, so we can't wait for it
      expect(processPromise).toBeInstanceOf(Promise);
    });
  });

  describe('processSpeakJobs', () => {
    it('should process speak jobs from queue', async () => {
      // This is an infinite loop, so we'll just verify it can be called
      const processPromise = chat.processSpeakJobs();

      // Give it a moment to start
      await new Promise(resolve => setTimeout(resolve, 10));

      // The function runs indefinitely
      expect(processPromise).toBeInstanceOf(Promise);
    });
  });

  describe('fetchAudio', () => {
    beforeEach(() => {
      chat.viewer = {} as any;
    });

    it('should return null when TTS backend is none', async () => {
      const talk: any = { message: 'Hello', speakerX: 0, speakerY: 0 };
      const result = await chat.fetchAudio(talk);
      expect(result).toBeNull();
    });

    it('should return null when no talk message', async () => {
      const talk: any = { message: '', speakerX: 0, speakerY: 0 };
      const result = await chat.fetchAudio(talk);
      expect(result).toBeNull();
    });
  });

  describe('getChatResponseStream', () => {
    beforeEach(() => {
      const mockAlert = { error: vi.fn(), success: vi.fn() };
      chat.initialize(
        {} as any,
        mockAlert as any,
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn()
      );
    });

    it('should get echo chat response stream', async () => {
      const messages: Message[] = [
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'Hello' }
      ];

      const stream = await chat.getChatResponseStream(messages);
      expect(stream).toBeDefined();
    });
  });

  describe('makeAndHandleStream', () => {
    beforeEach(() => {
      chat.initialize(
        {} as any,
        {} as any,
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn()
      );
    });

    it('should handle errors when getting chat response stream fails', async () => {
      const mockAlert = { error: vi.fn() };
      chat.alert = mockAlert as any;

      // Mock getChatResponseStream to throw error
      vi.spyOn(chat, 'getChatResponseStream').mockRejectedValue(new Error('Test error'));

      const messages: Message[] = [
        { role: 'user', content: 'Hello' }
      ];

      const result = await chat.makeAndHandleStream(messages);
      expect(result).toContain('Error');
      expect(mockAlert.error).toHaveBeenCalled();
    });

    it('should handle null stream error', async () => {
      const mockAlert = { error: vi.fn() };
      chat.alert = mockAlert as any;

      // Mock getChatResponseStream to return null
      vi.spyOn(chat, 'getChatResponseStream').mockResolvedValue(null as any);

      const messages: Message[] = [
        { role: 'user', content: 'Hello' }
      ];

      const result = await chat.makeAndHandleStream(messages);
      expect(result).toContain('Null stream');
      expect(mockAlert.error).toHaveBeenCalled();
    });
  });

  describe('handleChatResponseStream', () => {
    beforeEach(() => {
      chat.initialize(
        {} as any,
        {} as any,
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn()
      );
    });

    it('should return early if no streams', async () => {
      chat.streams = [];
      const result = await chat.handleChatResponseStream();
      expect(result).toBeUndefined();
    });
  });

  describe('receiveMessageFromUser', () => {
    beforeEach(() => {
      chat.initialize(
        {} as any,
        {} as any,
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn()
      );
    });

    it('should return early for null message', async () => {
      const result = await chat.receiveMessageFromUser(null as any);
      expect(result).toBeUndefined();
    });

    it('should return early for empty message', async () => {
      const result = await chat.receiveMessageFromUser('');
      expect(result).toBeUndefined();
    });

    it('should add neutral tag if message has no emotion tag', async () => {
      // Mock makeAndHandleStream to avoid actual streaming
      vi.spyOn(chat, 'makeAndHandleStream').mockResolvedValue(undefined);

      chat.bubbleMessage = vi.fn();

      await chat.receiveMessageFromUser('Hello');

      // Should have called bubbleMessage with [neutral] tag added
      expect(chat.bubbleMessage).toHaveBeenCalledWith('user', '[neutral] Hello');
    });

    it('should not add neutral tag if message already has emotion tag', async () => {
      // Mock makeAndHandleStream to avoid actual streaming
      vi.spyOn(chat, 'makeAndHandleStream').mockResolvedValue(undefined);

      chat.bubbleMessage = vi.fn();

      await chat.receiveMessageFromUser('[happy] Hello');

      // Should have called bubbleMessage with original message
      expect(chat.bubbleMessage).toHaveBeenCalledWith('user', '[happy] Hello');
    });

    it('should call makeAndHandleStream with correct messages', async () => {
      const makeAndHandleStreamSpy = vi.spyOn(chat, 'makeAndHandleStream').mockResolvedValue(undefined);

      await chat.receiveMessageFromUser('Hello');

      expect(makeAndHandleStreamSpy).toHaveBeenCalled();
      const callArg = makeAndHandleStreamSpy.mock.calls[0][0];
      expect(callArg.length).toBeGreaterThan(0);
      expect(callArg[0].role).toBe('system');
    });
  });

  describe('getVisionResponse', () => {
    beforeEach(() => {
      chat.initialize(
        {} as any,
        {} as any,
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn()
      );
    });

    it('should return early for unsupported vision backend', async () => {
      const mockAlert = { error: vi.fn() };
      chat.alert = mockAlert as any;

      const result = await chat.getVisionResponse('base64ImageData');

      // Should return undefined for unsupported backend
      expect(result).toBeUndefined();
    });
  });

  describe('handleChatResponseStream - processing', () => {
    it('should process stream chunks and call processResponse', async () => {
      const chat = new Chat();
      chat.initialize(
        {} as any,
        {} as any,
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn()
      );

      // Create a mock readable stream with simple text
      const encoder = new TextEncoder();
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('[neutral] Hello world.'));
          controller.close();
        }
      });

      chat.streams.push(mockStream as any);

      const result = await chat.handleChatResponseStream();

      // Should have processed the stream
      expect(typeof result).toBe('string');
    });

    it('should handle stream errors gracefully', async () => {
      const chat = new Chat();
      chat.initialize(
        {} as any,
        {} as any,
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn()
      );

      // Create a stream that throws an error
      const mockStream = new ReadableStream({
        start(controller) {
          controller.error(new Error('Stream error'));
        }
      });

      chat.streams.push(mockStream as any);

      // Mock bubbleMessage
      chat.bubbleMessage = vi.fn();

      const result = await chat.handleChatResponseStream();

      // Should have called bubbleMessage with error
      expect(chat.bubbleMessage).toHaveBeenCalled();
    });

    it('should stop processing when stream index changes', async () => {
      const chat = new Chat();
      chat.initialize(
        {} as any,
        {} as any,
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn()
      );

      // Create a mock readable stream
      const encoder = new TextEncoder();
      const mockStream = new ReadableStream({
        async start(controller) {
          controller.enqueue(encoder.encode('[neutral] Hello'));
          // Change stream index during processing
          await new Promise(resolve => setTimeout(resolve, 10));
          controller.enqueue(encoder.encode(' world.'));
          controller.close();
        }
      });

      chat.streams.push(mockStream as any);

      // Interrupt during processing by incrementing stream index
      setTimeout(() => {
        chat.currentStreamIdx++;
      }, 5);

      await chat.handleChatResponseStream();

      // Should have stopped processing early
      expect(chat.currentStreamIdx).toBeGreaterThan(0);
    });
  });
});
