import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { useTheme } from "@/hooks/useTheme";
import { useAuthContext } from "@/context/AuthContext";
import { Spacing, FontSize, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import type { InstitutionalInspectionsStackParamList } from "@/navigation/InstitutionalInspectionsStackNavigator";

interface Inspection {
  id: string;
  inspectionCode: string;
  institutionName: string;
  institutionAddress: string;
  inspectionDate: string;
  status: string;
  totalScore: number | null;
  riskClassification: string | null;
  institutionType?: { name: string };
}

type StatusTab = "all" | "draft" | "submitted";

const RISK_COLORS = {
  high: { bg: "#FEE2E2", text: "#DC2626" },
  medium: { bg: "#FEF3C7", text: "#D97706" },
  low: { bg: "#D1FAE5", text: "#059669" },
};

export default function InstitutionalInspectionsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<InstitutionalInspectionsStackParamList>>();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { user } = useAuthContext();

  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<StatusTab>("all");

  const fetchInspections = async () => {
    try {
      const response = await fetch(
        new URL("/api/institutional-inspections", getApiUrl()).toString(),
        {
          headers: {
            "Content-Type": "application/json",
            "x-officer-id": user?.id || "",
          },
        }
      );
      if (response.ok) {
        const data = await response.json();
        setInspections(data);
      }
    } catch (error) {
      console.error("Error fetching inspections:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchInspections();
    }, [])
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchInspections();
  };

  const filteredInspections = inspections.filter((inspection) => {
    const matchesSearch =
      searchQuery === "" ||
      inspection.institutionName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inspection.inspectionCode?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTab =
      activeTab === "all" ||
      (activeTab === "draft" && inspection.status === "draft") ||
      (activeTab === "submitted" && inspection.status === "submitted");

    return matchesSearch && matchesTab;
  });

  const getCounts = () => {
    const all = inspections.length;
    const draft = inspections.filter((i) => i.status === "draft").length;
    const submitted = inspections.filter((i) => i.status === "submitted").length;
    return { all, draft, submitted };
  };

  const counts = getCounts();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return { bg: "#E5E7EB", text: "#374151" };
      case "submitted":
        return { bg: "#DBEAFE", text: "#1D4ED8" };
      default:
        return { bg: "#E5E7EB", text: "#6B7280" };
    }
  };

  const renderInspectionCard = ({ item }: { item: Inspection }) => {
    const statusColors = getStatusColor(item.status);
    const riskKey = item.riskClassification?.toLowerCase().replace(" risk", "") as keyof typeof RISK_COLORS;
    const riskColors = RISK_COLORS[riskKey] || { bg: "#E5E7EB", text: "#6B7280" };

    return (
      <Pressable
        onPress={() => {
          if (item.status === "submitted") {
            navigation.navigate("InspectionDetails", { inspectionId: item.id });
          }
        }}
        style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
      >
        <Card style={styles.inspectionCard}>
          <View style={styles.cardHeader}>
            <View style={styles.codeContainer}>
              <ThemedText style={styles.inspectionCode}>{item.inspectionCode}</ThemedText>
              <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
                <ThemedText style={[styles.statusText, { color: statusColors.text }]}>
                  {item.status.toUpperCase()}
                </ThemedText>
              </View>
            </View>
            <ThemedText style={styles.dateText}>{formatDate(item.inspectionDate)}</ThemedText>
          </View>

          <ThemedText style={styles.institutionName} numberOfLines={1}>
            {item.institutionName}
          </ThemedText>
          
          <ThemedText style={styles.addressText} numberOfLines={1}>
            {item.institutionAddress || "No address provided"}
          </ThemedText>

          {item.status === "submitted" && item.totalScore !== null ? (
            <View style={styles.scoreRow}>
              <View style={styles.scoreContainer}>
                <ThemedText style={styles.scoreLabel}>Score:</ThemedText>
                <ThemedText style={[styles.scoreValue, { color: theme.primary }]}>
                  {item.totalScore}
                </ThemedText>
              </View>
              {item.riskClassification ? (
                <View style={[styles.riskBadge, { backgroundColor: riskColors.bg }]}>
                  <ThemedText style={[styles.riskText, { color: riskColors.text }]}>
                    {item.riskClassification.toUpperCase()}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          ) : null}
        </Card>
      </Pressable>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="clipboard" size={48} color={theme.textSecondary} />
      <ThemedText style={styles.emptyTitle}>No Inspections Found</ThemedText>
      <ThemedText style={styles.emptySubtitle}>
        {activeTab === "all"
          ? "Tap the + button to start a new inspection"
          : `No ${activeTab} inspections`}
      </ThemedText>
    </View>
  );

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText style={{ marginTop: Spacing.md }}>Loading inspections...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <ThemedText style={styles.headerTitle}>Institutional Inspections</ThemedText>
        
        <View style={styles.searchContainer}>
          <Input
            placeholder="Search by name or code..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            leftIcon={<Feather name="search" size={18} color={theme.textSecondary} />}
            style={styles.searchInput}
          />
        </View>

        <View style={styles.tabsContainer}>
          {(["all", "draft", "submitted"] as StatusTab[]).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[
                styles.tab,
                activeTab === tab && { backgroundColor: theme.primary },
              ]}
            >
              <ThemedText
                style={[
                  styles.tabText,
                  activeTab === tab && { color: "#FFFFFF" },
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </ThemedText>
              <View
                style={[
                  styles.countBadge,
                  activeTab === tab
                    ? { backgroundColor: "rgba(255,255,255,0.3)" }
                    : { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <ThemedText
                  style={[
                    styles.countText,
                    activeTab === tab && { color: "#FFFFFF" },
                  ]}
                >
                  {counts[tab]}
                </ThemedText>
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={filteredInspections}
        keyExtractor={(item) => item.id}
        renderItem={renderInspectionCard}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: tabBarHeight + Spacing.xl + 80 },
        ]}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />

      <Pressable
        style={[
          styles.fab,
          { backgroundColor: theme.primary, bottom: tabBarHeight + Spacing.lg },
        ]}
        onPress={() => navigation.navigate("SafetyAssessment")}
      >
        <Feather name="plus" size={28} color="#FFFFFF" />
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  headerTitle: { fontSize: 24, fontWeight: "700", marginBottom: Spacing.md },
  searchContainer: { marginBottom: Spacing.md },
  searchInput: { marginBottom: 0 },
  tabsContainer: { flexDirection: "row", gap: Spacing.sm },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  tabText: { fontSize: FontSize.sm, fontWeight: "500" },
  countBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    minWidth: 24,
    alignItems: "center",
  },
  countText: { fontSize: FontSize.xs, fontWeight: "600" },
  listContent: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  inspectionCard: { marginBottom: Spacing.md, padding: Spacing.md },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.xs,
  },
  codeContainer: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  inspectionCode: { fontSize: FontSize.sm, fontWeight: "600", color: "#6B7280" },
  statusBadge: { paddingHorizontal: Spacing.xs, paddingVertical: 2, borderRadius: 4 },
  statusText: { fontSize: 10, fontWeight: "600" },
  dateText: { fontSize: FontSize.xs, color: "#6B7280" },
  institutionName: { fontSize: FontSize.md, fontWeight: "600", marginBottom: 2 },
  addressText: { fontSize: FontSize.sm, color: "#6B7280", marginBottom: Spacing.sm },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.xs,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  scoreContainer: { flexDirection: "row", alignItems: "center", gap: Spacing.xs },
  scoreLabel: { fontSize: FontSize.sm, color: "#6B7280" },
  scoreValue: { fontSize: FontSize.lg, fontWeight: "700" },
  riskBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: 4 },
  riskText: { fontSize: FontSize.xs, fontWeight: "600" },
  emptyState: { alignItems: "center", paddingVertical: Spacing.xl * 2 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: "600", marginTop: Spacing.md },
  emptySubtitle: { fontSize: FontSize.sm, color: "#6B7280", marginTop: Spacing.xs, textAlign: "center" },
  fab: {
    position: "absolute",
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
