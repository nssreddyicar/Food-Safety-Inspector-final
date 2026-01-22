import {
  DashboardMetrics,
  ActionDashboardData,
  ActionCategory,
  ReportSection,
  StatisticsCard,
} from "@/types";

interface ReportData {
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

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatCurrency = (amount: number) => {
  if (amount >= 10000000) return `Rs ${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `Rs ${(amount / 100000).toFixed(2)} L`;
  if (amount >= 1000) return `Rs ${(amount / 1000).toFixed(1)} K`;
  return `Rs ${amount.toLocaleString("en-IN")}`;
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

const getGroupColor = (
  group: string,
): { bg: string; text: string; border: string } => {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    legal: { bg: "#FEF3C7", text: "#92400E", border: "#F59E0B" },
    inspection: { bg: "#DBEAFE", text: "#1E40AF", border: "#3B82F6" },
    sampling: { bg: "#D1FAE5", text: "#065F46", border: "#10B981" },
    administrative: { bg: "#F3E8FF", text: "#6B21A8", border: "#A855F7" },
    protocol: { bg: "#FCE7F3", text: "#9D174D", border: "#EC4899" },
  };
  return colors[group] || { bg: "#F3F4F6", text: "#374151", border: "#9CA3AF" };
};

export function generateReportHTML(data: ReportData): string {
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

  const groupedCategories: Record<string, ActionCategory[]> = {};
  actionData.categories.forEach((cat) => {
    if (!groupedCategories[cat.group]) {
      groupedCategories[cat.group] = [];
    }
    groupedCategories[cat.group].push(cat);
  });

  const groupOrder = [
    "legal",
    "inspection",
    "sampling",
    "administrative",
    "protocol",
  ];

  const shouldShowSection = (code: string): boolean => {
    if (!reportSections || reportSections.length === 0) return true;
    const section = reportSections.find((s) => s.code === code);
    return section ? section.isEnabled && section.showInPdf : true;
  };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Food Safety Performance Report - ${timePeriod}</title>
  <style>
    @page {
      size: A4;
      margin: 15mm;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', sans-serif;
      font-size: 11px;
      line-height: 1.5;
      color: #1f2937;
      background: #ffffff;
    }
    
    .page {
      max-width: 210mm;
      margin: 0 auto;
      padding: 20px;
    }
    
    .page-break {
      page-break-before: always;
    }
    
    /* Header Section */
    .report-header {
      background: linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%);
      color: white;
      padding: 24px;
      border-radius: 12px;
      margin-bottom: 20px;
      position: relative;
      overflow: hidden;
    }
    
    .report-header::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -30%;
      width: 60%;
      height: 200%;
      background: rgba(255,255,255,0.1);
      transform: rotate(30deg);
    }
    
    .header-content {
      position: relative;
      z-index: 1;
    }
    
    .logo-row {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
    }
    
    .logo-icon {
      width: 56px;
      height: 56px;
      background: rgba(255,255,255,0.2);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: 800;
      backdrop-filter: blur(4px);
    }
    
    .org-info h1 {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 2px;
    }
    
    .org-info p {
      font-size: 12px;
      opacity: 0.9;
    }
    
    .report-meta {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      background: rgba(255,255,255,0.15);
      padding: 16px;
      border-radius: 8px;
      backdrop-filter: blur(4px);
    }
    
    .meta-box {
      text-align: center;
    }
    
    .meta-box .label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.8;
      margin-bottom: 4px;
    }
    
    .meta-box .value {
      font-size: 13px;
      font-weight: 600;
    }
    
    /* Period Banner */
    .period-banner {
      background: linear-gradient(90deg, #EFF6FF 0%, #DBEAFE 50%, #EFF6FF 100%);
      border: 2px solid #3B82F6;
      border-radius: 10px;
      padding: 16px 24px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .period-title {
      font-size: 18px;
      font-weight: 700;
      color: #1E40AF;
    }
    
    .period-dates {
      font-size: 14px;
      color: #3B82F6;
      font-weight: 600;
    }
    
    /* Section Styling */
    .section {
      margin-bottom: 24px;
    }
    
    .section-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      padding-bottom: 10px;
      border-bottom: 2px solid #E5E7EB;
    }
    
    .section-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
    }
    
    .section-icon.action { background: linear-gradient(135deg, #DC2626 0%, #EF4444 100%); color: white; }
    .section-icon.stats { background: linear-gradient(135deg, #059669 0%, #10B981 100%); color: white; }
    .section-icon.financial { background: linear-gradient(135deg, #D97706 0%, #F59E0B 100%); color: white; }
    
    .section-title {
      font-size: 16px;
      font-weight: 700;
      color: #111827;
    }
    
    .section-subtitle {
      font-size: 11px;
      color: #6B7280;
    }
    
    /* Summary Cards Grid */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    
    .summary-card {
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .summary-card.overdue {
      background: linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%);
      border: 1px solid #F87171;
    }
    
    .summary-card.due-today {
      background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);
      border: 1px solid #FBBF24;
    }
    
    .summary-card.this-week {
      background: linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%);
      border: 1px solid #60A5FA;
    }
    
    .summary-card.total {
      background: linear-gradient(135deg, #D1FAE5 0%, #A7F3D0 100%);
      border: 1px solid #34D399;
    }
    
    .summary-number {
      font-size: 36px;
      font-weight: 800;
      line-height: 1;
      margin-bottom: 6px;
    }
    
    .summary-card.overdue .summary-number { color: #DC2626; }
    .summary-card.due-today .summary-number { color: #B45309; }
    .summary-card.this-week .summary-number { color: #1E40AF; }
    .summary-card.total .summary-number { color: #047857; }
    
    .summary-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .summary-card.overdue .summary-label { color: #B91C1C; }
    .summary-card.due-today .summary-label { color: #92400E; }
    .summary-card.this-week .summary-label { color: #1E3A8A; }
    .summary-card.total .summary-label { color: #065F46; }
    
    /* Category Tables */
    .category-section {
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    
    .category-group-header {
      padding: 10px 16px;
      border-radius: 8px 8px 0 0;
      font-size: 13px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .category-table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border: 1px solid #E5E7EB;
      border-top: none;
      border-radius: 0 0 8px 8px;
      overflow: hidden;
    }
    
    .category-table th {
      background: #F9FAFB;
      padding: 12px 16px;
      text-align: left;
      font-size: 10px;
      font-weight: 700;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 2px solid #E5E7EB;
    }
    
    .category-table th.center { text-align: center; }
    
    .category-table td {
      padding: 12px 16px;
      border-bottom: 1px solid #F3F4F6;
      font-size: 11px;
    }
    
    .category-table tr:last-child td {
      border-bottom: none;
    }
    
    .category-table tr:hover {
      background: #F9FAFB;
    }
    
    .category-name-cell {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .category-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    
    .category-name {
      font-weight: 500;
      color: #1F2937;
    }
    
    .count-cell {
      text-align: center;
    }
    
    .count-badge {
      display: inline-block;
      min-width: 32px;
      padding: 4px 10px;
      border-radius: 16px;
      font-weight: 700;
      font-size: 11px;
    }
    
    .count-badge.overdue { background: #FEE2E2; color: #DC2626; }
    .count-badge.pending { background: #FEF3C7; color: #B45309; }
    .count-badge.total { background: #E5E7EB; color: #374151; }
    .count-badge.zero { background: #F3F4F6; color: #9CA3AF; }
    
    .priority-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .priority-badge.critical { background: #FEE2E2; color: #DC2626; }
    .priority-badge.high { background: #FEF3C7; color: #B45309; }
    .priority-badge.normal { background: #D1FAE5; color: #047857; }
    
    /* Statistics Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin-bottom: 20px;
    }
    
    .stats-card {
      background: #FFFFFF;
      border: 1px solid #E5E7EB;
      border-radius: 12px;
      padding: 16px;
      page-break-inside: avoid;
    }
    
    .stats-card-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
      padding-bottom: 10px;
      border-bottom: 1px solid #F3F4F6;
    }
    
    .stats-card-icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }
    
    .stats-card-title {
      font-size: 12px;
      font-weight: 700;
      color: #374151;
    }
    
    .stats-table {
      width: 100%;
    }
    
    .stats-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px dashed #E5E7EB;
    }
    
    .stats-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
    
    .stats-label {
      color: #6B7280;
      font-size: 11px;
    }
    
    .stats-value {
      font-weight: 700;
      font-size: 12px;
      color: #1F2937;
    }
    
    .stats-value.primary { color: #1E40AF; }
    .stats-value.success { color: #059669; }
    .stats-value.warning { color: #D97706; }
    .stats-value.danger { color: #DC2626; }
    
    /* Financial Summary Table */
    .financial-table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #E5E7EB;
    }
    
    .financial-table th {
      background: linear-gradient(90deg, #FEF3C7 0%, #FDE68A 100%);
      padding: 14px 16px;
      text-align: left;
      font-size: 11px;
      font-weight: 700;
      color: #92400E;
      text-transform: uppercase;
    }
    
    .financial-table td {
      padding: 14px 16px;
      border-bottom: 1px solid #F3F4F6;
      font-size: 12px;
    }
    
    .financial-table tr:last-child td {
      border-bottom: none;
    }
    
    .financial-table .total-row {
      background: #F9FAFB;
      font-weight: 700;
    }
    
    .financial-table .total-row td {
      border-top: 2px solid #E5E7EB;
    }
    
    .amount-cell {
      text-align: right;
      font-weight: 600;
      color: #047857;
    }
    
    /* Footer */
    .report-footer {
      margin-top: 30px;
      padding-top: 16px;
      border-top: 2px solid #E5E7EB;
      text-align: center;
    }
    
    .footer-text {
      font-size: 10px;
      color: #9CA3AF;
      margin-bottom: 4px;
    }
    
    .footer-brand {
      font-size: 11px;
      font-weight: 600;
      color: #6B7280;
    }
    
    @media print {
      body {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      
      .page {
        padding: 0;
      }
      
      .report-header {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- Report Header -->
    <div class="report-header">
      <div class="header-content">
        <div class="logo-row">
          <div class="logo-icon">FS</div>
          <div class="org-info">
            <h1>Food Safety Department</h1>
            <p>Government Performance Report</p>
          </div>
        </div>
        <div class="report-meta">
          <div class="meta-box">
            <div class="label">Officer</div>
            <div class="value">${officerName}</div>
          </div>
          <div class="meta-box">
            <div class="label">Jurisdiction</div>
            <div class="value">${jurisdictionName}</div>
          </div>
          <div class="meta-box">
            <div class="label">Report Period</div>
            <div class="value">${timePeriod}</div>
          </div>
          <div class="meta-box">
            <div class="label">Generated On</div>
            <div class="value">${generatedAt}</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Period Banner -->
    <div class="period-banner">
      <div class="period-title">${timePeriod} Performance Overview</div>
      <div class="period-dates">${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}</div>
    </div>
    
    <!-- Action Dashboard Summary -->
    <div class="section">
      <div class="section-header">
        <div class="section-icon action">!</div>
        <div>
          <div class="section-title">Action Dashboard Summary</div>
          <div class="section-subtitle">Overview of pending actions and deadlines</div>
        </div>
      </div>
      
      <div class="summary-grid">
        <div class="summary-card overdue">
          <div class="summary-number">${actionData.totals.overdueItems}</div>
          <div class="summary-label">Overdue</div>
        </div>
        <div class="summary-card due-today">
          <div class="summary-number">${actionData.totals.dueToday}</div>
          <div class="summary-label">Due Today</div>
        </div>
        <div class="summary-card this-week">
          <div class="summary-number">${actionData.totals.dueThisWeek}</div>
          <div class="summary-label">This Week</div>
        </div>
        <div class="summary-card total">
          <div class="summary-number">${actionData.totals.totalItems}</div>
          <div class="summary-label">Total Actions</div>
        </div>
      </div>
    </div>
    
    <!-- Action Categories Breakdown -->
    ${groupOrder
      .map((group) => {
        const categories = groupedCategories[group];
        if (!categories || categories.length === 0) return "";
        const colors = getGroupColor(group);
        return `
      <div class="category-section">
        <div class="category-group-header" style="background: ${colors.bg}; color: ${colors.text}; border-left: 4px solid ${colors.border};">
          ${getGroupName(group)}
        </div>
        <table class="category-table">
          <thead>
            <tr>
              <th style="width: 35%;">Category</th>
              <th class="center" style="width: 13%;">Priority</th>
              <th class="center" style="width: 13%;">SLA (Days)</th>
              <th class="center" style="width: 13%;">Overdue</th>
              <th class="center" style="width: 13%;">Pending</th>
              <th class="center" style="width: 13%;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${categories
              .map(
                (cat) => `
            <tr>
              <td>
                <div class="category-name-cell">
                  <div class="category-dot" style="background: ${cat.color};"></div>
                  <span class="category-name">${cat.name}</span>
                </div>
              </td>
              <td class="count-cell">
                <span class="priority-badge ${cat.priority}">${cat.priority}</span>
              </td>
              <td class="count-cell">
                <span style="color: #6B7280;">${cat.slaDefaultDays}d</span>
              </td>
              <td class="count-cell">
                <span class="count-badge ${cat.counts.overdue > 0 ? "overdue" : "zero"}">${cat.counts.overdue}</span>
              </td>
              <td class="count-cell">
                <span class="count-badge ${cat.counts.pending > 0 ? "pending" : "zero"}">${cat.counts.pending}</span>
              </td>
              <td class="count-cell">
                <span class="count-badge total">${cat.counts.total}</span>
              </td>
            </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
      `;
      })
      .join("")}
    
    <!-- Page Break for Stats -->
    <div class="page-break"></div>
    
    <!-- Statistics Overview -->
    <div class="section">
      <div class="section-header">
        <div class="section-icon stats">&#9733;</div>
        <div>
          <div class="section-title">Statistics Overview</div>
          <div class="section-subtitle">Key performance metrics for ${timePeriod}</div>
        </div>
      </div>
      
      <div class="stats-grid">
        <!-- Licenses & Registrations -->
        <div class="stats-card">
          <div class="stats-card-header">
            <div class="stats-card-icon" style="background: linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%); color: white;">&#127942;</div>
            <div class="stats-card-title">Licenses</div>
          </div>
          <div class="stats-table">
            <div class="stats-row">
              <span class="stats-label">Total Licenses</span>
              <span class="stats-value">${metrics.licenses.total}</span>
            </div>
            <div class="stats-row">
              <span class="stats-label">Active Licenses</span>
              <span class="stats-value success">${metrics.licenses.active}</span>
            </div>
            <div class="stats-row">
              <span class="stats-label">Fees Collected</span>
              <span class="stats-value primary">${formatCurrency(metrics.licenses.amount)}</span>
            </div>
          </div>
        </div>
        
        <!-- Registrations -->
        <div class="stats-card">
          <div class="stats-card-header">
            <div class="stats-card-icon" style="background: linear-gradient(135deg, #7C3AED 0%, #A855F7 100%); color: white;">&#128196;</div>
            <div class="stats-card-title">Registrations</div>
          </div>
          <div class="stats-table">
            <div class="stats-row">
              <span class="stats-label">Total Registrations</span>
              <span class="stats-value">${metrics.registrations.total}</span>
            </div>
            <div class="stats-row">
              <span class="stats-label">Active Registrations</span>
              <span class="stats-value success">${metrics.registrations.active}</span>
            </div>
            <div class="stats-row">
              <span class="stats-label">Fees Collected</span>
              <span class="stats-value primary">${formatCurrency(metrics.registrations.amount)}</span>
            </div>
          </div>
        </div>
        
        <!-- Inspections -->
        <div class="stats-card">
          <div class="stats-card-header">
            <div class="stats-card-icon" style="background: linear-gradient(135deg, #059669 0%, #10B981 100%); color: white;">&#128269;</div>
            <div class="stats-card-title">Inspections</div>
          </div>
          <div class="stats-table">
            <div class="stats-row">
              <span class="stats-label">License Inspections</span>
              <span class="stats-value">${metrics.inspections.license}</span>
            </div>
            <div class="stats-row">
              <span class="stats-label">Registration Inspections</span>
              <span class="stats-value">${metrics.inspections.registration}</span>
            </div>
            <div class="stats-row">
              <span class="stats-label">Total Inspections</span>
              <span class="stats-value primary">${metrics.inspections.license + metrics.inspections.registration}</span>
            </div>
          </div>
        </div>
        
        <!-- Grievances -->
        <div class="stats-card">
          <div class="stats-card-header">
            <div class="stats-card-icon" style="background: linear-gradient(135deg, #DC2626 0%, #EF4444 100%); color: white;">&#128172;</div>
            <div class="stats-card-title">Grievances</div>
          </div>
          <div class="stats-table">
            <div class="stats-row">
              <span class="stats-label">Online Complaints</span>
              <span class="stats-value">${metrics.grievances.online}</span>
            </div>
            <div class="stats-row">
              <span class="stats-label">Offline Complaints</span>
              <span class="stats-value">${metrics.grievances.offline}</span>
            </div>
            <div class="stats-row">
              <span class="stats-label">Pending</span>
              <span class="stats-value warning">${metrics.grievances.pending}</span>
            </div>
            <div class="stats-row">
              <span class="stats-label">Total Grievances</span>
              <span class="stats-value">${metrics.grievances.total}</span>
            </div>
          </div>
        </div>
        
        <!-- FSW Activities -->
        <div class="stats-card">
          <div class="stats-card-header">
            <div class="stats-card-icon" style="background: linear-gradient(135deg, #0891B2 0%, #06B6D4 100%); color: white;">&#128101;</div>
            <div class="stats-card-title">FSW Activities</div>
          </div>
          <div class="stats-table">
            <div class="stats-row">
              <span class="stats-label">Testing Programs</span>
              <span class="stats-value">${metrics.fsw.testing}</span>
            </div>
            <div class="stats-row">
              <span class="stats-label">Training Sessions</span>
              <span class="stats-value">${metrics.fsw.training}</span>
            </div>
            <div class="stats-row">
              <span class="stats-label">Awareness Camps</span>
              <span class="stats-value">${metrics.fsw.awareness}</span>
            </div>
            <div class="stats-row">
              <span class="stats-label">Total Activities</span>
              <span class="stats-value primary">${metrics.fsw.testing + metrics.fsw.training + metrics.fsw.awareness}</span>
            </div>
          </div>
        </div>
        
        <!-- Adjudication & Prosecution -->
        <div class="stats-card">
          <div class="stats-card-header">
            <div class="stats-card-icon" style="background: linear-gradient(135deg, #B45309 0%, #F59E0B 100%); color: white;">&#9878;</div>
            <div class="stats-card-title">Adjudication & Prosecution</div>
          </div>
          <div class="stats-table">
            <div class="stats-row">
              <span class="stats-label">Adjudication Cases</span>
              <span class="stats-value">${metrics.adjudication.total}</span>
            </div>
            <div class="stats-row">
              <span class="stats-label">Adjudication Pending</span>
              <span class="stats-value warning">${metrics.adjudication.pending}</span>
            </div>
            <div class="stats-row">
              <span class="stats-label">Prosecution Cases</span>
              <span class="stats-value">${metrics.prosecution.total}</span>
            </div>
            <div class="stats-row">
              <span class="stats-label">Prosecution Pending</span>
              <span class="stats-value warning">${metrics.prosecution.pending}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Financial Summary -->
    <div class="section">
      <div class="section-header">
        <div class="section-icon financial">&#8377;</div>
        <div>
          <div class="section-title">Financial Summary</div>
          <div class="section-subtitle">Revenue collected during ${timePeriod}</div>
        </div>
      </div>
      
      <table class="financial-table">
        <thead>
          <tr>
            <th style="width: 50%;">Revenue Source</th>
            <th style="width: 25%;">Count</th>
            <th style="width: 25%; text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>License Fees</td>
            <td>${metrics.licenses.total} licenses</td>
            <td class="amount-cell">${formatCurrency(metrics.licenses.amount)}</td>
          </tr>
          <tr>
            <td>Registration Fees</td>
            <td>${metrics.registrations.total} registrations</td>
            <td class="amount-cell">${formatCurrency(metrics.registrations.amount)}</td>
          </tr>
          <tr class="total-row">
            <td><strong>Total Revenue</strong></td>
            <td><strong>${metrics.licenses.total + metrics.registrations.total} transactions</strong></td>
            <td class="amount-cell"><strong>${formatCurrency(metrics.licenses.amount + metrics.registrations.amount)}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <!-- Footer -->
    <div class="report-footer">
      <div class="footer-text">This report is auto-generated from the Food Safety Inspector Application</div>
      <div class="footer-brand">Food Safety Department | Government of India</div>
      <div class="footer-text" style="margin-top: 8px;">Page dynamically generated | Report ID: FSI-${Date.now()}</div>
    </div>
  </div>
</body>
</html>
  `;
}
