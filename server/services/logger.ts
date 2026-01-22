/**
 * =============================================================================
 * PRODUCTION-GRADE LOGGING SERVICE
 * =============================================================================
 * 
 * Centralized logging with Winston for structured, searchable logs.
 */

import winston from "winston";

const { combine, timestamp, printf, colorize, json } = winston.format;

/**
 * Custom log format for development
 */
const devFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : "";
  return `${timestamp} [${level}]: ${message} ${metaStr}`;
});

/**
 * Create Winston logger instance
 */
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  defaultMeta: {
    service: "food-safety-inspector",
    environment: process.env.NODE_ENV || "development",
  },
  transports: [
    // Console transport for all environments
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        devFormat
      ),
    }),
  ],
});

// Add file transports for production
if (process.env.NODE_ENV === "production") {
  logger.add(
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      format: combine(timestamp(), json()),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    })
  );

  logger.add(
    new winston.transports.File({
      filename: "logs/combined.log",
      format: combine(timestamp(), json()),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
    })
  );
}

/**
 * Request logging helper
 */
export function logRequest(req: any, res: any, duration: number) {
  const logData = {
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    duration: `${duration}ms`,
    ip: req.ip,
    userAgent: req.get("user-agent")?.substring(0, 100),
  };

  if (res.statusCode >= 500) {
    logger.error("Request failed", logData);
  } else if (res.statusCode >= 400) {
    logger.warn("Client error", logData);
  } else {
    logger.info("Request completed", logData);
  }
}

/**
 * Database query logger
 */
export function logQuery(query: string, duration: number) {
  if (process.env.LOG_QUERIES === "true") {
    logger.debug("Database query", {
      query: query.substring(0, 500),
      duration: `${duration}ms`,
    });
  }
}

/**
 * Security event logger
 */
export function logSecurityEvent(event: string, details: any) {
  logger.warn(`Security event: ${event}`, details);
}

export default logger;
