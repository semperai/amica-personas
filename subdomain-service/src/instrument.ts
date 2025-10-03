import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: "https://ed27a15ad711c3f64ecfc52c8aba7d24@o4510123266998272.ingest.us.sentry.io/4510123492573189",

  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
});
