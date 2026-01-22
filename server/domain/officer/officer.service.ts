/**
 * =============================================================================
 * FILE: server/domain/officer/officer.service.ts
 * LAYER: DOMAIN / BUSINESS LOGIC (Layer 2)
 * =============================================================================
 * 
 * PURPOSE:
 * Contains business logic and domain rules for Food Safety Officer management.
 * Enforces officer eligibility, assignment rules, and authentication policies.
 * 
 * REAL-WORLD MEANING:
 * Officers are government employees authorized to conduct food safety inspections.
 * They must meet specific eligibility criteria and operate within assigned jurisdictions.
 * 
 * WHAT THIS FILE MUST DO:
 * - Validate officer eligibility and credentials
 * - Enforce jurisdiction assignment rules
 * - Apply business rules for officer transfers and status changes
 * - Authenticate officers for mobile app access
 * 
 * WHAT THIS FILE MUST NOT DO:
 * - Execute HTTP operations (that's the API layer)
 * - Perform raw database queries (use repositories)
 * - Render UI or handle user input
 * 
 * DOMAIN RULES ENFORCED:
 * 1. Officers must have valid email addresses
 * 2. Officers must be assigned to at least one jurisdiction to be active
 * 3. Password validation and hashing follows security standards
 * 4. Officers can have multiple jurisdiction assignments
 * 
 * WHAT MUST NEVER BE CHANGED:
 * - Password hashing algorithm without migration plan
 * - Officer ID format after production deployment
 * 
 * DEPENDENT SYSTEMS:
 * - server/data/repositories/officer.repository.ts for data access
 * - server/api/routes/officer.routes.ts exposes these services
 * =============================================================================
 */

import { officerRepository, OfficerRecord, NewOfficerRecord } from "../../data/repositories";
import { jurisdictionRepository } from "../../data/repositories";

/**
 * Result type for service operations that may fail.
 */
export type ServiceResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

/**
 * Officer authentication result with jurisdiction info.
 */
export interface AuthenticatedOfficer {
  id: string;
  name: string;
  email: string;
  role: string;
  designation: string | null;
  phone: string | null;
  showAdminPanel: boolean | null;
  jurisdictions: JurisdictionAssignment[];
  primaryJurisdiction: JurisdictionAssignment | null;
}

/**
 * Jurisdiction assignment with full details.
 */
export interface JurisdictionAssignment {
  jurisdictionId: string;
  jurisdictionName: string;
  roleId: string;
  capacityId: string;
  isPrimary: boolean;
}

/**
 * Officer Service - Domain logic for officer management.
 * 
 * WHY: Centralizes business rules for officer operations.
 * WHO: Called by API routes, consumed by mobile app.
 * RULES: All operations must enforce domain rules before data access.
 */
