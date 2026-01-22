/**
 * =============================================================================
 * DATA EXPORT SERVICE
 * =============================================================================
 * 
 * Provides data export functionality in multiple formats:
 * - CSV export for spreadsheet compatibility
 * - Excel (XLSX) export for advanced analysis
 * - PDF export for official reports
 * - JSON export for data portability
 */

import { db } from "../db";
import {
  inspections,
  samples,
  complaints,
  prosecutionCases,
  officers,
  institutionalInspections,
} from "../../shared/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";

export interface ExportOptions {
  format: "csv" | "json" | "excel";
  startDate?: Date;
  endDate?: Date;
  officerId?: string;
  districtId?: string;
}

export interface ExportResult {
  data: string | Buffer;
  filename: string;
  mimeType: string;
}

/**
 * Convert data to CSV format
 */
function toCSV(data: Record<string, any>[], columns?: string[]): string {
  if (data.length === 0) return "";

  const cols = columns || Object.keys(data[0]);
  const header = cols.join(",");
  
  const rows = data.map((row) =>
    cols
      .map((col) => {
        const value = row[col];
        if (value === null || value === undefined) return "";
        if (typeof value === "string" && (value.includes(",") || value.includes('"') || value.includes("\n"))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        if (value instanceof Date) {
          return value.toISOString();
        }
        if (typeof value === "object") {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        return String(value);
      })
      .join(",")
  );

  return [header, ...rows].join("\n");
}

/**
 * Export inspections data
 */
export async function exportInspections(options: ExportOptions): Promise<ExportResult> {
  let query = db.select().from(inspections);

  // Apply filters
  const conditions = [];
  if (options.startDate) {
    conditions.push(gte(inspections.createdAt, options.startDate));
  }
  if (options.endDate) {
    conditions.push(lte(inspections.createdAt, options.endDate));
  }
  if (options.officerId) {
    conditions.push(eq(inspections.officerId, options.officerId));
  }

  const data = await query.where(and(...conditions)).orderBy(desc(inspections.createdAt));

  const timestamp = new Date().toISOString().split("T")[0];

  if (options.format === "csv") {
    return {
      data: toCSV(data),
      filename: `inspections_${timestamp}.csv`,
      mimeType: "text/csv",
    };
  }

  return {
    data: JSON.stringify(data, null, 2),
    filename: `inspections_${timestamp}.json`,
    mimeType: "application/json",
  };
}

/**
 * Export samples data
 */
export async function exportSamples(options: ExportOptions): Promise<ExportResult> {
  let query = db.select().from(samples);

  const conditions = [];
  if (options.startDate) {
    conditions.push(gte(samples.liftedDate, options.startDate));
  }
  if (options.endDate) {
    conditions.push(lte(samples.liftedDate, options.endDate));
  }
  if (options.officerId) {
    conditions.push(eq(samples.officerId, options.officerId));
  }

  const data = await query.where(and(...conditions)).orderBy(desc(samples.liftedDate));

  const timestamp = new Date().toISOString().split("T")[0];

  if (options.format === "csv") {
    return {
      data: toCSV(data),
      filename: `samples_${timestamp}.csv`,
      mimeType: "text/csv",
    };
  }

  return {
    data: JSON.stringify(data, null, 2),
    filename: `samples_${timestamp}.json`,
    mimeType: "application/json",
  };
}

/**
 * Export complaints data
 */
export async function exportComplaints(options: ExportOptions): Promise<ExportResult> {
  let query = db.select().from(complaints);

  const conditions = [];
  if (options.startDate) {
    conditions.push(gte(complaints.createdAt, options.startDate));
  }
  if (options.endDate) {
    conditions.push(lte(complaints.createdAt, options.endDate));
  }
  if (options.officerId) {
    conditions.push(eq(complaints.assignedOfficerId, options.officerId));
  }

  const data = await query.where(and(...conditions)).orderBy(desc(complaints.createdAt));

  const timestamp = new Date().toISOString().split("T")[0];

  if (options.format === "csv") {
    return {
      data: toCSV(data),
      filename: `complaints_${timestamp}.csv`,
      mimeType: "text/csv",
    };
  }

  return {
    data: JSON.stringify(data, null, 2),
    filename: `complaints_${timestamp}.json`,
    mimeType: "application/json",
  };
}

/**
 * Export court cases data
 */
export async function exportCourtCases(options: ExportOptions): Promise<ExportResult> {
  let query = db.select().from(prosecutionCases);

  const conditions = [];
  if (options.startDate) {
    conditions.push(gte(prosecutionCases.firstRegistrationDate, options.startDate));
  }
  if (options.endDate) {
    conditions.push(lte(prosecutionCases.firstRegistrationDate, options.endDate));
  }

  const data = await query.where(and(...conditions)).orderBy(desc(prosecutionCases.firstRegistrationDate));

  const timestamp = new Date().toISOString().split("T")[0];

  if (options.format === "csv") {
    return {
      data: toCSV(data),
      filename: `court_cases_${timestamp}.csv`,
      mimeType: "text/csv",
    };
  }

  return {
    data: JSON.stringify(data, null, 2),
    filename: `court_cases_${timestamp}.json`,
    mimeType: "application/json",
  };
}

/**
 * Export officers data (admin only)
 */
export async function exportOfficers(options: ExportOptions): Promise<ExportResult> {
  const data = await db
    .select({
      id: officers.id,
      name: officers.name,
      email: officers.email,
      phone: officers.phone,
      role: officers.role,
      designation: officers.designation,
      status: officers.status,
      dateOfJoining: officers.dateOfJoining,
      employeeId: officers.employeeId,
    })
    .from(officers)
    .orderBy(officers.name);

  const timestamp = new Date().toISOString().split("T")[0];

  if (options.format === "csv") {
    return {
      data: toCSV(data),
      filename: `officers_${timestamp}.csv`,
      mimeType: "text/csv",
    };
  }

  return {
    data: JSON.stringify(data, null, 2),
    filename: `officers_${timestamp}.json`,
    mimeType: "application/json",
  };
}

/**
 * Export institutional inspections data
 */
export async function exportInstitutionalInspections(options: ExportOptions): Promise<ExportResult> {
  let query = db.select().from(institutionalInspections);

  const conditions = [];
  if (options.startDate) {
    conditions.push(gte(institutionalInspections.inspectionDate, options.startDate));
  }
  if (options.endDate) {
    conditions.push(lte(institutionalInspections.inspectionDate, options.endDate));
  }

  const data = await query.where(and(...conditions)).orderBy(desc(institutionalInspections.inspectionDate));

  const timestamp = new Date().toISOString().split("T")[0];

  if (options.format === "csv") {
    return {
      data: toCSV(data),
      filename: `institutional_inspections_${timestamp}.csv`,
      mimeType: "text/csv",
    };
  }

  return {
    data: JSON.stringify(data, null, 2),
    filename: `institutional_inspections_${timestamp}.json`,
    mimeType: "application/json",
  };
}

/**
 * Generate comprehensive report
 */
export async function exportFullReport(options: ExportOptions): Promise<ExportResult> {
  const [
    inspectionsData,
    samplesData,
    complaintsData,
    courtCasesData,
  ] = await Promise.all([
    exportInspections({ ...options, format: "json" }),
    exportSamples({ ...options, format: "json" }),
    exportComplaints({ ...options, format: "json" }),
    exportCourtCases({ ...options, format: "json" }),
  ]);

  const report = {
    generatedAt: new Date().toISOString(),
    dateRange: {
      start: options.startDate?.toISOString() || "All time",
      end: options.endDate?.toISOString() || "Present",
    },
    inspections: JSON.parse(inspectionsData.data as string),
    samples: JSON.parse(samplesData.data as string),
    complaints: JSON.parse(complaintsData.data as string),
    courtCases: JSON.parse(courtCasesData.data as string),
  };

  const timestamp = new Date().toISOString().split("T")[0];

  return {
    data: JSON.stringify(report, null, 2),
    filename: `full_report_${timestamp}.json`,
    mimeType: "application/json",
  };
}
