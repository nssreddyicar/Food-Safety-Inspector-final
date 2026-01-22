/**
 * =============================================================================
 * FILE: client/types/index.ts
 * =============================================================================
 * 
 * PURPOSE:
 * This file defines all TypeScript type definitions for the Food Safety Inspector
 * mobile application. These types represent real-world entities in the FSSAI
 * (Food Safety and Standards Authority of India) regulatory framework.
 * 
 * BUSINESS/DOMAIN CONTEXT:
 * - Food Safety Officers (FSOs) conduct inspections of food business operators
 * - Inspections may result in sample collection for laboratory testing
 * - Samples must be tracked through a strict legal workflow with deadlines
 * - Non-compliance can lead to prosecution in court
 * - All data must be audit-ready and court-admissible
 * 
 * PROBLEMS SOLVED:
 * - Provides type safety for all domain entities
 * - Ensures consistent data structures across mobile app and server
 * - Documents the legal and administrative constraints on data
 * 
 * ASSUMPTIONS THAT MUST NEVER BE MADE:
 * - Never assume roles are fixed (FSO, DO, etc.) - they are admin-controlled
 * - Never assume jurisdiction levels are static (State > District > Zone)
 * - Never assume action types or categories are hardcoded
 * - Never assume sample deadlines are fixed (14 days is configurable)
 * 
 * DEPENDENT SYSTEMS:
 * - client/lib/storage.ts uses these types for local data persistence
 * - client/hooks/useAuth.ts uses User type for authentication
 * - All screen components depend on these types for data rendering
 * - server/routes.ts API responses must match these types
 * =============================================================================
 */

/**
 * InspectionStatus represents the lifecycle states of a food safety inspection.
 * 
 * WHY: Inspections must follow a strict legal workflow from creation to closure.
 * WHO: FSOs create inspections, supervisors review, system tracks status.
 * RULES:
 * - draft: Inspection started but not yet submitted (can be edited)
 * - submitted: Sent for review, becomes append-only for legal integrity
 * - under_review: Being reviewed by a supervising officer
 * - closed: Final state, no further modifications allowed
 * NEVER: Allow direct status jumps (e.g., draft → closed) - workflow must be followed.
 * RESULT: String literal union ensuring only valid statuses are used.
 */
export type InspectionStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "closed";

/**
 * SampleResult represents the laboratory analysis outcome for a collected sample.
 * 
 * WHY: Lab results determine legal action - unsafe samples trigger prosecution.
 * RULES:
 * - pending: Awaiting lab analysis (default state)
 * - not_unsafe: Compliant with food safety standards (no action required)
 * - substandard: Below quality standards but not immediately dangerous
 * - unsafe: Violates safety standards, triggers mandatory prosecution
 * NEVER: Allow result changes after prosecution is initiated (immutable for court).
 * RESULT: Determines the legal pathway for the food business operator.
 */
export type SampleResult = "pending" | "not_unsafe" | "substandard" | "unsafe";

/**
 * SampleType distinguishes the legal basis for sample collection.
 * 
 * WHY: Different sample types follow different legal procedures.
 * RULES:
 * - enforcement: Collected when violation is suspected, splits into 4 parts
 * - surveillance: Routine monitoring, no violation suspected
 * NEVER: Mix enforcement and surveillance procedures - legal implications differ.
 */
export type SampleType = "enforcement" | "surveillance";

/**
 * PackingType indicates how the food product was packaged at collection.
 * 
 * WHY: Affects sample handling, chain of custody, and lab procedures.
 * RULES:
 * - packed: Pre-packaged with manufacturer sealing
 * - loose: Sold without packaging (street food, bulk items)
 */
export type PackingType = "packed" | "loose";

/**
 * JurisdictionInfo represents an officer's assigned area of authority.
 * 
 * WHY: Officers can only act within their assigned jurisdictions.
 * WHO: Assigned by administrators, determines which inspections/samples officer can access.
 * RULES:
 * - Officers may have multiple jurisdictions (e.g., primary + in-charge of another)
 * - Each jurisdiction has a specific role and capacity
 * NEVER: Allow officers to access data outside their jurisdiction boundaries.
 */
export interface JurisdictionInfo {
  assignmentId?: string;    // Unique identifier for this specific assignment
  unitId?: string;          // The jurisdiction unit (district, zone, etc.)
  unitName?: string;        // Human-readable name of the jurisdiction
  roleName?: string;        // Officer's role in this jurisdiction (FSO, DO, etc.)
  capacityName?: string;    // Capacity type (Regular, In-Charge, FAC, etc.)
  isPrimary?: boolean;      // Whether this is the officer's primary posting
}

