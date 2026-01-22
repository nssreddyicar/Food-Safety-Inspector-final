/**
 * Seed script for Institutional Food Safety Inspection Module
 * 
 * Creates:
 * - Default institution types (MDM Schools, KGBV, Hospitals, etc.)
 * - 7 FSSAI-aligned pillars
 * - 35 risk indicators with weights
 * - Default risk threshold configuration
 */

import { db } from "../db";
import {
  institutionTypes,
  institutionalInspectionPillars,
  institutionalInspectionIndicators,
  institutionalInspectionConfig,
  institutionalInspectionPersonTypes,
} from "../../shared/schema";

// Person Types Data - Admin-configurable person types with their fields
const personTypesData = [
  {
    typeName: "Head of Institution",
    typeCode: "head_of_institution",
    description: "Principal, Director, Manager or Head of the institution",
    displayOrder: 1,
    isActive: true,
    isRequired: false,
    maxCount: 1,
    fields: [
      { key: "fullName", label: "Full Name", type: "text", required: true, showInWatermark: true },
      { key: "designation", label: "Designation", type: "text", required: false, showInWatermark: true },
      { key: "mobile", label: "Mobile Number", type: "phone", required: false, showInWatermark: true },
      { key: "email", label: "Email", type: "email", required: false, showInWatermark: false },
    ],
  },
  {
    typeName: "Warden / Incharge",
    typeCode: "warden_incharge",
    description: "Hostel warden, supervisor, or person in charge",
    displayOrder: 2,
    isActive: true,
    isRequired: false,
    maxCount: 2,
    fields: [
      { key: "fullName", label: "Full Name", type: "text", required: true, showInWatermark: true },
      { key: "designation", label: "Designation", type: "text", required: false, showInWatermark: true },
      { key: "mobile", label: "Mobile Number", type: "phone", required: true, showInWatermark: true },
    ],
  },
  {
    typeName: "Contractor / Caterer",
    typeCode: "contractor_caterer",
    description: "Food contractor, caterer, or food service provider",
    displayOrder: 3,
    isActive: true,
    isRequired: false,
    maxCount: 3,
    fields: [
      { key: "fullName", label: "Full Name / Firm Name", type: "text", required: true, showInWatermark: true },
      { key: "mobile", label: "Mobile Number", type: "phone", required: true, showInWatermark: true },
      { key: "fssaiLicense", label: "FSSAI License No.", type: "text", required: false, showInWatermark: false },
      { key: "licenseExpiry", label: "License Expiry Date", type: "date", required: false, showInWatermark: false },
    ],
  },
  {
    typeName: "Cook / Food Handler",
    typeCode: "cook_food_handler",
    description: "Cook or food handler working at the institution",
    displayOrder: 4,
    isActive: true,
    isRequired: false,
    maxCount: 5,
    fields: [
      { key: "fullName", label: "Full Name", type: "text", required: true, showInWatermark: true },
      { key: "mobile", label: "Mobile Number", type: "phone", required: false, showInWatermark: true },
      { key: "healthCertificate", label: "Health Certificate", type: "text", required: false, showInWatermark: false },
      { key: "certificateExpiry", label: "Certificate Expiry", type: "date", required: false, showInWatermark: false },
    ],
  },
  {
    typeName: "Supervisor / Observer",
    typeCode: "supervisor_observer",
    description: "Meal supervisor or observer during distribution",
    displayOrder: 5,
    isActive: true,
    isRequired: false,
    maxCount: 2,
    fields: [
      { key: "fullName", label: "Full Name", type: "text", required: true, showInWatermark: true },
      { key: "designation", label: "Designation", type: "text", required: false, showInWatermark: true },
      { key: "mobile", label: "Mobile Number", type: "phone", required: false, showInWatermark: true },
    ],
  },
];

// Institution Types Data
const institutionTypesData = [
  { name: "Mid Day Meal School", code: "MDM", category: "education", description: "Government schools serving mid-day meals to students", displayOrder: 1 },
  { name: "KGBV School", code: "KGBV", category: "education", description: "Kasturba Gandhi Balika Vidyalaya residential schools", displayOrder: 2 },
  { name: "Residential School", code: "RS", category: "education", description: "Government residential schools with hostel facilities", displayOrder: 3 },
  { name: "School Hostel", code: "SH", category: "education", description: "Hostels attached to government schools", displayOrder: 4 },
  { name: "College Hostel", code: "CH", category: "education", description: "Hostels attached to government colleges", displayOrder: 5 },
  { name: "Government Hospital", code: "GH", category: "healthcare", description: "Government hospitals providing patient meals", displayOrder: 6 },
  { name: "Government Canteen", code: "GC", category: "government", description: "Canteens in government offices and buildings", displayOrder: 7 },
  { name: "Government Temple", code: "GT", category: "religious", description: "Government-managed temples serving prasadam", displayOrder: 8 },
  { name: "Other Government Institution", code: "OGI", category: "government", description: "Other institutional food service establishments", displayOrder: 9 },
];

