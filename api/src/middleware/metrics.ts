import type { NextFunction, Request, Response } from "express";
import promBundle from "express-prom-bundle";
import * as promClient from "prom-client";

// create custom prometheus registry
const register = new promClient.Registry();

// for each route, define a histogram metric to track request duration
const routeMetrics = {
  chatCompletions: new promClient.Histogram({
    name: "chat_completions_duration_seconds",
    help: "Duration of requests to /v1/chat/completions in seconds",
    buckets: [0.1, 0.5, 1, 2, 5, 10],
    registers: [register],
  }),
  audioSpeech: new promClient.Histogram({
    name: "audio_speech_duration_seconds",
    help: "Duration of requests to /v1/audio/speech in seconds",
    buckets: [0.1, 0.5, 1, 2, 5, 10],
    registers: [register],
  }),
  audioTranscriptions: new promClient.Histogram({
    name: "audio_transcriptions_duration_seconds",
    help: "Duration of requests to /v1/audio/transcriptions in seconds",
    buckets: [0.1, 0.5, 1, 2, 5, 10],
    registers: [register],
  }),
};

// Define authentication and credit usage metrics
const authMetrics = new promClient.Counter({
  name: "api_requests_total",
  help: "Total number of API requests",
  labelNames: ["route", "auth_method", "tier"],
  registers: [register],
});

const creditUsageMetrics = new promClient.Counter({
  name: "credit_usage_total",
  help: "Total credit usage",
  labelNames: ["route", "tier"],
  registers: [register],
});

// Set up the express-prom-bundle middleware
const _metricsMiddleware = promBundle({
  includeMethod: true,
  includePath: true,
  includeStatusCode: true,
  includeUp: true,
  customLabels: { project_name: "api-heyamica-com" },
  promClient: {
    collectDefaultMetrics: {
      register,
    },
  },
});

// Middleware to measure request duration and track metrics
const measureDuration = (routeName: keyof typeof routeMetrics) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = (Date.now() - start) / 1000; // Convert to seconds
      routeMetrics[routeName].observe(duration);

      // TODO get anon, fee, pro
      const authMethod = req.headers.authorization ? "api_key" : "anon";
      const tier = authMethod === "api_key" ? "authenticated" : "anon";

      // Increment request counter
      authMetrics.labels(routeName, authMethod, tier).inc();

      // TODO track credit usage instead of sim
      const creditsUsed = Math.floor(Math.random() * 10) + 1;
      creditUsageMetrics.labels(routeName, tier).inc(creditsUsed);
    });
    next();
  };
};

export default measureDuration;
