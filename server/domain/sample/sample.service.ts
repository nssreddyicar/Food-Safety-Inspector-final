/**
 * =============================================================================
 * FILE: server/domain/sample/sample.service.ts
 * LAYER: DOMAIN / BUSINESS LOGIC (Layer 2)
 * =============================================================================
 * 
 * PURPOSE:
 * Contains business logic and domain rules for Food Sample management.
 * Enforces chain-of-custody, workflow transitions, and lab result handling.
 * 
 * REAL-WORLD MEANING:
 * Samples are physical food specimens collected by officers for laboratory testing.
 * They follow a strict chain-of-custody workflow:
 * collected → dispatched → at_lab → result_received → processed
 * 
 * Sample data is critical evidence in prosecution cases. Any mishandling
 * can invalidate the sample and compromise legal proceedings.
 * 
 * WHAT THIS FILE MUST DO:
 * - Validate sample creation and updates
 * - Enforce chain-of-custody rules
 * - Apply immutability after dispatch to lab
 * - Calculate lab report deadlines
 * - Track sample workflow state
 * 
 * WHAT THIS FILE MUST NOT DO:
 * - Execute HTTP operations (that's the API layer)
 * - Perform raw database queries (use repositories)
 * - Render UI or handle user input
 * 
 * DOMAIN RULES ENFORCED:
 * 1. Samples are bound to jurisdictions, not officers
 * 2. Dispatched samples become IMMUTABLE (cannot be modified)
 * 3. Lab report deadline is configurable (default 14 days from dispatch)
 * 4. Sample codes must be unique within the system
 * 
 * WHAT MUST NEVER BE CHANGED:
 * - Immutability rule after dispatch
 * - Chain-of-custody workflow sequence
 * - Sample code uniqueness requirement
 * 
 * DEPENDENT SYSTEMS:
 * - server/data/repositories/sample.repository.ts for data access
 * - server/api/routes/sample.routes.ts exposes these services
 * =============================================================================
 */

import { 
  sampleRepository, 
  SampleRecord, 
  NewSampleRecord,
  SampleFilterOptions 
} from "../../data/repositories";

/**
 * Result type for service operations that may fail.
 */
export type ServiceResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

/**
 * Valid sample status values.
 * 
 * WORKFLOW:
 * pending → collected → dispatched → at_lab → result_received → processed
 */
export const SAMPLE_STATUSES = {
  PENDING: "pending",
  COLLECTED: "collected",
  DISPATCHED: "dispatched",
  AT_LAB: "at_lab",
  RESULT_RECEIVED: "result_received",
  PROCESSED: "processed",
} as const;

/**
 * Sample types.
 */
export const SAMPLE_TYPES = {
  ENFORCEMENT: "enforcement",
  SURVEILLANCE: "surveillance",
} as const;

/**
 * Default lab report deadline in days.
 * 
 * WHY: Configurable setting, default is 14 days per FSSAI regulations.
 * RULES: This should be loaded from system settings in production.
 */
const DEFAULT_LAB_REPORT_DEADLINE_DAYS = 14;

/**
 * Allowed status transitions.
 * 
 * WHY: Enforces proper chain-of-custody workflow.
 * RULES: Only transitions in this map are allowed.
 */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ["collected"],
  collected: ["dispatched"],
  dispatched: ["at_lab"],
  at_lab: ["result_received"],
  result_received: ["processed"],
  processed: [], // Terminal state
};

/**
 * Sample Service - Domain logic for sample management.
 * 
 * WHY: Centralizes business rules for sample operations.
 * WHO: Called by API routes, consumed by mobile app.
 * RULES: All operations must enforce domain rules before data access.
 */
