import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { StatCardSkeleton } from "@/components/SkeletonLoader";
import {
  TimeFilter,
  TimeSelection,
  getDateRangeForSelection,
  getFilterDisplayLabel,
  getCurrentDefaults,
} from "@/components/TimeFilter";
import { useTheme } from "@/hooks/useTheme";
import { useAuthContext } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/query-client";
import {
  DashboardMetrics,
  ProsecutionCase,
  ActionDashboardData,
  ActionCategory,
  ActionCategoryGroup,
} from "@/types";
import { Spacing, BorderRadius } from "@/constants/theme";

const GROUP_INFO: Record<
  ActionCategoryGroup,
  { name: string; icon: keyof typeof Feather.glyphMap }
> = {
  legal: { name: "LEGAL & COURT", icon: "briefcase" },
  inspection: { name: "INSPECTIONS & ENFORCEMENT", icon: "search" },
  sampling: { name: "SAMPLING & LABORATORY", icon: "thermometer" },
  administrative: { name: "ADMINISTRATIVE", icon: "folder" },
  protocol: { name: "PROTOCOL & DUTIES", icon: "shield" },
};

interface SummaryCardProps {
  title: string;
  value: number;
  color: string;
  bgColor: string;
}

function SummaryCard({ title, value, color, bgColor }: SummaryCardProps) {
  return (
    <View style={[styles.summaryCard, { backgroundColor: bgColor }]}>
      <ThemedText type="h1" style={[styles.summaryValue, { color }]}>
        {value}
      </ThemedText>
      <ThemedText type="small" style={[styles.summaryLabel, { color }]}>
        {title}
      </ThemedText>
    </View>
  );
}

interface ActionCategoryCardProps {
  category: ActionCategory;
  onPress: () => void;
}

function ActionCategoryCard({ category, onPress }: ActionCategoryCardProps) {
  const { theme } = useTheme();

  const getFeatherIcon = (iconName: string): keyof typeof Feather.glyphMap => {
    const iconMap: Record<string, keyof typeof Feather.glyphMap> = {
      briefcase: "briefcase",
      "file-text": "file-text",
      "dollar-sign": "dollar-sign",
      "refresh-cw": "refresh-cw",
      clipboard: "clipboard",
      "alert-triangle": "alert-triangle",
      lock: "lock",
      "trash-2": "trash-2",
      package: "package",
      clock: "clock",
      "file-plus": "file-plus",
      "alert-octagon": "alert-octagon",
      "alert-circle": "alert-circle",
      tag: "tag",
      "shield-off": "shield-off",
      target: "target",
      users: "users",
      calendar: "calendar",
      star: "star",
      "message-circle": "message-circle",
      shield: "shield",
    };
    return iconMap[iconName] || "folder";
  };

  return (
    <Card style={styles.actionCategoryCard} onPress={onPress}>
      <View style={styles.actionCategoryRow}>
        <View
          style={[
            styles.actionCategoryIcon,
            { backgroundColor: category.color + "20" },
          ]}
        >
          <Feather
            name={getFeatherIcon(category.icon)}
            size={18}
            color={category.color}
          />
        </View>
        <View style={styles.actionCategoryContent}>
          <ThemedText type="body" style={styles.actionCategoryName}>
            {category.name}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {category.counts.pending} pending · {category.counts.overdue}{" "}
            overdue
          </ThemedText>
        </View>
        <ThemedText type="h2" style={styles.actionCategoryCount}>
          {category.counts.total}
        </ThemedText>
      </View>
    </Card>
  );
}

interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  onPress?: () => void;
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  color,
  onPress,
}: MetricCardProps) {
  const { theme } = useTheme();

  return (
    <Pressable onPress={onPress} style={styles.metricCard}>
      <Card style={styles.cardInner}>
        <View style={[styles.iconContainer, { backgroundColor: color + "20" }]}>
          <Feather name={icon} size={20} color={color} />
        </View>
        <ThemedText type="h2" style={styles.metricValue}>
          {value}
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText
            type="small"
            style={{ color: theme.textSecondary, marginTop: 2, fontSize: 11 }}
          >
            {subtitle}
          </ThemedText>
        ) : null}
      </Card>
    </Pressable>
  );
}

interface SectionHeaderProps {
  title: string;
  icon: keyof typeof Feather.glyphMap;
}

function SectionHeader({ title, icon }: SectionHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.sectionHeader}>
      <Feather name={icon} size={18} color={theme.primary} />
      <ThemedText type="h3" style={{ marginLeft: Spacing.sm }}>
        {title}
      </ThemedText>
    </View>
  );
}

