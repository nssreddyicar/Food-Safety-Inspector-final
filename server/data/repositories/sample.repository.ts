/**
 * =============================================================================
 * FILE: server/data/repositories/sample.repository.ts
 * LAYER: DATA ACCESS (Layer 4)
 * =============================================================================
 * 
 * PURPOSE:
 * Provides data access operations for Food Samples collected during inspections.
 * Handles all CRUD operations for sample-related database tables.
 * 
 * REAL-WORLD MEANING:
 * Samples are physical food specimens collected by officers for laboratory testing.
 * They follow a strict chain-of-custody workflow and generate legally binding results.
 * Sample data is critical evidence in prosecution cases.
 * 
 * WHAT THIS FILE MUST DO:
 * - Provide CRUD operations for samples table
 * - Support querying samples by inspection, jurisdiction, status
 * - Track sample workflow state transitions
 * - Preserve complete sample history
 * 
 * WHAT THIS FILE MUST NOT DO:
 * - Validate sample workflow transitions (that's domain logic)
 * - Enforce chain-of-custody rules (that's domain logic)
 * - Calculate lab report deadlines (that's domain logic)
 * - Handle HTTP requests or responses
 * 
 * AUDIT & COURT SAFETY:
 * - Sample records become IMMUTABLE after dispatch to laboratory
 * - All sample state changes must be logged in workflow state table
 * - Sample codes must be unique and traceable
 * - Historical sample data must NEVER be overwritten
 * 
 * DEPENDENT SYSTEMS:
 * - server/domain/sample/sample.service.ts uses this for business operations
 * - server/api/routes/sample.routes.ts exposes HTTP endpoints
 * =============================================================================
 */

import { eq, and, desc, asc, sql, gte, lte, ilike } from "drizzle-orm";
import { db, ListOptions, PaginatedResult, createAuditTimestamp } from "./base.repository";
import { samples, sampleWorkflowState, sampleCodes, sampleCodeAuditLog } from "../../../shared/schema";

/**
 * Sample data as stored in database.
 */
export type SampleRecord = typeof samples.$inferSelect;
export type NewSampleRecord = typeof samples.$inferInsert;

/**
 * Sample workflow state record.
 */
export type SampleWorkflowStateRecord = typeof sampleWorkflowState.$inferSelect;

/**
 * Extended filter options for sample queries.
 */
export interface SampleFilterOptions extends ListOptions {
  jurisdictionId?: string;
  inspectionId?: string;
  status?: string;
  sampleType?: string;
  fromDate?: Date;
  toDate?: Date;
}

/**
 * Sample Repository - Data access for sample entities.
 * 
 * WHY: Centralizes all sample-related database operations.
 * WHO: Used by SampleService in the domain layer.
 * RULES: Only performs data operations, no business logic.
 * 
 * IMMUTABILITY WARNING:
 * Samples cannot be modified after dispatch to laboratory.
 * The DOMAIN LAYER must enforce this rule before calling update methods.
 */
