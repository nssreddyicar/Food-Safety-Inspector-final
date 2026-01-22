/**
 * =============================================================================
 * FILE: shared/types/inspection.types.ts
 * PURPOSE: Inspection domain type definitions
 * =============================================================================
 */

/**
 * Inspection status values.
 * 
 * WORKFLOW:
 * draft → in_progress → completed → closed
 *                    ↘ requires_followup → closed
 */
export type InspectionStatus = 
  | 'draft'
  | 'in_progress'
  | 'completed'
  | 'requires_followup'
  | 'closed';

/**
 * Inspection type values.
 */
export type InspectionType = 
  | 'routine'
  | 'complaint'
  | 'follow_up'
  | 'surveillance'
  | 'special';

/**
 * Inspection record from database.
 */
export interface Inspection {
  id: string;
  jurisdictionId: string;
  officerId: string;
  type: InspectionType;
  status: InspectionStatus;
  fboName: string | null;
  fboAddress: string | null;
  fboLicenseNumber: string | null;
  findings: string | null;
  deviations: string | null;
  actionsTaken: string | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
}

/**
 * Inspection with related data.
 */
export interface InspectionWithDetails extends Inspection {
  officer: {
    id: string;
    name: string;
  };
  jurisdiction: {
    id: string;
    name: string;
  };
  samples: InspectionSample[];
}

/**
 * Sample linked to an inspection.
 */
export interface InspectionSample {
  id: string;
  code: string;
  status: string;
  sampleType: string;
}

/**
 * Input for creating a new inspection.
 */
export interface CreateInspectionInput {
  type: InspectionType;
  fboName?: string;
  fboAddress?: string;
  fboLicenseNumber?: string;
}

/**
 * Input for updating an inspection.
 */
export interface UpdateInspectionInput {
  fboName?: string;
  fboAddress?: string;
  fboLicenseNumber?: string;
  findings?: string;
  deviations?: string;
  actionsTaken?: string;
}

/**
 * Inspection filter options.
 */
export interface InspectionFilters {
  status?: InspectionStatus;
  type?: InspectionType;
  jurisdictionId?: string;
  officerId?: string;
  fromDate?: Date;
  toDate?: Date;
}
