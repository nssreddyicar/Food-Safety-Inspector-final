import {
  DashboardMetrics,
  ActionDashboardData,
  ReportSection,
  StatisticsCard,
} from "@/types";

interface ExcelReportData {
  timePeriod: string;
  dateRange: { startDate: string; endDate: string };
  actionData: ActionDashboardData;
  metrics: DashboardMetrics;
  officerName: string;
  jurisdictionName: string;
  generatedAt: string;
  reportSections?: ReportSection[];
  statisticsCards?: StatisticsCard[];
}

const escapeCSV = (value: string | number): string => {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getGroupName = (group: string): string => {
  const names: Record<string, string> = {
    legal: "Legal & Court",
    inspection: "Inspection & Enforcement",
    sampling: "Sampling & Laboratory",
    administrative: "Administrative",
    protocol: "Protocol & Duties",
  };
  return names[group] || group;
};

export function generateExcelCSV(data: ExcelReportData): string {
  const {
    timePeriod,
    dateRange,
    actionData,
    metrics,
    officerName,
    jurisdictionName,
    generatedAt,
    reportSections,
    statisticsCards,
  } = data;

  const shouldShowSection = (code: string): boolean => {
    if (!reportSections || reportSections.length === 0) return true;
    const section = reportSections.find((s) => s.code === code);
    return section ? section.isEnabled && section.showInExcel : true;
  };

  const lines: string[] = [];

  lines.push("FOOD SAFETY DEPARTMENT - PERFORMANCE REPORT");
  lines.push("");

  lines.push("REPORT INFORMATION");
  lines.push(`Officer,${escapeCSV(officerName)}`);
  lines.push(`Jurisdiction,${escapeCSV(jurisdictionName)}`);
  lines.push(`Report Period,${escapeCSV(timePeriod)}`);
  lines.push(
    `Date Range,${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}`,
  );
  lines.push(`Generated On,${escapeCSV(generatedAt)}`);
  lines.push("");
  lines.push("");

  lines.push("ACTION DASHBOARD SUMMARY");
  lines.push("Metric,Count");
  lines.push(`Overdue,${actionData.totals.overdueItems}`);
  lines.push(`Due Today,${actionData.totals.dueToday}`);
  lines.push(`Due This Week,${actionData.totals.dueThisWeek}`);
  lines.push(`Total Actions,${actionData.totals.totalItems}`);
  lines.push("");
  lines.push("");

  lines.push("ACTION CATEGORIES BREAKDOWN");
  lines.push("Group,Category,Priority,SLA Days,Overdue,Pending,Total");

  const groupOrder = [
    "legal",
    "inspection",
    "sampling",
    "administrative",
    "protocol",
  ];
  const groupedCategories: Record<string, typeof actionData.categories> = {};

  actionData.categories.forEach((cat) => {
    if (!groupedCategories[cat.group]) {
      groupedCategories[cat.group] = [];
    }
    groupedCategories[cat.group].push(cat);
  });

  groupOrder.forEach((group) => {
    const categories = groupedCategories[group];
    if (categories && categories.length > 0) {
      categories.forEach((cat) => {
        lines.push(
          [
            escapeCSV(getGroupName(group)),
            escapeCSV(cat.name),
            escapeCSV(cat.priority),
            cat.slaDefaultDays,
            cat.counts.overdue,
            cat.counts.pending,
            cat.counts.total,
          ].join(","),
        );
      });
    }
  });

  lines.push("");
  lines.push("");

  lines.push("LICENSES");
  lines.push("Metric,Value");
  lines.push(`Total Licenses,${metrics.licenses.total}`);
  lines.push(`Active Licenses,${metrics.licenses.active}`);
  lines.push(
    `License Fees Collected,Rs ${metrics.licenses.amount.toLocaleString("en-IN")}`,
  );
  lines.push("");

  lines.push("REGISTRATIONS");
  lines.push("Metric,Value");
  lines.push(`Total Registrations,${metrics.registrations.total}`);
  lines.push(`Active Registrations,${metrics.registrations.active}`);
  lines.push(
    `Registration Fees Collected,Rs ${metrics.registrations.amount.toLocaleString("en-IN")}`,
  );
  lines.push("");

  lines.push("INSPECTIONS");
  lines.push("Metric,Value");
  lines.push(`License Inspections,${metrics.inspections.license}`);
  lines.push(`Registration Inspections,${metrics.inspections.registration}`);
  lines.push(
    `Total Inspections,${metrics.inspections.license + metrics.inspections.registration}`,
  );
  lines.push("");

  lines.push("GRIEVANCES");
  lines.push("Metric,Value");
  lines.push(`Online Complaints,${metrics.grievances.online}`);
  lines.push(`Offline Complaints,${metrics.grievances.offline}`);
  lines.push(`Pending Grievances,${metrics.grievances.pending}`);
  lines.push(`Total Grievances,${metrics.grievances.total}`);
  lines.push("");

  lines.push("FSW ACTIVITIES");
  lines.push("Metric,Value");
  lines.push(`Testing Programs,${metrics.fsw.testing}`);
  lines.push(`Training Sessions,${metrics.fsw.training}`);
  lines.push(`Awareness Camps,${metrics.fsw.awareness}`);
  lines.push(
    `Total FSW Activities,${metrics.fsw.testing + metrics.fsw.training + metrics.fsw.awareness}`,
  );
  lines.push("");

  lines.push("ADJUDICATION & PROSECUTION");
  lines.push("Metric,Value");
  lines.push(`Adjudication Cases,${metrics.adjudication.total}`);
  lines.push(`Adjudication Pending,${metrics.adjudication.pending}`);
  lines.push(`Prosecution Cases,${metrics.prosecution.total}`);
  lines.push(`Prosecution Pending,${metrics.prosecution.pending}`);
  lines.push("");
  lines.push("");

  lines.push("FINANCIAL SUMMARY");
  lines.push("Revenue Source,Count,Amount");
  lines.push(
    `License Fees,${metrics.licenses.total} licenses,Rs ${metrics.licenses.amount.toLocaleString("en-IN")}`,
  );
  lines.push(
    `Registration Fees,${metrics.registrations.total} registrations,Rs ${metrics.registrations.amount.toLocaleString("en-IN")}`,
  );
  lines.push(
    `Total Revenue,${metrics.licenses.total + metrics.registrations.total} transactions,Rs ${(metrics.licenses.amount + metrics.registrations.amount).toLocaleString("en-IN")}`,
  );
  lines.push("");
  lines.push("");

  lines.push("--- End of Report ---");

  return lines.join("\n");
}
