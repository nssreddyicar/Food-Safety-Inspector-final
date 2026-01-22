/**
 * =============================================================================
 * INPUT VALIDATION SCHEMAS (ZOD)
 * =============================================================================
 * 
 * Comprehensive validation for all API inputs using Zod.
 * Ensures data integrity and prevents malformed data entry.
 */

import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

// ==================== COMMON SCHEMAS ====================

export const uuidSchema = z.string().uuid("Invalid UUID format");

export const emailSchema = z.string().email("Invalid email format").max(255);

export const phoneSchema = z
  .string()
  .regex(/^[6-9]\d{9}$/, "Invalid phone number (must be 10 digits starting with 6-9)");

export const dateSchema = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  "Invalid date format"
);

export const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

// ==================== OFFICER SCHEMAS ====================

export const officerLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const officerCreateSchema = z.object({
  name: z.string().min(2).max(100),
  email: emailSchema,
  phone: phoneSchema.optional(),
  designation: z.string().max(100).optional(),
  licenseNumber: z.string().max(50).optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  status: z.enum(["active", "inactive", "suspended"]).default("active"),
});

export const officerUpdateSchema = officerCreateSchema.partial().omit({ password: true });

// ==================== INSPECTION SCHEMAS ====================

export const inspectionCreateSchema = z.object({
  officerId: uuidSchema,
  jurisdictionId: uuidSchema,
  type: z.string().max(50),
  fboName: z.string().min(1).max(200),
  fboAddress: z.string().min(1).max(500),
  fboLicenseNumber: z.string().max(50).optional(),
  inspectionDate: dateSchema,
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  findings: z.string().optional(),
  deviations: z.array(z.object({
    category: z.string(),
    description: z.string(),
    severity: z.enum(["minor", "major", "critical"]),
  })).optional(),
});

export const inspectionUpdateSchema = z.object({
  status: z.enum(["draft", "in_progress", "completed", "follow_up", "closed"]).optional(),
  findings: z.string().optional(),
  recommendations: z.string().optional(),
  closureDate: dateSchema.optional(),
  closureRemarks: z.string().optional(),
}).refine(
  (data) => {
    // Cannot update closed inspections
    return true; // Additional business logic in route handler
  },
  { message: "Cannot modify closed inspections" }
);

// ==================== SAMPLE SCHEMAS ====================

export const sampleCreateSchema = z.object({
  officerId: uuidSchema,
  jurisdictionId: uuidSchema,
  inspectionId: uuidSchema.optional(),
  sampleCode: z.string().max(50),
  productName: z.string().min(1).max(200),
  brandName: z.string().max(100).optional(),
  batchNumber: z.string().max(50).optional(),
  manufacturingDate: dateSchema.optional(),
  expiryDate: dateSchema.optional(),
  quantity: z.string().max(50),
  collectionDate: dateSchema,
  collectionLocation: z.string().max(500),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  fboName: z.string().max(200),
  fboAddress: z.string().max(500),
  fboLicenseNumber: z.string().max(50).optional(),
});

export const sampleUpdateSchema = z.object({
  status: z.enum([
    "collected",
    "in_transit",
    "received_at_lab",
    "under_testing",
    "report_ready",
    "closed",
  ]).optional(),
  labName: z.string().max(200).optional(),
  labReceiptDate: dateSchema.optional(),
  testResults: z.string().optional(),
  testReportNumber: z.string().max(50).optional(),
  isConforming: z.boolean().optional(),
});

// ==================== COMPLAINT SCHEMAS ====================

export const complaintCreateSchema = z.object({
  complainantName: z.string().min(2).max(100),
  complainantPhone: phoneSchema,
  complainantEmail: emailSchema.optional(),
  complainantAddress: z.string().max(500).optional(),
  fboName: z.string().min(1).max(200),
  fboAddress: z.string().min(1).max(500),
  complaintType: z.string().max(100),
  description: z.string().min(10).max(2000),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  evidenceUrls: z.array(z.string().url()).optional(),
});

export const complaintUpdateSchema = z.object({
  status: z.enum([
    "received",
    "under_investigation",
    "action_taken",
    "closed",
    "rejected",
  ]).optional(),
  assignedOfficerId: uuidSchema.optional(),
  investigationNotes: z.string().optional(),
  actionTaken: z.string().optional(),
  closureRemarks: z.string().optional(),
});

// ==================== COURT CASE SCHEMAS ====================

export const courtCaseCreateSchema = z.object({
  officerId: uuidSchema,
  jurisdictionId: uuidSchema,
  caseNumber: z.string().min(1).max(50),
  courtName: z.string().min(1).max(200),
  defendantName: z.string().min(1).max(200),
  defendantAddress: z.string().max(500),
  offenseDescription: z.string().min(10),
  filingDate: dateSchema,
  relatedInspectionId: uuidSchema.optional(),
  relatedSampleId: uuidSchema.optional(),
});

export const hearingCreateSchema = z.object({
  caseId: uuidSchema,
  hearingDate: dateSchema,
  hearingType: z.string().max(100),
  courtRoom: z.string().max(50).optional(),
  judgeName: z.string().max(100).optional(),
  notes: z.string().optional(),
});

// ==================== VALIDATION MIDDLEWARE ====================

/**
 * Creates a validation middleware from a Zod schema
 */
export function validateBody<T extends z.ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    
    if (!result.success) {
      const errors = result.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      
      return res.status(400).json({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: errors,
      });
    }
    
    // Replace body with validated and transformed data
    req.body = result.data;
    next();
  };
}

/**
 * Validates query parameters
 */
export function validateQuery<T extends z.ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    
    if (!result.success) {
      const errors = result.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      
      return res.status(400).json({
        error: "Invalid query parameters",
        code: "QUERY_VALIDATION_ERROR",
        details: errors,
      });
    }
    
    req.query = result.data as any;
    next();
  };
}

/**
 * Validates URL parameters
 */
export function validateParams<T extends z.ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    
    if (!result.success) {
      const errors = result.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      
      return res.status(400).json({
        error: "Invalid URL parameters",
        code: "PARAMS_VALIDATION_ERROR",
        details: errors,
      });
    }
    
    req.params = result.data as any;
    next();
  };
}
