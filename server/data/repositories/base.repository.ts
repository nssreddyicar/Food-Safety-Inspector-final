/**
 * =============================================================================
 * FILE: server/data/repositories/base.repository.ts
 * LAYER: DATA ACCESS (Layer 4)
 * =============================================================================
 * 
 * PURPOSE:
 * Provides base repository utilities and types for all data access operations.
 * This file establishes the foundation for consistent database interactions
 * across all domain repositories.
 * 
 * WHAT THIS FILE MUST DO:
 * - Export database connection for use by repositories
 * - Provide common query utilities
 * - Define base types for repository operations
 * 
 * WHAT THIS FILE MUST NOT DO:
 * - Contain business logic or workflow rules
 * - Make decisions about data validity (that's the domain layer's job)
 * - Handle HTTP requests or responses
 * - Define UI-related types
 * 
 * DEPENDENT SYSTEMS:
 * - All repositories in server/data/repositories/* extend from here
 * - server/domain/* services use repositories for data operations
 * 
 * AUDIT & COURT SAFETY:
 * - All repositories must support audit logging
 * - Historical data must never be overwritten
 * - All modifications must be traceable
 * =============================================================================
 */

import { db } from "../../db";

/**
 * Re-export database connection for repository use.
 * 
 * WHY: Centralizes database access through a single export point.
 * WHO: All domain-specific repositories use this connection.
 * RULES: Never bypass this export for direct database access.
 */
export { db };

/**
 * Common result type for paginated queries.
 * 
 * WHY: Standardizes pagination across all list operations.
 * WHO: Used by any repository method that returns paginated data.
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Common filter options for list queries.
 * 
 * WHY: Provides consistent filtering interface across repositories.
 * WHO: Used by service layer when requesting filtered data.
 */
export interface ListOptions {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

/**
 * Result type for operations that may fail gracefully.
 * 
 * WHY: Allows repositories to return errors without throwing exceptions.
 * WHO: Used when operations may fail for expected reasons.
 */
export type RepositoryResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Audit metadata that must accompany all write operations.
 * 
 * WHY: Every data modification must be traceable for court admissibility.
 * WHO: All create/update/delete operations must include this metadata.
 * RULES: Never perform writes without audit context.
 */
export interface AuditContext {
  performedBy: string;      // Officer ID or "SYSTEM"
  performedAt: Date;        // Timestamp of operation
  reason?: string;          // Optional reason for the operation
  ipAddress?: string;       // Client IP if available
}

/**
 * Creates a standardized audit timestamp for database operations.
 * 
 * WHY: Ensures consistent timestamp format across all repositories.
 * WHO: Called by repositories before write operations.
 * RESULT: Current timestamp in database-compatible format.
 */
export function createAuditTimestamp(): Date {
  return new Date();
}
