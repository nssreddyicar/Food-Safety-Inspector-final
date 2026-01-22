import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  Share,
  Alert,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Input } from "@/components/Input";
import { FilterChips } from "@/components/FilterChips";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuthContext } from "@/context/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import type { Complaint } from "@shared/types/complaint.types";

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "assigned", label: "Assigned" },
  { value: "investigating", label: "Investigating" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

function getStatusColor(status: string, theme: any) {
  switch (status) {
    case "new":
      return theme.accent;
    case "assigned":
      return theme.primary;
    case "investigating":
      return theme.link;
    case "resolved":
      return theme.primary;
    case "closed":
      return theme.textSecondary;
    default:
      return theme.textSecondary;
  }
}

function ComplaintCard({
  complaint,
  onPress,
}: {
  complaint: Complaint;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const statusColor = getStatusColor(complaint.status, theme);

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.codeContainer}>
            <Feather name="file-text" size={16} color={theme.primary} />
            <ThemedText type="h4" style={styles.codeText}>
              {complaint.complaintCode}
            </ThemedText>
          </View>
          <View
            style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}
          >
            <ThemedText style={[styles.statusText, { color: statusColor }]}>
              {complaint.status.toUpperCase()}
            </ThemedText>
          </View>
        </View>

        <ThemedText style={styles.description} numberOfLines={2}>
          {complaint.incidentDescription || "No description provided"}
        </ThemedText>

        <View style={styles.cardFooter}>
          <View style={styles.footerItem}>
            <Feather name="user" size={14} color={theme.textSecondary} />
            <ThemedText style={styles.footerText}>
              {complaint.complainantName}
            </ThemedText>
          </View>
          <View style={styles.footerItem}>
            <Feather name="calendar" size={14} color={theme.textSecondary} />
            <ThemedText style={styles.footerText}>
              {new Date(complaint.submittedAt).toLocaleDateString()}
            </ThemedText>
          </View>
        </View>

        {complaint.location?.address ? (
          <View style={styles.locationRow}>
            <Feather name="map-pin" size={14} color={theme.textSecondary} />
            <ThemedText style={styles.locationText} numberOfLines={1}>
              {complaint.location.address}
            </ThemedText>
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

function LoadingSkeleton() {
  const { theme } = useTheme();
  return (
    <View style={styles.skeletonContainer}>
      {[1, 2, 3].map((i) => (
        <Card key={i} style={styles.card}>
          <View
            style={[styles.skeletonLine, { backgroundColor: theme.border }]}
          />
          <View
            style={[
              styles.skeletonLine,
              { backgroundColor: theme.border, width: "60%" },
            ]}
          />
          <View
            style={[
              styles.skeletonLine,
              { backgroundColor: theme.border, width: "40%" },
            ]}
          />
        </Card>
      ))}
    </View>
  );
}

function EmptyStateView({ hasFilters }: { hasFilters: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={styles.emptyContainer}>
      <Feather name="inbox" size={48} color={theme.textSecondary} />
      <ThemedText type="h3" style={styles.emptyTitle}>
        No Complaints Found
      </ThemedText>
      <ThemedText style={[styles.emptyMessage, { color: theme.textSecondary }]}>
        {hasFilters
          ? "Try adjusting your filters"
          : "No complaints have been submitted yet"}
      </ThemedText>
    </View>
  );
}

export default function ComplaintsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<any>();
  const { user } = useAuthContext();

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [filteredComplaints, setFilteredComplaints] = useState<Complaint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const jurisdictionId = user?.jurisdiction?.unitId;

  const loadData = useCallback(async () => {
    try {
      const apiUrl = getApiUrl();
      const url = new URL("/api/complaints", apiUrl);
      if (jurisdictionId) {
        url.searchParams.set("jurisdictionId", jurisdictionId);
      }
      if (statusFilter !== "all") {
        url.searchParams.set("status", statusFilter);
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error("Failed to fetch complaints");
      }

      const data = await response.json();
      const complaintsData = data.complaints || [];
      setComplaints(complaintsData);
      filterComplaints(complaintsData, searchQuery);
    } catch (error) {
      console.error("Failed to load complaints:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchQuery, statusFilter, jurisdictionId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const filterComplaints = (data: Complaint[], query: string) => {
    let filtered = data;

    if (query.trim()) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.complaintCode.toLowerCase().includes(lowerQuery) ||
          c.complainantName.toLowerCase().includes(lowerQuery) ||
          (c.incidentDescription?.toLowerCase().includes(lowerQuery) ?? false) ||
          (c.location?.address?.toLowerCase().includes(lowerQuery) ?? false)
      );
    }

    setFilteredComplaints(filtered);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    filterComplaints(complaints, query);
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const handleComplaintPress = (complaint: Complaint) => {
    navigation.navigate("ComplaintDetails", { complaintId: complaint.id });
  };

  const renderItem = useCallback(
    ({ item, index }: { item: Complaint; index: number }) => (
      <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
        <ComplaintCard
          complaint={item}
          onPress={() => handleComplaintPress(item)}
        />
      </Animated.View>
    ),
    []
  );

  const hasFilters = searchQuery.trim() !== "" || statusFilter !== "all";

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={filteredComplaints}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
        ]}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.shareFormRow}>
              <Pressable
                style={[styles.previewButton, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
                onPress={() => {
                  navigation.navigate("SubmitComplaint");
                }}
              >
                <Feather name="eye" size={18} color={theme.primary} />
              </Pressable>
              <Pressable
                style={[styles.shareFormButton, { backgroundColor: theme.primary }]}
                onPress={async () => {
                  const formLink = `https://food-safety-complaint.example.com/submit`;
                  const message = `Submit your food safety complaint online:\n\n${formLink}\n\nReport any food safety violations including expired products, unsanitary conditions, or adulteration.`;
                  
                  try {
                    await Share.share({
                      message,
                      title: "Food Safety Complaint Form",
                    });
                  } catch (error) {
                    await Clipboard.setStringAsync(formLink);
                    Alert.alert("Link Copied", "Complaint form link copied to clipboard");
                  }
                }}
              >
                <Feather name="share-2" size={18} color="#fff" />
                <ThemedText style={styles.shareFormButtonText}>
                  Share Complaint Form Link
                </ThemedText>
              </Pressable>
            </View>
            
            <Input
              placeholder="Search complaints..."
              value={searchQuery}
              onChangeText={handleSearch}
              icon="search"
              containerStyle={styles.searchInput}
            />
            <View style={styles.filterContainer}>
              <FilterChips
                options={STATUS_OPTIONS}
                selectedValue={statusFilter}
                onSelect={handleStatusFilter}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <LoadingSkeleton />
          ) : (
            <EmptyStateView hasFilters={hasFilters} />
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.md,
  },
  shareFormRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  previewButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  shareFormButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  shareFormButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  searchInput: {
    marginBottom: Spacing.md,
  },
  filterContainer: {
    marginHorizontal: -Spacing.lg,
  },
  card: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  codeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  codeText: {
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
  },
  description: {
    fontSize: 14,
    marginBottom: Spacing.md,
  },
  cardFooter: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  footerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  footerText: {
    fontSize: 12,
    opacity: 0.7,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  locationText: {
    fontSize: 12,
    opacity: 0.7,
    flex: 1,
  },
  skeletonContainer: {
    marginTop: Spacing.md,
  },
  skeletonLine: {
    height: 16,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Spacing.xl * 2,
  },
  emptyTitle: {
    marginTop: Spacing.md,
  },
  emptyMessage: {
    marginTop: Spacing.sm,
    textAlign: "center",
  },
});
