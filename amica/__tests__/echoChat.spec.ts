import { describe, it, expect } from 'vitest';
import { getEchoChatResponseStream } from '../src/features/chat/echoChat';
import { Message } from '../src/features/chat/messages';

describe('echoChat', () => {
  describe('getEchoChatResponseStream', () => {
    it('should return a ReadableStream', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Hello' }];
      const stream = await getEchoChatResponseStream(messages);

      expect(stream).toBeInstanceOf(ReadableStream);
    });

    it('should echo the last message word by word', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Hello world' }];
      const stream = await getEchoChatResponseStream(messages);

      const reader = stream.getReader();
      const chunks: string[] = [];

      let result = await reader.read();
      while (!result.done) {
        chunks.push(result.value);
        result = await reader.read();
      }

      expect(chunks).toEqual(['Hello ', 'world. ']);
    });

    it('should add period if message does not end with punctuation', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Hello' }];
      const stream = await getEchoChatResponseStream(messages);

      const reader = stream.getReader();
      const chunks: string[] = [];

      let result = await reader.read();
      while (!result.done) {
        chunks.push(result.value);
        result = await reader.read();
      }

      expect(chunks).toEqual(['Hello. ']);
    });

    it('should not add period if message ends with period', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Hello.' }];
      const stream = await getEchoChatResponseStream(messages);

      const reader = stream.getReader();
      const chunks: string[] = [];

      let result = await reader.read();
      while (!result.done) {
        chunks.push(result.value);
        result = await reader.read();
      }

      expect(chunks).toEqual(['Hello. ']);
    });

    it('should not add period if message ends with question mark', async () => {
      const messages: Message[] = [{ role: 'user', content: 'How are you?' }];
      const stream = await getEchoChatResponseStream(messages);

      const reader = stream.getReader();
      const chunks: string[] = [];

      let result = await reader.read();
      while (!result.done) {
        chunks.push(result.value);
        result = await reader.read();
      }

      expect(chunks).toEqual(['How ', 'are ', 'you? ']);
    });

    it('should not add period if message ends with exclamation mark', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Amazing!' }];
      const stream = await getEchoChatResponseStream(messages);

      const reader = stream.getReader();
      const chunks: string[] = [];

      let result = await reader.read();
      while (!result.done) {
        chunks.push(result.value);
        result = await reader.read();
      }

      expect(chunks).toEqual(['Amazing! ']);
    });

    it('should handle empty message', async () => {
      const messages: Message[] = [{ role: 'user', content: '' }];
      const stream = await getEchoChatResponseStream(messages);

      const reader = stream.getReader();
      const chunks: string[] = [];

      let result = await reader.read();
      while (!result.done) {
        chunks.push(result.value);
        result = await reader.read();
      }

      expect(chunks).toEqual(['. ']);
    });

    it('should handle single word message', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Test' }];
      const stream = await getEchoChatResponseStream(messages);

      const reader = stream.getReader();
      const chunks: string[] = [];

      let result = await reader.read();
      while (!result.done) {
        chunks.push(result.value);
        result = await reader.read();
      }

      expect(chunks).toEqual(['Test. ']);
    });

    it('should use only the last message from history', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'First message' },
        { role: 'assistant', content: 'Response' },
        { role: 'user', content: 'Last message' }
      ];
      const stream = await getEchoChatResponseStream(messages);

      const reader = stream.getReader();
      const chunks: string[] = [];

      let result = await reader.read();
      while (!result.done) {
        chunks.push(result.value);
        result = await reader.read();
      }

      expect(chunks).toEqual(['Last ', 'message. ']);
    });

    it('should handle long messages', async () => {
      const messages: Message[] = [{ role: 'user', content: 'One two three four five' }];
      const stream = await getEchoChatResponseStream(messages);

      const reader = stream.getReader();
      const chunks: string[] = [];

      let result = await reader.read();
      while (!result.done) {
        chunks.push(result.value);
        result = await reader.read();
      }

      expect(chunks).toEqual(['One ', 'two ', 'three ', 'four ', 'five. ']);
    });

    it('should handle message with multiple spaces', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Hello  world' }];
      const stream = await getEchoChatResponseStream(messages);

      const reader = stream.getReader();
      const chunks: string[] = [];

      let result = await reader.read();
      while (!result.done) {
        chunks.push(result.value);
        result = await reader.read();
      }

      expect(chunks).toEqual(['Hello ', ' ', 'world. ']);
    });
  });
});
