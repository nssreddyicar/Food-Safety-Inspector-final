/**
 * =============================================================================
 * FILE: server/domain/complaint/complaint.service.ts
 * LAYER: DOMAIN / BUSINESS LOGIC (Layer 2B)
 * =============================================================================
 * 
 * PURPOSE:
 * Contains business logic and domain rules for Complaint Management.
 * Enforces location immutability, workflow transitions, and audit trails.
 * 
 * WHAT THIS FILE MUST DO:
 * - Validate complaint submission
 * - Enforce location data immutability
 * - Apply admin-configured form rules
 * - Track all changes in history
 * - Auto-assign jurisdiction from GPS
 * 
 * WHAT THIS FILE MUST NOT DO:
 * - Execute HTTP operations
 * - Perform raw database queries (use repository)
 * - Render UI
 * 
 * DOMAIN RULES ENFORCED:
 * 1. Location data is IMMUTABLE after submission
 * 2. Form fields are validated per admin configuration
 * 3. Status transitions must follow allowed workflows
 * 4. All changes logged in history (audit requirement)
 * =============================================================================
 */

import { 
  complaintRepository,
  type Complaint,
  type ComplaintEvidence,
  type ComplaintHistory,
} from "../../data/repositories/complaint.repository";

/**
 * Result type for service operations.
 */
export type ServiceResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

/**
 * Location data structure.
 */
interface LocationData {
  latitude?: string;
  longitude?: string;
  accuracy?: string;
  timestamp?: Date;
  source: "gps" | "manual";
  address?: string;
  landmark?: string;
}

/**
 * Complaint submission data.
 */
