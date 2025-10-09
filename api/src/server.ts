import * as fs from "node:fs";
import * as Sentry from "@sentry/node";
import cors from "cors";
import express, { type Express, type Request, type Response } from "express";
import helmet from "helmet";
import multer from "multer";
import * as promClient from "prom-client";
import {
  apiCallDuration,
  apiCallErrors,
  creditsRemainingGauge,
  creditsUsedCounter,
  endpointHealthGauge,
  endpointResponseTimeGauge,
  outOfCreditsCounter,
  streamingEventsCounter,
} from "@/metrics";
import authorizationCheck from "@/middleware/authorizationCheck";
import errorHandler from "@/middleware/errorHandler";
import metricsMiddleware from "@/middleware/metricsMiddleware";
import rateLimiter from "@/middleware/rateLimiter";
import requestLogger from "@/middleware/requestLogger";
import { env } from "@/utils/envConfig";
import { fetchWithRetry } from "@/utils/fetchWithRetry";
import { createLogger, logError } from "@/utils/logger";

const logger = createLogger({ component: "server" });
const app: Express = express();
const upload = multer({ dest: "uploads/" });

// Set the application to trust the reverse proxy (for ip address)
app.set("trust proxy", true);

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(helmet());
app.use(rateLimiter);
app.use(metricsMiddleware);
app.use(requestLogger);

const sendEvent = (res: Response, data: any, endpoint: string) => {
  try {
    for (const item of ["id", "object", "model", "system_fingerprint", "x_groq"]) {
      if (typeof data[item] !== "undefined") {
        delete data[item];
      }
    }

    const json = JSON.stringify(data);
    res.write(`data: ${json}\n\n`);
    streamingEventsCounter.inc({ endpoint });
  } catch (error) {
    logError(error as Error, { context: "sendEvent" });
  }
};

app.get("/", (_req: Request, res: Response) => {
  return res.send("Hey, Amica!");
});