// 7 Pillars Data
const pillarsData = [
  { pillarNumber: 1, name: "Food Procurement & Supply", description: "Indicators related to raw material sourcing, freshness, and water safety", displayOrder: 1 },
  { pillarNumber: 2, name: "Storage & Temperature Control", description: "Indicators for proper storage, refrigeration, and pest control", displayOrder: 2 },
  { pillarNumber: 3, name: "Food Preparation & Cooking", description: "Indicators for cooking temperatures, cross-contamination prevention, and utensil hygiene", displayOrder: 3 },
  { pillarNumber: 4, name: "Personal Hygiene & Health", description: "Indicators for food handler health, protective clothing, and handwashing", displayOrder: 4 },
  { pillarNumber: 5, name: "Cleanliness & Sanitation", description: "Indicators for kitchen environment, waste disposal, and cleaning schedules", displayOrder: 5 },
  { pillarNumber: 6, name: "Serving & Distribution", description: "Indicators for hygienic serving, utensil cleanliness, and food transportation", displayOrder: 6 },
  { pillarNumber: 7, name: "Management & Awareness", description: "Indicators for training, record-keeping, and food safety supervision", displayOrder: 7 },
];

// 35 Indicators Data (organized by pillar)
const indicatorsData = [
  // PILLAR 1: Food Procurement & Supply (5 indicators)
  { pillarNumber: 1, indicatorNumber: 1, name: "Approved and safe raw material sources", riskLevel: "high", weight: 3 },
  { pillarNumber: 1, indicatorNumber: 2, name: "Freshness of raw materials", riskLevel: "high", weight: 3 },
  { pillarNumber: 1, indicatorNumber: 3, name: "No use of expired / damaged food", riskLevel: "high", weight: 3 },
  { pillarNumber: 1, indicatorNumber: 4, name: "Proper vendor records", riskLevel: "medium", weight: 2 },
  { pillarNumber: 1, indicatorNumber: 5, name: "Safe water used for food preparation", riskLevel: "high", weight: 3 },
  
  // PILLAR 2: Storage & Temperature Control (5 indicators)
  { pillarNumber: 2, indicatorNumber: 6, name: "Dry storage cleanliness", riskLevel: "medium", weight: 2 },
  { pillarNumber: 2, indicatorNumber: 7, name: "Separation of raw & cooked food", riskLevel: "high", weight: 3 },
  { pillarNumber: 2, indicatorNumber: 8, name: "Adequate refrigeration", riskLevel: "high", weight: 3 },
  { pillarNumber: 2, indicatorNumber: 9, name: "Proper labeling & FIFO followed", riskLevel: "medium", weight: 2 },
  { pillarNumber: 2, indicatorNumber: 10, name: "Pest-free storage area", riskLevel: "high", weight: 3 },
  
  // PILLAR 3: Food Preparation & Cooking (5 indicators)
  { pillarNumber: 3, indicatorNumber: 11, name: "Proper cooking temperatures achieved", riskLevel: "high", weight: 3 },
  { pillarNumber: 3, indicatorNumber: 12, name: "Cross-contamination prevention", riskLevel: "high", weight: 3 },
  { pillarNumber: 3, indicatorNumber: 13, name: "Clean utensils & equipment", riskLevel: "medium", weight: 2 },
  { pillarNumber: 3, indicatorNumber: 14, name: "Use of potable water for cooking", riskLevel: "high", weight: 3 },
  { pillarNumber: 3, indicatorNumber: 15, name: "Safe reheating practices", riskLevel: "medium", weight: 2 },
  
  // PILLAR 4: Personal Hygiene & Health (5 indicators)
  { pillarNumber: 4, indicatorNumber: 16, name: "Food handlers medically examined", riskLevel: "high", weight: 3 },
  { pillarNumber: 4, indicatorNumber: 17, name: "Use of clean protective clothing", riskLevel: "medium", weight: 2 },
  { pillarNumber: 4, indicatorNumber: 18, name: "Handwashing facilities available", riskLevel: "high", weight: 3 },
  { pillarNumber: 4, indicatorNumber: 19, name: "No ill person handling food", riskLevel: "high", weight: 3 },
  { pillarNumber: 4, indicatorNumber: 20, name: "Personal hygiene awareness", riskLevel: "low", weight: 1 },
  
  // PILLAR 5: Cleanliness & Sanitation (5 indicators)
  { pillarNumber: 5, indicatorNumber: 21, name: "Clean kitchen environment", riskLevel: "medium", weight: 2 },
  { pillarNumber: 5, indicatorNumber: 22, name: "Safe waste disposal system", riskLevel: "medium", weight: 2 },
  { pillarNumber: 5, indicatorNumber: 23, name: "Clean water source maintained", riskLevel: "high", weight: 3 },
  { pillarNumber: 5, indicatorNumber: 24, name: "Regular cleaning schedule followed", riskLevel: "low", weight: 1 },
  { pillarNumber: 5, indicatorNumber: 25, name: "No accumulation of waste", riskLevel: "medium", weight: 2 },
  
  // PILLAR 6: Serving & Distribution (5 indicators)
  { pillarNumber: 6, indicatorNumber: 26, name: "Hygienic serving practices", riskLevel: "high", weight: 3 },
  { pillarNumber: 6, indicatorNumber: 27, name: "Clean serving utensils", riskLevel: "medium", weight: 2 },
  { pillarNumber: 6, indicatorNumber: 28, name: "Protection from environmental contamination", riskLevel: "medium", weight: 2 },
  { pillarNumber: 6, indicatorNumber: 29, name: "Safe transportation of food", riskLevel: "medium", weight: 2 },
  { pillarNumber: 6, indicatorNumber: 30, name: "Timely consumption after preparation", riskLevel: "high", weight: 3 },
  
  // PILLAR 7: Management & Awareness (5 indicators)
  { pillarNumber: 7, indicatorNumber: 31, name: "Food safety training conducted", riskLevel: "low", weight: 1 },
  { pillarNumber: 7, indicatorNumber: 32, name: "Display of hygiene instructions", riskLevel: "low", weight: 1 },
  { pillarNumber: 7, indicatorNumber: 33, name: "Record keeping & monitoring", riskLevel: "medium", weight: 2 },
  { pillarNumber: 7, indicatorNumber: 34, name: "Emergency food safety response readiness", riskLevel: "medium", weight: 2 },
  { pillarNumber: 7, indicatorNumber: 35, name: "Overall food safety supervision", riskLevel: "high", weight: 3 },
];

