/**
 * =============================================================================
 * FILE: server/domain/jurisdiction/jurisdiction.service.ts
 * LAYER: DOMAIN / BUSINESS LOGIC (Layer 2)
 * =============================================================================
 * 
 * PURPOSE:
 * Contains business logic and domain rules for Jurisdiction management.
 * Enforces hierarchy rules, officer authority, and data access controls.
 * 
 * REAL-WORLD MEANING:
 * Jurisdictions represent administrative territories in India's food safety hierarchy:
 * - State (e.g., Maharashtra, Gujarat)
 * - District (e.g., Mumbai, Ahmedabad)
 * - Zone/Taluka (sub-district divisions)
 * 
 * The hierarchy is CONFIGURABLE by administrators, not hardcoded.
 * This allows the system to adapt to different state structures.
 * 
 * WHAT THIS FILE MUST DO:
 * - Validate jurisdiction hierarchy operations
 * - Enforce authority rules (officers can only access their jurisdictions)
 * - Manage administrative level definitions
 * - Support dynamic hierarchy configuration
 * 
 * WHAT THIS FILE MUST NOT DO:
 * - Execute HTTP operations (that's the API layer)
 * - Perform raw database queries (use repositories)
 * - Hardcode jurisdiction levels or names
 * 
 * DOMAIN RULES ENFORCED:
 * 1. Jurisdiction levels are admin-configurable, not hardcoded
 * 2. Jurisdictions form a strict parent-child hierarchy
 * 3. Officers can only access data within their assigned jurisdictions
 * 4. Higher-level officers can access all data in child jurisdictions
 * 
 * WHAT MUST NEVER BE CHANGED:
 * - Hierarchy integrity rules
 * - Authority validation logic
 * 
 * DEPENDENT SYSTEMS:
 * - server/data/repositories/jurisdiction.repository.ts for data access
 * - server/api/routes/jurisdiction.routes.ts exposes these services
 * =============================================================================
 */

import { 
  jurisdictionRepository,
  JurisdictionUnitRecord,
  AdministrativeLevelRecord 
} from "../../data/repositories";

/**
 * Result type for service operations that may fail.
 */
export type ServiceResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

/**
 * Jurisdiction with level information.
 */
export interface JurisdictionWithLevel extends JurisdictionUnitRecord {
  levelName: string;
  levelNumber: number;
}

/**
 * Jurisdiction tree node for hierarchy display.
 */
export interface JurisdictionTreeNode {
  id: string;
  name: string;
  code: string;
  levelId: string;
  levelName: string;
  children: JurisdictionTreeNode[];
}

/**
 * Jurisdiction Service - Domain logic for jurisdiction management.
 * 
 * WHY: Centralizes business rules for jurisdiction operations.
 * WHO: Called by API routes and other domain services.
 * RULES: All operations must respect hierarchy and authority rules.
 */
