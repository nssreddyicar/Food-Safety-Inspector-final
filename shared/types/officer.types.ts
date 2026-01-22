/**
 * =============================================================================
 * FILE: shared/types/officer.types.ts
 * PURPOSE: Officer domain type definitions
 * =============================================================================
 * 
 * Shared types used across all layers (frontend, backend, server).
 * These types define the shape of officer data throughout the system.
 * 
 * RULES:
 * - No logic, only type definitions
 * - No side effects
 * - Use domain language
 * =============================================================================
 */

/**
 * Officer status values.
 */
export type OfficerStatus = 'active' | 'inactive' | 'suspended' | 'transferred';

/**
 * Officer record from database.
 */
export interface Officer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  designation: string | null;
  role: string;
  status: OfficerStatus;
  showAdminPanel: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Officer with jurisdiction assignments.
 */
export interface OfficerWithJurisdictions extends Officer {
  jurisdictions: JurisdictionAssignment[];
  primaryJurisdiction: JurisdictionAssignment | null;
}

/**
 * Jurisdiction assignment for an officer.
 */
export interface JurisdictionAssignment {
  jurisdictionId: string;
  jurisdictionName: string;
  roleId: string;
  capacityId: string;
  isPrimary: boolean;
}

/**
 * Officer role definition.
 */
export interface OfficerRole {
  id: string;
  roleName: string;
  roleCode: string;
  description: string | null;
  permissions: string[];
}

/**
 * Officer capacity definition.
 */
export interface OfficerCapacity {
  id: string;
  capacityName: string;
  capacityCode: string;
  description: string | null;
}

/**
 * Input for creating a new officer.
 */
export interface CreateOfficerInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  designation?: string;
  role: string;
}

/**
 * Input for updating an officer.
 */
export interface UpdateOfficerInput {
  name?: string;
  email?: string;
  phone?: string;
  designation?: string;
  role?: string;
  status?: OfficerStatus;
}

/**
 * Authentication result.
 */
export interface AuthResult {
  success: boolean;
  officer?: OfficerWithJurisdictions;
  token?: string;
  error?: string;
}