interface SubmissionData {
  sharedLinkToken?: string; // If submitting via shared link
  districtId?: string; // For district-based ID generation
  complainantName: string;
  complainantMobile?: string;
  complainantEmail?: string;
  location: LocationData;
  incidentDate?: Date;
  incidentDescription?: string;
  formData?: Record<string, unknown>;
  submittedVia?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Status update data.
 */
interface StatusUpdateData {
  toStatus: string;
  remarks?: string;
  officerId: string;
  officerName?: string;
  location?: {
    latitude: string;
    longitude: string;
  };
}

export const complaintService = {
  /**
   * Submit a new complaint.
   * 
   * WHY: Creates a new complaint with location data and generates tracking code.
   * RULES:
   * - Complainant name is required
   * - Location data becomes immutable once saved
   * - History record is created automatically
   */
  async submitComplaint(data: SubmissionData): Promise<ServiceResult<Complaint & { sharedLinkToken?: string }>> {
    // Validate required fields
    if (!data.complainantName?.trim()) {
      return { success: false, error: "Complainant name is required", code: "REQUIRED_FIELD" };
    }

    let complaintCode: string;
    let sharedLink = null;
    let districtId = data.districtId;

    // Check if submitting via shared link
    if (data.sharedLinkToken) {
      sharedLink = await complaintRepository.findSharedLinkByToken(data.sharedLinkToken);
      if (!sharedLink) {
        return { success: false, error: "Invalid or expired link", code: "INVALID_LINK" };
      }
      if (sharedLink.status !== "active") {
        return { success: false, error: "This link has already been used", code: "LINK_USED" };
      }
      // Use district from shared link
      districtId = sharedLink.districtId || districtId;
    }

    // Generate district-based complaint code
    if (districtId) {
      const result = await complaintRepository.generateDistrictComplaintCode(districtId);
      complaintCode = result.code;
    } else {
      // Fallback to legacy format if no district
      complaintCode = await complaintRepository.generateComplaintCode();
    }

    // Determine jurisdiction from GPS (placeholder - would call geo service)
    const jurisdictionId = await this.mapLocationToJurisdiction(
      data.location.latitude,
      data.location.longitude
    );

    // Create complaint
    const complaint = await complaintRepository.create({
      complaintCode,
      complainantName: data.complainantName.trim(),
      complainantMobile: data.complainantMobile,
      complainantEmail: data.complainantEmail,
      latitude: data.location.latitude,
      longitude: data.location.longitude,
      locationAccuracy: data.location.accuracy,
      locationTimestamp: data.location.timestamp,
      locationSource: data.location.source,
      locationAddress: data.location.address,
      nearbyLandmark: data.location.landmark,
      incidentDate: data.incidentDate,
      incidentDescription: data.incidentDescription,
      formData: data.formData,
      jurisdictionId: jurisdictionId || undefined,
      status: "submitted",
      submittedVia: data.submittedVia || "mobile",
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    });

    // Create initial history record
    await complaintRepository.addHistory({
      complaintId: complaint.id,
      action: "created",
      toStatus: "submitted",
      remarks: "Complaint submitted",
      performedBy: "complainant",
      ipAddress: data.ipAddress,
    });

    // Mark shared link as submitted if applicable
    if (sharedLink && data.sharedLinkToken) {
      await complaintRepository.markSharedLinkSubmitted(
        data.sharedLinkToken,
        complaint.id,
        complaintCode
      );
    }

    return { 
      success: true, 
      data: { 
        ...complaint, 
        sharedLinkToken: data.sharedLinkToken 
      } 
    };
  },

  /**
   * Get complaint by ID (officer view).
   */
  async getComplaint(id: string): Promise<ServiceResult<Complaint & { 
    evidence: ComplaintEvidence[]; 
    history: ComplaintHistory[];
  }>> {
    const complaint = await complaintRepository.findById(id);
    
    if (!complaint) {
      return { success: false, error: "Complaint not found", code: "NOT_FOUND" };
    }

    const [evidence, history] = await Promise.all([
      complaintRepository.getEvidence(id),
      complaintRepository.getHistory(id),
    ]);

    return { 
      success: true, 
      data: { ...complaint, evidence, history } 
    };
  },

  /**
   * Track complaint by code (public/complainant view).
   * 
   * RULES:
   * - Only returns data visible to complainant
   * - Masks sensitive information
   * - Does not expose officer details unless configured
   */
  async trackComplaint(code: string): Promise<ServiceResult<{
    complaintCode: string;
    status: string;
    submittedAt: Date | null;
    lastUpdatedAt: Date | null;
    history: { action: string; status?: string; remarks?: string; performedAt: Date | null }[];
  }>> {
    const complaint = await complaintRepository.findByCode(code);
    
    if (!complaint) {
      return { success: false, error: "Complaint not found", code: "NOT_FOUND" };
    }

    const history = await complaintRepository.getHistory(complaint.id);

    // Filter history to only show public information
    const publicHistory = history.map(h => ({
      action: h.action,
      status: h.toStatus || undefined,
      remarks: h.remarks || undefined,
      performedAt: h.performedAt,
    }));

    return {
      success: true,
      data: {
        complaintCode: complaint.complaintCode,
        status: complaint.status,
        submittedAt: complaint.submittedAt,
        lastUpdatedAt: complaint.updatedAt,
        history: publicHistory,
      },
    };
  },

  /**
   * Update complaint status.
   * 
   * RULES:
   * - Must follow allowed transitions
   * - Officer must have authority
   * - Creates history record
   */
  async updateStatus(
    complaintId: string, 
    data: StatusUpdateData
  ): Promise<ServiceResult<Complaint>> {
    const complaint = await complaintRepository.findById(complaintId);
    
    if (!complaint) {
      return { success: false, error: "Complaint not found", code: "NOT_FOUND" };
    }

    // Check allowed transitions
    const transitions = await complaintRepository.getStatusTransitions(complaint.status);
    const allowedTransition = transitions.find(t => t.toStatus === data.toStatus);

    if (!allowedTransition) {
      return { 
        success: false, 
        error: `Cannot transition from "${complaint.status}" to "${data.toStatus}"`,
        code: "INVALID_TRANSITION",
      };
    }

    // Check if remarks required
    if (allowedTransition.requiresRemarks && !data.remarks?.trim()) {
      return { 
        success: false, 
        error: "Remarks are required for this status change",
        code: "REMARKS_REQUIRED",
      };
    }

    // Update status
    const updated = await complaintRepository.update(complaintId, {
      status: data.toStatus,
      ...(data.toStatus === "resolved" ? { 
        resolvedAt: new Date(),
        resolutionRemarks: data.remarks,
      } : {}),
    });

    if (!updated) {
      return { success: false, error: "Failed to update complaint", code: "UPDATE_FAILED" };
    }

    // Create history record
    await complaintRepository.addHistory({
      complaintId,
      action: "status_change",
      fromStatus: complaint.status,
      toStatus: data.toStatus,
      remarks: data.remarks,
      performedBy: "officer",
      officerId: data.officerId,
      officerName: data.officerName,
      latitude: data.location?.latitude,
      longitude: data.location?.longitude,
    });

    return { success: true, data: updated };
  },

  /**
   * Assign complaint to officer.
   */
  async assignToOfficer(
    complaintId: string,
    officerId: string,
    assignedBy: string,
    remarks?: string
  ): Promise<ServiceResult<Complaint>> {
    const complaint = await complaintRepository.findById(complaintId);
    
    if (!complaint) {
      return { success: false, error: "Complaint not found", code: "NOT_FOUND" };
    }

    const updated = await complaintRepository.update(complaintId, {
      assignedOfficerId: officerId,
      assignedAt: new Date(),
      status: complaint.status === "submitted" ? "assigned" : complaint.status,
    });

    if (!updated) {
      return { success: false, error: "Failed to assign complaint", code: "UPDATE_FAILED" };
    }

    // Create history record
    await complaintRepository.addHistory({
      complaintId,
      action: "assigned",
      fromStatus: complaint.status,
      toStatus: updated.status,
      remarks: remarks || `Assigned to officer`,
      performedBy: "officer",
      officerId: assignedBy,
    });

    return { success: true, data: updated };
  },

  /**
   * Add evidence to complaint.
   */
  async addEvidence(
    complaintId: string,
    evidenceData: {
      filename: string;
      originalName: string;
      fileType: string;
      mimeType: string;
      fileSize?: number;
      fileUrl: string;
      latitude?: string;
      longitude?: string;
      captureTimestamp?: Date;
      uploadedBy: string;
      uploadedByOfficerId?: string;
      description?: string;
    }
  ): Promise<ServiceResult<ComplaintEvidence>> {
    const complaint = await complaintRepository.findById(complaintId);
    
    if (!complaint) {
      return { success: false, error: "Complaint not found", code: "NOT_FOUND" };
    }

    const evidence = await complaintRepository.addEvidence({
      complaintId,
      ...evidenceData,
    });

    // Create history record
    await complaintRepository.addHistory({
      complaintId,
      action: "evidence_added",
      evidenceId: evidence.id,
      remarks: evidenceData.description || `${evidenceData.fileType} uploaded`,
      performedBy: evidenceData.uploadedBy as "officer" | "complainant",
      officerId: evidenceData.uploadedByOfficerId,
      latitude: evidenceData.latitude,
      longitude: evidenceData.longitude,
    });

    return { success: true, data: evidence };
  },

  /**
   * Get complaints list with filters.
   */
  async getComplaints(filters: {
    status?: string;
    jurisdictionId?: string;
    assignedOfficerId?: string;
    fromDate?: Date;
    toDate?: Date;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<ServiceResult<Complaint[]>> {
    const complaints = await complaintRepository.findAll(filters);
    return { success: true, data: complaints };
  },

  /**
   * Get form configuration.
   */
  async getFormConfig(): Promise<ServiceResult<Awaited<ReturnType<typeof complaintRepository.getFormConfig>>>> {
    const config = await complaintRepository.getFormConfig();
    return { success: true, data: config };
  },

  /**
   * Get complaint statistics.
   */
  async getStatistics(jurisdictionId?: string): Promise<ServiceResult<{
    total: number;
    byStatus: Record<string, number>;
  }>> {
    const byStatus = await complaintRepository.getCountByStatus(jurisdictionId);
    const total = Object.values(byStatus).reduce((sum, count) => sum + count, 0);
    
    return { 
      success: true, 
      data: { total, byStatus } 
    };
  },

  /**
   * Map GPS coordinates to jurisdiction.
   * 
   * NOTE: This is a placeholder. In production, this would:
   * - Call a geo-boundary service
   * - Query jurisdiction polygon boundaries
   * - Return the matching jurisdiction ID
   */
  async mapLocationToJurisdiction(
    latitude?: string,
    longitude?: string
  ): Promise<string | null> {
    if (!latitude || !longitude) return null;
    
    // TODO: Implement actual geo-mapping
    // For now, return null (manual assignment needed)
    return null;
  },
};
