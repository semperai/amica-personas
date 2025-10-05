import dotenv from "dotenv";
import { cleanEnv, host, num, port, str, testOnly } from "envalid";

dotenv.config();

export const env = cleanEnv(process.env, {
  NODE_ENV: str({
    devDefault: testOnly("test"),
    choices: ["development", "production", "test"],
  }),
  HOST: host({ default: "localhost" }),
  PORT: port({ default: 3000 }),
  CORS_ORIGIN: str({ devDefault: testOnly("http://localhost:3000") }),
  COMMON_RATE_LIMIT_MAX_REQUESTS: num({ default: 1000 }),
  COMMON_RATE_LIMIT_WINDOW_MS: num({ default: 1000 }),
  MAX_RETRIES: num({ default: 3 }),
  RETRY_DELAY: num({ default: 1000 }),
  CACHE_STALE_TIME: num({ default: 5 * 60 * 1000 }), // 5 minutes
  ANON_CREDITS_PER_DAY: num({ default: 1_000 }),
  FREE_CREDITS_PER_DAY: num({ default: 10_000 }),
  PRO_CREDITS_PER_DAY: num({ default: 100_000 }),
  CREDITS_PER_CHAT: num({ default: 1 }),
  CREDITS_PER_TTS: num({ default: 7 }),
  CREDITS_PER_STT: num({ default: 2 }),
  TIMEOUT_CHAT: num({ default: 3000 }),
  TIMEOUT_FISH: num({ default: 10000 }),
  TIMEOUT_WHISPER: num({ default: 5000 }),
  ANON_API_KEY: str({ default: "default" }),
  PGUSER: str(),
  PGPASSWORD: str(),
  PGDATABASE: str(),
  PGHOST: str(),
  PGPORT: str(),
  OPENAI_CHAT_API_KEY: str(),
  OPENAI_CHAT_URL: str(),
  OPENAI_CHAT_MODEL: str(),
  OPENAI_WHISPER_API_KEY: str(),
  OPENAI_WHISPER_URL: str(),
  OPENAI_WHISPER_MODEL: str(),
  FISH_API_KEY: str(),
  FISH_URL: str({ default: "https://api.fish.audio/v1/tts" }),
  FISH_MODEL: str({ default: "e58b0d7efca34eb38d5c4985e378abcb" }),
  LOG_LEVEL: str({ default: "info", choices: ["fatal", "error", "warn", "info", "debug", "trace"] }),
});