/**
 * User represents an authenticated food safety officer in the system.
 * 
 * WHY: Officers are the primary actors in the regulatory workflow.
 * WHO: Created by administrators, authenticated via mobile app.
 * RULES:
 * - Each user belongs to exactly one primary jurisdiction
 * - Role determines permissions and available actions
 * - showAdminPanel grants access to administrative functions
 * NEVER: Store passwords in this type - authentication is server-side only.
 * RESULT: Contains all information needed for the mobile app to function.
 */
export interface User {
  id: string;               // Unique officer identifier (UUID)
  name: string;             // Full name as per government records
  email: string;            // Official email, used for login
  role: "fso" | "do" | "commissioner" | "super_admin"; // Note: roles are admin-controlled
  designation: string;      // Official designation (e.g., "Food Safety Officer")
  district?: string;        // Legacy district field (use jurisdiction instead)
  phone?: string;           // Official contact number
  employeeId?: string;      // Government employee ID
  jurisdiction?: JurisdictionInfo | null;  // Currently active jurisdiction
  allJurisdictions?: JurisdictionInfo[];   // All assigned jurisdictions
  showAdminPanel?: boolean; // Whether user can access admin functions
  avatar?: string;          // Profile image URL (optional)
}

/**
 * FBODetails captures information about the Food Business Operator being inspected.
 * 
 * WHY: Legal requirement to identify the establishment and responsible person.
 * WHO: FSO collects this during inspection, used in all legal documents.
 * RULES:
 * - establishmentName: Trade name visible to public
 * - hasLicense: Determines whether FBO is operating legally
 * - licenseNumber: Required if hasLicense is true
 * NEVER: Omit FBO identification - required for legal action.
 * RESULT: Court-admissible identification of the food business.
 */
export interface FBODetails {
  establishmentName: string; // Name displayed at the food business premises
  name: string;              // Legal name of the operator/owner
  sonOfName?: string;        // Father's name (Indian legal requirement)
  age?: number;              // Age of the operator
  address: string;           // Full address of the establishment
  licenseNumber?: string;    // FSSAI license number if licensed
  registrationNumber?: string; // FSSAI registration number if registered
  hasLicense: boolean;       // Whether FBO holds valid FSSAI license/registration
}

/**
 * ProprietorDetails captures owner/proprietor information separate from FBO.
 * 
 * WHY: Owner may be different from the person managing the establishment.
 * WHO: Collected during inspection, liable for any violations.
 * RULES:
 * - isSameAsFBO: If true, copies FBO details automatically
 * - phone: Mandatory for legal summons and notices
 * NEVER: Skip proprietor details - they are legally liable.
 */
export interface ProprietorDetails {
  name: string;              // Full legal name of proprietor
  sonOfName?: string;        // Father's name (legal requirement)
  age?: number;              // Age of proprietor
  address: string;           // Residential address (may differ from FBO)
  phone: string;             // Contact number for legal communication
  aadhaarNumber?: string;    // Aadhaar ID for verification
  isSameAsFBO: boolean;      // Whether proprietor is same as FBO
}

/**
 * Deviation represents a food safety violation observed during inspection.
 * 
 * WHY: Documents non-compliance with FSSAI regulations.
 * WHO: FSO records during inspection, reviewed by supervisors.
 * RULES:
 * - category: Type of violation (Hygiene, Labeling, Storage, etc.)
 * - severity determines legal response:
 *   - minor: Advisory notice
 *   - major: Improvement notice with deadline
 *   - critical: Immediate prohibition/prosecution
 * NEVER: Downgrade severity after recording - maintains audit integrity.
 */
export interface Deviation {
  id: string;                // Unique identifier for this deviation
  category: string;          // Category of violation (admin-controlled list)
  description: string;       // Detailed description of the violation
  severity: "minor" | "major" | "critical"; // Determines legal action required
}

/**
 * Witness represents a person present during the inspection.
 * 
 * WHY: Witnesses are legally required for inspection validity.
 * WHO: Independent observers, may be called to testify in court.
 * RULES:
 * - At least one witness required for legal validity
 * - Signature/Aadhaar provides proof of presence
 * NEVER: Use FBO employees as sole witnesses - conflict of interest.
 */
export interface Witness {
  id: string;                // Unique identifier
  name: string;              // Full name of witness
  sonOfName?: string;        // Father's name (legal requirement)
  age?: number;              // Age of witness (must be adult)
  address: string;           // Residential address
  phone: string;             // Contact for court summons
  aadhaarNumber?: string;    // Aadhaar ID for verification
  aadhaarImage?: string;     // Photo of Aadhaar card as proof
  signature?: string;        // Digital signature image
}

export interface ManufacturerDetails {
  name: string;
  address: string;
  licenseNumber?: string;
}

export interface DistributorDetails {
  name: string;
  address: string;
  licenseNumber?: string;
}

