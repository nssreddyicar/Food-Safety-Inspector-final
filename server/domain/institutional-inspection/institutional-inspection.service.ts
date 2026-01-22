/**
 * Domain Service for Institutional Food Safety Inspections
 * 
 * Handles business logic including:
 * - Risk scoring and classification
 * - Inspection workflow validation
 * - Immutability enforcement
 * - Config snapshot for audit reproducibility
 */

import { institutionalInspectionRepository } from "../../data/repositories/institutional-inspection.repository";
import { db } from "../../db";
import { officerAssignments, districts } from "../../../shared/schema";
import { eq, and } from "drizzle-orm";

interface IndicatorResponse {
  indicatorId: string;
  response: 'yes' | 'no' | 'na';
  remarks?: string;
  images?: string[]; // Array of base64 image data URIs
}

interface RiskScoreResult {
  totalScore: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  riskClassification: 'low' | 'medium' | 'high';
  deviations: Array<{
    indicatorId: string;
    indicatorName: string;
    pillarName: string;
    riskLevel: string;
    weight: number;
    remarks?: string;
  }>;
}

interface ResponsiblePerson {
  name: string;
  parentName?: string; // S/o or D/o
  age?: number;
  mobile?: string;
  fssaiLicense?: string;
}

interface CreateInspectionData {
  institutionTypeId: string;
  institutionName: string;
  institutionAddress: string;
  districtId: string;
  jurisdictionId?: string;
  latitude?: string;
  longitude?: string;
  inspectionDate: Date;
  officerId: string;
  headOfInstitution?: ResponsiblePerson;
  inchargeWarden?: ResponsiblePerson;
  contractorCookServiceProvider?: ResponsiblePerson;
}

export class InstitutionalInspectionService {
  
  /**
   * Get form configuration for mobile app
   * Returns pillars, indicators, and institution types
   */
  async getFormConfig() {
    const [institutionTypes, pillars, indicators, config] = await Promise.all([
      institutionalInspectionRepository.getAllInstitutionTypes(),
      institutionalInspectionRepository.getAllPillars(),
      institutionalInspectionRepository.getAllIndicators(),
      institutionalInspectionRepository.getAllConfig(),
    ]);
    
    // Group indicators by pillar
    const pillarsWithIndicators = pillars.map(pillar => ({
      ...pillar,
      indicators: indicators.filter(ind => ind.pillarId === pillar.id),
    }));
    
    // Parse config into key-value object
    const configMap: Record<string, any> = {};
    for (const c of config) {
      if (c.configType === 'number') {
        configMap[c.configKey] = parseFloat(c.configValue);
      } else if (c.configType === 'boolean') {
        configMap[c.configKey] = c.configValue === 'true';
      } else if (c.configType === 'json') {
        try {
          configMap[c.configKey] = JSON.parse(c.configValue);
        } catch {
          configMap[c.configKey] = c.configValue;
        }
      } else {
        configMap[c.configKey] = c.configValue;
      }
    }
    
    return {
      institutionTypes,
      pillars: pillarsWithIndicators,
      config: configMap,
      photoCategories: [
        { id: 'kitchen', name: 'Kitchen', required: true },
        { id: 'storage', name: 'Storage Area', required: true },
        { id: 'cooking_area', name: 'Cooking Area', required: true },
        { id: 'serving_area', name: 'Serving Area', required: true },
        { id: 'water_source', name: 'Water Source', required: true },
        { id: 'waste_disposal', name: 'Waste Disposal', required: true },
      ],
    };
  }
  
