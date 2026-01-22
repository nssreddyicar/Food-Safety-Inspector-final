/**
 * Repository for Institutional Food Safety Inspections
 * 
 * Handles all database operations for institutional inspections,
 * including configuration, pillars, indicators, and inspection records.
 */

import { db } from "../../db";
import { eq, desc, and, sql, asc } from "drizzle-orm";
import {
  institutionTypes,
  institutionalInspectionPillars,
  institutionalInspectionIndicators,
  institutionalInspectionConfig,
  institutionalInspections,
  institutionalInspectionResponses,
  institutionalSurveillanceSamples,
  institutionalInspectionPhotos,
  institutionalInspectionHistory,
  InstitutionType,
  InstitutionalInspectionPillar,
  InstitutionalInspectionIndicator,
  InstitutionalInspectionConfig,
  InstitutionalInspection,
  InstitutionalInspectionResponse,
  InstitutionalSurveillanceSample,
  InstitutionalInspectionPhoto,
} from "../../../shared/schema";

export class InstitutionalInspectionRepository {
  
  // ========== Institution Types ==========
  
  async getAllInstitutionTypes(): Promise<InstitutionType[]> {
    return db
      .select()
      .from(institutionTypes)
      .where(eq(institutionTypes.isActive, true))
      .orderBy(asc(institutionTypes.displayOrder));
  }
  
  async getInstitutionTypeById(id: string): Promise<InstitutionType | undefined> {
    const [result] = await db
      .select()
      .from(institutionTypes)
      .where(eq(institutionTypes.id, id))
      .limit(1);
    return result;
  }
  
  async createInstitutionType(data: { name: string; code: string; category?: string; description?: string; displayOrder?: number }): Promise<InstitutionType> {
    const [result] = await db.insert(institutionTypes).values(data).returning();
    return result;
  }
  
  async updateInstitutionType(id: string, data: Partial<InstitutionType>): Promise<InstitutionType | undefined> {
    const [result] = await db
      .update(institutionTypes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(institutionTypes.id, id))
      .returning();
    return result;
  }
  
  // ========== Pillars ==========
  
  async getAllPillars(): Promise<InstitutionalInspectionPillar[]> {
    return db
      .select()
      .from(institutionalInspectionPillars)
      .where(eq(institutionalInspectionPillars.isActive, true))
      .orderBy(asc(institutionalInspectionPillars.displayOrder));
  }
  
  async getPillarById(id: string): Promise<InstitutionalInspectionPillar | undefined> {
    const [result] = await db
      .select()
      .from(institutionalInspectionPillars)
      .where(eq(institutionalInspectionPillars.id, id))
      .limit(1);
    return result;
  }
  