interface CourtCaseCardProps {
  caseData: ProsecutionCase;
  onPress: () => void;
}

function CourtCaseCard({ caseData, onPress }: CourtCaseCardProps) {
  const { theme } = useTheme();

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Not set";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getDaysUntilHearing = () => {
    if (!caseData.nextHearingDate) return null;
    const next = new Date(caseData.nextHearingDate);
    const today = new Date();
    const diff = Math.ceil(
      (next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    return diff;
  };

  const daysUntil = getDaysUntilHearing();
  const isUrgent = daysUntil !== null && daysUntil <= 7 && daysUntil >= 0;
  const isPast = daysUntil !== null && daysUntil < 0;

  const cardStyle = {
    ...styles.caseCard,
    ...(isUrgent ? { borderLeftWidth: 3, borderLeftColor: theme.warning } : {}),
    ...(isPast ? { borderLeftWidth: 3, borderLeftColor: theme.accent } : {}),
  };

  return (
    <Pressable onPress={onPress}>
      <Card style={cardStyle}>
        <View style={styles.caseHeader}>
          <View style={styles.caseNumberBadge}>
            <Feather name="briefcase" size={14} color={theme.primary} />
            <ThemedText
              type="body"
              style={{ marginLeft: 6, fontWeight: "600" }}
            >
              {caseData.caseNumber}
            </ThemedText>
          </View>
          {daysUntil !== null ? (
            <View
              style={[
                styles.daysBadge,
                {
                  backgroundColor: isPast
                    ? theme.accent + "20"
                    : isUrgent
                      ? theme.warning + "20"
                      : theme.success + "20",
                },
              ]}
            >
              <ThemedText
                type="small"
                style={{
                  color: isPast
                    ? theme.accent
                    : isUrgent
                      ? theme.warning
                      : theme.success,
                  fontSize: 11,
                }}
              >
                {isPast
                  ? `${Math.abs(daysUntil)} days ago`
                  : daysUntil === 0
                    ? "Today"
                    : `${daysUntil} days`}
              </ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.caseDetails}>
          <View style={styles.caseRow}>
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary, width: 90 }}
            >
              Respondent
            </ThemedText>
            <ThemedText type="body" style={{ flex: 1 }}>
              {caseData.respondentName}
            </ThemedText>
          </View>
          <View style={styles.caseRow}>
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary, width: 90 }}
            >
              Complainant
            </ThemedText>
            <ThemedText type="body" style={{ flex: 1 }}>
              {caseData.complainantName}
            </ThemedText>
          </View>
          {caseData.courtName ? (
            <View style={styles.caseRow}>
              <ThemedText
                type="small"
                style={{ color: theme.textSecondary, width: 90 }}
              >
                Court
              </ThemedText>
              <ThemedText type="body" style={{ flex: 1 }}>
                {caseData.courtName}
              </ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.caseDates}>
          <View style={styles.dateItem}>
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary, fontSize: 10 }}
            >
              First Reg.
            </ThemedText>
            <ThemedText type="small">
              {formatDate(caseData.firstRegistrationDate)}
            </ThemedText>
          </View>
          <View style={styles.dateItem}>
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary, fontSize: 10 }}
            >
              First Hearing
            </ThemedText>
            <ThemedText type="small">
              {formatDate(caseData.firstHearingDate)}
            </ThemedText>
          </View>
          <View style={styles.dateItem}>
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary, fontSize: 10 }}
            >
              Next Hearing
            </ThemedText>
            <ThemedText
              type="small"
              style={{
                color: isUrgent
                  ? theme.warning
                  : isPast
                    ? theme.accent
                    : theme.text,
              }}
            >
              {formatDate(caseData.nextHearingDate)}
            </ThemedText>
          </View>
        </View>

        <View style={styles.caseFooter}>
          <Feather name="chevron-right" size={16} color={theme.textSecondary} />
        </View>
      </Card>
    </Pressable>
  );
}

