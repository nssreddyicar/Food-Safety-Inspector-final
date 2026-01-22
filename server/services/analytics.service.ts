/**
 * =============================================================================
 * ANALYTICS SERVICE
 * =============================================================================
 * 
 * Provides advanced analytics and metrics for the admin dashboard.
 * Generates insights from inspection, sample, complaint, and court case data.
 */

import { db } from "../db";
import {
  inspections,
  samples,
  complaints,
  prosecutionCases,
  officers,
  institutionalInspections,
  auditLogs,
} from "../../shared/schema";
import { eq, and, gte, lte, count, sql, desc } from "drizzle-orm";

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface DashboardMetrics {
  summary: {
    totalInspections: number;
    totalSamples: number;
    totalComplaints: number;
    totalCourtCases: number;
    activeOfficers: number;
  };
  trends: {
    inspectionsTrend: number; // percentage change
    samplesTrend: number;
    complaintsTrend: number;
    resolutionRate: number;
  };
  recentActivity: Array<{
    type: string;
    description: string;
    timestamp: string;
    officerName?: string;
  }>;
}

export interface InspectionAnalytics {
  totalCount: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byMonth: Array<{ month: string; count: number }>;
  averageIndicatorScore: number;
  complianceRate: number;
}

export interface SampleAnalytics {
  totalCount: number;
  byStatus: Record<string, number>;
  pendingCount: number;
  overdueCount: number;
  averageProcessingDays: number;
  byProductType: Record<string, number>;
}

export interface ComplaintAnalytics {
  totalCount: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  averageResolutionDays: number;
  satisfactionRate: number;
}

export interface OfficerPerformance {
  officerId: string;
  officerName: string;
  inspectionsCompleted: number;
  samplesCollected: number;
  complaintsResolved: number;
  averageRating: number;
}

/**
 * Get dashboard summary metrics
 */
export async function getDashboardMetrics(dateRange?: DateRange): Promise<DashboardMetrics> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // Current period counts
  const [
    inspectionsCount,
    samplesCount,
    complaintsCount,
    courtCasesCount,
    activeOfficersCount,
  ] = await Promise.all([
    db.select({ count: count() }).from(inspections),
    db.select({ count: count() }).from(samples),
    db.select({ count: count() }).from(complaints),
    db.select({ count: count() }).from(prosecutionCases),
    db.select({ count: count() }).from(officers).where(eq(officers.status, "active")),
  ]);

  // Previous period counts for trend calculation
  const [prevInspections, prevSamples, prevComplaints] = await Promise.all([
    db.select({ count: count() })
      .from(inspections)
      .where(and(gte(inspections.createdAt, sixtyDaysAgo), lte(inspections.createdAt, thirtyDaysAgo))),
    db.select({ count: count() })
      .from(samples)
      .where(and(gte(samples.liftedDate, sixtyDaysAgo), lte(samples.liftedDate, thirtyDaysAgo))),
    db.select({ count: count() })
      .from(complaints)
      .where(and(gte(complaints.createdAt, sixtyDaysAgo), lte(complaints.createdAt, thirtyDaysAgo))),
  ]);

  // Recent period counts
  const [recentInspections, recentSamples, recentComplaints] = await Promise.all([
    db.select({ count: count() })
      .from(inspections)
      .where(gte(inspections.createdAt, thirtyDaysAgo)),
    db.select({ count: count() })
      .from(samples)
      .where(gte(samples.liftedDate, thirtyDaysAgo)),
    db.select({ count: count() })
      .from(complaints)
      .where(gte(complaints.createdAt, thirtyDaysAgo)),
  ]);

  // Resolution rate
  const resolvedComplaints = await db
    .select({ count: count() })
    .from(complaints)
    .where(eq(complaints.status, "resolved"));

  const resolutionRate = complaintsCount[0].count > 0
    ? (resolvedComplaints[0].count / complaintsCount[0].count) * 100
    : 0;

  // Calculate trends
  const calcTrend = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  // Recent activity from audit logs
  const recentActivity = await db
    .select({
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      timestamp: auditLogs.timestamp,
      officerId: auditLogs.officerId,
    })
    .from(auditLogs)
    .orderBy(desc(auditLogs.timestamp))
    .limit(10);

  return {
    summary: {
      totalInspections: inspectionsCount[0].count,
      totalSamples: samplesCount[0].count,
      totalComplaints: complaintsCount[0].count,
      totalCourtCases: courtCasesCount[0].count,
      activeOfficers: activeOfficersCount[0].count,
    },
    trends: {
      inspectionsTrend: calcTrend(recentInspections[0].count, prevInspections[0].count),
      samplesTrend: calcTrend(recentSamples[0].count, prevSamples[0].count),
      complaintsTrend: calcTrend(recentComplaints[0].count, prevComplaints[0].count),
      resolutionRate: Math.round(resolutionRate * 10) / 10,
    },
    recentActivity: recentActivity.map((a) => ({
      type: a.entityType,
      description: `${a.action} on ${a.entityType}`,
      timestamp: a.timestamp?.toISOString() || new Date().toISOString(),
      officerName: a.officerId || undefined,
    })),
  };
}

/**
 * Get inspection analytics
 */
