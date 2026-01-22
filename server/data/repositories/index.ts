/**
 * =============================================================================
 * FILE: server/data/repositories/index.ts
 * LAYER: DATA ACCESS (Layer 4)
 * =============================================================================
 * 
 * PURPOSE:
 * Central export point for all repository modules.
 * Provides a clean import interface for the domain layer.
 * 
 * USAGE:
 * import { officerRepository, inspectionRepository } from "@/data/repositories";
 * 
 * WHAT THIS FILE MUST NOT DO:
 * - Contain any logic
 * - Define types (those are in individual repositories)
 * =============================================================================
 */

export { officerRepository } from "./officer.repository";
export { inspectionRepository } from "./inspection.repository";
export { sampleRepository } from "./sample.repository";
export { jurisdictionRepository } from "./jurisdiction.repository";

export type { OfficerRecord, NewOfficerRecord, OfficerAssignmentRecord } from "./officer.repository";
export type { InspectionRecord, NewInspectionRecord, InspectionFilterOptions } from "./inspection.repository";
export type { SampleRecord, NewSampleRecord, SampleWorkflowStateRecord, SampleFilterOptions } from "./sample.repository";
export type { AdministrativeLevelRecord, JurisdictionUnitRecord } from "./jurisdiction.repository";

export { db, PaginatedResult, ListOptions, AuditContext, RepositoryResult } from "./base.repository";
