/**
 * =============================================================================
 * FILE: server/data/repositories/officer.repository.ts
 * LAYER: DATA ACCESS (Layer 4)
 * =============================================================================
 * 
 * PURPOSE:
 * Provides data access operations for Food Safety Officers and their assignments.
 * Handles all CRUD operations for officer-related database tables.
 * 
 * REAL-WORLD MEANING:
 * Officers are government employees authorized to conduct food safety inspections.
 * They are assigned to specific jurisdictions and have defined roles and capacities.
 * 
 * WHAT THIS FILE MUST DO:
 * - Provide CRUD operations for officers table
 * - Manage officer assignments to jurisdictions
 * - Handle officer role associations
 * - Support querying officers by various criteria
 * 
 * WHAT THIS FILE MUST NOT DO:
 * - Validate officer eligibility rules (that's domain logic)
 * - Check jurisdiction authority (that's domain logic)
 * - Handle authentication/authorization (that's API layer)
 * - Make business decisions about officer transfers
 * 
 * AUDIT & COURT SAFETY:
 * - Officer records are audit-sensitive
 * - Historical assignments must be preserved (not deleted)
 * - Changes to officer status must be logged
 * 
 * DEPENDENT SYSTEMS:
 * - server/domain/officer/officer.service.ts uses this for business operations
 * - server/api/routes/officer.routes.ts exposes HTTP endpoints
 * =============================================================================
 */

import { eq, and, desc, asc, sql, ilike, or } from "drizzle-orm";
import { db, ListOptions, PaginatedResult, AuditContext, createAuditTimestamp } from "./base.repository";
import {
  officers,
  officerRoles,
  officerCapacities,
  officerAssignments,
} from "../../../shared/schema";

/**
 * Officer data as stored in database.
 */
export type OfficerRecord = typeof officers.$inferSelect;
export type NewOfficerRecord = typeof officers.$inferInsert;

/**
 * Officer assignment record.
 */
export type OfficerAssignmentRecord = typeof officerAssignments.$inferSelect;

/**
 * Officer Repository - Data access for officer entities.
 * 
 * WHY: Centralizes all officer-related database operations.
 * WHO: Used by OfficerService in the domain layer.
 * RULES: Only performs data operations, no business logic.
 */
export const officerRepository = {
  /**
   * Finds an officer by their unique ID.
   * 
   * WHY: Core lookup operation for officer data.
   * WHO: Called by domain services when officer data is needed.
   * RESULT: Officer record or null if not found.
   */
  async findById(id: string): Promise<OfficerRecord | null> {
    const result = await db.select().from(officers).where(eq(officers.id, id)).limit(1);
    return result[0] || null;
  },

  /**
   * Finds an officer by their email address.
   * 
   * WHY: Email is the unique identifier for officer authentication.
   * WHO: Called during login and officer lookup operations.
   * RESULT: Officer record or null if not found.
   */
  async findByEmail(email: string): Promise<OfficerRecord | null> {
    const result = await db.select().from(officers).where(eq(officers.email, email)).limit(1);
    return result[0] || null;
  },

  /**
   * Lists all officers with optional filtering and pagination.
   * 
   * WHY: Supports admin panel officer management.
   * WHO: Called by OfficerService for listing operations.
   * RESULT: Paginated list of officers.
   */
  async findAll(options: ListOptions = {}): Promise<PaginatedResult<OfficerRecord>> {
    const { page = 1, pageSize = 50, sortOrder = "desc" } = options;
    const offset = (page - 1) * pageSize;

    const [data, countResult] = await Promise.all([
      db.select()
        .from(officers)
        .orderBy(sortOrder === "asc" ? asc(officers.createdAt) : desc(officers.createdAt))
        .limit(pageSize)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(officers),
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
   * Creates a new officer record.
   * 
   * WHY: Onboards new food safety officers into the system.
   * WHO: Called during officer registration/invitation flow.
   * RULES: Email must be unique, password must be pre-hashed.
   * RESULT: The created officer record.
   */
  async create(data: NewOfficerRecord): Promise<OfficerRecord> {
    const result = await db.insert(officers).values({
      ...data,
      createdAt: createAuditTimestamp(),
      updatedAt: createAuditTimestamp(),
    }).returning();
    return result[0];
  },

  /**
   * Updates an existing officer record.
   * 
   * WHY: Allows modification of officer profile and status.
   * WHO: Called for profile updates, status changes, etc.
   * RULES: Must update the updatedAt timestamp.
   * RESULT: The updated officer record or null if not found.
   */
  async update(id: string, data: Partial<NewOfficerRecord>): Promise<OfficerRecord | null> {
    const result = await db.update(officers)
      .set({
        ...data,
        updatedAt: createAuditTimestamp(),
      })
      .where(eq(officers.id, id))
      .returning();
    return result[0] || null;
  },

  /**
   * Finds officers by jurisdiction ID.
   * 
   * WHY: Lists all officers assigned to a specific jurisdiction.
   * WHO: Called when viewing jurisdiction details or transfers.
   * RESULT: Array of officers in that jurisdiction.
   */
  async findByJurisdiction(jurisdictionId: string): Promise<OfficerRecord[]> {
    const assignments = await db.select()
      .from(officerAssignments)
      .where(and(
        eq(officerAssignments.jurisdictionId, jurisdictionId),
        eq(officerAssignments.status, "active")
      ));

    if (assignments.length === 0) return [];

    const officerIds = assignments.map(a => a.officerId);
    const result = await db.select()
      .from(officers)
      .where(sql`${officers.id} = ANY(${officerIds})`);
    
    return result;
  },

  /**
   * Gets all active assignments for an officer.
   * 
   * WHY: Officers may be assigned to multiple jurisdictions.
   * WHO: Called during login to load officer's available jurisdictions.
   * RESULT: Array of active assignment records.
   */
  async getActiveAssignments(officerId: string): Promise<OfficerAssignmentRecord[]> {
    return db.select()
      .from(officerAssignments)
      .where(and(
        eq(officerAssignments.officerId, officerId),
        eq(officerAssignments.status, "active")
      ));
  },

  /**
   * Searches officers by name or email.
   * 
   * WHY: Supports officer lookup in admin panel.
   * WHO: Called from search functionality.
   * RESULT: Matching officer records.
   */
  async search(query: string, limit: number = 20): Promise<OfficerRecord[]> {
    return db.select()
      .from(officers)
      .where(or(
        ilike(officers.name, `%${query}%`),
        ilike(officers.email, `%${query}%`)
      ))
      .limit(limit);
  },

  /**
   * Gets all defined officer roles.
   * 
   * WHY: Roles are admin-configurable, not hardcoded.
   * WHO: Called when displaying role selection options.
   * RESULT: Array of all role definitions.
   */
  async getAllRoles(): Promise<(typeof officerRoles.$inferSelect)[]> {
    return db.select().from(officerRoles).orderBy(asc(officerRoles.displayOrder));
  },

  /**
   * Gets all defined officer capacities.
   * 
   * WHY: Capacities define additional duties (e.g., "Sampling Officer").
   * WHO: Called when assigning capacities to officers.
   * RESULT: Array of all capacity definitions.
   */
  async getAllCapacities(): Promise<(typeof officerCapacities.$inferSelect)[]> {
    return db.select().from(officerCapacities).orderBy(asc(officerCapacities.displayOrder));
  },
};
