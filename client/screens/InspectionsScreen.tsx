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
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { Input } from "@/components/Input";
import { FilterChips } from "@/components/FilterChips";
import { InspectionCard } from "@/components/InspectionCard";
import { EmptyState } from "@/components/EmptyState";
import { FAB } from "@/components/FAB";
import { InspectionCardSkeleton } from "@/components/SkeletonLoader";
import { useTheme } from "@/hooks/useTheme";
import { useAuthContext } from "@/context/AuthContext";
import { storage } from "@/lib/storage";
import { Inspection, InspectionStatus } from "@/types";
import { Spacing } from "@/constants/theme";

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "closed", label: "Closed" },
];

export default function InspectionsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<any>();
  const { user } = useAuthContext();

  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [filteredInspections, setFilteredInspections] = useState<Inspection[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const jurisdictionId = user?.jurisdiction?.unitId;

  const loadData = useCallback(async () => {
    try {
      const data = await storage.getInspections(jurisdictionId);
      setInspections(data);
      filterInspections(data, searchQuery, statusFilter);
    } catch (error) {
      console.error("Failed to load inspections:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchQuery, statusFilter, jurisdictionId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const filterInspections = (
    data: Inspection[],
    query: string,
    status: string,
  ) => {
    let filtered = data;

    if (status !== "all") {
      filtered = filtered.filter((i) => i.status === status);
    }

    if (query.trim()) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.fboDetails.name.toLowerCase().includes(lowerQuery) ||
          i.fboDetails.address.toLowerCase().includes(lowerQuery) ||
          i.type.toLowerCase().includes(lowerQuery),
      );
    }

    setFilteredInspections(filtered);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    filterInspections(inspections, query, statusFilter);
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    filterInspections(inspections, searchQuery, status);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <Input
        placeholder="Search by FBO name, address, type..."
        value={searchQuery}
        onChangeText={handleSearch}
        icon="search"
        testID="input-search"
      />
      <FilterChips
        options={STATUS_FILTERS}
        selectedValue={statusFilter}
        onSelect={handleStatusFilter}
      />
    </View>
  );

  const renderInspection = ({
    item,
    index,
  }: {
    item: Inspection;
    index: number;
  }) => (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
      <InspectionCard
        inspection={item}
        onPress={() =>
          navigation.navigate("InspectionDetails", { inspectionId: item.id })
        }
      />
    </Animated.View>
  );

  const renderEmptyState = () => (
    <EmptyState
      image={require("../../assets/images/inspections-empty.png")}
      title="No Inspections Found"
      description={
        searchQuery || statusFilter !== "all"
          ? "Try adjusting your search or filters"
          : "Start your first inspection by tapping the button below"
      }
      actionLabel={
        !searchQuery && statusFilter === "all" ? "New Inspection" : undefined
      }
      onAction={
        !searchQuery && statusFilter === "all"
          ? () => navigation.navigate("NewInspection")
          : undefined
      }
    />
  );

  const renderSkeleton = () => (
    <View style={styles.skeletonContainer}>
      {[1, 2, 3].map((i) => (
        <InspectionCardSkeleton key={i} />
      ))}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={filteredInspections}
        keyExtractor={(item) => item.id}
        renderItem={renderInspection}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={isLoading ? renderSkeleton : renderEmptyState}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: tabBarHeight + Spacing["4xl"] + 56,
          },
          filteredInspections.length === 0 && !isLoading && styles.emptyContent,
        ]}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
        }
      />
      <FAB
        icon="plus"
        onPress={() => navigation.navigate("NewInspection")}
        testID="fab-new-inspection"
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
  emptyContent: {
    flexGrow: 1,
  },
  headerContainer: {
    gap: Spacing.lg,
    marginBottom: Spacing.md,
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  skeletonContainer: {
    gap: Spacing.md,
  },
});
