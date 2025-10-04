import { describe, it, expect } from 'vitest';
import { getArbiusChatResponseStream } from '../src/features/chat/arbiusChat';
import { Message } from '../src/features/chat/messages';

describe('arbiusChat', () => {
  describe('getArbiusChatResponseStream', () => {
    it('should return a ReadableStream', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Hello' }];
      const stream = await getArbiusChatResponseStream(messages);

      expect(stream).toBeInstanceOf(ReadableStream);
    });

    it('should stream the last message word by word', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Hello world' }];
      const stream = await getArbiusChatResponseStream(messages);

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
      const messages: Message[] = [{ role: 'user', content: 'Test message' }];
      const stream = await getArbiusChatResponseStream(messages);

      const reader = stream.getReader();
      const chunks: string[] = [];

      let result = await reader.read();
      while (!result.done) {
        chunks.push(result.value);
        result = await reader.read();
      }

      expect(chunks).toEqual(['Test ', 'message. ']);
    });

    it('should not add period if message ends with period', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Hello.' }];
      const stream = await getArbiusChatResponseStream(messages);

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
      const messages: Message[] = [{ role: 'user', content: 'Are you there?' }];
      const stream = await getArbiusChatResponseStream(messages);

      const reader = stream.getReader();
      const chunks: string[] = [];

      let result = await reader.read();
      while (!result.done) {
        chunks.push(result.value);
        result = await reader.read();
      }

      expect(chunks).toEqual(['Are ', 'you ', 'there? ']);
    });

    it('should not add period if message ends with exclamation mark', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Wow!' }];
      const stream = await getArbiusChatResponseStream(messages);

      const reader = stream.getReader();
      const chunks: string[] = [];

      let result = await reader.read();
      while (!result.done) {
        chunks.push(result.value);
        result = await reader.read();
      }

      expect(chunks).toEqual(['Wow! ']);
    });

    it('should handle empty message', async () => {
      const messages: Message[] = [{ role: 'user', content: '' }];
      const stream = await getArbiusChatResponseStream(messages);

      const reader = stream.getReader();
      const chunks: string[] = [];

      let result = await reader.read();
      while (!result.done) {
        chunks.push(result.value);
        result = await reader.read();
      }

      expect(chunks).toEqual(['. ']);
    });

    it('should use only the last message', async () => {
      const messages: Message[] = [
        { role: 'user', content: 'First' },
        { role: 'assistant', content: 'Response' },
        { role: 'user', content: 'Second' }
      ];
      const stream = await getArbiusChatResponseStream(messages);

      const reader = stream.getReader();
      const chunks: string[] = [];

      let result = await reader.read();
      while (!result.done) {
        chunks.push(result.value);
        result = await reader.read();
      }

      expect(chunks).toEqual(['Second. ']);
    });

    it('should handle message with multiple words', async () => {
      const messages: Message[] = [{ role: 'user', content: 'This is a test' }];
      const stream = await getArbiusChatResponseStream(messages);

      const reader = stream.getReader();
      const chunks: string[] = [];

      let result = await reader.read();
      while (!result.done) {
        chunks.push(result.value);
        result = await reader.read();
      }

      expect(chunks).toEqual(['This ', 'is ', 'a ', 'test. ']);
    });

    it('should close stream properly', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Test' }];
      const stream = await getArbiusChatResponseStream(messages);

      const reader = stream.getReader();

      // Read all chunks
      let result = await reader.read();
      while (!result.done) {
        result = await reader.read();
      }

      // Should be done
      expect(result.done).toBe(true);
    });
  });
});