// Kubernetes liveness probe - checks if the app is alive
app.get("/livez", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

// Kubernetes readiness probe - checks if the app is ready to serve traffic
app.get("/readyz", async (_req: Request, res: Response) => {
  try {
    // Check database connectivity
    const { connect } = await import("ts-postgres");
    const client = await connect();
    await client.query("SELECT 1");
    await client.end();

    res.status(200).json({ status: "ready" });
  } catch (error) {
    logError(error as Error, { context: "readiness_check" });
    res.status(503).json({ status: "not ready", error: "Database unavailable" });
  }
});

app.get("/health-check", async (_req: Request, res: Response) => {
  try {
    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: env.NODE_ENV,
      version: "1.0.14",
      dependencies: {
        openai_chat: { status: "unknown", responseTime: 0 },
        openai_whisper: { status: "unknown", responseTime: 0 },
        fish_tts: { status: "unknown", responseTime: 0 },
        database: { status: "unknown", responseTime: 0 },
      },
    };

    // Quick dependency checks (with timeouts to avoid blocking)
    const checkPromises = [
      // Check OpenAI Chat
      (async () => {
        const start = Date.now();
        try {
          await fetch(env.OPENAI_CHAT_URL, {
            method: "HEAD",
            signal: AbortSignal.timeout(2000),
          });
          health.dependencies.openai_chat.status = "healthy";
          health.dependencies.openai_chat.responseTime = Date.now() - start;
          endpointHealthGauge.set({ endpoint: "/health-check", dependency: "openai_chat" }, 1);
          endpointResponseTimeGauge.set({ dependency: "openai_chat" }, health.dependencies.openai_chat.responseTime);
        } catch {
          health.dependencies.openai_chat.status = "unhealthy";
          health.dependencies.openai_chat.responseTime = Date.now() - start;
          endpointHealthGauge.set({ endpoint: "/health-check", dependency: "openai_chat" }, 0);
          endpointResponseTimeGauge.set({ dependency: "openai_chat" }, health.dependencies.openai_chat.responseTime);
        }
      })(),

      // Check OpenAI Whisper
      (async () => {
        const start = Date.now();
        try {
          await fetch(env.OPENAI_WHISPER_URL, {
            method: "HEAD",
            signal: AbortSignal.timeout(2000),
          });
          health.dependencies.openai_whisper.status = "healthy";
          health.dependencies.openai_whisper.responseTime = Date.now() - start;
          endpointHealthGauge.set({ endpoint: "/health-check", dependency: "openai_whisper" }, 1);
          endpointResponseTimeGauge.set(
            { dependency: "openai_whisper" },
            health.dependencies.openai_whisper.responseTime,
          );
        } catch {
          health.dependencies.openai_whisper.status = "unhealthy";
          health.dependencies.openai_whisper.responseTime = Date.now() - start;
          endpointHealthGauge.set({ endpoint: "/health-check", dependency: "openai_whisper" }, 0);
          endpointResponseTimeGauge.set(
            { dependency: "openai_whisper" },
            health.dependencies.openai_whisper.responseTime,
          );
        }
      })(),

      // Check Fish TTS
      (async () => {
        const start = Date.now();
        try {
          await fetch(env.FISH_URL, {
            method: "HEAD",
            signal: AbortSignal.timeout(2000),
          });
          health.dependencies.fish_tts.status = "healthy";
          health.dependencies.fish_tts.responseTime = Date.now() - start;
          endpointHealthGauge.set({ endpoint: "/health-check", dependency: "fish_tts" }, 1);
          endpointResponseTimeGauge.set({ dependency: "fish_tts" }, health.dependencies.fish_tts.responseTime);
        } catch {
          health.dependencies.fish_tts.status = "unhealthy";
          health.dependencies.fish_tts.responseTime = Date.now() - start;
          endpointHealthGauge.set({ endpoint: "/health-check", dependency: "fish_tts" }, 0);
          endpointResponseTimeGauge.set({ dependency: "fish_tts" }, health.dependencies.fish_tts.responseTime);
        }
      })(),

      // Check Database
      (async () => {
        const start = Date.now();
        try {
          const { connect } = await import("ts-postgres");
          const client = await connect();
          await client.query("SELECT 1");
          await client.end();
          health.dependencies.database.status = "healthy";
          health.dependencies.database.responseTime = Date.now() - start;
          endpointHealthGauge.set({ endpoint: "/health-check", dependency: "database" }, 1);
          endpointResponseTimeGauge.set({ dependency: "database" }, health.dependencies.database.responseTime);
        } catch {
          health.dependencies.database.status = "unhealthy";
          health.dependencies.database.responseTime = Date.now() - start;
          endpointHealthGauge.set({ endpoint: "/health-check", dependency: "database" }, 0);
          endpointResponseTimeGauge.set({ dependency: "database" }, health.dependencies.database.responseTime);
        }
      })(),
    ];

    // Wait for all checks with timeout
    await Promise.race([Promise.allSettled(checkPromises), new Promise((resolve) => setTimeout(resolve, 3000))]);

    // Determine overall status
    const hasUnhealthy = Object.values(health.dependencies).some((dep) => dep.status === "unhealthy");
    if (hasUnhealthy) {
      health.status = "degraded";
      return res.status(503).json(health);
    }

    return res.json(health);
  } catch (e) {
    logError(e as Error, { context: "health_check" });
    return res.status(500).json({
      status: "unhealthy",
      error: "Internal error",
      timestamp: new Date().toISOString(),
    });
  }
});

app.get("/metrics", async (req: Request, res: Response) => {
  res.setHeader("Content-Type", promClient.register.contentType);
  res.end(await promClient.register.metrics());
});

