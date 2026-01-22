import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";
import { ThemedText } from "@/components/ThemedText";
import { Input } from "@/components/Input";
import { FilterChips } from "@/components/FilterChips";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { FAB } from "@/components/FAB";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { useTheme } from "@/hooks/useTheme";
import { useAuthContext } from "@/context/AuthContext";
import { ProsecutionCase } from "@/types";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

const emptyImage = require("../../assets/images/inspections-empty.png");

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "ongoing", label: "Ongoing" },
  { value: "convicted", label: "Convicted" },
  { value: "acquitted", label: "Acquitted" },
  { value: "closed", label: "Closed" },
];

function CaseCardSkeleton() {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <SkeletonLoader height={140} borderRadius={BorderRadius.xl} />
    </View>
  );
}

export default function CourtCasesScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const { user } = useAuthContext();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const jurisdictionId = user?.jurisdiction?.unitId;

  const {
    data: cases = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<ProsecutionCase[]>({
    queryKey: ["/api/prosecution-cases", jurisdictionId],
    queryFn: async () => {
      const url = new URL("/api/prosecution-cases", getApiUrl());
      if (jurisdictionId)
        url.searchParams.set("jurisdictionId", jurisdictionId);
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch cases");
      return res.json();
    },
    enabled: !!jurisdictionId,
  });

  const filteredCases = cases.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        c.caseNumber.toLowerCase().includes(q) ||
        c.respondentName.toLowerCase().includes(q) ||
        c.complainantName.toLowerCase().includes(q) ||
        (c.courtName || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Not set";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getDaysUntilHearing = (nextHearingDate?: string) => {
    if (!nextHearingDate) return null;
    const next = new Date(nextHearingDate);
    const today = new Date();
    return Math.ceil(
      (next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return theme.warning;
      case "ongoing":
        return theme.primary;
      case "convicted":
        return theme.accent;
      case "acquitted":
        return theme.success;
      case "closed":
        return theme.textSecondary;
      default:
        return theme.textSecondary;
    }
  };

  const renderCase = ({
    item,
    index,
  }: {
    item: ProsecutionCase;
    index: number;
  }) => {
    const daysUntil = getDaysUntilHearing(item.nextHearingDate);
    const isUrgent = daysUntil !== null && daysUntil <= 7 && daysUntil >= 0;
    const isPast = daysUntil !== null && daysUntil < 0;

    const cardStyle = {
      ...styles.caseCard,
      ...(isUrgent
        ? { borderLeftWidth: 3, borderLeftColor: theme.warning }
        : {}),
      ...(isPast ? { borderLeftWidth: 3, borderLeftColor: theme.accent } : {}),
    };

    return (
      <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
        <Card
          style={cardStyle}
          onPress={() =>
            navigation.navigate("CaseDetails", { caseId: item.id })
          }
        >
          <View style={styles.caseHeader}>
            <View style={styles.caseNumberRow}>
              <Feather name="briefcase" size={16} color={theme.primary} />
              <ThemedText
                type="body"
                style={{ marginLeft: 8, fontWeight: "600" }}
              >
                {item.caseNumber}
              </ThemedText>
            </View>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(item.status) + "20" },
              ]}
            >
              <ThemedText
                type="small"
                style={{
                  color: getStatusColor(item.status),
                  textTransform: "capitalize",
                }}
              >
                {item.status}
              </ThemedText>
            </View>
          </View>

          <View style={styles.caseBody}>
            <View style={styles.infoRow}>
              <Feather name="user" size={14} color={theme.textSecondary} />
              <ThemedText type="body" style={{ marginLeft: 8, flex: 1 }}>
                {item.respondentName}
              </ThemedText>
            </View>
            {item.courtName ? (
              <View style={styles.infoRow}>
                <Feather name="home" size={14} color={theme.textSecondary} />
                <ThemedText
                  type="small"
                  style={{ marginLeft: 8, color: theme.textSecondary, flex: 1 }}
                >
                  {item.courtName}
                  {item.courtLocation ? `, ${item.courtLocation}` : ""}
                </ThemedText>
              </View>
            ) : null}
          </View>

          <View style={styles.caseDates}>
            <View style={styles.dateColumn}>
              <ThemedText
                type="small"
                style={{ color: theme.textSecondary, fontSize: 10 }}
              >
                Next Hearing
              </ThemedText>
              <ThemedText type="small" style={{ fontWeight: "500" }}>
                {formatDate(item.nextHearingDate)}
              </ThemedText>
            </View>
            {daysUntil !== null ? (
              <View
                style={[
                  styles.daysBadge,
                  {
                    backgroundColor: isPast
                      ? theme.accent + "15"
                      : isUrgent
                        ? theme.warning + "15"
                        : theme.success + "15",
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
                      : `In ${daysUntil} days`}
                </ThemedText>
              </View>
            ) : null}
          </View>
        </Card>
      </Animated.View>
    );
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <Input
        placeholder="Search case number, respondent, court..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        icon="search"
        testID="input-search-cases"
      />
      <FilterChips
        options={STATUS_FILTERS}
        selectedValue={statusFilter}
        onSelect={setStatusFilter}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={filteredCases}
        keyExtractor={(item) => item.id}
        renderItem={renderCase}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loadingContainer}>
              <CaseCardSkeleton />
              <CaseCardSkeleton />
              <CaseCardSkeleton />
            </View>
          ) : (
            <EmptyState
              image={emptyImage}
              title="No Court Cases"
              description="Cases filed for prosecution will appear here"
            />
          )
        }
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={theme.primary}
          />
        }
      />

      <FAB
        icon="plus"
        onPress={() => navigation.navigate("NewCase")}
        testID="fab-new-case"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  headerContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  loadingContainer: {
    gap: Spacing.md,
  },
  caseCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  caseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  caseNumberRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  caseBody: {
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  caseDates: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
    paddingTop: Spacing.sm,
  },
  dateColumn: {
    gap: 2,
  },
  daysBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
  },
});
