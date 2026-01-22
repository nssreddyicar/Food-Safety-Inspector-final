import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuthContext } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/query-client";
import { generateReportHTML } from "@/lib/report-template";
import { generateExcelCSV } from "@/lib/excel-template";
import {
  TimeSelection,
  getDateRangeForSelection,
  getFilterDisplayLabel,
} from "@/components/TimeFilter";
import {
  DashboardMetrics,
  ActionDashboardData,
  ReportSection,
  StatisticsCard,
} from "@/types";
import { Spacing, BorderRadius } from "@/constants/theme";

export default function GenerateReportScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const route = useRoute<any>();
  const { user } = useAuthContext();

  const timeSelection: TimeSelection = route.params?.timeSelection || {
    category: "month",
    value: `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, "0")}`,
  };

  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [actionData, setActionData] = useState<ActionDashboardData | null>(
    null,
  );
  const [reportSections, setReportSections] = useState<ReportSection[]>([]);
  const [statisticsCards, setStatisticsCards] = useState<StatisticsCard[]>([]);
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [excelUri, setExcelUri] = useState<string | null>(null);

  const jurisdictionId = user?.jurisdiction?.unitId;
  const timePeriodLabel = getFilterDisplayLabel(timeSelection);
  const dateRange = getDateRangeForSelection(timeSelection);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);

      const metricsUrl = new URL("/api/dashboard/metrics", getApiUrl());
      const actionUrl = new URL("/api/action-dashboard", getApiUrl());
      const reportSectionsUrl = new URL("/api/report-sections", getApiUrl());
      const statsCardsUrl = new URL("/api/statistics-cards", getApiUrl());

      if (jurisdictionId) {
        metricsUrl.searchParams.set("jurisdictionId", jurisdictionId);
        actionUrl.searchParams.set("jurisdictionId", jurisdictionId);
      }

      metricsUrl.searchParams.set("startDate", dateRange.startDate);
      metricsUrl.searchParams.set("endDate", dateRange.endDate);
      actionUrl.searchParams.set("startDate", dateRange.startDate);
      actionUrl.searchParams.set("endDate", dateRange.endDate);
      actionUrl.searchParams.set("forReport", "true");

      const [metricsRes, actionRes, sectionsRes, statsRes] = await Promise.all([
        fetch(metricsUrl.toString()),
        fetch(actionUrl.toString()),
        fetch(reportSectionsUrl.toString()),
        fetch(statsCardsUrl.toString()),
      ]);

      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        setMetrics(metricsData);
      }

      if (actionRes.ok) {
        const actionDashboardData = await actionRes.json();
        setActionData(actionDashboardData);
      }

      if (sectionsRes.ok) {
        const sections = await sectionsRes.json();
        setReportSections(sections.filter((s: ReportSection) => s.isEnabled));
      }

      if (statsRes.ok) {
        const cards = await statsRes.json();
        setStatisticsCards(
          cards.filter((c: StatisticsCard) => c.isEnabled && c.showInReport),
        );
      }
    } catch (error) {
      console.error("Failed to load report data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [jurisdictionId, dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const generatePDF = async () => {
    if (!metrics || !actionData) {
      Alert.alert("Error", "Data not loaded yet. Please wait.");
      return;
    }

    try {
      setIsGenerating(true);

      const html = generateReportHTML({
        timePeriod: timePeriodLabel,
        dateRange,
        actionData,
        metrics,
        officerName: user?.name || "FSO Officer",
        jurisdictionName: user?.jurisdiction?.unitName || "Jurisdiction",
        generatedAt: new Date().toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        reportSections,
        statisticsCards,
      });

      if (Platform.OS === "web") {
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
          }, 500);
          setPdfUri("web-print-success");
          Alert.alert(
            "Success",
            "Report opened in a new tab. Use Ctrl+P (Cmd+P on Mac) to save as PDF.",
          );
        } else {
          Alert.alert("Info", "Please allow popups to generate the report.");
        }
      } else {
        const { uri } = await Print.printToFileAsync({
          html,
          base64: false,
        });
        setPdfUri(uri);
        Alert.alert("Success", "Report generated successfully!");
      }
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      Alert.alert("Error", "Failed to generate PDF report. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const sharePDF = async () => {
    if (!pdfUri) {
      Alert.alert("Error", "Please generate the report first.");
      return;
    }

    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert("Error", "Sharing is not available on this device.");
        return;
      }

      await Sharing.shareAsync(pdfUri, {
        mimeType: "application/pdf",
        dialogTitle: `Share FSI Report - ${timePeriodLabel}`,
        UTI: "com.adobe.pdf",
      });
    } catch (error) {
      console.error("Failed to share PDF:", error);
      Alert.alert("Error", "Failed to share the report.");
    }
  };

  const downloadPDF = async () => {
    if (!pdfUri) {
      Alert.alert("Error", "Please generate the report first.");
      return;
    }

    if (Platform.OS === "web") {
      const link = document.createElement("a");
      link.href = pdfUri;
      link.download = `FSI_Report_${timePeriodLabel.replace(/\s+/g, "_")}.pdf`;
      link.click();
    } else {
      await sharePDF();
    }
  };

  const generateExcel = async () => {
    if (!metrics || !actionData) {
      Alert.alert("Error", "Data not loaded yet. Please wait.");
      return;
    }

    try {
      setIsGeneratingExcel(true);

      const csvContent = generateExcelCSV({
        timePeriod: timePeriodLabel,
        dateRange,
        actionData,
        metrics,
        officerName: user?.name || "FSO Officer",
        jurisdictionName: user?.jurisdiction?.unitName || "Jurisdiction",
        generatedAt: new Date().toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        reportSections,
        statisticsCards,
      });

      if (Platform.OS === "web") {
        const blob = new Blob([csvContent], {
          type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `FSI_Report_${timePeriodLabel.replace(/\s+/g, "_")}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        setExcelUri("web-csv-success");
        Alert.alert("Success", "Excel/CSV file downloaded successfully!");
      } else {
        const fileName = `FSI_Report_${timePeriodLabel.replace(/\s+/g, "_")}_${Date.now()}.csv`;
        const docDir =
          (FileSystem as any).documentDirectory ||
          (FileSystem as any).cacheDirectory ||
          "";
        const fileUri = `${docDir}${fileName}`;
        await (FileSystem as any).writeAsStringAsync(fileUri, csvContent);
        setExcelUri(fileUri);

        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(fileUri, {
            mimeType: "text/csv",
            dialogTitle: `Share FSI Report - ${timePeriodLabel}`,
          });
        }
        Alert.alert("Success", "Excel/CSV report generated successfully!");
      }
    } catch (error) {
      console.error("Failed to generate Excel:", error);
      Alert.alert(
        "Error",
        "Failed to generate Excel report. Please try again.",
      );
    } finally {
      setIsGeneratingExcel(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: theme.primary + "15" },
            ]}
          >
            <Feather name="file-text" size={32} color={theme.primary} />
          </View>
          <ThemedText type="h1" style={styles.title}>
            Generate Report
          </ThemedText>
          <ThemedText
            type="body"
            style={{ color: theme.textSecondary, textAlign: "center" }}
          >
            Create a professional PDF report for the selected time period
          </ThemedText>
        </View>

        <Card style={styles.periodCard}>
          <View style={styles.periodHeader}>
            <Feather name="calendar" size={20} color={theme.primary} />
            <ThemedText type="body" style={{ fontWeight: "600" }}>
              Report Period
            </ThemedText>
          </View>
          <View style={styles.periodDetails}>
            <View style={styles.periodRow}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Selected Period
              </ThemedText>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                {timePeriodLabel}
              </ThemedText>
            </View>
            <View style={styles.periodRow}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Date Range
              </ThemedText>
              <ThemedText type="body">
                {formatDate(dateRange.startDate)} -{" "}
                {formatDate(dateRange.endDate)}
              </ThemedText>
            </View>
          </View>
        </Card>

        {isLoading ? (
          <Card style={styles.loadingCard}>
            <ActivityIndicator size="large" color={theme.primary} />
            <ThemedText
              type="body"
              style={{ marginTop: Spacing.md, color: theme.textSecondary }}
            >
              Loading report data...
            </ThemedText>
          </Card>
        ) : (
          <>
            <Card style={styles.previewCard}>
              <ThemedText
                type="body"
                style={{ marginBottom: Spacing.md, fontWeight: "600" }}
              >
                Report Contents
              </ThemedText>

              <View style={styles.contentItem}>
                <View
                  style={[styles.contentIcon, { backgroundColor: "#DC262620" }]}
                >
                  <Feather name="alert-circle" size={16} color="#DC2626" />
                </View>
                <View style={styles.contentText}>
                  <ThemedText type="body">Action Dashboard Summary</ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary }}
                  >
                    Overdue, Due Today, This Week, Total actions
                  </ThemedText>
                </View>
              </View>

              <View style={styles.contentItem}>
                <View
                  style={[styles.contentIcon, { backgroundColor: "#1E40AF20" }]}
                >
                  <Feather name="list" size={16} color="#1E40AF" />
                </View>
                <View style={styles.contentText}>
                  <ThemedText type="body">
                    Action Categories Breakdown
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary }}
                  >
                    {actionData?.categories.length || 0} categories across 5
                    groups
                  </ThemedText>
                </View>
              </View>

              <View style={styles.contentItem}>
                <View
                  style={[styles.contentIcon, { backgroundColor: "#05966920" }]}
                >
                  <Feather name="bar-chart-2" size={16} color="#059669" />
                </View>
                <View style={styles.contentText}>
                  <ThemedText type="body">Statistics Overview</ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary }}
                  >
                    Licenses, Registrations, Inspections, Grievances, FSW,
                    Adjudication
                  </ThemedText>
                </View>
              </View>

              <View style={styles.contentItem}>
                <View
                  style={[styles.contentIcon, { backgroundColor: "#D9770620" }]}
                >
                  <Feather name="dollar-sign" size={16} color="#D97706" />
                </View>
                <View style={styles.contentText}>
                  <ThemedText type="body">Financial Summary</ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary }}
                  >
                    Revenue from licenses, registrations, and penalties
                  </ThemedText>
                </View>
              </View>
            </Card>

            <View style={styles.actions}>
              <View style={styles.formatButtons}>
                <Pressable
                  onPress={generatePDF}
                  disabled={isGenerating || !metrics || !actionData}
                  style={[
                    styles.formatButton,
                    {
                      backgroundColor: theme.primary,
                      opacity:
                        isGenerating || !metrics || !actionData ? 0.5 : 1,
                    },
                  ]}
                  testID="button-generate-pdf"
                >
                  <Feather name="file-text" size={20} color="white" />
                  <ThemedText
                    type="body"
                    style={{ color: "white", fontWeight: "600" }}
                  >
                    {isGenerating ? "Generating..." : "PDF Report"}
                  </ThemedText>
                </Pressable>

                <Pressable
                  onPress={generateExcel}
                  disabled={isGeneratingExcel || !metrics || !actionData}
                  style={[
                    styles.formatButton,
                    {
                      backgroundColor: "#059669",
                      opacity:
                        isGeneratingExcel || !metrics || !actionData ? 0.5 : 1,
                    },
                  ]}
                  testID="button-generate-excel"
                >
                  <Feather name="grid" size={20} color="white" />
                  <ThemedText
                    type="body"
                    style={{ color: "white", fontWeight: "600" }}
                  >
                    {isGeneratingExcel ? "Generating..." : "Excel Report"}
                  </ThemedText>
                </Pressable>
              </View>

              {pdfUri && Platform.OS !== "web" ? (
                <View style={styles.shareActions}>
                  <Pressable
                    onPress={sharePDF}
                    style={[
                      styles.secondaryButton,
                      { borderColor: theme.primary },
                    ]}
                    testID="button-share-pdf"
                  >
                    <Feather name="share-2" size={18} color={theme.primary} />
                    <ThemedText
                      type="body"
                      style={{ color: theme.primary, fontWeight: "600" }}
                    >
                      Share PDF
                    </ThemedText>
                  </Pressable>
                </View>
              ) : null}
            </View>

            {pdfUri || excelUri ? (
              <View style={styles.successCard}>
                <View style={styles.successContent}>
                  <Feather name="check-circle" size={24} color="#059669" />
                  <View style={styles.successText}>
                    <ThemedText
                      type="body"
                      style={{ color: "#047857", fontWeight: "600" }}
                    >
                      Report Ready
                    </ThemedText>
                    <ThemedText type="small" style={{ color: "#065F46" }}>
                      {pdfUri && excelUri
                        ? "Both PDF and Excel reports have been generated successfully."
                        : pdfUri
                          ? "Your PDF report has been generated and is ready to share."
                          : "Your Excel report has been generated successfully."}
                    </ThemedText>
                  </View>
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  periodCard: {
    padding: Spacing.lg,
  },
  periodHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  periodDetails: {
    gap: Spacing.sm,
  },
  periodRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  loadingCard: {
    padding: Spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  previewCard: {
    padding: Spacing.lg,
  },
  contentItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  contentIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  contentText: {
    flex: 1,
    gap: 2,
  },
  actions: {
    gap: Spacing.md,
  },
  generateButton: {
    width: "100%",
  },
  formatButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  formatButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  shareActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    backgroundColor: "transparent",
  },
  successCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    backgroundColor: "#D1FAE5",
  },
  successContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  successText: {
    flex: 1,
    gap: 2,
  },
});