  async updatePillar(id: string, data: Partial<InstitutionalInspectionPillar>): Promise<InstitutionalInspectionPillar | undefined> {
    const [result] = await db
      .update(institutionalInspectionPillars)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(institutionalInspectionPillars.id, id))
      .returning();
    return result;
  }

  async createPillar(data: {
    pillarNumber: number;
    name: string;
    description?: string;
    displayOrder?: number;
  }): Promise<InstitutionalInspectionPillar> {
    const [result] = await db.insert(institutionalInspectionPillars).values({
      ...data,
      displayOrder: data.displayOrder || data.pillarNumber,
    }).returning();
    return result;
  }

  async deletePillar(id: string): Promise<void> {
    await db.delete(institutionalInspectionIndicators).where(eq(institutionalInspectionIndicators.pillarId, id));
    await db.delete(institutionalInspectionPillars).where(eq(institutionalInspectionPillars.id, id));
  }
  
  // ========== Indicators ==========
  
  async getAllIndicators(): Promise<InstitutionalInspectionIndicator[]> {
    return db
      .select()
      .from(institutionalInspectionIndicators)
      .where(eq(institutionalInspectionIndicators.isActive, true))
      .orderBy(asc(institutionalInspectionIndicators.indicatorNumber));
  }
  
  async getIndicatorsByPillar(pillarId: string): Promise<InstitutionalInspectionIndicator[]> {
    return db
      .select()
      .from(institutionalInspectionIndicators)
      .where(and(
        eq(institutionalInspectionIndicators.pillarId, pillarId),
        eq(institutionalInspectionIndicators.isActive, true)
      ))
      .orderBy(asc(institutionalInspectionIndicators.displayOrder));
  }
  
  async getIndicatorById(id: string): Promise<InstitutionalInspectionIndicator | undefined> {
    const [result] = await db
      .select()
      .from(institutionalInspectionIndicators)
      .where(eq(institutionalInspectionIndicators.id, id))
      .limit(1);
    return result;
  }
  
  async updateIndicator(id: string, data: Partial<InstitutionalInspectionIndicator>): Promise<InstitutionalInspectionIndicator | undefined> {
    const [result] = await db
      .update(institutionalInspectionIndicators)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(institutionalInspectionIndicators.id, id))
      .returning();
    return result;
  }
  
  async createIndicator(data: {
    pillarId: string;
    indicatorNumber: number;
    name: string;
    riskLevel: string;
    weight: number;
    description?: string;
    displayOrder?: number;
  }): Promise<InstitutionalInspectionIndicator> {
    const [result] = await db.insert(institutionalInspectionIndicators).values(data).returning();
    return result;
  }

  async deleteIndicator(id: string): Promise<void> {
    await db.delete(institutionalInspectionIndicators).where(eq(institutionalInspectionIndicators.id, id));
  }
  
  // ========== Configuration ==========
  
  async getAllConfig(): Promise<InstitutionalInspectionConfig[]> {
    return db.select().from(institutionalInspectionConfig);
  }
  
  async getConfigValue(key: string): Promise<string | null> {
    const [result] = await db
      .select()
      .from(institutionalInspectionConfig)
      .where(eq(institutionalInspectionConfig.configKey, key))
      .limit(1);
    return result?.configValue ?? null;
  }
  
  async updateConfig(key: string, value: string, updatedBy?: string): Promise<InstitutionalInspectionConfig | undefined> {
    const [result] = await db
      .update(institutionalInspectionConfig)
      .set({ configValue: value, updatedBy, updatedAt: new Date() })
      .where(eq(institutionalInspectionConfig.configKey, key))
      .returning();
    return result;
  }
  
  // ========== Inspections ==========
  
  async createInspection(data: {
    inspectionCode: string;
    institutionTypeId: string;
    institutionName: string;
    institutionAddress: string;
    districtId: string;
    jurisdictionId?: string;
    latitude?: string;
    longitude?: string;
    inspectionDate: Date;
    officerId: string;
    headOfInstitution?: object;
    inchargeWarden?: object;
    contractorCookServiceProvider?: object;
    configSnapshot?: object;
  }): Promise<InstitutionalInspection> {
    const [result] = await db.insert(institutionalInspections).values(data).returning();
    return result;
  }
  
  async getInspectionById(id: string): Promise<InstitutionalInspection | undefined> {
    const [result] = await db
      .select()
      .from(institutionalInspections)
      .where(eq(institutionalInspections.id, id))
      .limit(1);
    return result;
  }
  
  async getInspectionByCode(code: string): Promise<InstitutionalInspection | undefined> {
    const [result] = await db
      .select()
      .from(institutionalInspections)
      .where(eq(institutionalInspections.inspectionCode, code))
      .limit(1);
    return result;
  }
  
  async getInspectionsByOfficer(officerId: string): Promise<InstitutionalInspection[]> {
    return db
      .select()
      .from(institutionalInspections)
      .where(eq(institutionalInspections.officerId, officerId))
      .orderBy(desc(institutionalInspections.createdAt));
  }
  
  async getInspectionsByDistrict(districtId: string): Promise<InstitutionalInspection[]> {
    return db
      .select()
      .from(institutionalInspections)
      .where(eq(institutionalInspections.districtId, districtId))
      .orderBy(desc(institutionalInspections.createdAt));
  }
  
  async getAllInspections(limit = 100): Promise<InstitutionalInspection[]> {
    return db
      .select()
      .from(institutionalInspections)
      .orderBy(desc(institutionalInspections.createdAt))
      .limit(limit);
  }
  
  async updateInspection(id: string, data: Partial<InstitutionalInspection>): Promise<InstitutionalInspection | undefined> {
    const [result] = await db
      .update(institutionalInspections)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(institutionalInspections.id, id))
      .returning();
    return result;
  }
  
  // ========== Inspection Responses ==========
  
  async createResponse(data: {
    inspectionId: string;
    indicatorId: string;
    response: string;
    remarks?: string;
    indicatorName: string;
    pillarName: string;
    riskLevel: string;
    weight: number;
    scoreContribution: number;
  }): Promise<InstitutionalInspectionResponse> {
    const [result] = await db.insert(institutionalInspectionResponses).values(data).returning();
    return result;
  }
  
  async getResponsesByInspection(inspectionId: string): Promise<InstitutionalInspectionResponse[]> {
    return db
      .select()
      .from(institutionalInspectionResponses)
      .where(eq(institutionalInspectionResponses.inspectionId, inspectionId));
  }
  
  async bulkCreateResponses(responses: Array<{
    inspectionId: string;
    indicatorId: string;
    response: string;
    remarks?: string;
    indicatorName: string;
    pillarName: string;
    riskLevel: string;
    weight: number;
    scoreContribution: number;
  }>): Promise<InstitutionalInspectionResponse[]> {
    if (responses.length === 0) return [];
    return db.insert(institutionalInspectionResponses).values(responses).returning();
  }
  
  // ========== Surveillance Samples ==========
  
  async createSample(data: {
    inspectionId: string;
    sampleName: string;
    sampleCode: string;
    placeOfCollection: string;
    packingType: string;
    collectionDateTime: Date;
    witnessName: string;
    witnessAddress: string;
    witnessMobile: string;
    photos?: object;
  }): Promise<InstitutionalSurveillanceSample> {
    const [result] = await db.insert(institutionalSurveillanceSamples).values(data).returning();
    return result;
  }
  
  async getSamplesByInspection(inspectionId: string): Promise<InstitutionalSurveillanceSample[]> {
    return db
      .select()
      .from(institutionalSurveillanceSamples)
      .where(eq(institutionalSurveillanceSamples.inspectionId, inspectionId));
  }
  
  async updateSample(id: string, data: Partial<InstitutionalSurveillanceSample>): Promise<InstitutionalSurveillanceSample | undefined> {
    const [result] = await db
      .update(institutionalSurveillanceSamples)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(institutionalSurveillanceSamples.id, id))
      .returning();
    return result;
  }
  
  // ========== Photos ==========
  
  async createPhoto(data: {
    inspectionId: string;
    filename: string;
    originalName: string;
    fileUrl: string;
    category: string;
    latitude?: string;
    longitude?: string;
    captureTimestamp?: Date;
    watermarkApplied?: boolean;
    watermarkDetails?: object;
  }): Promise<InstitutionalInspectionPhoto> {
    const [result] = await db.insert(institutionalInspectionPhotos).values(data).returning();
    return result;
  }
  
  async getPhotosByInspection(inspectionId: string): Promise<InstitutionalInspectionPhoto[]> {
    return db
      .select()
      .from(institutionalInspectionPhotos)
      .where(eq(institutionalInspectionPhotos.inspectionId, inspectionId));
  }
  
  async getPhotosByCategory(inspectionId: string, category: string): Promise<InstitutionalInspectionPhoto[]> {
    return db
      .select()
      .from(institutionalInspectionPhotos)
      .where(and(
        eq(institutionalInspectionPhotos.inspectionId, inspectionId),
        eq(institutionalInspectionPhotos.category, category)
      ));
  }
  
  // ========== History ==========
  
  async addHistory(data: {
    inspectionId: string;
    action: string;
    details?: object;
    performedBy: string;
    performedByName?: string;
    ipAddress?: string;
  }): Promise<void> {
    await db.insert(institutionalInspectionHistory).values(data);
  }
  
  async getHistoryByInspection(inspectionId: string): Promise<any[]> {
    return db
      .select()
      .from(institutionalInspectionHistory)
      .where(eq(institutionalInspectionHistory.inspectionId, inspectionId))
      .orderBy(desc(institutionalInspectionHistory.performedAt));
  }
  
  // ========== Code Generation ==========
  
  async generateInspectionCode(districtId: string): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    const count = await db
      .select({ count: sql<number>`count(*)` })
      .from(institutionalInspections)
      .where(eq(institutionalInspections.districtId, districtId));
    
    const seq = (count[0]?.count || 0) + 1;
    return `INS${year}${month}${day}${String(seq).padStart(4, '0')}`;
  }
  
  // ========== Statistics ==========
  
  async getInspectionStats(districtId?: string): Promise<{
    total: number;
    draft: number;
    submitted: number;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
  }> {
    let query = db.select().from(institutionalInspections);
    
    if (districtId) {
      query = query.where(eq(institutionalInspections.districtId, districtId)) as any;
    }
    
    const inspections = await query;
    
    return {
      total: inspections.length,
      draft: inspections.filter(i => i.status === 'draft').length,
      submitted: inspections.filter(i => i.status === 'submitted').length,
      highRisk: inspections.filter(i => i.riskClassification === 'high').length,
      mediumRisk: inspections.filter(i => i.riskClassification === 'medium').length,
      lowRisk: inspections.filter(i => i.riskClassification === 'low').length,
    };
  }
}

export const institutionalInspectionRepository = new InstitutionalInspectionRepository();
