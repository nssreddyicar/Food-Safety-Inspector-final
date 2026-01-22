/**
 * =============================================================================
 * AUDIT TRAIL MIDDLEWARE
 * =============================================================================
 * 
 * Provides comprehensive audit logging for all data changes.
 * Essential for legal compliance and court admissibility.
 */

import type { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Audit log entry structure
 */
export interface AuditLogEntry {
  id?: number;
  timestamp: Date;
  action: "CREATE" | "UPDATE" | "DELETE" | "READ" | "LOGIN" | "LOGOUT" | "EXPORT";
  entityType: string;
  entityId: string | null;
  officerId: string | null;
  ipAddress: string;
  userAgent: string;
  requestPath: string;
  requestMethod: string;
  oldValues: any | null;
  newValues: any | null;
  metadata: any | null;
}

/**
 * In-memory audit buffer for batch writing
 */
const auditBuffer: AuditLogEntry[] = [];
const BUFFER_FLUSH_INTERVAL = 5000; // 5 seconds
const MAX_BUFFER_SIZE = 100;

/**
 * Flush audit buffer to database
 */
async function flushAuditBuffer() {
  if (auditBuffer.length === 0) return;

  const entries = auditBuffer.splice(0, auditBuffer.length);
  
  try {
    for (const entry of entries) {
      await db.execute(sql`
        INSERT INTO audit_logs (
          timestamp, action, entity_type, entity_id, officer_id,
          ip_address, user_agent, request_path, request_method,
          old_values, new_values, metadata
        ) VALUES (
          ${entry.timestamp}, ${entry.action}, ${entry.entityType}, ${entry.entityId},
          ${entry.officerId}, ${entry.ipAddress}, ${entry.userAgent},
          ${entry.requestPath}, ${entry.requestMethod},
          ${JSON.stringify(entry.oldValues)}, ${JSON.stringify(entry.newValues)},
          ${JSON.stringify(entry.metadata)}
        )
      `);
    }
  } catch (error) {
    // Log to console as fallback if DB write fails
    console.error("[AUDIT] Failed to write audit logs to database:", error);
    console.log("[AUDIT] Fallback entries:", JSON.stringify(entries, null, 2));
  }
}

// Periodic flush
setInterval(flushAuditBuffer, BUFFER_FLUSH_INTERVAL);

/**
 * Creates an audit log entry
 */
export function createAuditLog(entry: Omit<AuditLogEntry, "id" | "timestamp">) {
  const fullEntry: AuditLogEntry = {
    ...entry,
    timestamp: new Date(),
  };

  auditBuffer.push(fullEntry);

  // Flush if buffer is full
  if (auditBuffer.length >= MAX_BUFFER_SIZE) {
    flushAuditBuffer();
  }

  // Also log to console for immediate visibility
  console.log(`[AUDIT] ${entry.action} ${entry.entityType} ${entry.entityId || ""} by ${entry.officerId || "system"}`);
}

/**
 * Extracts officer ID from request (supports various auth methods)
 */
function getOfficerIdFromRequest(req: Request): string | null {
  // From query param (mobile app)
  if (req.query.officerId) return req.query.officerId as string;
  
  // From body (for create/update operations)
  if (req.body?.officerId) return req.body.officerId;
  
  // From authorization header (JWT token)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.split(" ")[1];
      const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
      return payload.officerId || null;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Determines action type from HTTP method
 */
function getActionFromMethod(method: string): AuditLogEntry["action"] {
  switch (method.toUpperCase()) {
    case "POST": return "CREATE";
    case "PUT":
    case "PATCH": return "UPDATE";
    case "DELETE": return "DELETE";
    case "GET":
    default: return "READ";
  }
}

/**
 * Extracts entity type from request path
 */
function getEntityTypeFromPath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  // /api/inspections/123 -> inspections
  // /api/samples -> samples
  if (parts[0] === "api" && parts[1]) {
    return parts[1].replace(/-/g, "_");
  }
  return "unknown";
}

/**
 * Audit middleware for automatic logging of API calls
 */
export function auditMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip audit for non-mutating requests on specific paths
  const skipPaths = ["/api/health", "/api/admin/check", "/assets", "/static-build"];
  if (skipPaths.some((p) => req.path.startsWith(p))) {
    return next();
  }

  // Skip GET requests except for sensitive data
  const sensitiveReadPaths = ["/api/officer/me", "/api/officers/"];
  const isReadRequest = req.method === "GET";
  const isSensitiveRead = sensitiveReadPaths.some((p) => req.path.startsWith(p));
  
  if (isReadRequest && !isSensitiveRead) {
    return next();
  }

  // Capture original response
  const originalSend = res.send;
  let responseBody: any;

  res.send = function (body: any) {
    responseBody = body;
    return originalSend.call(this, body);
  };

  // Log after response is sent
  res.on("finish", () => {
    // Only log successful mutations or sensitive reads
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const action = getActionFromMethod(req.method);
      const entityType = getEntityTypeFromPath(req.path);
      const entityId = typeof req.params.id === 'string' ? req.params.id : null;

      createAuditLog({
        action,
        entityType,
        entityId,
        officerId: getOfficerIdFromRequest(req),
        ipAddress: req.ip || req.socket.remoteAddress || "unknown",
        userAgent: req.get("user-agent") || "unknown",
        requestPath: req.path,
        requestMethod: req.method,
        oldValues: null, // Would need to fetch before update for full tracking
        newValues: action !== "READ" ? req.body : null,
        metadata: {
          statusCode: res.statusCode,
          queryParams: req.query,
        },
      });
    }
  });

  next();
}

/**
 * Logs authentication events
 */
export function logAuthEvent(
  type: "LOGIN" | "LOGOUT",
  officerId: string | null,
  req: Request,
  success: boolean,
  reason?: string
) {
  createAuditLog({
    action: type,
    entityType: "authentication",
    entityId: officerId,
    officerId,
    ipAddress: req.ip || req.socket.remoteAddress || "unknown",
    userAgent: req.get("user-agent") || "unknown",
    requestPath: req.path,
    requestMethod: req.method,
    oldValues: null,
    newValues: null,
    metadata: {
      success,
      reason,
    },
  });
}

/**
 * Logs data export events (for compliance)
 */
export function logExportEvent(
  entityType: string,
  officerId: string,
  req: Request,
  recordCount: number
) {
  createAuditLog({
    action: "EXPORT",
    entityType,
    entityId: null,
    officerId,
    ipAddress: req.ip || req.socket.remoteAddress || "unknown",
    userAgent: req.get("user-agent") || "unknown",
    requestPath: req.path,
    requestMethod: req.method,
    oldValues: null,
    newValues: null,
    metadata: {
      recordCount,
      exportFormat: req.query.format || "json",
    },
  });
}
