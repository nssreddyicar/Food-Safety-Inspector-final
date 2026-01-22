/**
 * =============================================================================
 * FILE: shared/types/sample.types.ts
 * PURPOSE: Sample domain type definitions
 * =============================================================================
 */

/**
 * Sample status values.
 * 
 * WORKFLOW (chain-of-custody):
 * pending → collected → dispatched → at_lab → result_received → processed
 */
export type SampleStatus = 
  | 'pending'
  | 'collected'
  | 'dispatched'
  | 'at_lab'
  | 'result_received'
  | 'processed';

/**
 * Sample type values.
 */
export type SampleType = 'enforcement' | 'surveillance';

/**
 * Lab result values.
 */
export type LabResult = 'conforming' | 'non_conforming' | 'pending';

/**
 * Sample record from database.
 */
export interface Sample {
  id: string;
  code: string;
  jurisdictionId: string;
  officerId: string;
  inspectionId: string | null;
  sampleType: SampleType;
  status: SampleStatus;
  productName: string | null;
  productBrand: string | null;
  batchNumber: string | null;
  manufacturingDate: Date | null;
  expiryDate: Date | null;
  quantity: string | null;
  liftedDate: Date | null;
  dispatchDate: Date | null;
  labName: string | null;
  labResult: LabResult;
  labReportDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Sample with related data.
 */
export interface SampleWithDetails extends Sample {
  officer: {
    id: string;
    name: string;
  };
  jurisdiction: {
    id: string;
    name: string;
  };
  inspection?: {
    id: string;
    fboName: string | null;
  };
  daysUntilDeadline: number | null;
  isOverdue: boolean;
}

/**
 * Input for creating a new sample.
 */
export interface CreateSampleInput {
  code: string;
  sampleType: SampleType;
  inspectionId?: string;
  productName?: string;
  productBrand?: string;
  batchNumber?: string;
  manufacturingDate?: Date;
  expiryDate?: Date;
  quantity?: string;
}

/**
 * Input for updating a sample.
 */
export interface UpdateSampleInput {
  productName?: string;
  productBrand?: string;
  batchNumber?: string;
  manufacturingDate?: Date;
  expiryDate?: Date;
  quantity?: string;
  labName?: string;
  labResult?: LabResult;
  labReportDate?: Date;
}

/**
 * Sample filter options.
 */
export interface SampleFilters {
  status?: SampleStatus;
  sampleType?: SampleType;
  jurisdictionId?: string;
  officerId?: string;
  inspectionId?: string;
  fromDate?: Date;
  toDate?: Date;
}
