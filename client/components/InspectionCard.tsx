import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { StatusBadge } from "@/components/StatusBadge";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, Shadows } from "@/constants/theme";
import { Inspection } from "@/types";

interface InspectionCardProps {
  inspection: Inspection;
  onPress?: () => void;
}

export function InspectionCard({ inspection, onPress }: InspectionCardProps) {
  const { theme } = useTheme();

  const formattedDate = new Date(inspection.createdAt).toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  );

  return (
    <Pressable
      onPress={onPress}
      testID={`inspection-card-${inspection.id}`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.backgroundDefault },
        Shadows.md,
        pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.typeContainer}>
          <View
            style={[styles.typeIcon, { backgroundColor: theme.primary + "20" }]}
          >
            <Feather name="clipboard" size={16} color={theme.primary} />
          </View>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {inspection.type}
          </ThemedText>
        </View>
        <StatusBadge status={inspection.status} />
      </View>

      <View style={styles.content}>
        <ThemedText type="h3" numberOfLines={1}>
          {inspection.fboDetails.name}
        </ThemedText>
        <ThemedText
          type="small"
          style={{ color: theme.textSecondary }}
          numberOfLines={1}
        >
          {inspection.fboDetails.address}
        </ThemedText>
      </View>

      <View style={styles.footer}>
        <View style={styles.metaItem}>
          <Feather name="calendar" size={14} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {formattedDate}
          </ThemedText>
        </View>
        {inspection.sampleLifted ? (
          <View style={styles.metaItem}>
            <Feather name="droplet" size={14} color={theme.primary} />
            <ThemedText type="small" style={{ color: theme.primary }}>
              {inspection.samples.length} sample
              {inspection.samples.length !== 1 ? "s" : ""}
            </ThemedText>
          </View>
        ) : null}
        {inspection.deviations.length > 0 ? (
          <View style={styles.metaItem}>
            <Feather name="alert-triangle" size={14} color={theme.warning} />
            <ThemedText type="small" style={{ color: theme.warning }}>
              {inspection.deviations.length}
            </ThemedText>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  typeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  typeIcon: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    gap: Spacing.xs,
  },
  footer: {
    flexDirection: "row",
    gap: Spacing.lg,
    flexWrap: "wrap",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
});