// Default Configuration
const configData = [
  { configKey: "low_risk_max_score", configValue: "15", configType: "number", description: "Maximum weighted score for Low Risk classification" },
  { configKey: "medium_risk_max_score", configValue: "35", configType: "number", description: "Maximum weighted score for Medium Risk classification (score > low_max and <= medium_max)" },
  { configKey: "high_risk_indicator_threshold", configValue: "5", configType: "number", description: "If non-compliant high-risk indicators exceed this count, auto-classify as High Risk regardless of score" },
  { configKey: "require_all_photos", configValue: "true", configType: "boolean", description: "Require photos from all categories before submission" },
  { configKey: "require_surveillance_sample", configValue: "false", configType: "boolean", description: "Require at least one surveillance sample per inspection" },
  { configKey: "department_name", configValue: "Food Safety and Standards Authority of India", configType: "string", description: "Department name for watermarks and reports" },
  { configKey: "watermark_opacity", configValue: "0.7", configType: "number", description: "Opacity for photo watermarks (0.1 to 1.0)" },
];

export async function seedInstitutionalInspection() {
  console.log("Seeding Institutional Inspection module...");
  
  try {
    // Check if already seeded
    const existingPillars = await db.select().from(institutionalInspectionPillars).limit(1);
    if (existingPillars.length > 0) {
      console.log("Institutional Inspection module already seeded. Skipping...");
      return;
    }
    
    // 1. Insert Institution Types
    console.log("Inserting institution types...");
    await db.insert(institutionTypes).values(institutionTypesData);
    
    // 2. Insert Pillars and get their IDs
    console.log("Inserting pillars...");
    const insertedPillars: { id: string; pillarNumber: number }[] = [];
    for (const pillar of pillarsData) {
      const [inserted] = await db.insert(institutionalInspectionPillars).values(pillar).returning({ id: institutionalInspectionPillars.id, pillarNumber: institutionalInspectionPillars.pillarNumber });
      insertedPillars.push(inserted);
    }
    
    // 3. Insert Indicators with pillar references
    console.log("Inserting indicators...");
    for (const indicator of indicatorsData) {
      const pillar = insertedPillars.find(p => p.pillarNumber === indicator.pillarNumber);
      if (!pillar) {
        console.error(`Pillar not found for indicator ${indicator.indicatorNumber}`);
        continue;
      }
      
      await db.insert(institutionalInspectionIndicators).values({
        pillarId: pillar.id,
        indicatorNumber: indicator.indicatorNumber,
        name: indicator.name,
        riskLevel: indicator.riskLevel,
        weight: indicator.weight,
        displayOrder: indicator.indicatorNumber,
      });
    }
    
    // 4. Insert Configuration
    console.log("Inserting configuration...");
    await db.insert(institutionalInspectionConfig).values(configData);
    
    // 5. Insert Person Types
    console.log("Inserting person types...");
    for (const personType of personTypesData) {
      await db.insert(institutionalInspectionPersonTypes).values({
        typeName: personType.typeName,
        typeCode: personType.typeCode,
        description: personType.description,
        displayOrder: personType.displayOrder,
        isActive: personType.isActive,
        isRequired: personType.isRequired,
        maxCount: personType.maxCount,
        fields: personType.fields,
      });
    }
    
    console.log("Institutional Inspection module seeded successfully!");
    console.log(`- ${institutionTypesData.length} institution types`);
    console.log(`- ${pillarsData.length} pillars`);
    console.log(`- ${indicatorsData.length} indicators`);
    console.log(`- ${configData.length} configuration settings`);
    console.log(`- ${personTypesData.length} person types`);
    
  } catch (error) {
    console.error("Error seeding Institutional Inspection module:", error);
    throw error;
  }
}

// Allow running directly
if (require.main === module) {
  seedInstitutionalInspection()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
