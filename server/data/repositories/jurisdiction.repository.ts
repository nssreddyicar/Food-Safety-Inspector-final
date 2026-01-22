/**
 * =============================================================================
 * FILE: server/data/repositories/jurisdiction.repository.ts
 * LAYER: DATA ACCESS (Layer 4)
 * =============================================================================
 * 
 * PURPOSE:
 * Provides data access operations for Jurisdictions and Administrative Levels.
 * Handles all CRUD operations for jurisdiction-related database tables.
 * 
 * REAL-WORLD MEANING:
 * Jurisdictions represent administrative territories in India's food safety hierarchy:
 * - State (e.g., Maharashtra, Gujarat)
 * - District (e.g., Mumbai, Ahmedabad)
 * - Zone/Taluka (sub-district divisions)
 * The hierarchy is CONFIGURABLE by administrators, not hardcoded.
 * 
 * WHAT THIS FILE MUST DO:
 * - Provide CRUD operations for jurisdiction_units table
 * - Manage administrative_levels (hierarchy definition)
 * - Support querying jurisdictions by parent, level, or name
 * - Maintain the jurisdiction tree structure
 * 
 * WHAT THIS FILE MUST NOT DO:
 * - Validate jurisdiction authority rules (that's domain logic)
 * - Check officer permissions (that's domain logic)
 * - Enforce hierarchy business rules (that's domain logic)
 * - Handle HTTP requests or responses
 * 
 * AUDIT & COURT SAFETY:
 * - Jurisdiction changes affect data visibility and officer authority
 * - Changes to jurisdiction hierarchy must be audited
 * - Historical jurisdiction assignments must be preserved
 * 
 * DEPENDENT SYSTEMS:
 * - server/domain/jurisdiction/jurisdiction.service.ts uses this for business operations
 * - server/api/routes/jurisdiction.routes.ts exposes HTTP endpoints
 * - All data is bound to jurisdictions for access control
 * =============================================================================
 */

import { eq, and, desc, asc, sql, isNull, ilike } from "drizzle-orm";
import { db, ListOptions, PaginatedResult, createAuditTimestamp } from "./base.repository";
import { administrativeLevels, jurisdictionUnits } from "../../../shared/schema";

/**
 * Administrative level data as stored in database.
 */
export type AdministrativeLevelRecord = typeof administrativeLevels.$inferSelect;
export type NewAdministrativeLevelRecord = typeof administrativeLevels.$inferInsert;

/**
 * Jurisdiction unit data as stored in database.
 */
export type JurisdictionUnitRecord = typeof jurisdictionUnits.$inferSelect;
export type NewJurisdictionUnitRecord = typeof jurisdictionUnits.$inferInsert;

/**
 * Jurisdiction Repository - Data access for jurisdiction entities.
 * 
 * WHY: Centralizes all jurisdiction-related database operations.
 * WHO: Used by JurisdictionService in the domain layer.
 * RULES: Only performs data operations, no business logic.
 * 
 * HIERARCHY NOTE:
 * Administrative levels define the STRUCTURE (State > District > Zone).
 * Jurisdiction units are the INSTANCES (Maharashtra, Mumbai, Zone-1).
 */