export interface RepackerDetails {
  name: string;
  address: string;
  licenseNumber?: string;
}

export interface RelabellerDetails {
  name: string;
  address: string;
  licenseNumber?: string;
}

/**
 * Sample represents a food sample collected during inspection for laboratory testing.
 * 
 * WHY: Samples are primary evidence in food safety prosecutions.
 * WHO: FSO collects, lab analyzes, court uses as evidence.
 * 
 * WORKFLOW (Enforcement Samples):
 * 1. Sample lifted at premises → divided into 4 parts
 * 2. Part 1: Sent to designated lab
 * 3. Part 2: Given to FBO for counter-analysis
 * 4. Part 3: Sent to referral lab (if disputed)
 * 5. Part 4: Retained by FSO as reserve
 * 6. Lab must report within 14 days of receipt
 * 7. If "unsafe", prosecution is mandatory
 * 
 * RULES:
 * - code: Unique sample code following district-year-sequence format
 * - daysRemaining: Countdown to lab report deadline (14 days from dispatch)
 * NEVER: Modify sample details after dispatch - chain of custody integrity.
 * RESULT: Legally valid evidence for court proceedings.
 */
export interface Sample {
  id: string;                // Unique sample identifier
  inspectionId: string;      // Parent inspection this sample belongs to
  jurisdictionId?: string;   // Jurisdiction where sample was collected
  sampleType: SampleType;    // enforcement or surveillance
  name: string;              // Description of the food item sampled
  code: string;              // Unique sample code (e.g., HYD-2024-0001)
  liftedDate: string;        // Date and time of sample collection
  liftedPlace: string;       // Exact location within premises
  officerId: string;         // FSO who collected the sample
  officerName: string;       // Name for document generation
  officerDesignation: string; // Designation for document generation
  cost: number;              // Cost paid to FBO for sample (mandatory)
  quantityInGrams: number;   // Weight of sample collected
  preservativeAdded: boolean; // Whether preservative was added
  preservativeType?: string; // Type of preservative if added
  packingType: PackingType;  // packed or loose
  manufacturerDetails?: ManufacturerDetails;  // For packed products
  distributorDetails?: DistributorDetails;    // Supply chain info
  repackerDetails?: RepackerDetails;          // If repacked
  relabellerDetails?: RelabellerDetails;      // If relabeled
  mfgDate?: string;          // Manufacturing date on package
  useByDate?: string;        // Best before/use by date
  lotBatchNumber?: string;   // Batch/lot number for traceability
  dispatchDate?: string;     // Date sample was sent to lab
  dispatchMode?: "post" | "courier" | "by_hand"; // How sample was sent
  acknowledgementImage?: string; // Proof of dispatch/receipt
  labReportDate?: string;    // Date lab report was received
  labResult?: SampleResult;  // Result: pending, not_unsafe, substandard, unsafe
  remarks?: string;          // Additional notes
  daysRemaining?: number;    // Computed: days until lab deadline
}

/**
 * ActionTaken records regulatory actions taken during or after inspection.
 * 
 * WHY: Documents enforcement actions for legal compliance and audit.
 * WHO: FSO initiates, system tracks, supervisor reviews.
 * RULES:
 * - countdownDate: For actions with deadlines (e.g., improvement notice)
 * - images: Photographic evidence of action taken
 * NEVER: Delete action records - append-only for audit trail.
 */
export interface ActionTaken {
  id: string;                // Unique action identifier
  actionType: string;        // Type of action (from admin-controlled list)
  description: string;       // Detailed description of action
  images: string[];          // Evidence photographs
  countdownDate?: string;    // Deadline for compliance (if applicable)
  remarks?: string;          // Additional notes
}

/**
 * Inspection is the primary workflow entity in the food safety system.
 * 
 * WHY: Inspections are the core regulatory activity of FSSAI officers.
 * WHO: FSOs conduct, supervisors review, system tracks lifecycle.
 * 
 * WORKFLOW:
 * 1. FSO creates inspection (status: draft)
 * 2. FSO records FBO details, deviations, samples, actions
 * 3. FSO submits inspection (status: submitted)
 * 4. Supervisor reviews (status: under_review)
 * 5. Inspection closed (status: closed) - becomes immutable
 * 
 * RULES:
 * - type: Routine, Complaint Based, Special Drive, etc.
 * - All nested data (samples, deviations) belongs to this inspection
 * NEVER: Modify closed inspections - they are court-admissible records.
 * RESULT: Complete audit trail of regulatory enforcement activity.
 */