  /**
   * Calculate risk score from indicator responses
   */
  async calculateRiskScore(responses: IndicatorResponse[]): Promise<RiskScoreResult> {
    const [indicators, pillars, config] = await Promise.all([
      institutionalInspectionRepository.getAllIndicators(),
      institutionalInspectionRepository.getAllPillars(),
      institutionalInspectionRepository.getAllConfig(),
    ]);
    
    // Get thresholds from config
    const lowMaxScore = parseFloat(config.find(c => c.configKey === 'low_risk_max_score')?.configValue || '15');
    const mediumMaxScore = parseFloat(config.find(c => c.configKey === 'medium_risk_max_score')?.configValue || '35');
    const highRiskThreshold = parseInt(config.find(c => c.configKey === 'high_risk_indicator_threshold')?.configValue || '5');
    
    let totalScore = 0;
    let highRiskCount = 0;
    let mediumRiskCount = 0;
    let lowRiskCount = 0;
    const deviations: RiskScoreResult['deviations'] = [];
    
    for (const resp of responses) {
      if (resp.response !== 'no') continue; // Only non-compliant adds score
      
      const indicator = indicators.find(i => i.id === resp.indicatorId);
      if (!indicator) continue;
      
      const pillar = pillars.find(p => p.id === indicator.pillarId);
      
      totalScore += indicator.weight;
      
      if (indicator.riskLevel === 'high') {
        highRiskCount++;
      } else if (indicator.riskLevel === 'medium') {
        mediumRiskCount++;
      } else {
        lowRiskCount++;
      }
      
      deviations.push({
        indicatorId: indicator.id,
        indicatorName: indicator.name,
        pillarName: pillar?.name || 'Unknown',
        riskLevel: indicator.riskLevel,
        weight: indicator.weight,
        remarks: resp.remarks,
      });
    }
    
    // Determine risk classification
    let riskClassification: 'low' | 'medium' | 'high';
    
    // Special rule: If high-risk indicator count exceeds threshold, auto-classify as high
    if (highRiskCount >= highRiskThreshold) {
      riskClassification = 'high';
    } else if (totalScore <= lowMaxScore) {
      riskClassification = 'low';
    } else if (totalScore <= mediumMaxScore) {
      riskClassification = 'medium';
    } else {
      riskClassification = 'high';
    }
    
    return {
      totalScore,
      highRiskCount,
      mediumRiskCount,
      lowRiskCount,
      riskClassification,
      deviations,
    };
  }
  
  /**
   * Create a new institutional inspection (draft)
   */
  async createInspection(data: CreateInspectionData): Promise<any> {
    // Get district ID from officer's assignment if not provided
    let districtId = data.districtId;
    if (!districtId && data.officerId) {
      // Try to get district from officer's active assignment
      const assignment = await db
        .select({ jurisdictionId: officerAssignments.jurisdictionId })
        .from(officerAssignments)
        .where(
          and(
            eq(officerAssignments.officerId, data.officerId),
            eq(officerAssignments.status, 'active')
          )
        )
        .limit(1);
      
      // If assignment found, use the jurisdiction ID directly
      if (assignment.length > 0) {
        districtId = assignment[0].jurisdictionId;
      }
      
      // Fallback: get first available district
      if (!districtId) {
        const firstDistrict = await db
          .select({ id: districts.id })
          .from(districts)
          .where(eq(districts.status, 'active'))
          .limit(1);
        
        if (firstDistrict.length > 0) {
          districtId = firstDistrict[0].id;
        } else {
          // Ultimate fallback: use a default placeholder district ID
          districtId = 'default-district-00000000';
        }
      }
    }
    
    // If still no districtId, use placeholder (for testing/development)
    if (!districtId) {
      districtId = 'default-district-00000000';
    }
    
    // Generate inspection code
    const inspectionCode = await institutionalInspectionRepository.generateInspectionCode(districtId);
    
    // Capture config snapshot for audit reproducibility
    const config = await institutionalInspectionRepository.getAllConfig();
    const configSnapshot = config.reduce((acc, c) => {
      acc[c.configKey] = c.configValue;
      return acc;
    }, {} as Record<string, string>);
    
    const inspection = await institutionalInspectionRepository.createInspection({
      inspectionCode,
      institutionTypeId: data.institutionTypeId,
      institutionName: data.institutionName,
      institutionAddress: data.institutionAddress,
      districtId,
      jurisdictionId: data.jurisdictionId,
      latitude: data.latitude,
      longitude: data.longitude,
      inspectionDate: data.inspectionDate,
      officerId: data.officerId,
      headOfInstitution: data.headOfInstitution,
      inchargeWarden: data.inchargeWarden,
      contractorCookServiceProvider: data.contractorCookServiceProvider,
      configSnapshot,
    });
    
    // Add history entry
    await institutionalInspectionRepository.addHistory({
      inspectionId: inspection.id,
      action: 'created',
      performedBy: data.officerId,
      details: { inspectionCode },
    });
    
    return inspection;
  }
  