// Monitoring dashboard endpoint
app.get("/monitoring", async (_req: Request, res: Response) => {
  try {
    const metrics = await promClient.register.getMetricsAsJSON();
    const metricsMap = new Map(metrics.map((m) => [m.name, m]));

    const dashboard = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: "1.0.14",
      environment: env.NODE_ENV,
      health: {
        dependencies: {
          openai_chat:
            metricsMap.get("endpoint_health_status")?.values.find((v) => v.labels.dependency === "openai_chat")
              ?.value === 1
              ? "healthy"
              : "unhealthy",
          openai_whisper:
            metricsMap.get("endpoint_health_status")?.values.find((v) => v.labels.dependency === "openai_whisper")
              ?.value === 1
              ? "healthy"
              : "unhealthy",
          fish_tts:
            metricsMap.get("endpoint_health_status")?.values.find((v) => v.labels.dependency === "fish_tts")?.value ===
            1
              ? "healthy"
              : "unhealthy",
          database:
            metricsMap.get("endpoint_health_status")?.values.find((v) => v.labels.dependency === "database")?.value ===
            1
              ? "healthy"
              : "unhealthy",
        },
        responseTimes: {
          openai_chat:
            metricsMap.get("endpoint_response_time_ms")?.values.find((v) => v.labels.dependency === "openai_chat")
              ?.value || 0,
          openai_whisper:
            metricsMap.get("endpoint_response_time_ms")?.values.find((v) => v.labels.dependency === "openai_whisper")
              ?.value || 0,
          fish_tts:
            metricsMap.get("endpoint_response_time_ms")?.values.find((v) => v.labels.dependency === "fish_tts")
              ?.value || 0,
          database:
            metricsMap.get("endpoint_response_time_ms")?.values.find((v) => v.labels.dependency === "database")
              ?.value || 0,
        },
      },
      api: {
        totalRequests: metricsMap.get("api_requests_total")?.values.reduce((sum, v) => sum + (v.value || 0), 0) || 0,
        creditsUsed: metricsMap.get("credits_used_total")?.values.reduce((sum, v) => sum + (v.value || 0), 0) || 0,
        outOfCreditsEvents:
          metricsMap.get("out_of_credits_total")?.values.reduce((sum, v) => sum + (v.value || 0), 0) || 0,
        apiCallErrors: metricsMap.get("api_call_errors_total")?.values.reduce((sum, v) => sum + (v.value || 0), 0) || 0,
      },
      endpoints: {
        "/v1/chat/completions": {
          requests:
            metricsMap.get("api_requests_total")?.values.find((v) => v.labels.endpoint === "/v1/chat/completions")
              ?.value || 0,
          credits:
            metricsMap.get("credits_used_total")?.values.find((v) => v.labels.endpoint === "/v1/chat/completions")
              ?.value || 0,
          errors:
            metricsMap.get("api_call_errors_total")?.values.find((v) => v.labels.endpoint === "/v1/chat/completions")
              ?.value || 0,
        },
        "/v1/audio/speech": {
          requests:
            metricsMap.get("api_requests_total")?.values.find((v) => v.labels.endpoint === "/v1/audio/speech")?.value ||
            0,
          credits:
            metricsMap.get("credits_used_total")?.values.find((v) => v.labels.endpoint === "/v1/audio/speech")?.value ||
            0,
          errors:
            metricsMap.get("api_call_errors_total")?.values.find((v) => v.labels.endpoint === "/v1/audio/speech")
              ?.value || 0,
        },
        "/v1/audio/transcriptions": {
          requests:
            metricsMap.get("api_requests_total")?.values.find((v) => v.labels.endpoint === "/v1/audio/transcriptions")
              ?.value || 0,
          credits:
            metricsMap.get("credits_used_total")?.values.find((v) => v.labels.endpoint === "/v1/audio/transcriptions")
              ?.value || 0,
          errors:
            metricsMap
              .get("api_call_errors_total")
              ?.values.find((v) => v.labels.endpoint === "/v1/audio/transcriptions")?.value || 0,
        },
      },
    };

    return res.json(dashboard);
  } catch (e) {
    logError(e as Error, { context: "monitoring_dashboard" });
    return res.status(500).json({ error: "Failed to generate monitoring dashboard" });
  }
});

