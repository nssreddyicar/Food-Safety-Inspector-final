/**
 * =============================================================================
 * FILE: server/domain/index.ts
 * LAYER: DOMAIN / BUSINESS LOGIC (Layer 2)
 * =============================================================================
 * 
 * PURPOSE:
 * Central export point for all domain service modules.
 * Provides a clean import interface for the API layer.
 * 
 * USAGE:
 * import { officerService, inspectionService } from "@/domain";
 * 
 * WHAT THIS FILE MUST NOT DO:
 * - Contain any logic
 * - Define types (those are in individual services)
 * =============================================================================
 */

export { officerService } from "./officer/officer.service";
export { inspectionService } from "./inspection/inspection.service";
export { sampleService } from "./sample/sample.service";
export { jurisdictionService } from "./jurisdiction/jurisdiction.service";
export { complaintService } from "./complaint/complaint.service";

export type { ServiceResult, AuthenticatedOfficer, JurisdictionAssignment } from "./officer/officer.service";
export { INSPECTION_STATUSES } from "./inspection/inspection.service";
export { SAMPLE_STATUSES, SAMPLE_TYPES } from "./sample/sample.service";