  /**
   * Submit indicator responses and calculate final score
   */
  async submitResponses(
    inspectionId: string,
    responses: IndicatorResponse[],
    officerId: string
  ): Promise<RiskScoreResult> {
    const inspection = await institutionalInspectionRepository.getInspectionById(inspectionId);
    
    if (!inspection) {
      throw new Error('Inspection not found');
    }
    
    if (inspection.status !== 'draft') {
      throw new Error('Cannot modify submitted inspection (immutability rule)');
    }
    
    // Get indicator and pillar details for snapshots
    const [indicators, pillars] = await Promise.all([
      institutionalInspectionRepository.getAllIndicators(),
      institutionalInspectionRepository.getAllPillars(),
    ]);
    
    // Calculate risk score
    const scoreResult = await this.calculateRiskScore(responses);
    
    // Create response records with snapshots
    const responseRecords = responses.map(resp => {
      const indicator = indicators.find(i => i.id === resp.indicatorId);
      const pillar = pillars.find(p => p.id === indicator?.pillarId);
      
      const scoreContribution = resp.response === 'no' ? (indicator?.weight || 0) : 0;
      
      return {
        inspectionId,
        indicatorId: resp.indicatorId,
        response: resp.response,
        remarks: resp.remarks,
        images: resp.images || [],
        indicatorName: indicator?.name || 'Unknown',
        pillarName: pillar?.name || 'Unknown',
        riskLevel: indicator?.riskLevel || 'unknown',
        weight: indicator?.weight || 0,
        scoreContribution,
      };
    });
    
    await institutionalInspectionRepository.bulkCreateResponses(responseRecords);
    
    // Update inspection with scores
    await institutionalInspectionRepository.updateInspection(inspectionId, {
      totalScore: scoreResult.totalScore,
      highRiskCount: scoreResult.highRiskCount,
      mediumRiskCount: scoreResult.mediumRiskCount,
      lowRiskCount: scoreResult.lowRiskCount,
      riskClassification: scoreResult.riskClassification,
      deviations: scoreResult.deviations,
    });
    
    // Add history entry
    await institutionalInspectionRepository.addHistory({
      inspectionId,
      action: 'responses_submitted',
      performedBy: officerId,
      details: {
        totalScore: scoreResult.totalScore,
        riskClassification: scoreResult.riskClassification,
      },
    });
    
    return scoreResult;
  }
  
  /**
   * Submit inspection (makes it immutable)
   */
  async submitInspection(inspectionId: string, officerId: string, recommendations?: string[]): Promise<any> {
    const inspection = await institutionalInspectionRepository.getInspectionById(inspectionId);
    
    if (!inspection) {
      throw new Error('Inspection not found');
    }
    
    if (inspection.status !== 'draft') {
      throw new Error('Inspection already submitted');
    }
    
    // Validate all responses are present
    const responses = await institutionalInspectionRepository.getResponsesByInspection(inspectionId);
    const indicators = await institutionalInspectionRepository.getAllIndicators();
    
    if (responses.length < indicators.length) {
      throw new Error(`All indicators must be responded to. Got ${responses.length} of ${indicators.length}`);
    }
    
    // Update inspection status
    const updated = await institutionalInspectionRepository.updateInspection(inspectionId, {
      status: 'submitted',
      submittedAt: new Date(),
      recommendations: recommendations || [],
    });
    
    // Add history entry
    await institutionalInspectionRepository.addHistory({
      inspectionId,
      action: 'submitted',
      performedBy: officerId,
      details: {
        riskClassification: inspection.riskClassification,
        totalScore: inspection.totalScore,
      },
    });
    
    return updated;
  }
  