export const sampleRepository = {
  /**
   * Finds a sample by its unique ID.
   * 
   * WHY: Core lookup operation for sample data.
   * WHO: Called by domain services when sample data is needed.
   * RESULT: Sample record or null if not found.
   */
  async findById(id: string): Promise<SampleRecord | null> {
    const result = await db.select().from(samples).where(eq(samples.id, id)).limit(1);
    return result[0] || null;
  },

  /**
   * Finds a sample by its unique sample code.
   * 
   * WHY: Sample codes are the primary identifier used in field operations.
   * WHO: Called during barcode/QR scanning or manual lookup.
   * RESULT: Sample record or null if not found.
   */
  async findByCode(sampleCode: string): Promise<SampleRecord | null> {
    const result = await db.select().from(samples).where(eq(samples.code, sampleCode)).limit(1);
    return result[0] || null;
  },

  /**
   * Lists samples with filtering and pagination.
   * 
   * WHY: Supports sample list views in mobile app and admin panel.
   * WHO: Called by SampleService for listing operations.
   * RESULT: Paginated list of samples matching filters.
   */
  async findAll(options: SampleFilterOptions = {}): Promise<PaginatedResult<SampleRecord>> {
    const { 
      page = 1, 
      pageSize = 20, 
      sortOrder = "desc",
      jurisdictionId,
      inspectionId,
      status,
      sampleType,
      fromDate,
      toDate,
    } = options;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    
    if (jurisdictionId) {
      conditions.push(eq(samples.jurisdictionId, jurisdictionId));
    }
    if (inspectionId) {
      conditions.push(eq(samples.inspectionId, inspectionId));
    }
    if (status) {
      conditions.push(eq(samples.status, status));
    }
    if (sampleType) {
      conditions.push(eq(samples.sampleType, sampleType));
    }
    if (fromDate) {
      conditions.push(gte(samples.liftedDate, fromDate));
    }
    if (toDate) {
      conditions.push(lte(samples.liftedDate, toDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      db.select()
        .from(samples)
        .where(whereClause)
        .orderBy(sortOrder === "asc" ? asc(samples.liftedDate) : desc(samples.liftedDate))
        .limit(pageSize)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` })
        .from(samples)
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
   * Finds all samples for a specific inspection.
   * 
   * WHY: Samples are linked to the inspection during which they were collected.
   * WHO: Called when viewing inspection details.
   * RESULT: Array of samples from that inspection.
   */
  async findByInspection(inspectionId: string): Promise<SampleRecord[]> {
    return db.select()
      .from(samples)
      .where(eq(samples.inspectionId, inspectionId))
      .orderBy(desc(samples.liftedDate));
  },

  /**
   * Finds all samples for a specific jurisdiction.
   * 
   * WHY: Samples are jurisdiction-bound for data continuity.
   * WHO: Called when loading samples for an officer's active jurisdiction.
   * RESULT: Array of samples in that jurisdiction.
   */
  async findByJurisdiction(jurisdictionId: string): Promise<SampleRecord[]> {
    return db.select()
      .from(samples)
      .where(eq(samples.jurisdictionId, jurisdictionId))
      .orderBy(desc(samples.liftedDate));
  },

  /**
   * Creates a new sample record.
   * 
   * WHY: Records a new sample collected during inspection.
   * WHO: Called when an officer lifts a sample.
   * RULES: Must include unique sample code and inspection reference.
   * RESULT: The created sample record.
   */
  async create(data: NewSampleRecord): Promise<SampleRecord> {
    const result = await db.insert(samples).values({
      ...data,
      createdAt: createAuditTimestamp(),
      updatedAt: createAuditTimestamp(),
    }).returning();
    return result[0];
  },

  /**
   * Updates an existing sample record.
   * 
   * WHY: Allows modification of sample data during active workflow.
   * WHO: Called for status updates, lab result entry, etc.
   * 
   * CRITICAL WARNING:
   * The DOMAIN LAYER must check if sample is dispatched before calling this.
   * Dispatched samples are IMMUTABLE for chain-of-custody compliance.
   * This repository method does NOT enforce that rule - it just persists data.
   * 
   * RESULT: The updated sample record or null if not found.
   */
  async update(id: string, data: Partial<NewSampleRecord>): Promise<SampleRecord | null> {
    const result = await db.update(samples)
      .set({
        ...data,
        updatedAt: createAuditTimestamp(),
      })
      .where(eq(samples.id, id))
      .returning();
    return result[0] || null;
  },

  /**
   * Gets the workflow state history for a sample.
   * 
   * WHY: Provides complete audit trail of sample lifecycle.
   * WHO: Called for audit reports and tracking.
   * RESULT: Array of workflow state records in chronological order.
   */
  async getWorkflowHistory(sampleId: string): Promise<SampleWorkflowStateRecord[]> {
    return db.select()
      .from(sampleWorkflowState)
      .where(eq(sampleWorkflowState.sampleId, sampleId))
      .orderBy(asc(sampleWorkflowState.enteredAt));
  },

  /**
   * Counts samples by status for a jurisdiction.
   * 
   * WHY: Provides statistics for dashboard displays.
   * WHO: Called by dashboard and reporting services.
   * RESULT: Object with counts per status.
   */
  async countByStatus(jurisdictionId: string): Promise<Record<string, number>> {
    const result = await db.select({
      status: samples.status,
      count: sql<number>`count(*)`,
    })
    .from(samples)
    .where(eq(samples.jurisdictionId, jurisdictionId))
    .groupBy(samples.status);

    return result.reduce((acc, row) => {
      acc[row.status] = Number(row.count);
      return acc;
    }, {} as Record<string, number>);
  },

  /**
   * Finds samples with pending lab reports (approaching deadline).
   * 
   * WHY: Identifies samples requiring urgent follow-up.
   * WHO: Called for dashboard urgent actions and notifications.
   * RESULT: Array of samples pending lab results.
   */
  async findPendingLabReports(jurisdictionId: string): Promise<SampleRecord[]> {
    return db.select()
      .from(samples)
      .where(and(
        eq(samples.jurisdictionId, jurisdictionId),
        eq(samples.status, "dispatched")
      ))
      .orderBy(asc(samples.liftedDate));
  },
};
