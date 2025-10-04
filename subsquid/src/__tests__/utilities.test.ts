import { describe, it, expect } from 'vitest';

describe('Data Transformation Utilities', () => {
  describe('BigInt Conversions', () => {
    it('should convert string to BigInt', () => {
      const tokenId = '12345';
      const bigIntValue = BigInt(tokenId);

      expect(typeof bigIntValue).toBe('bigint');
      expect(bigIntValue).toBe(12345n);
    });

    it('should convert number to BigInt', () => {
      const amount = 1000;
      const bigIntValue = BigInt(amount);

      expect(typeof bigIntValue).toBe('bigint');
      expect(bigIntValue).toBe(1000n);
    });

    it('should handle very large numbers', () => {
      const largeNumber = '9007199254740992'; // > Number.MAX_SAFE_INTEGER
      const bigIntValue = BigInt(largeNumber);

      expect(bigIntValue).toBe(9007199254740992n);
    });

    it('should convert BigInt to string', () => {
      const value = 12345n;
      const stringValue = value.toString();

      expect(typeof stringValue).toBe('string');
      expect(stringValue).toBe('12345');
    });

    it('should convert BigInt to number for small values', () => {
      const value = 12345n;
      const numberValue = Number(value);

      expect(typeof numberValue).toBe('number');
      expect(numberValue).toBe(12345);
    });
  });

  describe('Address Normalization', () => {
    it('should lowercase mixed case addresses', () => {
      const mixedCase = '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12';
      const normalized = mixedCase.toLowerCase();

      expect(normalized).toBe('0xabcdef1234567890abcdef1234567890abcdef12');
    });

    it('should handle already lowercase addresses', () => {
      const lowercase = '0xabcdef1234567890abcdef1234567890abcdef12';
      const normalized = lowercase.toLowerCase();

      expect(normalized).toBe(lowercase);
    });

    it('should handle uppercase addresses', () => {
      const uppercase = '0XABCDEF1234567890ABCDEF1234567890ABCDEF12';
      const normalized = uppercase.toLowerCase();

      expect(normalized).toBe('0xabcdef1234567890abcdef1234567890abcdef12');
    });

    it('should preserve 0x prefix', () => {
      const addr = '0xABCDEF';
      const normalized = addr.toLowerCase();

      expect(normalized.startsWith('0x')).toBe(true);
    });
  });

  describe('ID Generation', () => {
    it('should generate transaction-based IDs', () => {
      const txHash = '0xtxhash123';
      const logIndex = 5;
      const id = `${txHash}-${logIndex}`;

      expect(id).toBe('0xtxhash123-5');
      expect(id.includes('-')).toBe(true);
    });

    it('should generate persona metadata IDs', () => {
      const personaId = '123';
      const key = 'image';
      const metadataId = `${personaId}-${key}`;

      expect(metadataId).toBe('123-image');
    });

    it('should generate user-specific IDs', () => {
      const personaId = '123';
      const user = '0xuser';
      const logIndex = 5;
      const depositId = `${personaId}-${user.toLowerCase()}-${logIndex}`;

      expect(depositId).toBe('123-0xuser-5');
    });

    it('should generate unique IDs for different log indices', () => {
      const txHash = '0xtx';
      const id1 = `${txHash}-0`;
      const id2 = `${txHash}-1`;

      expect(id1).not.toBe(id2);
    });

    it('should generate consistent IDs', () => {
      const txHash = '0xtx';
      const logIndex = 5;
      const id1 = `${txHash}-${logIndex}`;
      const id2 = `${txHash}-${logIndex}`;

      expect(id1).toBe(id2);
    });
  });

  describe('Date Formatting', () => {
    it('should format date as ISO string', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const iso = date.toISOString();

      expect(iso).toContain('2024-01-15');
      expect(iso).toContain('T');
      expect(iso).toContain('Z');
    });

    it('should extract date portion from ISO string', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const dateStr = date.toISOString().split('T')[0];

      expect(dateStr).toBe('2024-01-15');
      expect(dateStr.length).toBe(10);
    });

    it('should convert timestamp to Date', () => {
      const timestamp = 1704110400000;
      const date = new Date(timestamp);

      expect(date).toBeInstanceOf(Date);
      expect(date.getFullYear()).toBe(2024);
    });

    it('should get Unix timestamp from Date', () => {
      const date = new Date('2024-01-01T00:00:00Z');
      const unixTimestamp = Math.floor(date.getTime() / 1000);

      expect(typeof unixTimestamp).toBe('number');
      expect(unixTimestamp).toBeGreaterThan(0);
    });

    it('should calculate date ranges', () => {
      const dateStr = '2024-01-15';
      const startOfDay = new Date(dateStr);
      const endOfDay = new Date(dateStr);
      endOfDay.setDate(endOfDay.getDate() + 1);

      const rangeMs = endOfDay.getTime() - startOfDay.getTime();
      expect(rangeMs).toBe(86400000); // 24 hours
    });
  });

  describe('Bytes32 Conversions', () => {
    it('should convert string to bytes32 hex', () => {
      const key = 'image';
      const keyBytes32 = '0x' + Buffer.from(key).toString('hex').padEnd(64, '0');

      expect(keyBytes32.length).toBe(66);
      expect(keyBytes32.startsWith('0x')).toBe(true);
    });

    it('should handle empty string', () => {
      const key = '';
      const keyBytes32 = '0x' + Buffer.from(key).toString('hex').padEnd(64, '0');

      expect(keyBytes32).toBe('0x' + '0'.repeat(64));
    });

    it('should handle long strings', () => {
      const key = 'a'.repeat(100);
      const hex = Buffer.from(key).toString('hex');

      expect(hex.length).toBeGreaterThan(64);
    });

    it('should convert short strings correctly', () => {
      const key = 'a';
      const keyBytes32 = '0x' + Buffer.from(key).toString('hex').padEnd(64, '0');

      expect(keyBytes32.startsWith('0x61')).toBe(true); // 'a' = 0x61
      expect(keyBytes32.endsWith('0')).toBe(true);
    });
  });

  describe('Array Aggregations', () => {
    it('should sum BigInt array', () => {
      const values = [100n, 200n, 300n];
      const sum = values.reduce((acc, v) => acc + v, 0n);

      expect(sum).toBe(600n);
    });

    it('should filter and sum', () => {
      const items = [
        { isBuy: true, amount: 100n },
        { isBuy: false, amount: 200n },
        { isBuy: true, amount: 300n },
      ];

      const buySum = items
        .filter(i => i.isBuy)
        .reduce((sum, i) => sum + i.amount, 0n);

      expect(buySum).toBe(400n);
    });

    it('should count unique values', () => {
      const traders = ['0xuser1', '0xuser1', '0xuser2', '0xuser3'];
      const uniqueCount = new Set(traders).size;

      expect(uniqueCount).toBe(3);
    });

    it('should map and reduce', () => {
      const trades = [
        { trader: '0xuser1', amount: 100n },
        { trader: '0xuser2', amount: 200n },
      ];

      const totalAmount = trades
        .map(t => t.amount)
        .reduce((sum, a) => sum + a, 0n);

      expect(totalAmount).toBe(300n);
    });

    it('should handle empty arrays', () => {
      const empty: bigint[] = [];
      const sum = empty.reduce((acc, v) => acc + v, 0n);

      expect(sum).toBe(0n);
    });
  });

  describe('Set Operations', () => {
    it('should create set from array', () => {
      const arr = [1, 2, 2, 3, 3, 3];
      const set = new Set(arr);

      expect(set.size).toBe(3);
    });

    it('should convert set to array', () => {
      const set = new Set([1, 2, 3]);
      const arr = [...set];

      expect(arr.length).toBe(3);
      expect(Array.isArray(arr)).toBe(true);
    });

    it('should check set membership', () => {
      const set = new Set(['0xuser1', '0xuser2']);

      expect(set.has('0xuser1')).toBe(true);
      expect(set.has('0xuser3')).toBe(false);
    });

    it('should add to set', () => {
      const set = new Set<string>();
      set.add('0xuser1');
      set.add('0xuser1');
      set.add('0xuser2');

      expect(set.size).toBe(2);
    });
  });

  describe('Map Operations', () => {
    it('should create and query map', () => {
      const map = new Map<string, number>();
      map.set('key1', 100);
      map.set('key2', 200);

      expect(map.get('key1')).toBe(100);
      expect(map.get('key3')).toBeUndefined();
    });

    it('should update map values', () => {
      const map = new Map<string, number>();
      map.set('count', 1);
      map.set('count', 2);

      expect(map.get('count')).toBe(2);
    });

    it('should iterate over map', () => {
      const map = new Map([
        ['a', 1],
        ['b', 2],
        ['c', 3],
      ]);

      const sum = [...map.values()].reduce((s, v) => s + v, 0);
      expect(sum).toBe(6);
    });

    it('should get map keys', () => {
      const map = new Map([
        ['a', 1],
        ['b', 2],
      ]);

      const keys = [...map.keys()];
      expect(keys.length).toBe(2);
      expect(keys).toContain('a');
      expect(keys).toContain('b');
    });
  });

  describe('Null/Undefined Checks', () => {
    it('should use nullish coalescing', () => {
      const value1 = null;
      const value2 = undefined;
      const value3 = 0;

      expect(value1 ?? 'default').toBe('default');
      expect(value2 ?? 'default').toBe('default');
      expect(value3 ?? 'default').toBe(0);
    });

    it('should use optional chaining', () => {
      const obj: any = { nested: null };

      expect(obj?.nested?.value).toBeUndefined();
      expect(obj?.missing?.value).toBeUndefined();
    });

    it('should check for null or undefined', () => {
      const isNullish = (val: any) => val === null || val === undefined;

      expect(isNullish(null)).toBe(true);
      expect(isNullish(undefined)).toBe(true);
      expect(isNullish(0)).toBe(false);
      expect(isNullish('')).toBe(false);
    });
  });

  describe('String Utilities', () => {
    it('should trim whitespace', () => {
      const str = '  hello  ';
      const trimmed = str.trim();

      expect(trimmed).toBe('hello');
    });

    it('should split strings', () => {
      const str = 'a,b,c';
      const parts = str.split(',');

      expect(parts.length).toBe(3);
      expect(parts[0]).toBe('a');
    });

    it('should check string contains', () => {
      const str = 'hello world';

      expect(str.includes('world')).toBe(true);
      expect(str.includes('foo')).toBe(false);
    });

    it('should check string starts with', () => {
      const addr = '0xabcdef';

      expect(addr.startsWith('0x')).toBe(true);
      expect(addr.startsWith('0X')).toBe(false);
    });

    it('should pad strings', () => {
      const hex = 'abc';
      const padded = hex.padEnd(6, '0');

      expect(padded).toBe('abc000');
      expect(padded.length).toBe(6);
    });
  });
});
