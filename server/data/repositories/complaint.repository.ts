/**
 * =============================================================================
 * FILE: server/data/repositories/complaint.repository.ts
 * LAYER: DATA ACCESS (Layer 2C)
 * =============================================================================
 * 
 * PURPOSE:
 * Provides data access methods for complaint records.
 * 
 * WHAT THIS FILE MUST DO:
 * - Execute database queries for complaints
 * - Return typed results
 * - Handle query construction
 * 
 * WHAT THIS FILE MUST NOT DO:
 * - Contain business logic
 * - Make workflow decisions
 * - Validate business rules (domain layer does this)
 * =============================================================================
 */

import { db } from "../../db";
import { 
  complaints, 
  complaintEvidence, 
  complaintHistory,
  complaintFormConfigs,
  complaintStatusWorkflows,
  complaintSettings,
  complaintSequences,
  sharedComplaintLinks,
  districts,
  type Complaint,
  type ComplaintEvidence,
  type ComplaintHistory,
  type ComplaintFormConfig,
  type ComplaintStatusWorkflow,
  type ComplaintSetting,
  type ComplaintSequence,
  type SharedComplaintLink,
} from "../../../shared/schema";
import { eq, and, desc, gte, lte, like, sql } from "drizzle-orm";
import crypto from "crypto";

export interface NewComplaint {
  complaintCode: string;
  complainantName: string;
  complainantMobile?: string;
  complainantEmail?: string;
  latitude?: string;
  longitude?: string;
  locationAccuracy?: string;
  locationTimestamp?: Date;
  locationSource: string;
  locationAddress?: string;
  nearbyLandmark?: string;
  incidentDate?: Date;
  incidentDescription?: string;
  formData?: Record<string, unknown>;
  jurisdictionId?: string;
  jurisdictionName?: string;
  status?: string;
  submittedVia?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ComplaintFilterOptions {
  status?: string;
  jurisdictionId?: string;
  assignedOfficerId?: string;
  fromDate?: Date;
  toDate?: Date;
  search?: string;
  limit?: number;
  offset?: number;
}

export const complaintRepository = {
  /**
   * Create a new complaint.
   */
  async create(data: NewComplaint): Promise<Complaint> {
    const [created] = await db
      .insert(complaints)
      .values(data)
      .returning();
    return created;
  },

  /**
   * Find complaint by ID.
   */
  async findById(id: string): Promise<Complaint | null> {
    const [complaint] = await db
      .select()
      .from(complaints)
      .where(eq(complaints.id, id))
      .limit(1);
    return complaint || null;
  },

  /**
   * Find complaint by code (public tracking).
   */
  async findByCode(code: string): Promise<Complaint | null> {
    const [complaint] = await db
      .select()
      .from(complaints)
      .where(eq(complaints.complaintCode, code))
      .limit(1);
    return complaint || null;
  },

  /**
   * Find complaints with filters.
   */
  async findAll(options: ComplaintFilterOptions = {}): Promise<Complaint[]> {
    const conditions = [];
    
    if (options.status) {
      conditions.push(eq(complaints.status, options.status));
    }
    if (options.jurisdictionId) {
      conditions.push(eq(complaints.jurisdictionId, options.jurisdictionId));
    }
    if (options.assignedOfficerId) {
      conditions.push(eq(complaints.assignedOfficerId, options.assignedOfficerId));
    }
    if (options.fromDate) {
      conditions.push(gte(complaints.submittedAt, options.fromDate));
    }
    if (options.toDate) {
      conditions.push(lte(complaints.submittedAt, options.toDate));
    }
    if (options.search) {
      conditions.push(
        like(complaints.complainantName, `%${options.search}%`)
      );
    }

    let query = db.select().from(complaints);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    
    return query
      .orderBy(desc(complaints.submittedAt))
      .limit(options.limit || 100)
      .offset(options.offset || 0);
  },

  /**
   * Update complaint.
   */
  async update(id: string, data: Partial<Complaint>): Promise<Complaint | null> {
    const [updated] = await db
      .update(complaints)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(complaints.id, id))
      .returning();
    return updated || null;
  },

  /**
   * Add evidence to complaint.
   */
  async addEvidence(data: {
    complaintId: string;
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
  }): Promise<ComplaintEvidence> {
    const [created] = await db
      .insert(complaintEvidence)
      .values({
        complaintId: data.complaintId,
        filename: data.filename,
        originalName: data.originalName,
        fileType: data.fileType,
        mimeType: data.mimeType,
        fileSize: data.fileSize || null,
        fileUrl: data.fileUrl,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        captureTimestamp: data.captureTimestamp || null,
        uploadedBy: data.uploadedBy,
        uploadedByOfficerId: data.uploadedByOfficerId || null,
        description: data.description || null,
        isDeleted: false,
      })
      .returning();
    return created;
  },

