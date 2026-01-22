import React, { useState, useCallback } from "react";
import { View, StyleSheet, FlatList, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { FilterChips } from "@/components/FilterChips";
import { SampleCard } from "@/components/SampleCard";
import { EmptyState } from "@/components/EmptyState";
import { SampleCardSkeleton } from "@/components/SkeletonLoader";
import { useTheme } from "@/hooks/useTheme";
import { useAuthContext } from "@/context/AuthContext";
import { storage } from "@/lib/storage";
import { Sample } from "@/types";
import { Spacing } from "@/constants/theme";

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "dispatched", label: "Dispatched" },
  { value: "completed", label: "Completed" },
];

export default function SamplesScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<any>();
  const { user } = useAuthContext();

  const [samples, setSamples] = useState<Sample[]>([]);
  const [filteredSamples, setFilteredSamples] = useState<Sample[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const jurisdictionId = user?.jurisdiction?.unitId;

  const loadData = useCallback(async () => {
    try {
      const data = await storage.getSamples(jurisdictionId);
      setSamples(data);
      filterSamples(data, statusFilter);
    } catch (error) {
      console.error("Failed to load samples:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [statusFilter, jurisdictionId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const filterSamples = (data: Sample[], status: string) => {
    let filtered = data;

    switch (status) {
      case "pending":
        filtered = filtered.filter((s) => !s.dispatchDate && !s.labResult);
        break;
      case "dispatched":
        filtered = filtered.filter((s) => s.dispatchDate && !s.labResult);
        break;
      case "completed":
        filtered = filtered.filter((s) => !!s.labResult);
        break;
    }

    setFilteredSamples(filtered);
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    filterSamples(samples, status);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.titleRow}>
        <ThemedText type="h3">Sample Tracking</ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {samples.length} total
        </ThemedText>
      </View>
      <FilterChips
        options={STATUS_FILTERS}
        selectedValue={statusFilter}
        onSelect={handleStatusFilter}
      />
    </View>
  );

  const renderSample = ({ item, index }: { item: Sample; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
      <SampleCard
        sample={item}
        onPress={() =>
          navigation.navigate("SampleDetails", { sampleId: item.id })
        }
      />
    </Animated.View>
  );

  const renderEmptyState = () => (
    <EmptyState
      image={require("../../assets/images/samples-empty.png")}
      title="No Samples Found"
      description={
        statusFilter !== "all"
          ? "Try adjusting your filter to see more samples"
          : "Samples lifted during inspections will appear here"
      }
    />
  );

  const renderSkeleton = () => (
    <View style={styles.skeletonContainer}>
      {[1, 2, 3, 4].map((i) => (
        <SampleCardSkeleton key={i} />
      ))}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={filteredSamples}
        keyExtractor={(item) => item.id}
        renderItem={renderSample}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={isLoading ? renderSkeleton : renderEmptyState}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
          filteredSamples.length === 0 && !isLoading && styles.emptyContent,
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
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  skeletonContainer: {
    gap: Spacing.md,
  },
});