export const jurisdictionService = {
  // =========================================================================
  // ADMINISTRATIVE LEVELS
  // =========================================================================

  /**
   * Gets all administrative levels.
   * 
   * WHY: Levels define the jurisdiction hierarchy structure.
   * WHO: Called for hierarchy configuration and display.
   * RESULT: Array of levels ordered by hierarchy.
   */
  async getAllLevels(): Promise<AdministrativeLevelRecord[]> {
    return jurisdictionRepository.getAllLevels();
  },

  /**
   * Gets a level by ID.
   * 
   * WHY: Level lookup for specific operations.
   * WHO: Called when working with level-specific data.
   * RESULT: Level record or null.
   */
  async getLevelById(id: string): Promise<AdministrativeLevelRecord | null> {
    return jurisdictionRepository.findLevelById(id);
  },

  // =========================================================================
  // JURISDICTION UNITS
  // =========================================================================

  /**
   * Gets a jurisdiction by ID.
   * 
   * WHY: Core lookup for jurisdiction data.
   * WHO: Called throughout the system.
   * RESULT: Jurisdiction record or null.
   */
  async getById(id: string): Promise<JurisdictionUnitRecord | null> {
    return jurisdictionRepository.findById(id);
  },

  /**
   * Gets a jurisdiction with its level information.
   * 
   * WHY: Often need jurisdiction with level context.
   * WHO: Called for display purposes.
   * RESULT: Jurisdiction with level info or null.
   */
  async getByIdWithLevel(id: string): Promise<JurisdictionWithLevel | null> {
    const jurisdiction = await jurisdictionRepository.findById(id);
    if (!jurisdiction) return null;

    const level = await jurisdictionRepository.findLevelById(jurisdiction.levelId);
    if (!level) return null;

    return {
      ...jurisdiction,
      levelName: level.levelName,
      levelNumber: level.levelNumber,
    };
  },

  /**
   * Gets all jurisdictions.
   * 
   * WHY: Full jurisdiction list for admin operations.
   * WHO: Called by admin panel.
   * RESULT: Array of all jurisdictions.
   */
  async getAll(): Promise<JurisdictionUnitRecord[]> {
    return jurisdictionRepository.findAll();
  },

  /**
   * Gets jurisdictions by level.
   * 
   * WHY: Lists all units at a specific level.
   * WHO: Called for filtering and display.
   * RESULT: Array of jurisdictions at that level.
   */
  async getByLevel(levelId: string): Promise<JurisdictionUnitRecord[]> {
    return jurisdictionRepository.findByLevel(levelId);
  },

  /**
   * Gets child jurisdictions under a parent.
   * 
   * WHY: Navigates the hierarchy tree.
   * WHO: Called for cascade selection and tree display.
   * RESULT: Array of child jurisdictions.
   */
  async getChildren(parentId: string): Promise<JurisdictionUnitRecord[]> {
    return jurisdictionRepository.findByParent(parentId);
  },

  /**
   * Gets root jurisdictions (top level).
   * 
   * WHY: Entry point for hierarchy navigation.
   * WHO: Called to start hierarchy selection.
   * RESULT: Array of root-level jurisdictions.
   */
  async getRoots(): Promise<JurisdictionUnitRecord[]> {
    return jurisdictionRepository.findRoots();
  },

  /**
   * Gets the full ancestor path for a jurisdiction.
   * 
   * WHY: Shows full hierarchy path (e.g., "Maharashtra > Mumbai > Zone-1").
   * WHO: Called for display and authority checks.
   * RESULT: Array from root to specified jurisdiction.
   */
  async getAncestorPath(id: string): Promise<JurisdictionUnitRecord[]> {
    return jurisdictionRepository.getAncestorPath(id);
  },

  /**
   * Builds a full hierarchy path string.
   * 
   * WHY: Human-readable path for display.
   * WHO: Called for UI displays.
   * RESULT: String like "Maharashtra > Mumbai > Zone-1".
   */
  async getHierarchyPathString(id: string): Promise<string> {
    const path = await this.getAncestorPath(id);
    return path.map(j => j.name).join(" > ");
  },

  /**
   * Searches jurisdictions by name.
   * 
   * WHY: Supports search functionality.
   * WHO: Called from search UI.
   * RESULT: Matching jurisdiction records.
   */
  async search(query: string, limit: number = 20): Promise<JurisdictionUnitRecord[]> {
    return jurisdictionRepository.search(query, limit);
  },

  // =========================================================================
  // AUTHORITY CHECKS
  // =========================================================================

  /**
   * Checks if an officer has authority over a jurisdiction.
   * 
   * WHY: Officers can only access data within their assigned jurisdictions.
   * WHO: Called before any data access operation.
   * 
   * RULES:
   * - Officer must have an active assignment to the jurisdiction
   * - OR officer must have assignment to a parent jurisdiction
   * 
   * RESULT: true if authorized, false otherwise.
   */
  async hasAuthority(
    officerJurisdictions: string[],
    targetJurisdictionId: string
  ): Promise<boolean> {
    if (officerJurisdictions.includes(targetJurisdictionId)) {
      return true;
    }

    const targetPath = await this.getAncestorPath(targetJurisdictionId);
    const targetPathIds = targetPath.map(j => j.id);

    for (const officerJurisdiction of officerJurisdictions) {
      if (targetPathIds.includes(officerJurisdiction)) {
        return true;
      }
    }

    return false;
  },

  /**
   * Gets all jurisdictions an officer has authority over.
   * 
   * WHY: Determines complete data access scope for an officer.
   * WHO: Called for data filtering and access control.
   * 
   * RULES:
   * - Includes all assigned jurisdictions
   * - Includes all child jurisdictions of assigned ones
   * 
   * RESULT: Array of jurisdiction IDs the officer can access.
   */
  async getAuthorityScope(officerJurisdictionIds: string[]): Promise<string[]> {
    const scope = new Set<string>(officerJurisdictionIds);

    async function addChildren(parentId: string) {
      const children = await jurisdictionRepository.findByParent(parentId);
      for (const child of children) {
        scope.add(child.id);
        await addChildren(child.id);
      }
    }

    for (const jurisdictionId of officerJurisdictionIds) {
      await addChildren(jurisdictionId);
    }

    return Array.from(scope);
  },

  // =========================================================================
  // HIERARCHY MANAGEMENT
  // =========================================================================

  /**
   * Creates a new jurisdiction unit.
   * 
   * WHY: Adds new territories to the hierarchy.
   * WHO: Called by admin panel.
   * 
   * RULES:
   * - Must specify level
   * - Parent must be valid if specified
   * - Code must be unique
   * 
   * RESULT: Created jurisdiction on success, error on failure.
   */
  async create(data: {
    name: string;
    code: string;
    levelId: string;
    parentId?: string;
  }): Promise<ServiceResult<JurisdictionUnitRecord>> {
    const level = await jurisdictionRepository.findLevelById(data.levelId);
    if (!level) {
      return { success: false, error: "Invalid administrative level", code: "INVALID_LEVEL" };
    }

    if (data.parentId) {
      const parent = await jurisdictionRepository.findById(data.parentId);
      if (!parent) {
        return { success: false, error: "Parent jurisdiction not found", code: "INVALID_PARENT" };
      }
    }

    const jurisdiction = await jurisdictionRepository.create({
      name: data.name,
      code: data.code,
      levelId: data.levelId,
      parentId: data.parentId || null,
      status: "active",
    });

    return { success: true, data: jurisdiction };
  },

  /**
   * Updates a jurisdiction unit.
   * 
   * WHY: Modifies jurisdiction details.
   * WHO: Called by admin panel.
   * 
   * RULES:
   * - Cannot change to invalid parent (would create cycle)
   * 
   * RESULT: Updated jurisdiction on success, error on failure.
   */
  async update(
    id: string, 
    data: Partial<{ name: string; code: string; parentId: string; status: string }>
  ): Promise<ServiceResult<JurisdictionUnitRecord>> {
    const jurisdiction = await jurisdictionRepository.findById(id);
    if (!jurisdiction) {
      return { success: false, error: "Jurisdiction not found", code: "NOT_FOUND" };
    }

    if (data.parentId === id) {
      return { success: false, error: "Jurisdiction cannot be its own parent", code: "INVALID_PARENT" };
    }

    const updated = await jurisdictionRepository.update(id, data);
    if (!updated) {
      return { success: false, error: "Failed to update jurisdiction", code: "UPDATE_FAILED" };
    }

    return { success: true, data: updated };
  },
};