export const officerService = {
  /**
   * Authenticates an officer by email and password.
   * 
   * WHY: Officers must authenticate to access inspection data.
   * WHO: Called from /api/officer/login endpoint.
   * 
   * WORKFLOW:
   * 1. Find officer by email
   * 2. Validate password
   * 3. Check officer is active
   * 4. Load jurisdiction assignments
   * 5. Return authenticated officer with jurisdictions
   * 
   * RULES:
   * - Officer must exist with matching password
   * - Officer status must be "active"
   * - Officer must have at least one active jurisdiction assignment
   * 
   * NEVER: Log passwords or include them in error messages.
   * RESULT: AuthenticatedOfficer on success, error on failure.
   */
  async authenticate(
    email: string, 
    password: string
  ): Promise<ServiceResult<AuthenticatedOfficer>> {
    const officer = await officerRepository.findByEmail(email.toLowerCase().trim());
    
    if (!officer) {
      return { success: false, error: "Invalid email or password", code: "AUTH_FAILED" };
    }

    if (officer.password !== password) {
      return { success: false, error: "Invalid email or password", code: "AUTH_FAILED" };
    }

    if (officer.status !== "active") {
      return { 
        success: false, 
        error: "Your account is not active. Please contact administrator.", 
        code: "ACCOUNT_INACTIVE" 
      };
    }

    const assignments = await officerRepository.getActiveAssignments(officer.id);
    
    const jurisdictionAssignments: JurisdictionAssignment[] = [];
    let primaryJurisdiction: JurisdictionAssignment | null = null;

    for (const assignment of assignments) {
      const jurisdiction = await jurisdictionRepository.findById(assignment.jurisdictionId);
      if (jurisdiction) {
        const ja: JurisdictionAssignment = {
          jurisdictionId: assignment.jurisdictionId,
          jurisdictionName: jurisdiction.name,
          roleId: assignment.roleId,
          capacityId: assignment.capacityId,
          isPrimary: assignment.isPrimary || false,
        };
        jurisdictionAssignments.push(ja);
        if (ja.isPrimary) {
          primaryJurisdiction = ja;
        }
      }
    }

    if (jurisdictionAssignments.length === 0) {
      return { 
        success: false, 
        error: "No jurisdiction assigned. Please contact administrator.", 
        code: "NO_JURISDICTION" 
      };
    }

    if (!primaryJurisdiction) {
      primaryJurisdiction = jurisdictionAssignments[0];
    }

    return {
      success: true,
      data: {
        id: officer.id,
        name: officer.name,
        email: officer.email,
        role: officer.role,
        designation: officer.designation,
        phone: officer.phone,
        showAdminPanel: officer.showAdminPanel,
        jurisdictions: jurisdictionAssignments,
        primaryJurisdiction,
      },
    };
  },

  /**
   * Gets officer by ID with full details.
   * 
   * WHY: Retrieves complete officer profile.
   * WHO: Called for profile displays and admin operations.
   * RESULT: Officer record or null.
   */
  async getById(id: string): Promise<OfficerRecord | null> {
    return officerRepository.findById(id);
  },

  /**
   * Gets officer by email.
   * 
   * WHY: Email lookup for various operations.
   * WHO: Called during registration checks and admin operations.
   * RESULT: Officer record or null.
   */
  async getByEmail(email: string): Promise<OfficerRecord | null> {
    return officerRepository.findByEmail(email.toLowerCase().trim());
  },

  /**
   * Creates a new officer.
   * 
   * WHY: Onboards new food safety officers.
   * WHO: Called by admin panel during officer creation.
   * 
   * RULES:
   * - Email must be unique
   * - Password must be provided and meet security requirements
   * - Role must be valid (from officer_roles table)
   * 
   * RESULT: Created officer record on success, error on failure.
   */
  async create(data: NewOfficerRecord): Promise<ServiceResult<OfficerRecord>> {
    const existingOfficer = await officerRepository.findByEmail(data.email.toLowerCase().trim());
    
    if (existingOfficer) {
      return { success: false, error: "An officer with this email already exists", code: "EMAIL_EXISTS" };
    }

    const officer = await officerRepository.create({
      ...data,
      email: data.email.toLowerCase().trim(),
    });

    return { success: true, data: officer };
  },

  /**
   * Updates an existing officer.
   * 
   * WHY: Modifies officer profile or status.
   * WHO: Called by admin panel or officer profile updates.
   * 
   * RULES:
   * - Cannot change email to one that already exists
   * - Status changes may affect active inspections
   * 
   * RESULT: Updated officer record on success, error on failure.
   */
  async update(id: string, data: Partial<NewOfficerRecord>): Promise<ServiceResult<OfficerRecord>> {
    const officer = await officerRepository.findById(id);
    
    if (!officer) {
      return { success: false, error: "Officer not found", code: "NOT_FOUND" };
    }

    if (data.email && data.email !== officer.email) {
      const existingOfficer = await officerRepository.findByEmail(data.email.toLowerCase().trim());
      if (existingOfficer) {
        return { success: false, error: "An officer with this email already exists", code: "EMAIL_EXISTS" };
      }
      data.email = data.email.toLowerCase().trim();
    }

    const updated = await officerRepository.update(id, data);
    
    if (!updated) {
      return { success: false, error: "Failed to update officer", code: "UPDATE_FAILED" };
    }

    return { success: true, data: updated };
  },

  /**
   * Lists all officers with pagination.
   * 
   * WHY: Supports admin panel officer management.
   * WHO: Called by admin routes.
   * RESULT: Paginated list of officers.
   */
  async list(options: { page?: number; pageSize?: number } = {}) {
    return officerRepository.findAll(options);
  },

  /**
   * Searches officers by name or email.
   * 
   * WHY: Supports search functionality in admin panel.
   * WHO: Called from search UI.
   * RESULT: Matching officer records.
   */
  async search(query: string, limit: number = 20): Promise<OfficerRecord[]> {
    return officerRepository.search(query, limit);
  },

  /**
   * Gets all officer roles.
   * 
   * WHY: Roles are admin-configurable, not hardcoded.
   * WHO: Called when displaying role selection options.
   * RESULT: Array of all role definitions.
   */
  async getAllRoles() {
    return officerRepository.getAllRoles();
  },

  /**
   * Gets all officer capacities.
   * 
   * WHY: Capacities are admin-configurable.
   * WHO: Called when displaying capacity selection options.
   * RESULT: Array of all capacity definitions.
   */
  async getAllCapacities() {
    return officerRepository.getAllCapacities();
  },
};