// TODO we want to fallover between list of providers
// e.g. if groq fails, disable it for 5 minutes and use fireworks
// then re-enable groq upon test success
app.post("/v1/chat/completions", [authorizationCheck(env.CREDITS_PER_CHAT)], async (req: Request, res: Response) => {
  try {
    const accountInfo = res.locals.accountInfo;
    const tier = accountInfo.tier || "unknown";
    const userId = accountInfo.userId || "anonymous";

    logger.info({ accountInfo, requestId: req.id }, "Processing chat completion request");

    // Track credits
    creditsRemainingGauge.set({ user_id: userId, tier }, accountInfo.credits);

    if (accountInfo.credits < 0) {
      outOfCreditsCounter.inc({ tier, endpoint: "/v1/chat/completions" });
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      const json = {
        created: +new Date(),
        choices: [
          {
            index: 0,
            delta: {
              content: "[sad] You have run out of credits. Please top up your account to continue chatting.",
            },
            logprobs: null,
            finish_reason: null,
          },
        ],
      };

      sendEvent(res, json, "/v1/chat/completions");

      // Close the connection when the client disconnects
      req.on("close", () => {
        try {
          res.end();
        } catch (error) {
          logError(error as Error, { context: "chat_completion_close", requestId: req.id });
        }
      });

      return;
    }

    const apiUrl = env.OPENAI_CHAT_URL;
    const model = env.OPENAI_CHAT_MODEL;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate, br, zstd",
      Authorization: `Bearer ${env.OPENAI_CHAT_API_KEY}`,
    };

    const messages: {
      role: string;
      content: string;
    }[] = [];

    try {
      for (const message of req.body.messages) {
        // Skip messages with empty content
        if (!message.content || typeof message.content !== "string" || message.content.trim() === "") {
          logger.info("Skipping empty message", { role: message.role, requestId: req.id });
          continue;
        }
        messages.push({
          role: message.role,
          content: message.content,
        });
      }
    } catch (error) {
      logError(error as Error, { context: "parse_messages", requestId: req.id });
      return res.status(400).send("Bad Request");
    }

    if (messages.length === 0) {
      logError(new Error("No valid messages in request"), { context: "validate_messages", requestId: req.id });
      return res.status(400).send("Bad Request: No valid messages");
    }

    const body = {
      stream: true,
      model,
      max_tokens: 2000,
      messages,
    };

    try {
      logger.info("Sending chat request", {
        component: "server",
        model,
        messageCount: messages.length,
        requestId: req.id,
      });

      // Track credits usage
      creditsUsedCounter.inc({ tier, endpoint: "/v1/chat/completions", user_id: userId }, env.CREDITS_PER_CHAT);

      const startTime = Date.now();
      const response = await fetchWithRetry(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(env.TIMEOUT_CHAT),
      });

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Response body is not readable");
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      const decoder = new TextDecoder("utf-8");

      let combined = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          res.write("event: close\n");
          res.end();
          break;
        }

        const data = decoder.decode(value);
        const chunks = data.split("data:").filter((val) => !!val && val.trim() !== "[DONE]");

        for (const chunk of chunks) {
          // skip comments
          if (chunk.length > 0 && chunk[0] === ":") {
            continue;
          }
          combined += chunk;

          try {
            const json = JSON.parse(combined);
            combined = "";
            sendEvent(res, json, "/v1/chat/completions");
          } catch {
            // its normal for the last chunk to not be a full json object
          }
        }
      }

      // Track API call duration
      const duration = (Date.now() - startTime) / 1000;
      apiCallDuration.observe({ service: "openai", endpoint: "/v1/chat/completions", status: "success" }, duration);
    } catch (error) {
      apiCallErrors.inc({ service: "openai", endpoint: "/v1/chat/completions", error_type: (error as Error).name });
      logError(error as Error, { context: "chat_streaming", requestId: req.id });
      res.end();
    }

    // Close the connection when the client disconnects
    req.on("close", () => {
      try {
        res.end();
      } catch (error) {
        logError(error as Error, { context: "chat_stream_close", requestId: req.id });
      }
    });
  } catch {
    return res.status(500).json({ error: "Internal error" });
  }
});

const outOfCreditsAudios: Buffer[] = [];
for (let i = 1; i <= 5; i++) {
  const path = `./assets/outofcredits${i}.mp3`;
  if (fs.existsSync(path)) {
    outOfCreditsAudios.push(Buffer.from(fs.readFileSync(path)));
  }
}

