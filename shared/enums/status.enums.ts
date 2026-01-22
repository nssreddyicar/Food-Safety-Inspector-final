/**
 * =============================================================================
 * FILE: shared/enums/status.enums.ts
 * PURPOSE: Status enum definitions for domain entities
 * =============================================================================
 */

/**
 * Inspection status values with metadata.
 */
export const INSPECTION_STATUS = {
  DRAFT: 'draft',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  REQUIRES_FOLLOWUP: 'requires_followup',
  CLOSED: 'closed',
} as const;

/**
 * Allowed inspection status transitions.
 */
export const INSPECTION_TRANSITIONS: Record<string, string[]> = {
  draft: ['in_progress', 'closed'],
  in_progress: ['completed', 'requires_followup'],
  completed: ['closed'],
  requires_followup: ['completed', 'closed'],
  closed: [], // Terminal state - IMMUTABLE
};

/**
 * Sample status values with metadata.
 */
export const SAMPLE_STATUS = {
  PENDING: 'pending',
  COLLECTED: 'collected',
  DISPATCHED: 'dispatched',
  AT_LAB: 'at_lab',
  RESULT_RECEIVED: 'result_received',
  PROCESSED: 'processed',
} as const;

/**
 * Allowed sample status transitions.
 */
export const SAMPLE_TRANSITIONS: Record<string, string[]> = {
  pending: ['collected'],
  collected: ['dispatched'],
  dispatched: ['at_lab'], // IMMUTABLE from this point
  at_lab: ['result_received'],
  result_received: ['processed'],
  processed: [], // Terminal state
};

/**
 * Statuses that make a sample immutable.
 */
export const SAMPLE_IMMUTABLE_STATUSES = [
  'dispatched',
  'at_lab',
  'result_received',
  'processed',
];

/**
 * Officer status values.
 */
export const OFFICER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
  TRANSFERRED: 'transferred',
} as const;

/**
 * Jurisdiction status values.
 */
export const JURISDICTION_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;