  /**
   * Get full inspection details with all related data
   */
  async getInspectionDetails(inspectionId: string) {
    const [inspection, responses, samples, photos, history] = await Promise.all([
      institutionalInspectionRepository.getInspectionById(inspectionId),
      institutionalInspectionRepository.getResponsesByInspection(inspectionId),
      institutionalInspectionRepository.getSamplesByInspection(inspectionId),
      institutionalInspectionRepository.getPhotosByInspection(inspectionId),
      institutionalInspectionRepository.getHistoryByInspection(inspectionId),
    ]);
    
    if (!inspection) {
      return null;
    }
    
    // Get institution type name
    const institutionType = await institutionalInspectionRepository.getInstitutionTypeById(inspection.institutionTypeId);
    
    return {
      ...inspection,
      institutionTypeName: institutionType?.name,
      responses,
      samples,
      photos,
      history,
    };
  }
  
  /**
   * Add surveillance sample to inspection
   */
  async addSample(inspectionId: string, sampleData: {
    sampleName: string;
    sampleCode: string;
    placeOfCollection: string;
    packingType: string;
    collectionDateTime: Date;
    witnessName: string;
    witnessAddress: string;
    witnessMobile: string;
    photos?: string[];
  }, officerId: string) {
    const inspection = await institutionalInspectionRepository.getInspectionById(inspectionId);
    
    if (!inspection) {
      throw new Error('Inspection not found');
    }
    
    if (inspection.status !== 'draft') {
      throw new Error('Cannot add samples to submitted inspection');
    }
    
    const sample = await institutionalInspectionRepository.createSample({
      inspectionId,
      ...sampleData,
      photos: sampleData.photos,
    });
    
    // Add history
    await institutionalInspectionRepository.addHistory({
      inspectionId,
      action: 'sample_added',
      performedBy: officerId,
      details: { sampleCode: sampleData.sampleCode },
    });
    
    return sample;
  }
  
  /**
   * Add photo to inspection
   */
  async addPhoto(inspectionId: string, photoData: {
    filename: string;
    originalName: string;
    fileUrl: string;
    category: string;
    latitude?: string;
    longitude?: string;
    captureTimestamp?: Date;
    watermarkApplied?: boolean;
    watermarkDetails?: object;
  }, officerId: string) {
    const inspection = await institutionalInspectionRepository.getInspectionById(inspectionId);
    
    if (!inspection) {
      throw new Error('Inspection not found');
    }
    
    if (inspection.status !== 'draft') {
      throw new Error('Cannot add photos to submitted inspection');
    }
    
    const photo = await institutionalInspectionRepository.createPhoto({
      inspectionId,
      ...photoData,
    });
    
    // Add history
    await institutionalInspectionRepository.addHistory({
      inspectionId,
      action: 'photo_added',
      performedBy: officerId,
      details: { category: photoData.category },
    });
    
    return photo;
  }
  
  /**
   * Get inspection statistics
   */
  async getStats(districtId?: string) {
    return institutionalInspectionRepository.getInspectionStats(districtId);
  }
  
  /**
   * Validate inspection is editable (not submitted)
   */
  async validateEditable(inspectionId: string): Promise<boolean> {
    const inspection = await institutionalInspectionRepository.getInspectionById(inspectionId);
    return inspection?.status === 'draft';
  }
}

export const institutionalInspectionService = new InstitutionalInspectionService();
