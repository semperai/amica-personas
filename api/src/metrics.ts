import * as promClient from "prom-client";

// create custom prometheus registry
export const register = new promClient.Registry();

// Define authentication and credit usage metrics
export const authMetrics = new promClient.Counter({
  name: "api_requests_total",
  help: "Total number of API requests",
  labelNames: ["tier", "endpoint"],
  registers: [register],
});

// Credits usage metrics
export const creditsUsedCounter = new promClient.Counter({
  name: "credits_used_total",
  help: "Total credits consumed by API calls",
  labelNames: ["tier", "endpoint", "user_id"],
  registers: [register],
});

export const creditsRemainingGauge = new promClient.Gauge({
  name: "credits_remaining",
  help: "Remaining credits for users",
  labelNames: ["user_id", "tier"],
  registers: [register],
});

// API operation metrics
export const apiCallDuration = new promClient.Histogram({
  name: "api_call_duration_seconds",
  help: "Duration of API calls to external services",
  labelNames: ["service", "endpoint", "status"],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const apiCallErrors = new promClient.Counter({
  name: "api_call_errors_total",
  help: "Total number of API call errors",
  labelNames: ["service", "endpoint", "error_type"],
  registers: [register],
});

// Streaming metrics
export const streamingEventsCounter = new promClient.Counter({
  name: "streaming_events_total",
  help: "Total number of streaming events sent",
  labelNames: ["endpoint"],
  registers: [register],
});

// Out of credits events
export const outOfCreditsCounter = new promClient.Counter({
  name: "out_of_credits_total",
  help: "Total number of out-of-credits events",
  labelNames: ["tier", "endpoint"],
  registers: [register],
});

// Endpoint health metrics
export const endpointHealthGauge = new promClient.Gauge({
  name: "endpoint_health_status",
  help: "Health status of API endpoints (1 = healthy, 0 = unhealthy)",
  labelNames: ["endpoint", "dependency"],
  registers: [register],
});

export const endpointResponseTimeGauge = new promClient.Gauge({
  name: "endpoint_response_time_ms",
  help: "Response time of dependencies in milliseconds",
  labelNames: ["dependency"],
  registers: [register],
});

// Request success/failure metrics
export const requestSuccessCounter = new promClient.Counter({
  name: "request_success_total",
  help: "Total number of successful requests",
  labelNames: ["endpoint", "status_code"],
  registers: [register],
});

export const requestFailureCounter = new promClient.Counter({
  name: "request_failure_total",
  help: "Total number of failed requests",
  labelNames: ["endpoint", "status_code", "error_type"],
  registers: [register],
});