export default function DashboardScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<any>();
  const { user } = useAuthContext();

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [actionData, setActionData] = useState<ActionDashboardData | null>(
    null,
  );
  const [upcomingCases, setUpcomingCases] = useState<ProsecutionCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeSelection, setTimeSelection] =
    useState<TimeSelection>(getCurrentDefaults());

  const jurisdictionId = user?.jurisdiction?.unitId;

  const loadData = useCallback(async () => {
    try {
      const dateRange = getDateRangeForSelection(timeSelection);

      const metricsUrl = new URL("/api/dashboard/metrics", getApiUrl());
      const actionUrl = new URL("/api/action-dashboard", getApiUrl());
      const casesUrl = new URL("/api/upcoming-hearings", getApiUrl());

      if (jurisdictionId) {
        metricsUrl.searchParams.set("jurisdictionId", jurisdictionId);
        actionUrl.searchParams.set("jurisdictionId", jurisdictionId);
        casesUrl.searchParams.set("jurisdictionId", jurisdictionId);
      }

      metricsUrl.searchParams.set("startDate", dateRange.startDate);
      metricsUrl.searchParams.set("endDate", dateRange.endDate);
      actionUrl.searchParams.set("startDate", dateRange.startDate);
      actionUrl.searchParams.set("endDate", dateRange.endDate);
      casesUrl.searchParams.set("days", "30");

      const [metricsRes, actionRes, casesRes] = await Promise.all([
        fetch(metricsUrl.toString()),
        fetch(actionUrl.toString()),
        fetch(casesUrl.toString()),
      ]);

      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        setMetrics(metricsData);
      }

      if (actionRes.ok) {
        const actionDashboardData = await actionRes.json();
        setActionData(actionDashboardData);
      }

      if (casesRes.ok) {
        const casesData = await casesRes.json();
        setUpcomingCases(casesData.slice(0, 3));
      }
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [jurisdictionId, timeSelection]);

  const handleTimeSelectionChange = (selection: TimeSelection) => {
    setTimeSelection(selection);
    setIsLoading(true);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const handleCategoryPress = (category: ActionCategory) => {
    switch (category.code) {
      case "court_cases":
        navigation.navigate("ProfileTab", { screen: "CourtCases" });
        break;
      case "pending_inspections":
        navigation.navigate("InspectionsTab");
        break;
      case "samples_pending":
      case "lab_reports_awaited":
      case "unsafe_samples":
      case "substandard_samples":
        navigation.navigate("SamplesTab");
        break;
      default:
        break;
    }
  };

  const formatAmount = (amount: number) => {
    if (amount >= 10000000) return `${(amount / 10000000).toFixed(1)} Cr`;
    if (amount >= 100000) return `${(amount / 100000).toFixed(1)} L`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(1)} K`;
    return amount.toString();
  };

  const groupedCategories: Partial<
    Record<ActionCategoryGroup, ActionCategory[]>
  > = {};
  if (actionData?.categories) {
    actionData.categories.forEach((cat) => {
      if (!groupedCategories[cat.group]) {
        groupedCategories[cat.group] = [];
      }
      groupedCategories[cat.group]!.push(cat);
    });
  }

  const groupOrder: ActionCategoryGroup[] = [
    "legal",
    "inspection",
    "sampling",
    "administrative",
    "protocol",
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
        }
      >
        <Animated.View
          entering={FadeInDown.delay(100).duration(400)}
          style={styles.header}
        >
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <ThemedText type="h1" style={styles.title}>
                Action Dashboard
              </ThemedText>
              <ThemedText type="body" style={{ color: theme.textSecondary }}>
                {getFilterDisplayLabel(timeSelection)} overview
              </ThemedText>
            </View>
            <View style={styles.headerActions}>
              <TimeFilter
                selected={timeSelection}
                onSelect={handleTimeSelectionChange}
              />
              <Pressable
                onPress={() =>
                  navigation.navigate("GenerateReport", { timeSelection })
                }
                style={[
                  styles.reportButton,
                  { backgroundColor: theme.primary + "15" },
                ]}
              >
                <Feather name="file-text" size={18} color={theme.primary} />
              </Pressable>
            </View>
          </View>
        </Animated.View>

        {actionData ? (
          <>
            <Animated.View entering={FadeInDown.delay(150).duration(400)}>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryRow}>
                  <SummaryCard
                    title="Overdue"
                    value={actionData.totals.overdueItems}
                    color="#DC2626"
                    bgColor="#FEE2E2"
                  />
                  <SummaryCard
                    title="Due Today"
                    value={actionData.totals.dueToday}
                    color="#92400E"
                    bgColor="#FEF3C7"
                  />
                </View>
                <View style={styles.summaryRow}>
                  <SummaryCard
                    title="This Week"
                    value={actionData.totals.dueThisWeek}
                    color="#1E40AF"
                    bgColor="#DBEAFE"
                  />
                  <SummaryCard
                    title="Total Actions"
                    value={actionData.totals.totalItems}
                    color="#065F46"
                    bgColor="#D1FAE5"
                  />
                </View>
              </View>
            </Animated.View>

            {groupOrder.map((group, groupIndex) => {
              const categories = groupedCategories[group];
              if (!categories || categories.length === 0) return null;

              const groupInfo = GROUP_INFO[group];
              return (
                <Animated.View
                  key={group}
                  entering={FadeInDown.delay(200 + groupIndex * 50).duration(
                    400,
                  )}
                  style={styles.actionGroupContainer}
                >
                  <View style={styles.actionGroupHeader}>
                    <Feather
                      name={groupInfo.icon}
                      size={14}
                      color={theme.textSecondary}
                    />
                    <ThemedText type="small" style={styles.actionGroupTitle}>
                      {groupInfo.name}
                    </ThemedText>
                  </View>
                  {categories.map((category) => (
                    <ActionCategoryCard
                      key={category.id}
                      category={category}
                      onPress={() => handleCategoryPress(category)}
                    />
                  ))}
                </Animated.View>
              );
            })}
          </>
        ) : isLoading ? (
          <View style={styles.loadingContainer}>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryRow}>
                <View
                  style={[styles.summaryCard, { backgroundColor: "#FEE2E2" }]}
                />
                <View
                  style={[styles.summaryCard, { backgroundColor: "#FEF3C7" }]}
                />
              </View>
              <View style={styles.summaryRow}>
                <View
                  style={[styles.summaryCard, { backgroundColor: "#DBEAFE" }]}
                />
                <View
                  style={[styles.summaryCard, { backgroundColor: "#D1FAE5" }]}
                />
              </View>
            </View>
          </View>
        ) : null}

        <Animated.View
          entering={FadeInDown.delay(500).duration(400)}
          style={styles.divider}
        >
          <View
            style={[styles.dividerLine, { backgroundColor: theme.border }]}
          />
          <ThemedText
            type="small"
            style={[
              styles.dividerText,
              {
                color: theme.textSecondary,
                backgroundColor: theme.backgroundRoot,
              },
            ]}
          >
            Statistics Overview
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(550).duration(400)}>
          <SectionHeader title="Licenses & Registrations" icon="file-text" />
          {isLoading ? (
            <View style={styles.metricsRow}>
              <StatCardSkeleton />
              <StatCardSkeleton />
            </View>
          ) : (
            <>
              <View style={styles.metricsRow}>
                <MetricCard
                  title="Licenses"
                  value={metrics?.licenses.total || 0}
                  subtitle={`Active: ${metrics?.licenses.active || 0}`}
                  icon="award"
                  color={theme.primary}
                />
                <MetricCard
                  title="License Fees"
                  value={`Rs ${formatAmount(metrics?.licenses.amount || 0)}`}
                  icon="dollar-sign"
                  color={theme.success}
                />
              </View>
              <View style={[styles.metricsRow, { marginTop: Spacing.sm }]}>
                <MetricCard
                  title="Registrations"
                  value={metrics?.registrations.total || 0}
                  subtitle={`Active: ${metrics?.registrations.active || 0}`}
                  icon="file"
                  color="#0EA5E9"
                />
                <MetricCard
                  title="Reg. Fees"
                  value={`Rs ${formatAmount(metrics?.registrations.amount || 0)}`}
                  icon="dollar-sign"
                  color={theme.success}
                />
              </View>
            </>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(600).duration(400)}>
          <SectionHeader title="Inspections" icon="clipboard" />
          {isLoading ? (
            <View style={styles.metricsRow}>
              <StatCardSkeleton />
              <StatCardSkeleton />
            </View>
          ) : (
            <View style={styles.metricsRow}>
              <MetricCard
                title="License Insp."
                value={metrics?.inspections.license || 0}
                icon="search"
                color={theme.primary}
                onPress={() => navigation.navigate("InspectionsTab")}
              />
              <MetricCard
                title="Reg. Insp."
                value={metrics?.inspections.registration || 0}
                icon="search"
                color="#0EA5E9"
                onPress={() => navigation.navigate("InspectionsTab")}
              />
            </View>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(650).duration(400)}>
          <SectionHeader title="Grievances" icon="message-square" />
          {isLoading ? (
            <View style={styles.metricsRow}>
              <StatCardSkeleton />
              <StatCardSkeleton />
            </View>
          ) : (
            <View style={styles.metricsRow}>
              <MetricCard
                title="Online"
                value={metrics?.grievances.online || 0}
                icon="globe"
                color="#3B82F6"
              />
              <MetricCard
                title="Offline"
                value={metrics?.grievances.offline || 0}
                icon="edit-3"
                color="#8B5CF6"
              />
              <MetricCard
                title="Pending"
                value={metrics?.grievances.pending || 0}
                icon="clock"
                color={theme.warning}
              />
            </View>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(700).duration(400)}>
          <SectionHeader title="FSW Activities" icon="users" />
          {isLoading ? (
            <View style={styles.metricsRow}>
              <StatCardSkeleton />
              <StatCardSkeleton />
            </View>
          ) : (
            <View style={styles.metricsRow}>
              <MetricCard
                title="Testing"
                value={metrics?.fsw.testing || 0}
                icon="thermometer"
                color="#10B981"
              />
              <MetricCard
                title="Training"
                value={metrics?.fsw.training || 0}
                icon="book-open"
                color="#F59E0B"
              />
              <MetricCard
                title="Awareness"
                value={metrics?.fsw.awareness || 0}
                icon="radio"
                color="#EC4899"
              />
            </View>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(750).duration(400)}>
          <SectionHeader title="Adjudication & Prosecution" icon="briefcase" />
          {isLoading ? (
            <View style={styles.metricsRow}>
              <StatCardSkeleton />
              <StatCardSkeleton />
            </View>
          ) : (
            <View style={styles.metricsRow}>
              <MetricCard
                title="Adj. Pending"
                value={metrics?.adjudication.pending || 0}
                subtitle={`Total: ${metrics?.adjudication.total || 0}`}
                icon="sliders"
                color="#6366F1"
              />
              <MetricCard
                title="Court Pending"
                value={metrics?.prosecution.pending || 0}
                subtitle={`Total: ${metrics?.prosecution.total || 0}`}
                icon="briefcase"
                color={theme.accent}
                onPress={() =>
                  navigation.navigate("ProfileTab", { screen: "CourtCases" })
                }
              />
            </View>
          )}
        </Animated.View>

        {upcomingCases.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(800).duration(400)}>
            <View style={styles.sectionHeaderWithAction}>
              <SectionHeader title="Upcoming Court Dates" icon="calendar" />
              <Pressable
                onPress={() =>
                  navigation.navigate("ProfileTab", { screen: "CourtCases" })
                }
                style={styles.viewAllButton}
              >
                <ThemedText type="small" style={{ color: theme.primary }}>
                  View All
                </ThemedText>
                <Feather name="chevron-right" size={14} color={theme.primary} />
              </Pressable>
            </View>
            {upcomingCases.map((caseData, index) => (
              <Animated.View
                key={caseData.id}
                entering={FadeInDown.delay(850 + index * 50).duration(400)}
              >
                <CourtCaseCard
                  caseData={caseData}
                  onPress={() =>
                    navigation.navigate("ProfileTab", {
                      screen: "CaseDetails",
                      params: { caseId: caseData.id },
                    })
                  }
                />
              </Animated.View>
            ))}
          </Animated.View>
        ) : null}
      </ScrollView>
    </View>
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
    marginBottom: Spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  headerText: {
    flex: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  reportButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 4,
  },
  summaryGrid: {
    gap: Spacing.sm,
  },
  summaryRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  summaryCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 80,
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 38,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2,
  },
  actionGroupContainer: {
    marginBottom: Spacing.xs,
  },
  actionGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
    paddingLeft: 4,
  },
  actionGroupTitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    color: "#6B7280",
  },
  actionCategoryCard: {
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  actionCategoryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionCategoryIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  actionCategoryContent: {
    flex: 1,
  },
  actionCategoryName: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  actionCategoryCount: {
    fontSize: 20,
    fontWeight: "600",
    color: "#374151",
    marginLeft: Spacing.md,
  },
  loadingContainer: {
    marginBottom: Spacing.lg,
  },
  divider: {
    position: "relative",
    alignItems: "center",
    marginVertical: Spacing.md,
  },
  dividerLine: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    height: 1,
  },
  dividerText: {
    paddingHorizontal: Spacing.md,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  sectionHeaderWithAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metricsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  metricCard: {
    flex: 1,
  },
  cardInner: {
    padding: Spacing.md,
    alignItems: "center",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  metricValue: {
    fontSize: 22,
    marginBottom: 2,
  },
  caseCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  caseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  caseNumberBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  daysBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  caseDetails: {
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  caseRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  caseDates: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
  },
  dateItem: {
    alignItems: "center",
  },
  caseFooter: {
    position: "absolute",
    right: Spacing.md,
    top: "50%",
  },
});