export const jurisdictionRepository = {
  // =========================================================================
  // ADMINISTRATIVE LEVELS (Hierarchy Definition)
  // =========================================================================

  /**
   * Gets all administrative levels ordered by hierarchy.
   * 
   * WHY: Levels define the jurisdiction hierarchy structure.
   * WHO: Called when displaying hierarchy or creating new units.
   * RESULT: Array of levels from highest to lowest.
   */
  async getAllLevels(): Promise<AdministrativeLevelRecord[]> {
    return db.select()
      .from(administrativeLevels)
      .orderBy(asc(administrativeLevels.displayOrder));
  },

  /**
   * Finds an administrative level by ID.
   * 
   * WHY: Needed when working with specific level data.
   * WHO: Called by domain services.
   * RESULT: Level record or null if not found.
   */
  async findLevelById(id: string): Promise<AdministrativeLevelRecord | null> {
    const result = await db.select()
      .from(administrativeLevels)
      .where(eq(administrativeLevels.id, id))
      .limit(1);
    return result[0] || null;
  },

  /**
   * Creates a new administrative level.
   * 
   * WHY: Allows administrators to define new hierarchy levels.
   * WHO: Called from admin panel for hierarchy configuration.
   * RESULT: The created level record.
   */
  async createLevel(data: NewAdministrativeLevelRecord): Promise<AdministrativeLevelRecord> {
    const result = await db.insert(administrativeLevels).values(data).returning();
    return result[0];
  },

  /**
   * Updates an administrative level.
   * 
   * WHY: Allows modification of level names or properties.
   * WHO: Called from admin panel.
   * RESULT: The updated level record or null if not found.
   */
  async updateLevel(id: string, data: Partial<NewAdministrativeLevelRecord>): Promise<AdministrativeLevelRecord | null> {
    const result = await db.update(administrativeLevels)
      .set(data)
      .where(eq(administrativeLevels.id, id))
      .returning();
    return result[0] || null;
  },

  // =========================================================================
  // JURISDICTION UNITS (Actual Territories)
  // =========================================================================

  /**
   * Finds a jurisdiction unit by ID.
   * 
   * WHY: Core lookup for jurisdiction data.
   * WHO: Called throughout the system when jurisdiction context is needed.
   * RESULT: Jurisdiction record or null if not found.
   */
  async findById(id: string): Promise<JurisdictionUnitRecord | null> {
    const result = await db.select()
      .from(jurisdictionUnits)
      .where(eq(jurisdictionUnits.id, id))
      .limit(1);
    return result[0] || null;
  },

  /**
   * Lists all jurisdiction units.
   * 
   * WHY: Provides full jurisdiction list for admin operations.
   * WHO: Called by admin panel for jurisdiction management.
   * RESULT: Array of all jurisdiction units.
   */
  async findAll(): Promise<JurisdictionUnitRecord[]> {
    return db.select()
      .from(jurisdictionUnits)
      .orderBy(asc(jurisdictionUnits.name));
  },

  /**
   * Finds jurisdiction units by administrative level.
   * 
   * WHY: Lists all units at a specific level (e.g., all Districts).
   * WHO: Called when populating dropdowns or filtering by level.
   * RESULT: Array of jurisdiction units at that level.
   */
  async findByLevel(levelId: string): Promise<JurisdictionUnitRecord[]> {
    return db.select()
      .from(jurisdictionUnits)
      .where(eq(jurisdictionUnits.levelId, levelId))
      .orderBy(asc(jurisdictionUnits.name));
  },

  /**
   * Finds child jurisdiction units under a parent.
   * 
   * WHY: Navigates the jurisdiction hierarchy (e.g., districts in a state).
   * WHO: Called when building hierarchy trees or filtering cascades.
   * RESULT: Array of child jurisdiction units.
   */
  async findByParent(parentId: string): Promise<JurisdictionUnitRecord[]> {
    return db.select()
      .from(jurisdictionUnits)
      .where(eq(jurisdictionUnits.parentId, parentId))
      .orderBy(asc(jurisdictionUnits.name));
  },

  /**
   * Finds root jurisdiction units (no parent).
   * 
   * WHY: Gets top-level jurisdictions (typically States).
   * WHO: Called to start hierarchy navigation.
   * RESULT: Array of root-level jurisdiction units.
   */
  async findRoots(): Promise<JurisdictionUnitRecord[]> {
    return db.select()
      .from(jurisdictionUnits)
      .where(isNull(jurisdictionUnits.parentId))
      .orderBy(asc(jurisdictionUnits.name));
  },

  /**
   * Creates a new jurisdiction unit.
   * 
   * WHY: Adds new territories to the hierarchy.
   * WHO: Called from admin panel for jurisdiction management.
   * RULES: Must specify level and optionally parent.
   * RESULT: The created jurisdiction record.
   */
  async create(data: NewJurisdictionUnitRecord): Promise<JurisdictionUnitRecord> {
    const result = await db.insert(jurisdictionUnits).values({
      ...data,
      createdAt: createAuditTimestamp(),
    }).returning();
    return result[0];
  },

  /**
   * Updates a jurisdiction unit.
   * 
   * WHY: Allows modification of jurisdiction name or parent.
   * WHO: Called from admin panel.
   * RESULT: The updated jurisdiction record or null if not found.
   */
  async update(id: string, data: Partial<NewJurisdictionUnitRecord>): Promise<JurisdictionUnitRecord | null> {
    const result = await db.update(jurisdictionUnits)
      .set(data)
      .where(eq(jurisdictionUnits.id, id))
      .returning();
    return result[0] || null;
  },

  /**
   * Searches jurisdiction units by name.
   * 
   * WHY: Supports search functionality in admin panel.
   * WHO: Called from search UI.
   * RESULT: Matching jurisdiction records.
   */
  async search(query: string, limit: number = 20): Promise<JurisdictionUnitRecord[]> {
    return db.select()
      .from(jurisdictionUnits)
      .where(ilike(jurisdictionUnits.name, `%${query}%`))
      .orderBy(asc(jurisdictionUnits.name))
      .limit(limit);
  },

  /**
   * Gets the full ancestor path for a jurisdiction.
   * 
   * WHY: Displays full hierarchy path (e.g., "Maharashtra > Mumbai > Zone-1").
   * WHO: Called for display purposes and authority checks.
   * RESULT: Array of jurisdiction units from root to the specified unit.
   */
  async getAncestorPath(id: string): Promise<JurisdictionUnitRecord[]> {
    const path: JurisdictionUnitRecord[] = [];
    let currentId: string | null = id;

    while (currentId) {
      const unit = await this.findById(currentId);
      if (!unit) break;
      path.unshift(unit);
      currentId = unit.parentId;
    }

    return path;
  },
};
