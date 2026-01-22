/**
 * =============================================================================
 * FILE: server/domain/inspection/inspection.service.ts
 * LAYER: DOMAIN / BUSINESS LOGIC (Layer 2)
 * =============================================================================
 * 
 * PURPOSE:
 * Contains business logic and domain rules for Food Safety Inspections.
 * Enforces inspection workflow, immutability rules, and regulatory compliance.
 * 
 * REAL-WORLD MEANING:
 * Inspections are official regulatory visits to Food Business Operators (FBOs).
 * They generate legally binding records that may be used as evidence in court.
 * The inspection workflow must follow strict regulatory requirements.
 * 
 * WHAT THIS FILE MUST DO:
 * - Validate inspection creation and updates
 * - Enforce workflow state transitions
 * - Apply immutability rules for closed inspections
 * - Ensure jurisdiction binding for data continuity
 * 
 * WHAT THIS FILE MUST NOT DO:
 * - Execute HTTP operations (that's the API layer)
 * - Perform raw database queries (use repositories)
 * - Render UI or handle user input
 * 
 * DOMAIN RULES ENFORCED:
 * 1. Inspections are bound to jurisdictions, not officers
 * 2. Closed inspections become IMMUTABLE (cannot be modified)
 * 3. Status transitions must follow allowed workflow paths
 * 4. Officer must have authority in the inspection's jurisdiction
 * 
 * WHAT MUST NEVER BE CHANGED:
 * - Immutability rule for closed inspections
 * - Jurisdiction binding requirement
 * - Audit trail preservation
 * 
 * DEPENDENT SYSTEMS:
 * - server/data/repositories/inspection.repository.ts for data access
 * - server/api/routes/inspection.routes.ts exposes these services
 * =============================================================================
 */

import { 
  inspectionRepository, 
  InspectionRecord, 
  NewInspectionRecord,
  InspectionFilterOptions 
} from "../../data/repositories";

/**
 * Result type for service operations that may fail.
 */
export type ServiceResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

/**
 * Valid inspection status values.
 * 
 * WORKFLOW:
 * draft → in_progress → completed → closed
 *                    ↘ requires_followup → closed
 */
export const INSPECTION_STATUSES = {
  DRAFT: "draft",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  REQUIRES_FOLLOWUP: "requires_followup",
  CLOSED: "closed",
} as const;

/**
 * Allowed status transitions.
 * 
 * WHY: Enforces proper workflow progression.
 * RULES: Only transitions in this map are allowed.
 */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ["in_progress", "closed"],
  in_progress: ["completed", "requires_followup"],
  completed: ["closed"],
  requires_followup: ["completed", "closed"],
  closed: [], // No transitions allowed from closed
};

/**
 * Inspection Service - Domain logic for inspection management.
 * 
 * WHY: Centralizes business rules for inspection operations.
 * WHO: Called by API routes, consumed by mobile app.
 * RULES: All operations must enforce domain rules before data access.
 */
