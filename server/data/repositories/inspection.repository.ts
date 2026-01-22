/**
 * =============================================================================
 * FILE: server/data/repositories/inspection.repository.ts
 * LAYER: DATA ACCESS (Layer 4)
 * =============================================================================
 * 
 * PURPOSE:
 * Provides data access operations for Food Safety Inspections.
 * Handles all CRUD operations for inspection-related database tables.
 * 
 * REAL-WORLD MEANING:
 * Inspections are official regulatory visits to Food Business Operators (FBOs).
 * They generate legally binding records that may be used as evidence in court.
 * Inspections are bound to jurisdictions, not officers, ensuring data continuity.
 * 
 * WHAT THIS FILE MUST DO:
 * - Provide CRUD operations for inspections table
 * - Support querying inspections by jurisdiction, status, date range
 * - Handle inspection-related data (deviations, actions, samples)
 * - Preserve historical inspection data
 * 
 * WHAT THIS FILE MUST NOT DO:
 * - Validate inspection workflow transitions (that's domain logic)
 * - Check officer authority (that's domain logic)
 * - Apply business rules about inspection status (that's domain logic)
 * - Handle HTTP requests or responses
 * 
 * AUDIT & COURT SAFETY:
 * - Inspection records become IMMUTABLE once status is "closed"
 * - Historical inspection data must NEVER be overwritten
 * - All modifications must create audit trail entries
 * - Closed inspections can only be viewed, never modified
 * 
 * DEPENDENT SYSTEMS:
 * - server/domain/inspection/inspection.service.ts uses this for business operations
 * - server/api/routes/inspection.routes.ts exposes HTTP endpoints
 * =============================================================================
 */

import { eq, and, desc, asc, sql, gte, lte, ilike, or } from "drizzle-orm";
import { db, ListOptions, PaginatedResult, createAuditTimestamp } from "./base.repository";
import { inspections } from "../../../shared/schema";

/**
 * Inspection data as stored in database.
 */
export type InspectionRecord = typeof inspections.$inferSelect;
export type NewInspectionRecord = typeof inspections.$inferInsert;

/**
 * Extended filter options for inspection queries.
 */
export interface InspectionFilterOptions extends ListOptions {
  jurisdictionId?: string;
  status?: string;
  officerId?: string;
  fromDate?: Date;
  toDate?: Date;
}

/**
 * Inspection Repository - Data access for inspection entities.
 * 
 * WHY: Centralizes all inspection-related database operations.
 * WHO: Used by InspectionService in the domain layer.
 * RULES: Only performs data operations, no business logic.
 * 
 * IMMUTABILITY WARNING:
 * This repository provides update methods, but the DOMAIN LAYER
 * must enforce that closed inspections cannot be modified.
 */
export const inspectionRepository = {
  /**
   * Finds an inspection by its unique ID.
   * 
   * WHY: Core lookup operation for inspection data.
   * WHO: Called by domain services when inspection data is needed.
   * RESULT: Inspection record or null if not found.
   */
  async findById(id: string): Promise<InspectionRecord | null> {
    const result = await db.select().from(inspections).where(eq(inspections.id, id)).limit(1);
    return result[0] || null;
  },

  /**
   * Lists inspections with filtering and pagination.
   * 
   * WHY: Supports inspection list views in mobile app and admin panel.
   * WHO: Called by InspectionService for listing operations.
   * RESULT: Paginated list of inspections matching filters.
   */
  async findAll(options: InspectionFilterOptions = {}): Promise<PaginatedResult<InspectionRecord>> {
    const { 
      page = 1, 
      pageSize = 20, 
      sortOrder = "desc",
      jurisdictionId,
      status,
      officerId,
      fromDate,
      toDate,
    } = options;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    
    if (jurisdictionId) {
      conditions.push(eq(inspections.jurisdictionId, jurisdictionId));
    }
    if (status) {
      conditions.push(eq(inspections.status, status));
    }
    if (officerId) {
      conditions.push(eq(inspections.officerId, officerId));
    }
    if (fromDate) {
      conditions.push(gte(inspections.createdAt, fromDate));
    }
    if (toDate) {
      conditions.push(lte(inspections.createdAt, toDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      db.select()
        .from(inspections)
        .where(whereClause)
        .orderBy(sortOrder === "asc" ? asc(inspections.createdAt) : desc(inspections.createdAt))
        .limit(pageSize)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` })
        .from(inspections)
        .where(whereClause),
    ]);

    const total = Number(countResult[0]?.count || 0);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  },

  /**
   * Finds all inspections for a specific jurisdiction.
   * 
   * WHY: Inspections are jurisdiction-bound for data continuity.
   * WHO: Called when loading inspections for an officer's active jurisdiction.
   * RESULT: Array of inspections in that jurisdiction.
   */
  async findByJurisdiction(jurisdictionId: string): Promise<InspectionRecord[]> {
    return db.select()
      .from(inspections)
      .where(eq(inspections.jurisdictionId, jurisdictionId))
      .orderBy(desc(inspections.createdAt));
  },

  /**
   * Creates a new inspection record.
   * 
   * WHY: Initiates the inspection workflow when an officer starts an inspection.
   * WHO: Called when an officer creates a new inspection.
   * RULES: Must include jurisdictionId for data binding.
   * RESULT: The created inspection record.
   */
  async create(data: NewInspectionRecord): Promise<InspectionRecord> {
    const result = await db.insert(inspections).values({
      ...data,
      createdAt: createAuditTimestamp(),
      updatedAt: createAuditTimestamp(),
    }).returning();
    return result[0];
  },

  /**
   * Updates an existing inspection record.
   * 
   * WHY: Allows modification of inspection data during active workflow.
   * WHO: Called for status updates, adding findings, etc.
   * 
   * CRITICAL WARNING:
   * The DOMAIN LAYER must check if inspection is closed before calling this.
   * Closed inspections are IMMUTABLE for legal compliance.
   * This repository method does NOT enforce that rule - it just persists data.
   * 
   * RESULT: The updated inspection record or null if not found.
   */
  async update(id: string, data: Partial<NewInspectionRecord>): Promise<InspectionRecord | null> {
    const result = await db.update(inspections)
      .set({
        ...data,
        updatedAt: createAuditTimestamp(),
      })
      .where(eq(inspections.id, id))
      .returning();
    return result[0] || null;
  },

  /**
   * Counts inspections by status for a jurisdiction.
   * 
   * WHY: Provides statistics for dashboard displays.
   * WHO: Called by dashboard and reporting services.
   * RESULT: Object with counts per status.
   */
  async countByStatus(jurisdictionId: string): Promise<Record<string, number>> {
    const result = await db.select({
      status: inspections.status,
      count: sql<number>`count(*)`,
    })
    .from(inspections)
    .where(eq(inspections.jurisdictionId, jurisdictionId))
    .groupBy(inspections.status);

    return result.reduce((acc, row) => {
      acc[row.status] = Number(row.count);
      return acc;
    }, {} as Record<string, number>);
  },

  /**
   * Searches inspections by FBO name or address.
   * 
   * WHY: Supports search functionality in mobile app.
   * WHO: Called from search UI.
   * RESULT: Matching inspection records.
   */
  async search(query: string, jurisdictionId: string, limit: number = 20): Promise<InspectionRecord[]> {
    return db.select()
      .from(inspections)
      .where(and(
        eq(inspections.jurisdictionId, jurisdictionId),
        eq(inspections.type, query)
      ))
      .orderBy(desc(inspections.createdAt))
      .limit(limit);
  },
};