  /**
   * Get evidence for complaint.
   */
  async getEvidence(complaintId: string): Promise<ComplaintEvidence[]> {
    return db
      .select()
      .from(complaintEvidence)
      .where(and(
        eq(complaintEvidence.complaintId, complaintId),
        eq(complaintEvidence.isDeleted, false)
      ))
      .orderBy(desc(complaintEvidence.uploadedAt));
  },

  /**
   * Add history record.
   */
  async addHistory(data: {
    complaintId: string;
    action: string;
    fromStatus?: string;
    toStatus?: string;
    remarks?: string;
    evidenceId?: string;
    performedBy: string;
    officerId?: string;
    officerName?: string;
    latitude?: string;
    longitude?: string;
    ipAddress?: string;
  }): Promise<ComplaintHistory> {
    const [created] = await db
      .insert(complaintHistory)
      .values({
        complaintId: data.complaintId,
        action: data.action,
        fromStatus: data.fromStatus || null,
        toStatus: data.toStatus || null,
        remarks: data.remarks || null,
        evidenceId: data.evidenceId || null,
        performedBy: data.performedBy,
        officerId: data.officerId || null,
        officerName: data.officerName || null,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        ipAddress: data.ipAddress || null,
      })
      .returning();
    return created;
  },

  /**
   * Get history for complaint.
   */
  async getHistory(complaintId: string): Promise<ComplaintHistory[]> {
    return db
      .select()
      .from(complaintHistory)
      .where(eq(complaintHistory.complaintId, complaintId))
      .orderBy(desc(complaintHistory.performedAt));
  },

  /**
   * Get form configuration.
   */
  async getFormConfig(): Promise<ComplaintFormConfig[]> {
    return db
      .select()
      .from(complaintFormConfigs)
      .where(eq(complaintFormConfigs.isActive, true))
      .orderBy(complaintFormConfigs.displayOrder);
  },

  /**
   * Get allowed status transitions.
   */
  async getStatusTransitions(fromStatus?: string): Promise<ComplaintStatusWorkflow[]> {
    const conditions = [eq(complaintStatusWorkflows.isActive, true)];
    
    if (fromStatus) {
      conditions.push(eq(complaintStatusWorkflows.fromStatus, fromStatus));
    }
    
    return db
      .select()
      .from(complaintStatusWorkflows)
      .where(and(...conditions))
      .orderBy(complaintStatusWorkflows.displayOrder);
  },

  /**
   * Get setting value.
   */
  async getSetting(key: string): Promise<string | null> {
    const [setting] = await db
      .select()
      .from(complaintSettings)
      .where(eq(complaintSettings.settingKey, key))
      .limit(1);
    return setting?.settingValue || null;
  },

  /**
   * Generate unique complaint code (legacy format - fallback).
   */
  async generateComplaintCode(): Promise<string> {
    const prefix = "CMP";
    const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, "0");
    
    // Count existing complaints this month
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(complaints)
      .where(like(complaints.complaintCode, `${prefix}${year}${month}%`));
    
