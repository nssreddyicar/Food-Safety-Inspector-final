import React, { useEffect } from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonLoader({
  width = "100%",
  height = 20,
  borderRadius = BorderRadius.md,
  style,
}: SkeletonLoaderProps) {
  const { theme } = useTheme();
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1200 }), -1, false);
  }, [shimmer]);

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(shimmer.value, [0, 0.5, 1], [0.3, 0.6, 0.3]);
    return { opacity };
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: theme.backgroundTertiary,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

export function InspectionCardSkeleton() {
  const { theme } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
      <View style={styles.cardHeader}>
        <SkeletonLoader width={100} height={28} />
        <SkeletonLoader width={60} height={20} />
      </View>
      <SkeletonLoader
        width="80%"
        height={20}
        style={{ marginTop: Spacing.md }}
      />
      <SkeletonLoader
        width="60%"
        height={16}
        style={{ marginTop: Spacing.sm }}
      />
      <View style={styles.cardFooter}>
        <SkeletonLoader width={80} height={16} />
        <SkeletonLoader width={60} height={16} />
      </View>
    </View>
  );
}

export function SampleCardSkeleton() {
  const { theme } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
      <View style={styles.sampleHeader}>
        <SkeletonLoader width={44} height={44} borderRadius={BorderRadius.md} />
        <View style={{ flex: 1, gap: Spacing.sm }}>
          <SkeletonLoader width="70%" height={18} />
          <SkeletonLoader width="40%" height={14} />
        </View>
        <SkeletonLoader width={44} height={50} />
      </View>
      <View style={styles.cardFooter}>
        <SkeletonLoader width={100} height={14} />
        <SkeletonLoader width={60} height={14} />
      </View>
    </View>
  );
}

export function StatCardSkeleton() {
  const { theme } = useTheme();

  return (
    <View
      style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}
    >
      <SkeletonLoader width={40} height={40} borderRadius={BorderRadius.md} />
      <SkeletonLoader
        width={50}
        height={32}
        style={{ marginTop: Spacing.md }}
      />
      <SkeletonLoader
        width="80%"
        height={14}
        style={{ marginTop: Spacing.xs }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {},
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardFooter: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginTop: Spacing.md,
  },
  sampleHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    minWidth: 140,
  },
});
