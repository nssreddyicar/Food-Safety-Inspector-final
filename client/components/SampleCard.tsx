import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { StatusBadge } from "@/components/StatusBadge";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, Shadows } from "@/constants/theme";
import { Sample } from "@/types";

interface SampleCardProps {
  sample: Sample;
  onPress?: () => void;
}

export function SampleCard({ sample, onPress }: SampleCardProps) {
  const { theme } = useTheme();

  const isOverdue =
    sample.daysRemaining !== undefined &&
    sample.daysRemaining <= 0 &&
    !sample.labResult;
  const isUrgent =
    sample.daysRemaining !== undefined &&
    sample.daysRemaining <= 3 &&
    !sample.labResult;
  const countdownColor = isOverdue
    ? theme.accent
    : isUrgent
      ? theme.warning
      : theme.textSecondary;

  const formattedDate = new Date(sample.liftedDate).toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
    },
  );

  return (
    <Pressable
      onPress={onPress}
      testID={`sample-card-${sample.id}`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.backgroundDefault },
        Shadows.md,
        pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
      ]}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor:
                sample.sampleType === "enforcement"
                  ? theme.accent + "20"
                  : theme.primary + "20",
            },
          ]}
        >
          <Feather
            name={sample.sampleType === "enforcement" ? "shield" : "eye"}
            size={18}
            color={
              sample.sampleType === "enforcement" ? theme.accent : theme.primary
            }
          />
        </View>
        <View style={styles.headerContent}>
          <View style={styles.titleRow}>
            <ThemedText type="h4" numberOfLines={1} style={{ flex: 1 }}>
              {sample.name}
            </ThemedText>
            {sample.sampleType ? (
              <View
                style={[
                  styles.typeBadge,
                  {
                    backgroundColor:
                      sample.sampleType === "enforcement"
                        ? theme.accent + "15"
                        : theme.primary + "15",
                  },
                ]}
              >
                <ThemedText
                  type="small"
                  style={{
                    color:
                      sample.sampleType === "enforcement"
                        ? theme.accent
                        : theme.primary,
                    fontSize: 10,
                    fontWeight: "600",
                  }}
                >
                  {sample.sampleType === "enforcement" ? "ENF" : "SRV"}
                </ThemedText>
              </View>
            ) : null}
          </View>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {sample.code}
          </ThemedText>
        </View>
        {sample.labResult ? (
          <StatusBadge status={sample.labResult} />
        ) : sample.daysRemaining !== undefined ? (
          <View style={styles.countdown}>
            <ThemedText type="h2" style={{ color: countdownColor }}>
              {isOverdue ? "!" : sample.daysRemaining}
            </ThemedText>
            <ThemedText type="small" style={{ color: countdownColor }}>
              {isOverdue ? "Due" : "days"}
            </ThemedText>
          </View>
        ) : (
          <StatusBadge status="pending" />
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.metaItem}>
          <Feather name="map-pin" size={14} color={theme.textSecondary} />
          <ThemedText
            type="small"
            style={{ color: theme.textSecondary }}
            numberOfLines={1}
          >
            {sample.liftedPlace}
          </ThemedText>
        </View>
        <View style={styles.metaItem}>
          <Feather name="calendar" size={14} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {formattedDate}
          </ThemedText>
        </View>
        {sample.dispatchMode ? (
          <View style={styles.metaItem}>
            <Feather name="send" size={14} color={theme.success} />
            <ThemedText
              type="small"
              style={{ color: theme.success, textTransform: "capitalize" }}
            >
              {sample.dispatchMode.replace("_", " ")}
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
    alignItems: "center",
    gap: Spacing.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  headerContent: {
    flex: 1,
    gap: Spacing.xs,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  typeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  countdown: {
    alignItems: "center",
    minWidth: 44,
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
    maxWidth: "50%",
  },
});