app.post("/v1/audio/speech", [authorizationCheck(env.CREDITS_PER_TTS)], async (req: Request, res: Response) => {
  try {
    const accountInfo = res.locals.accountInfo;
    const tier = accountInfo.tier || "unknown";
    const userId = accountInfo.userId || "anonymous";

    creditsRemainingGauge.set({ user_id: userId, tier }, accountInfo.credits);

    if (accountInfo.credits < 0) {
      outOfCreditsCounter.inc({ tier, endpoint: "/v1/audio/speech" });
      if (outOfCreditsAudios.length > 0) {
        res.setHeader("Content-Type", "audio/mpeg");
        res.send(outOfCreditsAudios[Math.floor(Math.random() * outOfCreditsAudios.length)]);
      } else {
        res.status(402).json({ error: "Out of credits" });
      }
      return;
    }

    creditsUsedCounter.inc({ tier, endpoint: "/v1/audio/speech", user_id: userId }, env.CREDITS_PER_TTS);

    const apiUrl = env.FISH_URL;
    const referenceId = env.FISH_MODEL;

    // parse the request body
    const text = req.body.input;
    if (!text) {
      return res.status(400).json({ error: "No input text provided" });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.FISH_API_KEY}`,
    };

    const startTime = Date.now();
    const response = await fetchWithRetry(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        text,
        reference_id: referenceId,
        format: "mp3",
      }),
      signal: AbortSignal.timeout(env.TIMEOUT_FISH),
    });

    // Set headers before streaming
    res.setHeader("Content-Type", "audio/mpeg");
    if (response.headers.get("Content-Length")) {
      res.setHeader("Content-Length", response.headers.get("Content-Length")!);
    }

    // Stream the response directly instead of buffering
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Response body is not readable");
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        res.write(Buffer.from(value));
      }
      res.end();

      const duration = (Date.now() - startTime) / 1000;
      apiCallDuration.observe({ service: "fish", endpoint: "/v1/audio/speech", status: "success" }, duration);
    } catch (error) {
      apiCallErrors.inc({ service: "fish", endpoint: "/v1/audio/speech", error_type: (error as Error).name });
      logError(error as Error, { context: "tts_streaming", requestId: req.id });
      throw error;
    }
  } catch {
    return res.status(500).json({ error: "Internal error" });
  }
});

// TODO fireworks returns 400 for this, only groq works?
// figure out how to enable fireworks
app.post(
  "/v1/audio/transcriptions",
  [upload.single("file"), authorizationCheck(env.CREDITS_PER_STT)],
  async (req: Request, res: Response) => {
    try {
      const accountInfo = res.locals.accountInfo;
      const tier = accountInfo.tier || "unknown";
      const userId = accountInfo.userId || "anonymous";

      creditsRemainingGauge.set({ user_id: userId, tier }, accountInfo.credits);

      if (accountInfo.credits < 0) {
        outOfCreditsCounter.inc({ tier, endpoint: "/v1/audio/transcriptions" });
        return res.json({
          text: "You have run out of credits. Please top up your account to continue using this service.",
        });
      }

      creditsUsedCounter.inc({ tier, endpoint: "/v1/audio/transcriptions", user_id: userId }, env.CREDITS_PER_STT);

      const apiUrl = env.OPENAI_WHISPER_URL;
      const model = env.OPENAI_WHISPER_MODEL;

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const form = new FormData();
      const buffer = fs.readFileSync(req.file!.path);
      const blob = new Blob([buffer], { type: req.file.mimetype });
      form.append("file", blob, req.file.originalname);
      form.append("prompt", req.body.prompt || "");
      form.append("model", model);
      form.append("temperature", req.body.temperature || "0");
      form.append("response_format", req.body.response_format || "json");
      form.append("language", req.body.language || "en");

      const headers: Record<string, string> = {
        Authorization: `Bearer ${env.OPENAI_WHISPER_API_KEY}`,
      };

      const startTime = Date.now();
      const response = await fetchWithRetry(apiUrl, {
        method: "POST",
        headers,
        body: form,
        signal: AbortSignal.timeout(env.TIMEOUT_WHISPER),
      });

      const duration = (Date.now() - startTime) / 1000;
      apiCallDuration.observe({ service: "openai", endpoint: "/v1/audio/transcriptions", status: "success" }, duration);

      const data = await response.json();
      data.x_groq = undefined; // delete
      return res.json(data);
    } catch {
      return res.status(500).json({ error: "Internal error" });
    }
  },
);

// The error handler must be registered before any other error middleware and after all controllers
Sentry.setupExpressErrorHandler(app);

// Error handlers (must be last)
app.use(errorHandler());

export { app };
