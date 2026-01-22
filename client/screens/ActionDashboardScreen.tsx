import React, { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuthContext } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/query-client";
import {
  ActionDashboardData,
  ActionCategory,
  ActionCategoryGroup,
} from "@/types";
import { Spacing, BorderRadius } from "@/constants/theme";

const GROUP_INFO: Record<
  ActionCategoryGroup,
  { name: string; icon: keyof typeof Feather.glyphMap; color: string }
> = {
  legal: { name: "LEGAL & COURT", icon: "briefcase", color: "#D97706" },
  inspection: {
    name: "INSPECTIONS & ENFORCEMENT",
    icon: "search",
    color: "#1E40AF",
  },
  sampling: {
    name: "SAMPLING & LABORATORY",
    icon: "thermometer",
    color: "#059669",
  },
  administrative: { name: "ADMINISTRATIVE", icon: "folder", color: "#7C3AED" },
  protocol: { name: "PROTOCOL & DUTIES", icon: "shield", color: "#DC2626" },
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

interface CategoryCardProps {
  category: ActionCategory;
  onPress: () => void;
}

function CategoryCard({ category, onPress }: CategoryCardProps) {
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
    <Card style={styles.categoryCard} onPress={onPress}>
      <View style={styles.categoryRow}>
        <View
          style={[
            styles.categoryIcon,
            { backgroundColor: category.color + "20" },
          ]}
        >
          <Feather
            name={getFeatherIcon(category.icon)}
            size={18}
            color={category.color}
          />
        </View>
        <View style={styles.categoryContent}>
          <ThemedText type="body" style={styles.categoryName}>
            {category.name}
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {category.counts.pending} pending · {category.counts.overdue}{" "}
            overdue
          </ThemedText>
        </View>
        <ThemedText type="h2" style={styles.categoryCount}>
          {category.counts.total}
        </ThemedText>
      </View>
    </Card>
  );
}

export default function ActionDashboardScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<any>();
  const { user } = useAuthContext();

  const [data, setData] = useState<ActionDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const jurisdictionId = user?.jurisdiction?.unitId;

  const loadData = useCallback(async () => {
    try {
      const url = new URL("/api/action-dashboard", getApiUrl());
      if (jurisdictionId) {
        url.searchParams.set("jurisdictionId", jurisdictionId);
      }

      const response = await fetch(url.toString());
      if (response.ok) {
        const dashboardData = await response.json();
        setData(dashboardData);
      }
    } catch (error) {
      console.error("Failed to load action dashboard:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [jurisdictionId]);

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

  const groupedCategories: Partial<
    Record<ActionCategoryGroup, ActionCategory[]>
  > = {};
  if (data?.categories) {
    data.categories.forEach((cat) => {
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
          <ThemedText type="h1" style={styles.title}>
            Action Dashboard
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            Today&apos;s overview
          </ThemedText>
        </Animated.View>

        {data ? (
          <>
            <Animated.View entering={FadeInDown.delay(200).duration(400)}>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryRow}>
                  <SummaryCard
                    title="Overdue"
                    value={data.totals.overdueItems}
                    color="#DC2626"
                    bgColor="#FEE2E2"
                  />
                  <SummaryCard
                    title="Due Today"
                    value={data.totals.dueToday}
                    color="#92400E"
                    bgColor="#FEF3C7"
                  />
                </View>
                <View style={styles.summaryRow}>
                  <SummaryCard
                    title="This Week"
                    value={data.totals.dueThisWeek}
                    color="#1E40AF"
                    bgColor="#DBEAFE"
                  />
                  <SummaryCard
                    title="Total Actions"
                    value={data.totals.totalItems}
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
                  entering={FadeInDown.delay(300 + groupIndex * 100).duration(
                    400,
                  )}
                  style={styles.groupContainer}
                >
                  <View style={styles.groupHeader}>
                    <Feather
                      name={groupInfo.icon}
                      size={14}
                      color={theme.textSecondary}
                    />
                    <ThemedText type="small" style={styles.groupTitle}>
                      {groupInfo.name}
                    </ThemedText>
                  </View>
                  {categories.map((category) => (
                    <CategoryCard
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
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Loading action dashboard...
            </ThemedText>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Feather name="inbox" size={48} color={theme.textSecondary} />
            <ThemedText
              type="body"
              style={{ color: theme.textSecondary, marginTop: Spacing.lg }}
            >
              No action categories configured
            </ThemedText>
          </View>
        )}
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
  },
  header: {
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 4,
  },
  summaryGrid: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
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
  groupContainer: {
    marginBottom: Spacing.md,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
    paddingLeft: 4,
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    color: "#6B7280",
  },
  categoryCard: {
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  categoryContent: {
    flex: 1,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  categoryCount: {
    fontSize: 20,
    fontWeight: "600",
    color: "#374151",
    marginLeft: Spacing.md,
  },
  loadingContainer: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  emptyContainer: {
    padding: Spacing.xl * 2,
    alignItems: "center",
  },
});
