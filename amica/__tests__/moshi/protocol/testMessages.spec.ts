import { describe, it, expect } from 'vitest';
import {
  handshakeMessage,
  audioMessage,
  textMessage,
  controlBOSMessage,
  controlEOSMessage,
  metadataMessage,
} from '@/features/moshi/protocol/testMessages';

describe('testMessages', () => {
  describe('handshakeMessage', () => {
    it('should have correct type', () => {
      expect(handshakeMessage.type).toBe('handshake');
    });

    it('should have version 0', () => {
      expect(handshakeMessage.version).toBe(0);
    });

    it('should have model 0', () => {
      expect(handshakeMessage.model).toBe(0);
    });

    it('should be a valid handshake message', () => {
      expect(handshakeMessage).toEqual({
        type: 'handshake',
        version: 0,
        model: 0,
      });
    });
  });

  describe('audioMessage', () => {
    it('should have correct type', () => {
      expect(audioMessage.type).toBe('audio');
    });

    it('should have Uint8Array data', () => {
      expect(audioMessage.data).toBeInstanceOf(Uint8Array);
    });

    it('should have data length of 10', () => {
      expect(audioMessage.data).toHaveLength(10);
    });

    it('should be a valid audio message', () => {
      expect(audioMessage).toMatchObject({
        type: 'audio',
        data: expect.any(Uint8Array),
      });
    });
  });

  describe('textMessage', () => {
    it('should have correct type', () => {
      expect(textMessage.type).toBe('text');
    });

    it('should have string data', () => {
      expect(typeof textMessage.data).toBe('string');
    });

    it('should contain Hello message', () => {
      expect(textMessage.data).toBe('Hello');
    });

    it('should be a valid text message', () => {
      expect(textMessage).toEqual({
        type: 'text',
        data: 'Hello',
      });
    });
  });

  describe('controlBOSMessage', () => {
    it('should have correct type', () => {
      expect(controlBOSMessage.type).toBe('control');
    });

    it('should have start action', () => {
      expect(controlBOSMessage.action).toBe('start');
    });

    it('should be a valid BOS control message', () => {
      expect(controlBOSMessage).toEqual({
        type: 'control',
        action: 'start',
      });
    });
  });

  describe('controlEOSMessage', () => {
    it('should have correct type', () => {
      expect(controlEOSMessage.type).toBe('control');
    });

    it('should have endTurn action', () => {
      expect(controlEOSMessage.action).toBe('endTurn');
    });

    it('should be a valid EOS control message', () => {
      expect(controlEOSMessage).toEqual({
        type: 'control',
        action: 'endTurn',
      });
    });
  });

  describe('metadataMessage', () => {
    it('should have correct type', () => {
      expect(metadataMessage.type).toBe('metadata');
    });

    it('should have object data', () => {
      expect(typeof metadataMessage.data).toBe('object');
    });

    it('should contain key-value metadata', () => {
      expect(metadataMessage.data).toEqual({ key: 'value' });
    });

    it('should be a valid metadata message', () => {
      expect(metadataMessage).toEqual({
        type: 'metadata',
        data: { key: 'value' },
      });
    });
  });

  describe('Message types', () => {
    it('should export all message types', () => {
      const messages = [
        handshakeMessage,
        audioMessage,
        textMessage,
        controlBOSMessage,
        controlEOSMessage,
        metadataMessage,
      ];

      messages.forEach(message => {
        expect(message).toBeDefined();
        expect(message.type).toBeDefined();
      });
    });

    it('should have unique message types', () => {
      const types = [
        handshakeMessage.type,
        audioMessage.type,
        textMessage.type,
        controlBOSMessage.type,
        controlEOSMessage.type,
        metadataMessage.type,
      ];

      const uniqueTypes = new Set(types);
      // control messages share the same type but different actions
      expect(uniqueTypes.size).toBe(5);
    });

    it('should differentiate control messages by action', () => {
      expect(controlBOSMessage.type).toBe(controlEOSMessage.type);
      expect(controlBOSMessage.action).not.toBe(controlEOSMessage.action);
    });
  });
});