    const sequence = ((result?.count || 0) + 1).toString().padStart(4, "0");
    return `${prefix}${year}${month}${sequence}`;
  },

  /**
   * Generate district-based complaint code.
   * Format: {DISTRICT_ABBR}{4-digit-seq}{MMYYYY}
   * Example: DEL0001012026 (Delhi, complaint #1, January 2026)
   */
  async generateDistrictComplaintCode(districtId: string): Promise<{ code: string; sequence: number }> {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    
    // Get district abbreviation
    const [district] = await db
      .select()
      .from(districts)
      .where(eq(districts.id, districtId))
      .limit(1);
    
    // Default abbreviation if district not found or no abbreviation
    const abbr = district?.abbreviation || "GEN";
    
    // Get or create sequence for this district/month/year
    let [sequence] = await db
      .select()
      .from(complaintSequences)
      .where(
        and(
          eq(complaintSequences.districtId, districtId),
          eq(complaintSequences.month, month),
          eq(complaintSequences.year, year)
        )
      )
      .limit(1);
    
    let nextSequence: number;
    
    if (sequence) {
      // Increment existing sequence
      nextSequence = sequence.lastSequence + 1;
      await db
        .update(complaintSequences)
        .set({ lastSequence: nextSequence, updatedAt: new Date() })
        .where(eq(complaintSequences.id, sequence.id));
    } else {
      // Create new sequence for this month
      nextSequence = 1;
      await db
        .insert(complaintSequences)
        .values({
          districtId,
          districtAbbreviation: abbr,
          month,
          year,
          lastSequence: 1,
        });
    }
    
    // Format: ABBR + 4-digit sequence + MM + YYYY
    const seqStr = nextSequence.toString().padStart(4, "0");
    const monthStr = month.toString().padStart(2, "0");
    const code = `${abbr}${seqStr}${monthStr}${year}`;
    
    return { code, sequence: nextSequence };
  },

  /**
   * Get district by ID.
   */
  async getDistrictById(districtId: string) {
    const [district] = await db
      .select()
      .from(districts)
      .where(eq(districts.id, districtId))
      .limit(1);
    return district || null;
  },

  /**
   * Get default district (first active district).
   */
  async getDefaultDistrict() {
    const [district] = await db
      .select()
      .from(districts)
      .where(eq(districts.status, "active"))
      .limit(1);
    return district || null;
  },

  /**
   * Create a shared complaint link.
   */
  async createSharedLink(data: {
    districtId?: string;
    districtAbbreviation?: string;
    sharedByOfficerId?: string;
    sharedByOfficerName?: string;
    expiresAt?: Date;
  }): Promise<SharedComplaintLink> {
    const token = crypto.randomBytes(32).toString("hex");
    
    const [created] = await db
      .insert(sharedComplaintLinks)
      .values({
        token,
        districtId: data.districtId,
        districtAbbreviation: data.districtAbbreviation,
        sharedByOfficerId: data.sharedByOfficerId,
        sharedByOfficerName: data.sharedByOfficerName,
        expiresAt: data.expiresAt,
        status: "active",
      })
      .returning();
    
    return created;
  },

  /**
   * Find shared link by token.
   */
  async findSharedLinkByToken(token: string): Promise<SharedComplaintLink | null> {
    const [link] = await db
      .select()
      .from(sharedComplaintLinks)
      .where(eq(sharedComplaintLinks.token, token))
      .limit(1);
    return link || null;
  },

  /**
   * Mark shared link as submitted.
   */
  async markSharedLinkSubmitted(
    token: string, 
    complaintId: string, 
    complaintCode: string
  ): Promise<void> {
    await db
      .update(sharedComplaintLinks)
      .set({
        status: "submitted",
        complaintId,
        complaintCode,
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sharedComplaintLinks.token, token));
  },

  /**
   * Update shared link with PDF info.
   */
  async updateSharedLinkPdf(token: string, pdfUrl: string): Promise<void> {
    await db
      .update(sharedComplaintLinks)
      .set({
        pdfGenerated: true,
        pdfUrl,
        updatedAt: new Date(),
      })
      .where(eq(sharedComplaintLinks.token, token));
  },

  /**
   * Get shared links by officer.
   */
  async getSharedLinksByOfficer(officerId: string): Promise<SharedComplaintLink[]> {
    return db
      .select()
      .from(sharedComplaintLinks)
      .where(eq(sharedComplaintLinks.sharedByOfficerId, officerId))
      .orderBy(desc(sharedComplaintLinks.createdAt));
  },

  /**
   * Get all shared links (admin).
   */
  async getAllSharedLinks(): Promise<SharedComplaintLink[]> {
    return db
      .select()
      .from(sharedComplaintLinks)
      .orderBy(desc(sharedComplaintLinks.createdAt));
  },

  /**
   * Delete a shared link.
   */
  async deleteSharedLink(id: string): Promise<void> {
    await db
      .delete(sharedComplaintLinks)
      .where(eq(sharedComplaintLinks.id, id));
  },

  /**
   * Get complaints count by status.
   */
  async getCountByStatus(jurisdictionId?: string): Promise<Record<string, number>> {
    const conditions = [];
    if (jurisdictionId) {
      conditions.push(eq(complaints.jurisdictionId, jurisdictionId));
    }

    const results = await db
      .select({
        status: complaints.status,
        count: sql<number>`count(*)`,
      })
      .from(complaints)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(complaints.status);

    return results.reduce((acc, { status, count }) => {
      acc[status] = count;
      return acc;
    }, {} as Record<string, number>);
  },
};

export type { Complaint, ComplaintEvidence, ComplaintHistory, ComplaintFormConfig, SharedComplaintLink, ComplaintSequence };
