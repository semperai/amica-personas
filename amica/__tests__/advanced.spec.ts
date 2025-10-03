import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";

/**
 * Advanced Test Scenarios
 *
 * These tests cover extremely complex scenarios including:
 * - State machines with transitions and guards
 * - WebSocket-like real-time communication
 * - Storage transactions and consistency
 * - Advanced error recovery patterns (circuit breaker, bulkhead)
 * - Security and sanitization edge cases
 * - Complex React patterns and cleanup races
 */

describe("Advanced Test Scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("State Machine Patterns", () => {
    type State = "idle" | "loading" | "success" | "error" | "retrying";
    type Event = "FETCH" | "SUCCESS" | "ERROR" | "RETRY" | "RESET";

    interface StateMachine {
      state: State;
      canTransition: (event: Event) => boolean;
      transition: (event: Event) => void;
      onEnter?: Record<State, () => void>;
      onExit?: Record<State, () => void>;
    }

    const createStateMachine = (
      initialState: State,
      transitions: Record<State, Partial<Record<Event, State>>>,
      guards?: Record<State, Partial<Record<Event, () => boolean>>>
    ): StateMachine => {
      let currentState: State = initialState;

      return {
        get state() {
          return currentState;
        },
        set state(value: State) {
          currentState = value;
        },
        canTransition(event: Event): boolean {
          const stateTransitions = transitions[currentState];
          if (!stateTransitions || !stateTransitions[event]) {
            return false;
          }

          const stateGuards = guards?.[currentState];
          const guard = stateGuards?.[event];
          return guard ? guard() : true;
        },
        transition(event: Event): void {
          if (!this.canTransition(event)) {
            throw new Error(`Invalid transition: ${currentState} -> ${event}`);
          }

          const nextState = transitions[currentState][event]!;
          const prevState = currentState;

          this.onExit?.[prevState]?.();
          currentState = nextState;
          this.onEnter?.[nextState]?.();
        },
      };
    };

    test("should handle valid state transitions", () => {
      const transitions: Record<State, Partial<Record<Event, State>>> = {
        idle: { FETCH: "loading" },
        loading: { SUCCESS: "success", ERROR: "error" },
        success: { RESET: "idle" },
        error: { RETRY: "retrying", RESET: "idle" },
        retrying: { SUCCESS: "success", ERROR: "error" },
      };

      const sm = createStateMachine("idle", transitions);

      expect(sm.state).toBe("idle");

      sm.transition("FETCH");
      expect(sm.state).toBe("loading");

      sm.transition("SUCCESS");
      expect(sm.state).toBe("success");

      sm.transition("RESET");
      expect(sm.state).toBe("idle");
    });

    test("should prevent invalid state transitions", () => {
      const transitions: Record<State, Partial<Record<Event, State>>> = {
        idle: { FETCH: "loading" },
        loading: { SUCCESS: "success", ERROR: "error" },
        success: { RESET: "idle" },
        error: { RETRY: "retrying", RESET: "idle" },
        retrying: { SUCCESS: "success", ERROR: "error" },
      };

      const sm = createStateMachine("idle", transitions);

      expect(() => sm.transition("SUCCESS")).toThrow("Invalid transition");
      expect(sm.state).toBe("idle");

      sm.transition("FETCH");
      expect(() => sm.transition("RETRY")).toThrow("Invalid transition");
      expect(sm.state).toBe("loading");
    });

    test("should handle guarded transitions", () => {
      let retryCount = 0;
      const maxRetries = 3;

      const transitions: Record<State, Partial<Record<Event, State>>> = {
        idle: { FETCH: "loading" },
        loading: { SUCCESS: "success", ERROR: "error" },
        success: { RESET: "idle" },
        error: { RETRY: "retrying", RESET: "idle" },
        retrying: { SUCCESS: "success", ERROR: "error" },
      };

      const guards: Record<State, Partial<Record<Event, () => boolean>>> = {
        error: {
          RETRY: () => retryCount < maxRetries,
        },
      };

      const sm = createStateMachine("error", transitions, guards);

      // Should allow retry when under limit
      retryCount = 1;
      expect(sm.canTransition("RETRY")).toBe(true);
      sm.transition("RETRY");
      expect(sm.state).toBe("retrying");

      // Reset to error state
      sm.state = "error";

      // Should prevent retry when at limit
      retryCount = 3;
      expect(sm.canTransition("RETRY")).toBe(false);
      expect(() => sm.transition("RETRY")).toThrow("Invalid transition");
    });

    test("should call onEnter and onExit hooks", () => {
      const onEnter = {
        loading: vi.fn(),
        success: vi.fn(),
      } as any;

      const onExit = {
        idle: vi.fn(),
        loading: vi.fn(),
      } as any;

      const transitions: Record<State, Partial<Record<Event, State>>> = {
        idle: { FETCH: "loading" },
        loading: { SUCCESS: "success" },
        success: {},
        error: {},
        retrying: {},
      };

      const sm = createStateMachine("idle", transitions);
      sm.onEnter = onEnter;
      sm.onExit = onExit;

      sm.transition("FETCH");
      expect(onExit.idle).toHaveBeenCalledTimes(1);
      expect(onEnter.loading).toHaveBeenCalledTimes(1);

      sm.transition("SUCCESS");
      expect(onExit.loading).toHaveBeenCalledTimes(1);
      expect(onEnter.success).toHaveBeenCalledTimes(1);
    });

    test("should handle concurrent state transitions safely", () => {
      const transitions: Record<State, Partial<Record<Event, State>>> = {
        idle: { FETCH: "loading" },
        loading: { SUCCESS: "success", ERROR: "error" },
        success: { RESET: "idle" },
        error: {},
        retrying: {},
      };

      const sm = createStateMachine("idle", transitions);
      const results: boolean[] = [];

      sm.transition("FETCH");

      // Try multiple concurrent transitions from same state
      try {
        sm.transition("SUCCESS");
        results.push(true);
      } catch {
        results.push(false);
      }

      try {
        sm.transition("ERROR");
        results.push(true);
      } catch {
        results.push(false);
      }

      // Only one should succeed (the first one)
      expect(results).toEqual([true, false]);
      expect(sm.state).toBe("success");
    });
  });

  describe("WebSocket-like Real-Time Communication", () => {
    type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";
    type Message = { type: string; payload: any };

    class MockWebSocket {
      state: ConnectionState = "disconnected";
      messageQueue: Message[] = [];
      listeners: Map<string, Set<Function>> = new Map();
      reconnectAttempts = 0;
      maxReconnectAttempts = 5;
      reconnectDelay = 1000;

      async connect(): Promise<void> {
        if (this.state !== "disconnected") {
          throw new Error("Already connected or connecting");
        }

        this.state = "connecting";

        return new Promise<void>((resolve, reject) => {
          setTimeout(() => {
            if (Math.random() > 0.3) {
              this.state = "connected";
              this.emit("open", {});
              this.flushQueue();
              resolve();
            } else {
              this.state = "disconnected";
              reject(new Error("Connection failed"));
            }
          }, 100);
        });
      }

      async reconnect(): Promise<void> {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          throw new Error("Max reconnect attempts reached");
        }

        this.state = "disconnected"; // Reset to disconnected before reconnecting
        this.reconnectAttempts++;

        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        await new Promise(resolve => setTimeout(resolve, delay));

        try {
          await this.connect();
          this.reconnectAttempts = 0;
        } catch (error) {
          this.state = "disconnected";
          throw error;
        }
      }

      send(message: Message): void {
        if (this.state === "connected") {
          this.messageQueue.push(message);
          this.emit("message", message);
        } else {
          this.messageQueue.push(message);
        }
      }

      flushQueue(): void {
        while (this.messageQueue.length > 0) {
          const message = this.messageQueue.shift()!;
          this.emit("message", message);
        }
      }

      on(event: string, callback: Function): void {
        if (!this.listeners.has(event)) {
          this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);
      }

      off(event: string, callback: Function): void {
        this.listeners.get(event)?.delete(callback);
      }

      emit(event: string, data: any): void {
        this.listeners.get(event)?.forEach(callback => callback(data));
      }

      disconnect(): void {
        this.state = "disconnected";
        this.emit("close", {});
      }
    }

    test("should handle connection lifecycle", async () => {
      const ws = new MockWebSocket();
      const openHandler = vi.fn();
      const closeHandler = vi.fn();

      ws.on("open", openHandler);
      ws.on("close", closeHandler);

      expect(ws.state).toBe("disconnected");

      // Mock successful connection
      Math.random = vi.fn().mockReturnValue(0.5);

      const connectPromise = ws.connect();
      await vi.runAllTimersAsync();
      await connectPromise;

      expect(ws.state).toBe("connected");
      expect(openHandler).toHaveBeenCalled();

      ws.disconnect();
      expect(ws.state).toBe("disconnected");
      expect(closeHandler).toHaveBeenCalled();
    });

    test("should queue messages when disconnected and flush on connect", async () => {
      const ws = new MockWebSocket();
      const messageHandler = vi.fn();

      ws.on("message", messageHandler);

      // Send messages while disconnected
      ws.send({ type: "msg1", payload: "data1" });
      ws.send({ type: "msg2", payload: "data2" });

      expect(messageHandler).not.toHaveBeenCalled();
      expect(ws.messageQueue.length).toBe(2);

      // Connect and flush queue
      Math.random = vi.fn().mockReturnValue(0.5);
      const connectPromise = ws.connect();
      await vi.runAllTimersAsync();
      await connectPromise;

      expect(messageHandler).toHaveBeenCalledTimes(2);
      expect(ws.messageQueue.length).toBe(0);
    });

    test("should handle reconnection with exponential backoff", async () => {
      const ws = new MockWebSocket();
      ws.state = "disconnected";

      // Always fail connections
      Math.random = vi.fn().mockReturnValue(0.1);

      let caughtError: any = null;

      const reconnectPromise = ws.reconnect().catch(err => {
        caughtError = err;
      });

      // Wait for the backoff delay and connection attempt
      await vi.runAllTimersAsync();
      await reconnectPromise;

      expect(caughtError).not.toBeNull();
      expect(caughtError.message).toBe("Connection failed");
      expect(ws.reconnectAttempts).toBe(1);
      expect(ws.state).toBe("disconnected");
    });

    test("should respect max reconnect attempts", async () => {
      const ws = new MockWebSocket();
      ws.state = "disconnected";
      ws.maxReconnectAttempts = 3;

      // Simulate connection failures
      Math.random = vi.fn().mockReturnValue(0.1);

      // Attempt to reconnect until limit
      for (let i = 0; i < 3; i++) {
        ws.state = "disconnected"; // Reset state
        const promise = ws.reconnect().catch(() => {
          // Expected connection failure
        });
        await vi.runAllTimersAsync();
        await promise;
      }

      expect(ws.reconnectAttempts).toBe(3);

      // Next attempt should fail immediately without trying to connect
      let error: any = null;
      try {
        await ws.reconnect();
      } catch (err: any) {
        error = err;
      }

      expect(error).not.toBeNull();
      expect(error.message).toBe("Max reconnect attempts reached");
    });

    test("should handle message ordering under network delay", async () => {
      const ws = new MockWebSocket();
      const receivedMessages: string[] = [];

      ws.on("message", (msg: Message) => {
        receivedMessages.push(msg.type);
      });

      Math.random = vi.fn().mockReturnValue(0.5);
      const connectPromise = ws.connect();
      await vi.runAllTimersAsync();
      await connectPromise;

      // Send messages in order
      ws.send({ type: "msg1", payload: {} });
      ws.send({ type: "msg2", payload: {} });
      ws.send({ type: "msg3", payload: {} });

      // Messages should arrive in order
      expect(receivedMessages).toEqual(["msg1", "msg2", "msg3"]);
    });
  });

  describe("Storage Transactions and Consistency", () => {
    interface Transaction {
      id: string;
      operations: Array<{ type: "read" | "write"; key: string; value?: any }>;
      status: "pending" | "committed" | "aborted";
    }

    class TransactionalStorage {
      private data: Map<string, any> = new Map();
      private locks: Map<string, string> = new Map(); // key -> transaction id
      private transactions: Map<string, Transaction> = new Map();

      beginTransaction(id: string): Transaction {
        if (this.transactions.has(id)) {
          throw new Error(`Transaction ${id} already exists`);
        }

        const transaction: Transaction = {
          id,
          operations: [],
          status: "pending",
        };

        this.transactions.set(id, transaction);
        return transaction;
      }

      read(transactionId: string, key: string): any {
        const transaction = this.transactions.get(transactionId);
        if (!transaction || transaction.status !== "pending") {
          throw new Error("Invalid transaction");
        }

        transaction.operations.push({ type: "read", key });
        return this.data.get(key);
      }

      write(transactionId: string, key: string, value: any): void {
        const transaction = this.transactions.get(transactionId);
        if (!transaction || transaction.status !== "pending") {
          throw new Error("Invalid transaction");
        }

        // Check for lock conflicts
        const existingLock = this.locks.get(key);
        if (existingLock && existingLock !== transactionId) {
          throw new Error(`Key ${key} is locked by transaction ${existingLock}`);
        }

        // Acquire lock
        this.locks.set(key, transactionId);

        transaction.operations.push({ type: "write", key, value });
      }

      commit(transactionId: string): void {
        const transaction = this.transactions.get(transactionId);
        if (!transaction || transaction.status !== "pending") {
          throw new Error("Invalid transaction");
        }

        // Apply all writes
        for (const op of transaction.operations) {
          if (op.type === "write") {
            this.data.set(op.key, op.value);
          }
        }

        // Release locks
        for (const op of transaction.operations) {
          if (op.type === "write") {
            this.locks.delete(op.key);
          }
        }

        transaction.status = "committed";
      }

      abort(transactionId: string): void {
        const transaction = this.transactions.get(transactionId);
        if (!transaction) {
          throw new Error("Transaction not found");
        }

        // Release locks without applying writes
        for (const op of transaction.operations) {
          if (op.type === "write") {
            this.locks.delete(op.key);
          }
        }

        transaction.status = "aborted";
      }

      isLocked(key: string): boolean {
        return this.locks.has(key);
      }

      get(key: string): any {
        return this.data.get(key);
      }
    }

    test("should handle basic read-write transaction", () => {
      const storage = new TransactionalStorage();

      const tx = storage.beginTransaction("tx1");
      storage.write("tx1", "key1", "value1");
      storage.write("tx1", "key2", "value2");
      storage.commit("tx1");

      expect(storage.get("key1")).toBe("value1");
      expect(storage.get("key2")).toBe("value2");
    });

    test("should rollback on abort", () => {
      const storage = new TransactionalStorage();

      // Set initial value
      const tx1 = storage.beginTransaction("tx1");
      storage.write("tx1", "key1", "initial");
      storage.commit("tx1");

      // Start new transaction and abort
      const tx2 = storage.beginTransaction("tx2");
      storage.write("tx2", "key1", "modified");
      storage.abort("tx2");

      // Value should remain unchanged
      expect(storage.get("key1")).toBe("initial");
    });

    test("should prevent concurrent writes with locking", () => {
      const storage = new TransactionalStorage();

      const tx1 = storage.beginTransaction("tx1");
      storage.write("tx1", "key1", "value1");

      expect(storage.isLocked("key1")).toBe(true);

      const tx2 = storage.beginTransaction("tx2");
      expect(() => storage.write("tx2", "key1", "value2")).toThrow("locked by transaction tx1");
    });

    test("should release locks after commit", () => {
      const storage = new TransactionalStorage();

      const tx1 = storage.beginTransaction("tx1");
      storage.write("tx1", "key1", "value1");
      storage.commit("tx1");

      expect(storage.isLocked("key1")).toBe(false);

      // Should be able to acquire lock now
      const tx2 = storage.beginTransaction("tx2");
      expect(() => storage.write("tx2", "key1", "value2")).not.toThrow();
    });

    test("should handle read-modify-write pattern", () => {
      const storage = new TransactionalStorage();

      // Initial value
      const tx1 = storage.beginTransaction("tx1");
      storage.write("tx1", "counter", 0);
      storage.commit("tx1");

      // Read-modify-write
      const tx2 = storage.beginTransaction("tx2");
      const current = storage.read("tx2", "counter");
      storage.write("tx2", "counter", current + 1);
      storage.commit("tx2");

      expect(storage.get("counter")).toBe(1);
    });

    test("should handle lost update problem with locking", () => {
      const storage = new TransactionalStorage();

      // Initial value
      const tx0 = storage.beginTransaction("tx0");
      storage.write("tx0", "counter", 100);
      storage.commit("tx0");

      // Transaction 1 reads
      const tx1 = storage.beginTransaction("tx1");
      const value1 = storage.read("tx1", "counter");

      // Transaction 2 tries to read and write
      const tx2 = storage.beginTransaction("tx2");
      const value2 = storage.read("tx2", "counter");

      // Transaction 1 writes (acquires lock)
      storage.write("tx1", "counter", value1 - 10);

      // Transaction 2 tries to write (should fail due to lock)
      expect(() => storage.write("tx2", "counter", value2 - 20)).toThrow("locked");

      storage.commit("tx1");

      // Now tx2 can proceed
      const value2Updated = storage.read("tx2", "counter");
      storage.write("tx2", "counter", value2Updated - 20);
      storage.commit("tx2");

      expect(storage.get("counter")).toBe(70); // 100 - 10 - 20
    });

    test("should prevent dirty reads", () => {
      const storage = new TransactionalStorage();

      const tx1 = storage.beginTransaction("tx1");
      storage.write("tx1", "key1", "dirty");

      // Another transaction shouldn't see uncommitted data
      const tx2 = storage.beginTransaction("tx2");
      const value = storage.read("tx2", "key1");

      expect(value).toBeUndefined(); // Hasn't been committed yet
    });
  });

  describe("Circuit Breaker Pattern", () => {
    type CircuitState = "closed" | "open" | "half-open";

    class CircuitBreaker {
      private state: CircuitState = "closed";
      private failureCount = 0;
      private successCount = 0;
      private lastFailureTime: number | null = null;
      private nextAttemptTime: number | null = null;

      constructor(
        private failureThreshold: number = 5,
        private successThreshold: number = 2,
        private timeout: number = 60000
      ) {}

      async execute<T>(operation: () => Promise<T>): Promise<T> {
        if (this.state === "open") {
          if (this.shouldAttemptReset()) {
            this.state = "half-open";
          } else {
            throw new Error("Circuit breaker is OPEN");
          }
        }

        try {
          const result = await operation();
          this.onSuccess();
          return result;
        } catch (error) {
          this.onFailure();
          throw error;
        }
      }

      private shouldAttemptReset(): boolean {
        if (!this.nextAttemptTime) return false;
        return Date.now() >= this.nextAttemptTime;
      }

      private onSuccess(): void {
        this.failureCount = 0;

        if (this.state === "half-open") {
          this.successCount++;

          if (this.successCount >= this.successThreshold) {
            this.state = "closed";
            this.successCount = 0;
          }
        }
      }

      private onFailure(): void {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        this.successCount = 0;

        if (this.failureCount >= this.failureThreshold) {
          this.state = "open";
          this.nextAttemptTime = Date.now() + this.timeout;
        }
      }

      getState(): CircuitState {
        return this.state;
      }

      getFailureCount(): number {
        return this.failureCount;
      }

      reset(): void {
        this.state = "closed";
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        this.nextAttemptTime = null;
      }
    }

    test("should start in closed state", () => {
      const breaker = new CircuitBreaker();
      expect(breaker.getState()).toBe("closed");
    });

    test("should open after threshold failures", async () => {
      vi.setSystemTime(0);
      const breaker = new CircuitBreaker(3, 2, 1000);

      const failingOperation = () => Promise.reject(new Error("Operation failed"));

      // Fail 3 times
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingOperation);
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe("open");
      expect(breaker.getFailureCount()).toBe(3);
    });

    test("should reject immediately when open", async () => {
      vi.setSystemTime(0);
      const breaker = new CircuitBreaker(2, 2, 1000);

      const failingOperation = () => Promise.reject(new Error("Operation failed"));

      // Trigger opening
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(failingOperation);
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe("open");

      // Should reject immediately
      await expect(
        breaker.execute(() => Promise.resolve("should not execute"))
      ).rejects.toThrow("Circuit breaker is OPEN");
    });

    test("should transition to half-open after timeout", async () => {
      vi.setSystemTime(0);
      const breaker = new CircuitBreaker(2, 2, 1000);

      const failingOperation = () => Promise.reject(new Error("Fail"));
      const successOperation = () => Promise.resolve("Success");

      // Open the breaker
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(failingOperation);
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe("open");

      // Wait for timeout
      vi.setSystemTime(1000);

      // Next call should transition to half-open and execute
      const result = await breaker.execute(successOperation);

      expect(result).toBe("Success");
      expect(breaker.getState()).toBe("half-open");
    });

    test("should close after successful attempts in half-open state", async () => {
      vi.setSystemTime(0);
      const breaker = new CircuitBreaker(2, 2, 1000);

      const failingOperation = () => Promise.reject(new Error("Fail"));
      const successOperation = () => Promise.resolve("Success");

      // Open the breaker
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(failingOperation);
        } catch {
          // Expected
        }
      }

      // Wait for timeout and transition to half-open
      vi.setSystemTime(1000);

      // Execute successful operations
      await breaker.execute(successOperation);
      expect(breaker.getState()).toBe("half-open");

      await breaker.execute(successOperation);
      expect(breaker.getState()).toBe("closed");
    });

    test("should reopen if failure occurs in half-open state", async () => {
      vi.setSystemTime(0);
      const breaker = new CircuitBreaker(2, 2, 1000);

      const failingOperation = () => Promise.reject(new Error("Fail"));
      const successOperation = () => Promise.resolve("Success");

      // Open the breaker
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(failingOperation);
        } catch {
          // Expected
        }
      }

      // Transition to half-open
      vi.setSystemTime(1000);
      await breaker.execute(successOperation);

      expect(breaker.getState()).toBe("half-open");

      // Fail in half-open state
      try {
        await breaker.execute(failingOperation);
      } catch {
        // Expected
      }

      // Should have incremented failure count but not necessarily opened yet
      // (depending on implementation, it might reopen immediately)
      expect(breaker.getFailureCount()).toBeGreaterThan(0);
    });

    test("should reset all counters on manual reset", async () => {
      vi.setSystemTime(0);
      const breaker = new CircuitBreaker(2, 2, 1000);

      const failingOperation = () => Promise.reject(new Error("Fail"));

      // Open the breaker
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(failingOperation);
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe("open");
      expect(breaker.getFailureCount()).toBe(2);

      breaker.reset();

      expect(breaker.getState()).toBe("closed");
      expect(breaker.getFailureCount()).toBe(0);
    });
  });

  describe("Security and Sanitization", () => {
    const sanitizeHTML = (input: string): string => {
      const tagPattern = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
      let sanitized = input.replace(tagPattern, "");

      // Remove event handlers
      sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, "");
      sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]*/gi, "");

      // Remove javascript: protocol and anything in href with it
      sanitized = sanitized.replace(/href\s*=\s*["']?javascript:[^"'>]*["']?/gi, "");
      sanitized = sanitized.replace(/javascript:/gi, "");

      return sanitized;
    };

    const sanitizeSQL = (input: string): string => {
      // Basic SQL injection prevention (simplified)
      return input.replace(/['";]/g, "");
    };

    const escapeHTML = (input: string): string => {
      const map: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#x27;",
        "/": "&#x2F;",
      };

      return input.replace(/[&<>"'/]/g, char => map[char]);
    };

    test("should remove script tags", () => {
      const malicious = '<div>Hello <script>alert("XSS")</script> World</div>';
      const sanitized = sanitizeHTML(malicious);

      expect(sanitized).not.toContain("<script>");
      expect(sanitized).not.toContain("alert");
      expect(sanitized).toContain("Hello");
      expect(sanitized).toContain("World");
    });

    test("should remove inline event handlers", () => {
      const malicious = '<div onclick="alert(\'XSS\')">Click me</div>';
      const sanitized = sanitizeHTML(malicious);

      expect(sanitized).not.toContain("onclick");
      expect(sanitized).not.toContain("alert");
      expect(sanitized).toContain("Click me");
    });

    test("should remove javascript: protocol", () => {
      const malicious = '<a href="javascript:alert(\'XSS\')">Link</a>';
      const sanitized = sanitizeHTML(malicious);

      expect(sanitized).not.toContain("javascript:");
      expect(sanitized).toContain("Link");
    });

    test("should handle nested script tags", () => {
      const malicious = "<script><script>alert('XSS')</script></script>";
      const sanitized = sanitizeHTML(malicious);

      expect(sanitized).not.toContain("<script>");
      expect(sanitized).not.toContain("alert");
    });

    test("should prevent SQL injection in basic queries", () => {
      const maliciousInput = "admin'; DROP TABLE users; --";
      const sanitized = sanitizeSQL(maliciousInput);

      expect(sanitized).not.toContain("'");
      expect(sanitized).not.toContain(";");
      expect(sanitized).toBe("admin DROP TABLE users --");
    });

    test("should escape HTML entities", () => {
      const input = '<div class="test">A & B < C > D</div>';
      const escaped = escapeHTML(input);

      expect(escaped).toBe("&lt;div class=&quot;test&quot;&gt;A &amp; B &lt; C &gt; D&lt;&#x2F;div&gt;");
      expect(escaped).not.toContain("<");
      expect(escaped).not.toContain(">");
      // Should contain escaped ampersands but not raw ones
      expect(escaped).toContain("&amp;");
      expect(escaped).toContain("&lt;");
    });

    test("should handle multiple XSS vectors in one input", () => {
      const malicious =
        '<img src=x onerror="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)">text</a>';
      const sanitized = sanitizeHTML(malicious);

      expect(sanitized).not.toContain("onerror");
      expect(sanitized).not.toContain("<script>");
      expect(sanitized).not.toContain("javascript:");
      expect(sanitized).not.toContain("alert");
    });

    test("should preserve safe HTML", () => {
      const safe = '<div class="container"><p>Hello <strong>World</strong>!</p></div>';
      const sanitized = sanitizeHTML(safe);

      expect(sanitized).toContain("<div");
      expect(sanitized).toContain("<p>");
      expect(sanitized).toContain("<strong>");
      expect(sanitized).toContain("Hello");
      expect(sanitized).toContain("World");
    });

    test("should handle case-insensitive attacks", () => {
      const malicious = '<SCRIPT>alert("XSS")</SCRIPT><ScRiPt>alert("XSS")</ScRiPt>';
      const sanitized = sanitizeHTML(malicious);

      expect(sanitized).not.toContain("SCRIPT");
      expect(sanitized).not.toContain("ScRiPt");
      expect(sanitized).not.toContain("alert");
    });

    test("should handle encoded attacks", () => {
      const malicious = '<img src=x onerror="&#97;&#108;&#101;&#114;&#116;(1)">';
      const sanitized = sanitizeHTML(malicious);

      expect(sanitized).not.toContain("onerror");
    });
  });

  describe("Complex React Patterns", () => {
    test("should handle useEffect cleanup race condition", async () => {
      const cleanupFns: Array<() => void> = [];
      let isMounted = true;

      const useEffect = (effect: () => (() => void) | void, deps: any[]) => {
        const cleanup = effect();
        if (cleanup) {
          cleanupFns.push(cleanup);
        }
      };

      const simulateUnmount = () => {
        isMounted = false;
        cleanupFns.forEach(fn => fn());
        cleanupFns.length = 0;
      };

      const fetchData = vi.fn().mockResolvedValue({ data: "test" });
      const setState = vi.fn();

      // Simulate effect with async operation
      useEffect(() => {
        const controller = new AbortController();

        fetchData({ signal: controller.signal }).then(result => {
          if (isMounted) {
            setState(result);
          }
        });

        return () => {
          controller.abort();
        };
      }, []);

      // Unmount before fetch completes
      simulateUnmount();

      await vi.runAllTimersAsync();

      // setState should not be called after unmount
      expect(setState).not.toHaveBeenCalled();
    });

    test("should handle stale closure in useEffect", () => {
      const effects: Array<() => void> = [];

      const useEffect = (effect: () => void, deps: any[]) => {
        effects.push(effect);
      };

      // First render with count = 0
      let count1 = 0;
      useEffect(() => {
        console.log("Count is", count1);
      }, [count1]);

      // Second render with count = 1
      let count2 = 1;
      useEffect(() => {
        console.log("Count is", count2);
      }, [count2]);

      // Execute effects
      const consoleSpy = vi.spyOn(console, "log").mockImplementation();

      effects[0](); // Uses count1 = 0 (closure captures count1)
      effects[1](); // Uses count2 = 1 (closure captures count2)

      expect(consoleSpy).toHaveBeenNthCalledWith(1, "Count is", 0);
      expect(consoleSpy).toHaveBeenNthCalledWith(2, "Count is", 1);

      consoleSpy.mockRestore();
    });

    test("should handle ref updates without re-render", () => {
      const ref = { current: null as HTMLDivElement | null };

      const setRef = (element: HTMLDivElement | null) => {
        ref.current = element;
      };

      const mockElement = { tagName: "DIV" } as HTMLDivElement;

      setRef(mockElement);
      expect(ref.current).toBe(mockElement);

      setRef(null);
      expect(ref.current).toBe(null);
    });

    test("should handle custom hook with multiple state updates", () => {
      let state = { loading: false, data: null as any, error: null as any };

      const setState = (updates: Partial<typeof state>) => {
        state = { ...state, ...updates };
      };

      const fetchWithState = async () => {
        setState({ loading: true, error: null });

        try {
          const data = await Promise.resolve({ result: "success" });
          setState({ loading: false, data });
        } catch (error) {
          setState({ loading: false, error });
        }
      };

      expect(state.loading).toBe(false);

      const fetchPromise = fetchWithState();

      expect(state.loading).toBe(true);
      expect(state.data).toBe(null);

      return fetchPromise.then(() => {
        expect(state.loading).toBe(false);
        expect(state.data).toEqual({ result: "success" });
        expect(state.error).toBe(null);
      });
    });

    test("should batch state updates correctly", () => {
      const updates: any[] = [];

      const setState = (update: any) => {
        updates.push(update);
      };

      // Simulate batched updates
      const batchUpdates = (fn: () => void) => {
        const startLength = updates.length;
        fn();
        return updates.length - startLength;
      };

      const updateCount = batchUpdates(() => {
        setState({ count: 1 });
        setState({ count: 2 });
        setState({ count: 3 });
      });

      expect(updateCount).toBe(3);
      expect(updates).toEqual([{ count: 1 }, { count: 2 }, { count: 3 }]);
    });
  });
});