export const inspectionService = {
  /**
   * Gets an inspection by ID.
   * 
   * WHY: Core lookup for inspection data.
   * WHO: Called for inspection detail views.
   * RESULT: Inspection record or null.
   */
  async getById(id: string): Promise<InspectionRecord | null> {
    return inspectionRepository.findById(id);
  },

  /**
   * Lists inspections with filtering.
   * 
   * WHY: Supports inspection list views.
   * WHO: Called by mobile app and admin panel.
   * RESULT: Paginated list of inspections.
   */
  async list(options: InspectionFilterOptions = {}) {
    return inspectionRepository.findAll(options);
  },

  /**
   * Gets inspections for a specific jurisdiction.
   * 
   * WHY: Inspections are jurisdiction-bound.
   * WHO: Called when officer logs in and views their jurisdiction's data.
   * RESULT: Array of inspections in that jurisdiction.
   */
  async getByJurisdiction(jurisdictionId: string): Promise<InspectionRecord[]> {
    return inspectionRepository.findByJurisdiction(jurisdictionId);
  },

  /**
   * Creates a new inspection.
   * 
   * WHY: Initiates the inspection workflow.
   * WHO: Called when an officer starts a new inspection.
   * 
   * RULES:
   * - Must include jurisdiction ID for data binding
   * - Initial status is "draft"
   * - Officer must have authority in the jurisdiction (checked by caller)
   * 
   * RESULT: Created inspection on success, error on failure.
   */
  async create(
    data: NewInspectionRecord,
    officerId: string,
    jurisdictionId: string
  ): Promise<ServiceResult<InspectionRecord>> {
    if (!jurisdictionId) {
      return { success: false, error: "Jurisdiction ID is required", code: "MISSING_JURISDICTION" };
    }

    if (!data.type) {
      return { success: false, error: "Inspection type is required", code: "MISSING_TYPE" };
    }

    const inspection = await inspectionRepository.create({
      ...data,
      officerId,
      jurisdictionId,
      status: INSPECTION_STATUSES.DRAFT,
    });

    return { success: true, data: inspection };
  },

  /**
   * Updates an existing inspection.
   * 
   * WHY: Modifies inspection data during active workflow.
   * WHO: Called during inspection editing.
   * 
   * CRITICAL RULE:
   * Closed inspections CANNOT be modified. This is a legal requirement
   * for court admissibility. Once an inspection is closed, it becomes
   * an immutable legal record.
   * 
   * RULES:
   * - Check if inspection exists
   * - Check if inspection is not closed
   * - Apply updates
   * 
   * RESULT: Updated inspection on success, error on failure.
   */
  async update(
    id: string, 
    data: Partial<NewInspectionRecord>
  ): Promise<ServiceResult<InspectionRecord>> {
    const inspection = await inspectionRepository.findById(id);
    
    if (!inspection) {
      return { success: false, error: "Inspection not found", code: "NOT_FOUND" };
    }

    if (inspection.status === INSPECTION_STATUSES.CLOSED) {
      return { 
        success: false, 
        error: "Closed inspections cannot be modified. This is a legal requirement for court admissibility.",
        code: "IMMUTABLE_RECORD" 
      };
    }

    const updated = await inspectionRepository.update(id, data);
    
    if (!updated) {
      return { success: false, error: "Failed to update inspection", code: "UPDATE_FAILED" };
    }

    return { success: true, data: updated };
  },

  /**
   * Transitions inspection to a new status.
   * 
   * WHY: Enforces workflow state machine.
   * WHO: Called when officer progresses inspection through workflow.
   * 
   * RULES:
   * - Only allowed transitions are permitted
   * - Closed inspections cannot transition to any other status
   * - Status changes may trigger additional workflow actions
   * 
   * RESULT: Updated inspection on success, error on failure.
   */
  async transitionStatus(
    id: string, 
    newStatus: string
  ): Promise<ServiceResult<InspectionRecord>> {
    const inspection = await inspectionRepository.findById(id);
    
    if (!inspection) {
      return { success: false, error: "Inspection not found", code: "NOT_FOUND" };
    }

    const currentStatus = inspection.status;
    const allowedNextStatuses = ALLOWED_TRANSITIONS[currentStatus] || [];

    if (!allowedNextStatuses.includes(newStatus)) {
      return { 
        success: false, 
        error: `Cannot transition from "${currentStatus}" to "${newStatus}". Allowed: ${allowedNextStatuses.join(", ") || "none"}`,
        code: "INVALID_TRANSITION" 
      };
    }

    const updated = await inspectionRepository.update(id, { status: newStatus });
    
    if (!updated) {
      return { success: false, error: "Failed to update inspection status", code: "UPDATE_FAILED" };
    }

    return { success: true, data: updated };
  },

  /**
   * Gets inspection statistics for a jurisdiction.
   * 
   * WHY: Provides dashboard metrics.
   * WHO: Called for dashboard displays.
   * RESULT: Counts by status.
   */
  async getStatsByJurisdiction(jurisdictionId: string): Promise<Record<string, number>> {
    return inspectionRepository.countByStatus(jurisdictionId);
  },

  /**
   * Searches inspections by type.
   * 
   * WHY: Supports filtering in mobile app.
   * WHO: Called from search UI.
   * RESULT: Matching inspection records.
   */
  async search(query: string, jurisdictionId: string, limit: number = 20): Promise<InspectionRecord[]> {
    return inspectionRepository.search(query, jurisdictionId, limit);
  },

  /**
   * Checks if an inspection is modifiable.
   * 
   * WHY: Helper to check immutability before updates.
   * WHO: Called internally and by API layer.
   * 
   * RULES:
   * - Closed inspections are NEVER modifiable
   * - All other statuses are modifiable
   * 
   * RESULT: true if modifiable, false if immutable.
   */
  isModifiable(inspection: InspectionRecord): boolean {
    return inspection.status !== INSPECTION_STATUSES.CLOSED;
  },
};