export interface Inspection {
  id: string;                // Unique inspection identifier
  type: string;              // Inspection type (admin-controlled list)
  status: InspectionStatus;  // Current workflow state
  createdAt: string;         // Timestamp of creation
  updatedAt: string;         // Timestamp of last modification
  fboDetails: FBODetails;    // Food Business Operator information
  proprietorDetails: ProprietorDetails; // Owner/proprietor information
  deviations: Deviation[];   // List of violations observed
  actionsTaken: ActionTaken[]; // Regulatory actions taken
  sampleLifted: boolean;     // Whether samples were collected
  samples: Sample[];         // Collected samples
  witnesses: Witness[];      // Witnesses present during inspection
  fsoId: string;             // Officer who conducted inspection
  fsoName: string;           // Officer name for documents
  district: string;          // District where inspection conducted
  jurisdictionId?: string;   // Specific jurisdiction unit
}

export interface DashboardStats {
  pendingInspections: number;
  overdueSamples: number;
  samplesInTransit: number;
  completedThisMonth: number;
}

export interface DashboardMetrics {
  licenses: {
    total: number;
    active: number;
    amount: number;
  };
  registrations: {
    total: number;
    active: number;
    amount: number;
  };
  inspections: {
    total: number;
    license: number;
    registration: number;
  };
  grievances: {
    total: number;
    online: number;
    offline: number;
    pending: number;
  };
  fsw: {
    testing: number;
    training: number;
    awareness: number;
  };
  adjudication: {
    total: number;
    pending: number;
  };
  prosecution: {
    total: number;
    pending: number;
  };
}

export interface ProsecutionCase {
  id: string;
  caseNumber: string;
  courtName?: string;
  courtLocation?: string;
  respondentName: string;
  respondentAddress?: string;
  complainantName: string;
  complainantDesignation?: string;
  offenceDetails?: string;
  sectionsCharged?: string;
  sampleId?: string;
  inspectionId?: string;
  firstRegistrationDate?: string;
  firstHearingDate?: string;
  nextHearingDate?: string;
  lastHearingDate?: string;
  status: "pending" | "ongoing" | "convicted" | "acquitted" | "closed";
  outcome?: string;
  sentenceDetails?: string;
  fineAmount?: number;
  jurisdictionId?: string;
  officerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProsecutionHearing {
  id: string;
  caseId: string;
  hearingDate: string;
  hearingType?: string;
  courtRoom?: string;
  judgeName?: string;
  attendees?: string;
  proceedings?: string;
  orderPassed?: string;
  nextDate?: string;
  nextDatePurpose?: string;
  notes?: string;
  images?: string[];
  status: "scheduled" | "completed" | "adjourned" | "cancelled";
  createdByOfficerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UrgentAction {
  id: string;
  type: "sample_deadline" | "report_pending" | "notice_due";
  title: string;
  description: string;
  daysRemaining: number;
  sampleId?: string;
  inspectionId?: string;
}

export const PRESERVATIVE_TYPES = [
  "Sodium Benzoate",
  "Potassium Sorbate",
  "Sodium Metabisulphite",
  "Citric Acid",
  "Acetic Acid",
  "Formalin",
  "Other",
];

export const ACTION_TYPES = [
  "Warning Issued",
  "Improvement Notice",
  "Seizure Order",
  "Prohibition Order",
  "Prosecution Initiated",
  "License Suspended",
  "License Cancelled",
  "No Issues Found",
];

export type ActionCategoryGroup =
  | "legal"
  | "inspection"
  | "sampling"
  | "administrative"
  | "protocol";
export type ActionPriority = "critical" | "high" | "normal";

export interface ActionCategoryCounts {
  total: number;
  pending: number;
  overdue: number;
  dueThisWeek: number;
  dueToday: number;
}

export interface ActionCategory {
  id: string;
  code: string;
  name: string;
  group: ActionCategoryGroup;
  icon: string;
  color: string;
  entityType: string;
  slaDefaultDays: number;
  priority: ActionPriority;
  displayOrder: number;
  isEnabled: boolean;
  showOnDashboard: boolean;
  counts: ActionCategoryCounts;
}

export interface ActionDashboardTotals {
  totalItems: number;
  overdueItems: number;
  dueThisWeek: number;
  dueToday: number;
}

export interface ActionDashboardData {
  categories: ActionCategory[];
  totals: ActionDashboardTotals;
}

export interface StatisticsCard {
  id: string;
  name: string;
  code: string;
  description?: string;
  icon: string;
  color: string;
  group: string;
  valueType: "count" | "currency" | "percentage";
  entityType?: string;
  displayOrder: number;
  isEnabled: boolean;
  showOnDashboard: boolean;
  showInReport: boolean;
}

export interface ReportSection {
  id: string;
  name: string;
  code: string;
  description?: string;
  sectionType: "summary" | "table" | "statistics" | "chart";
  displayOrder: number;
  isEnabled: boolean;
  showInPdf: boolean;
  showInExcel: boolean;
  configuration?: Record<string, any>;
}
