import { vi } from "vitest";

export const mockEnv = {
  NODE_ENV: "test",
  HOST: "localhost",
  PORT: 3000,
  CORS_ORIGIN: "http://localhost:3000",
  COMMON_RATE_LIMIT_MAX_REQUESTS: 1000,
  COMMON_RATE_LIMIT_WINDOW_MS: 1000,
  MAX_RETRIES: 3,
  RETRY_DELAY: 100,
  CACHE_STALE_TIME: 300000,
  ANON_CREDITS_PER_DAY: 1000,
  FREE_CREDITS_PER_DAY: 10000,
  PRO_CREDITS_PER_DAY: 100000,
  CREDITS_PER_CHAT: 1,
  CREDITS_PER_TTS: 7,
  CREDITS_PER_STT: 2,
  TIMEOUT_CHAT: 30000,
  TIMEOUT_FISH: 10000,
  TIMEOUT_WHISPER: 5000,
  ANON_API_KEY: "default",
  PGUSER: "test_user",
  PGPASSWORD: "test_password",
  PGDATABASE: "test_db",
  PGHOST: "localhost",
  PGPORT: "5432",
  OPENAI_CHAT_API_KEY: "test-api-key",
  OPENAI_CHAT_URL: "https://api.test.com/v1/chat/completions",
  OPENAI_CHAT_MODEL: "test-model",
  OPENAI_WHISPER_API_KEY: "test-whisper-key",
  OPENAI_WHISPER_URL: "https://api.test.com/v1/audio/transcriptions",
  OPENAI_WHISPER_MODEL: "whisper-1",
  FISH_API_KEY: "test-fish-key",
  FISH_URL: "https://api.fish.audio/v1/tts",
  FISH_MODEL: "test-fish-model",
  LOG_LEVEL: "error",
};

export function setupMockEnv() {
  vi.mock("@/utils/envConfig", () => ({
    env: mockEnv,
  }));
}
