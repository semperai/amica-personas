import type { ErrorRequestHandler, RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import { apiCallErrors } from "@/metrics";
import { logError } from "@/utils/logger";

const unexpectedRequest: RequestHandler = (req, res) => {
  logError(new Error("Route not found"), {
    path: req.path,
    method: req.method,
    requestId: req.id,
  });
  res.sendStatus(StatusCodes.NOT_FOUND);
};

const addErrorToRequestLog: ErrorRequestHandler = (err, req, res, next) => {
  res.locals.err = err;

  // Log error with full context
  logError(err, {
    requestId: req.id,
    path: req.path,
    method: req.method,
    userId: res.locals.accountInfo?.userId,
    tier: res.locals.accountInfo?.tier,
    statusCode: res.statusCode,
  });

  // Track error metrics
  apiCallErrors.inc({
    service: "api",
    endpoint: req.path,
    error_type: err.name || "UnknownError",
  });

  next(err);
};

export default () => [unexpectedRequest, addErrorToRequestLog];
