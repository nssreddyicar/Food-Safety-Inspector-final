/**
 * =============================================================================
 * FILE: shared/types/complaint.types.ts
 * LAYER: SHARED / CONTRACTS (Layer 3)
 * =============================================================================
 * 
 * PURPOSE:
 * TypeScript interfaces for the Dynamic Complaint Management System.
 * 
 * DESIGN PRINCIPLES:
 * - All form fields are dynamic (admin-configured)
 * - Location data is immutable once submitted
 * - Evidence is traceable with metadata
 * - No hardcoded fields, rules, or workflows
 * =============================================================================
 */

/**
 * Complaint location data captured from device GPS.
 */
export interface ComplaintLocation {
  latitude: string;
  longitude: string;
  accuracy: string; // meters
  timestamp: string; // ISO date
  source: "gps" | "manual";
  address?: string;
  landmark?: string;
}

/**
 * Complaint form field configuration (admin-defined).
 */
export interface ComplaintFormField {
  id: string;
  fieldName: string;
  fieldLabel: string;
  fieldType: "text" | "textarea" | "date" | "datetime" | "dropdown" | "phone" | "email" | "file" | "location" | "number";
  fieldGroup: "complainant" | "incident" | "accused" | "evidence" | "other";
  displayOrder: number;
  isRequired: boolean;
  isVisible: boolean;
  isVisibleToOfficer: boolean;
  isVisibleToComplainant: boolean;
  isEditable: boolean;
  validationRules?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    min?: number;
    max?: number;
  };
  dropdownOptions?: { value: string; label: string }[];
  defaultValue?: string;
  helpText?: string;
}

/**
 * Complaint status workflow transition (admin-defined).
 */
export interface ComplaintStatusTransition {
  id: string;
  fromStatus: string;
  toStatus: string;
  transitionName: string;
  requiredRole?: string;
  requiresEvidence: boolean;
  requiresRemarks: boolean;
}

/**
 * Complaint evidence/proof uploaded.
 */
export interface ComplaintEvidence {
  id: string;
  complaintId: string;
  filename: string;
  originalName: string;
  fileType: "image" | "video" | "audio" | "document";
  mimeType: string;
  fileSize: number;
  fileUrl: string;
  latitude?: string;
  longitude?: string;
  captureTimestamp?: string;
  uploadedBy: "complainant" | "officer";
  uploadedByOfficerId?: string;
  description?: string;
  uploadedAt: string;
}

/**
 * Complaint history record (audit trail).
 */
export interface ComplaintHistoryRecord {
  id: string;
  complaintId: string;
  action: "status_change" | "assigned" | "evidence_added" | "remark_added" | "created";
  fromStatus?: string;
  toStatus?: string;
  remarks?: string;
  evidenceId?: string;
  performedBy: "system" | "officer" | "complainant";
  officerId?: string;
  officerName?: string;
  latitude?: string;
  longitude?: string;
  performedAt: string;
}

/**
 * Core complaint record.
 */
export interface Complaint {
  id: string;
  complaintCode: string;
  
  // Core Complainant Info
  complainantName: string;
  complainantMobile?: string;
  complainantEmail?: string;
  
  // Location (IMMUTABLE after submission)
  location: ComplaintLocation;
  
  // Incident Details
  incidentDate?: string;
  incidentDescription?: string;
  
  // Dynamic Form Data
  formData: Record<string, unknown>;
  
  // Jurisdiction
  jurisdictionId?: string;
  jurisdictionName?: string;
  
  // Status
  status: string;
  assignedOfficerId?: string;
  assignedAt?: string;
  
  // Resolution
  resolvedAt?: string;
  resolutionRemarks?: string;
  
  // Metadata
  submittedAt: string;
  submittedVia: "mobile" | "web" | "offline";
  
  // Related Data
  evidence?: ComplaintEvidence[];
  history?: ComplaintHistoryRecord[];
}

/**
 * Complaint submission request.
 */
export interface ComplaintSubmission {
  complainantName: string;
  complainantMobile?: string;
  complainantEmail?: string;
  
  // Location
  location: ComplaintLocation;
  
  // Incident
  incidentDate?: string;
  incidentDescription?: string;
  
  // Dynamic Fields
  formData: Record<string, unknown>;
  
  // Metadata
  submittedVia?: "mobile" | "web" | "offline";
}

/**
 * Complaint status update request.
 */
export interface ComplaintStatusUpdate {
  complaintId: string;
  toStatus: string;
  remarks?: string;
  officerId: string;
  location?: {
    latitude: string;
    longitude: string;
  };
}

/**
 * Complaint assignment request.
 */
export interface ComplaintAssignment {
  complaintId: string;
  officerId: string;
  assignedBy: string;
  remarks?: string;
}

/**
 * Complaint tracking response (for complainant).
 */
export interface ComplaintTrackingInfo {
  complaintCode: string;
  status: string;
  statusLabel: string;
  submittedAt: string;
  lastUpdatedAt: string;
  history: {
    action: string;
    status?: string;
    remarks?: string;
    performedAt: string;
  }[];
  evidence?: {
    filename: string;
    fileType: string;
    uploadedAt: string;
  }[];
}

/**
 * Complaint list filters.
 */
export interface ComplaintFilters {
  status?: string;
  jurisdictionId?: string;
  assignedOfficerId?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
}