export const sampleService = {
  /**
   * Gets a sample by ID.
   * 
   * WHY: Core lookup for sample data.
   * WHO: Called for sample detail views.
   * RESULT: Sample record or null.
   */
  async getById(id: string): Promise<SampleRecord | null> {
    return sampleRepository.findById(id);
  },

  /**
   * Gets a sample by its unique code.
   * 
   * WHY: Sample codes are used in field operations and QR scanning.
   * WHO: Called during barcode scanning or manual lookup.
   * RESULT: Sample record or null.
   */
  async getByCode(code: string): Promise<SampleRecord | null> {
    return sampleRepository.findByCode(code);
  },

  /**
   * Lists samples with filtering.
   * 
   * WHY: Supports sample list views.
   * WHO: Called by mobile app and admin panel.
   * RESULT: Paginated list of samples.
   */
  async list(options: SampleFilterOptions = {}) {
    return sampleRepository.findAll(options);
  },

  /**
   * Gets samples for a specific jurisdiction.
   * 
   * WHY: Samples are jurisdiction-bound.
   * WHO: Called when officer views their jurisdiction's samples.
   * RESULT: Array of samples in that jurisdiction.
   */
  async getByJurisdiction(jurisdictionId: string): Promise<SampleRecord[]> {
    return sampleRepository.findByJurisdiction(jurisdictionId);
  },

  /**
   * Gets samples for a specific inspection.
   * 
   * WHY: Samples are linked to inspections.
   * WHO: Called when viewing inspection details.
   * RESULT: Array of samples from that inspection.
   */
  async getByInspection(inspectionId: string): Promise<SampleRecord[]> {
    return sampleRepository.findByInspection(inspectionId);
  },

  /**
   * Creates a new sample.
   * 
   * WHY: Records sample collection during inspection.
   * WHO: Called when an officer lifts a sample.
   * 
   * RULES:
   * - Must include jurisdiction ID for data binding
   * - Sample code must be unique
   * - Initial status is "pending"
   * 
   * RESULT: Created sample on success, error on failure.
   */
  async create(
    data: NewSampleRecord,
    officerId: string,
    jurisdictionId: string
  ): Promise<ServiceResult<SampleRecord>> {
    if (!jurisdictionId) {
      return { success: false, error: "Jurisdiction ID is required", code: "MISSING_JURISDICTION" };
    }

    if (!data.code) {
      return { success: false, error: "Sample code is required", code: "MISSING_CODE" };
    }

    const existingSample = await sampleRepository.findByCode(data.code);
    if (existingSample) {
      return { success: false, error: "A sample with this code already exists", code: "CODE_EXISTS" };
    }

    const sample = await sampleRepository.create({
      ...data,
      officerId,
      jurisdictionId,
      status: SAMPLE_STATUSES.PENDING,
    });

    return { success: true, data: sample };
  },

  /**
   * Updates an existing sample.
   * 
   * WHY: Modifies sample data during active workflow.
   * WHO: Called during sample editing.
   * 
   * CRITICAL RULE:
   * Dispatched samples CANNOT be modified. This is a legal requirement
   * for chain-of-custody compliance. Once a sample is dispatched to the
   * lab, it becomes an immutable record.
   * 
   * RULES:
   * - Check if sample exists
   * - Check if sample is not dispatched or beyond
   * - Apply updates
   * 
   * RESULT: Updated sample on success, error on failure.
   */
  async update(
    id: string, 
    data: Partial<NewSampleRecord>
  ): Promise<ServiceResult<SampleRecord>> {
    const sample = await sampleRepository.findById(id);
    
    if (!sample) {
      return { success: false, error: "Sample not found", code: "NOT_FOUND" };
    }

    if (!this.isModifiable(sample)) {
      return { 
        success: false, 
        error: "Dispatched samples cannot be modified. This is a legal requirement for chain-of-custody.",
        code: "IMMUTABLE_RECORD" 
      };
    }

    const updated = await sampleRepository.update(id, data);
    
    if (!updated) {
      return { success: false, error: "Failed to update sample", code: "UPDATE_FAILED" };
    }

    return { success: true, data: updated };
  },

  /**
   * Transitions sample to a new status.
   * 
   * WHY: Enforces chain-of-custody workflow.
   * WHO: Called when sample progresses through workflow.
   * 
   * RULES:
   * - Only allowed transitions are permitted
   * - Dispatch transition sets the dispatch date
   * 
   * RESULT: Updated sample on success, error on failure.
   */
  async transitionStatus(
    id: string, 
    newStatus: string
  ): Promise<ServiceResult<SampleRecord>> {
    const sample = await sampleRepository.findById(id);
    
    if (!sample) {
      return { success: false, error: "Sample not found", code: "NOT_FOUND" };
    }

    const currentStatus = sample.status;
    const allowedNextStatuses = ALLOWED_TRANSITIONS[currentStatus] || [];

    if (!allowedNextStatuses.includes(newStatus)) {
      return { 
        success: false, 
        error: `Cannot transition from "${currentStatus}" to "${newStatus}". Allowed: ${allowedNextStatuses.join(", ") || "none"}`,
        code: "INVALID_TRANSITION" 
      };
    }

    const updateData: Partial<NewSampleRecord> = { status: newStatus };

    if (newStatus === SAMPLE_STATUSES.DISPATCHED) {
      updateData.dispatchDate = new Date();
    }

    const updated = await sampleRepository.update(id, updateData);
    
    if (!updated) {
      return { success: false, error: "Failed to update sample status", code: "UPDATE_FAILED" };
    }

    return { success: true, data: updated };
  },

  /**
   * Gets samples with pending lab reports.
   * 
   * WHY: Identifies samples requiring follow-up.
   * WHO: Called for dashboard urgent actions.
   * RESULT: Array of samples awaiting lab results.
   */
  async getPendingLabReports(jurisdictionId: string): Promise<SampleRecord[]> {
    return sampleRepository.findPendingLabReports(jurisdictionId);
  },

  /**
   * Calculates lab report deadline for a sample.
   * 
   * WHY: Lab reports are due within configurable days from dispatch.
   * WHO: Called for deadline displays and urgent action calculations.
   * 
   * RULES:
   * - Deadline is calculated from dispatch date
   * - Returns null if sample is not dispatched
   * 
   * RESULT: Deadline date or null.
   */
  calculateLabReportDeadline(sample: SampleRecord): Date | null {
    if (!sample.dispatchDate) {
      return null;
    }

    const dispatchDate = new Date(sample.dispatchDate);
    const deadline = new Date(dispatchDate);
    deadline.setDate(deadline.getDate() + DEFAULT_LAB_REPORT_DEADLINE_DAYS);
    return deadline;
  },

  /**
   * Calculates days until lab report deadline.
   * 
   * WHY: Shows urgency indicator for pending samples.
   * WHO: Called for dashboard and sample list displays.
   * RESULT: Number of days (negative if overdue), null if not applicable.
   */
  calculateDaysUntilDeadline(sample: SampleRecord): number | null {
    const deadline = this.calculateLabReportDeadline(sample);
    if (!deadline) {
      return null;
    }

    const now = new Date();
    const diffMs = deadline.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  },

  /**
   * Gets sample statistics for a jurisdiction.
   * 
   * WHY: Provides dashboard metrics.
   * WHO: Called for dashboard displays.
   * RESULT: Counts by status.
   */
  async getStatsByJurisdiction(jurisdictionId: string): Promise<Record<string, number>> {
    return sampleRepository.countByStatus(jurisdictionId);
  },

  /**
   * Gets workflow history for a sample.
   * 
   * WHY: Provides audit trail for sample lifecycle.
   * WHO: Called for sample detail views and audits.
   * RESULT: Array of workflow state records.
   */
  async getWorkflowHistory(sampleId: string) {
    return sampleRepository.getWorkflowHistory(sampleId);
  },

  /**
   * Checks if a sample is modifiable.
   * 
   * WHY: Helper to check immutability before updates.
   * WHO: Called internally and by API layer.
   * 
   * RULES:
   * - Samples are modifiable until dispatched
   * - Once dispatched, samples become IMMUTABLE
   * 
   * RESULT: true if modifiable, false if immutable.
   */
  isModifiable(sample: SampleRecord): boolean {
    const immutableStatuses = [
      SAMPLE_STATUSES.DISPATCHED,
      SAMPLE_STATUSES.AT_LAB,
      SAMPLE_STATUSES.RESULT_RECEIVED,
      SAMPLE_STATUSES.PROCESSED,
    ];
    return !immutableStatuses.includes(sample.status as any);
  },
};
