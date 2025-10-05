import promBundle from "express-prom-bundle";
import { register } from "@/metrics";

const metricsMiddleware = promBundle({
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

export default metricsMiddleware;
