/**
 * =============================================================================
 * PRODUCTION-GRADE SECURITY MIDDLEWARE
 * =============================================================================
 * 
 * Provides comprehensive security for the Food Safety Inspector API:
 * - Rate limiting to prevent abuse
 * - Helmet for HTTP security headers
 * - Input sanitization to prevent XSS/injection
 * - Request validation
 */

import type { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

/**
 * Rate limiter for general API endpoints
 * Allows 100 requests per 15 minutes per IP
 */
export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again after 15 minutes",
    code: "RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === "/api/health";
  },
});

/**
 * Stricter rate limiter for authentication endpoints
 * Allows 5 login attempts per 15 minutes per IP
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Only 5 attempts
  message: {
    error: "Too many login attempts, please try again after 15 minutes",
    code: "AUTH_RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for file upload endpoints
 * Allows 20 uploads per hour per IP
 */
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: {
    error: "Too many file uploads, please try again later",
    code: "UPLOAD_RATE_LIMIT_EXCEEDED",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Helmet configuration for security headers
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for mobile app compatibility
  crossOriginResourcePolicy: { policy: "cross-origin" },
});

/**
 * Sanitizes string input to prevent XSS attacks
 */
export function sanitizeString(input: string): string {
  if (typeof input !== "string") return input;
  return input
    .replace(/[<>]/g, "") // Remove < and >
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+=/gi, "") // Remove event handlers
    .trim();
}

/**
 * Deep sanitizes an object recursively
 */
export function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return sanitizeString(obj);
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  
  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[sanitizeString(key)] = sanitizeObject(value);
  }
  return sanitized;
}

/**
 * Input sanitization middleware
 * Sanitizes req.body, req.query, and req.params
 */
export function inputSanitizer(req: Request, _res: Response, next: NextFunction) {
  // Only sanitize body - query and params are read-only in Express
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}

/**
 * Validates that required fields exist in request body
 */
export function validateRequiredFields(fields: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const missing = fields.filter((field) => {
      const value = req.body[field];
      return value === undefined || value === null || value === "";
    });

    if (missing.length > 0) {
      return res.status(400).json({
        error: "Validation failed",
        code: "MISSING_REQUIRED_FIELDS",
        fields: missing,
        message: `Missing required fields: ${missing.join(", ")}`,
      });
    }
    next();
  };
}

/**
 * Validates UUID format
 */
export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Validates email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates phone number format (Indian format)
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(phone.replace(/[\s-]/g, ""));
}

/**
 * Security context for audit logging
 */
export interface SecurityContext {
  ip: string;
  userAgent: string;
  timestamp: Date;
  requestId: string;
}

/**
 * Extracts security context from request
 */
export function getSecurityContext(req: Request): SecurityContext {
  return {
    ip: req.ip || req.socket.remoteAddress || "unknown",
    userAgent: req.get("user-agent") || "unknown",
    timestamp: new Date(),
    requestId: req.headers["x-request-id"] as string || generateRequestId(),
  };
}

/**
 * Generates a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Request ID middleware
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers["x-request-id"] as string || generateRequestId();
  req.headers["x-request-id"] = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}