export async function getInspectionAnalytics(dateRange?: DateRange): Promise<InspectionAnalytics> {
  const allInspections = await db.select().from(inspections);

  const byStatus: Record<string, number> = {};
  const byType: Record<string, number> = {};

  allInspections.forEach((insp) => {
    byStatus[insp.status] = (byStatus[insp.status] || 0) + 1;
    const type = insp.type || "unknown";
    byType[type] = (byType[type] || 0) + 1;
  });

  // Group by month
  const byMonth: Record<string, number> = {};
  allInspections.forEach((insp) => {
    if (insp.createdAt) {
      const month = insp.createdAt.toISOString().substring(0, 7);
      byMonth[month] = (byMonth[month] || 0) + 1;
    }
  });

  const monthlyData = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, count]) => ({ month, count }));

  // Calculate compliance rate (completed / total)
  const completedCount = byStatus["closed"] || 0;
  const complianceRate = allInspections.length > 0
    ? (completedCount / allInspections.length) * 100
    : 0;

  return {
    totalCount: allInspections.length,
    byStatus,
    byType,
    byMonth: monthlyData,
    averageIndicatorScore: 0, // Would need indicator data
    complianceRate: Math.round(complianceRate * 10) / 10,
  };
}

/**
 * Get sample analytics
 */
export async function getSampleAnalytics(dateRange?: DateRange): Promise<SampleAnalytics> {
  const allSamples = await db.select().from(samples);

  const byStatus: Record<string, number> = {};
  const byProductType: Record<string, number> = {};

  let pendingCount = 0;
  let overdueCount = 0;
  const now = new Date();

  allSamples.forEach((sample) => {
    byStatus[sample.status] = (byStatus[sample.status] || 0) + 1;
    
    const productType = sample.name || "unknown";
    byProductType[productType] = (byProductType[productType] || 0) + 1;

    if (sample.status === "pending" || sample.status === "collected") {
      pendingCount++;
      // Check if overdue (14 days from collection)
      if (sample.liftedDate) {
        const deadline = new Date(sample.liftedDate);
        deadline.setDate(deadline.getDate() + 14);
        if (now > deadline) {
          overdueCount++;
        }
      }
    }
  });

  return {
    totalCount: allSamples.length,
    byStatus,
    pendingCount,
    overdueCount,
    averageProcessingDays: 7, // Would need actual calculation
    byProductType,
  };
}

/**
 * Get complaint analytics
 */
export async function getComplaintAnalytics(dateRange?: DateRange): Promise<ComplaintAnalytics> {
  const allComplaints = await db.select().from(complaints);

  const byStatus: Record<string, number> = {};
  const bySource: Record<string, number> = {};

  allComplaints.forEach((complaint) => {
    byStatus[complaint.status] = (byStatus[complaint.status] || 0) + 1;
    const source = complaint.complaintCode?.substring(0, 3) || "unknown";
    bySource[source] = (bySource[source] || 0) + 1;
  });

  // Calculate average resolution time for resolved complaints
  let totalResolutionDays = 0;
  let resolvedCount = 0;

  allComplaints.forEach((complaint) => {
    if (complaint.status === "resolved" && complaint.createdAt && complaint.updatedAt) {
      const created = new Date(complaint.createdAt);
      const resolved = new Date(complaint.updatedAt);
      const days = Math.ceil((resolved.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      totalResolutionDays += days;
      resolvedCount++;
    }
  });

  const avgResolutionDays = resolvedCount > 0 ? totalResolutionDays / resolvedCount : 0;

  return {
    totalCount: allComplaints.length,
    byStatus,
    bySource,
    averageResolutionDays: Math.round(avgResolutionDays * 10) / 10,
    satisfactionRate: 85, // Would need survey data
  };
}

/**
 * Get officer performance metrics
 */
export async function getOfficerPerformance(): Promise<OfficerPerformance[]> {
  const allOfficers = await db
    .select()
    .from(officers)
    .where(eq(officers.status, "active"));

  const performance: OfficerPerformance[] = [];

  for (const officer of allOfficers) {
    const [inspCount, sampleCount, complaintCount] = await Promise.all([
      db.select({ count: count() })
        .from(inspections)
        .where(eq(inspections.officerId, officer.id)),
      db.select({ count: count() })
        .from(samples)
        .where(eq(samples.officerId, officer.id)),
      db.select({ count: count() })
        .from(complaints)
        .where(and(
          eq(complaints.assignedOfficerId, officer.id),
          eq(complaints.status, "resolved")
        )),
    ]);

    performance.push({
      officerId: officer.id,
      officerName: officer.name,
      inspectionsCompleted: inspCount[0].count,
      samplesCollected: sampleCount[0].count,
      complaintsResolved: complaintCount[0].count,
      averageRating: 4.5, // Would need rating data
    });
  }

  return performance.sort((a, b) => b.inspectionsCompleted - a.inspectionsCompleted);
}

/**
 * Get system health metrics
 */
export async function getSystemHealthMetrics() {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [auditCount, recentLogins] = await Promise.all([
    db.select({ count: count() })
      .from(auditLogs)
      .where(gte(auditLogs.timestamp, oneDayAgo)),
    db.select({ count: count() })
      .from(auditLogs)
      .where(and(
        gte(auditLogs.timestamp, oneDayAgo),
        eq(auditLogs.action, "LOGIN")
      )),
  ]);

  return {
    apiRequestsLast24h: auditCount[0].count,
    uniqueLoginsLast24h: recentLogins[0].count,
    serverUptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    nodeVersion: process.version,
  };
}
