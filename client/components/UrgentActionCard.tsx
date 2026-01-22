import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, Shadows } from "@/constants/theme";
import { UrgentAction } from "@/types";

interface UrgentActionCardProps {
  action: UrgentAction;
  onPress?: () => void;
}

export function UrgentActionCard({ action, onPress }: UrgentActionCardProps) {
  const { theme } = useTheme();

  const isOverdue = action.daysRemaining <= 0;
  const isUrgent = action.daysRemaining <= 3;
  const color = isOverdue
    ? theme.accent
    : isUrgent
      ? theme.warning
      : theme.primary;

  const getIcon = (): keyof typeof Feather.glyphMap => {
    switch (action.type) {
      case "sample_deadline":
        return "clock";
      case "report_pending":
        return "file-text";
      case "notice_due":
        return "alert-circle";
      default:
        return "alert-triangle";
    }
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.backgroundDefault, borderLeftColor: color },
        Shadows.sm,
        pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: color + "20" }]}>
        <Feather name={getIcon()} size={20} color={color} />
      </View>
      <View style={styles.content}>
        <ThemedText type="h4" numberOfLines={1}>
          {action.title}
        </ThemedText>
        <ThemedText
          type="small"
          style={{ color: theme.textSecondary }}
          numberOfLines={1}
        >
          {action.description}
        </ThemedText>
      </View>
      <View style={styles.countdownContainer}>
        <ThemedText type="h2" style={{ color }}>
          {isOverdue ? "!" : action.daysRemaining}
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {isOverdue ? "Overdue" : "days"}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderLeftWidth: 4,
    gap: Spacing.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    gap: Spacing.xs,
  },
  countdownContainer: {
    alignItems: "center",
    minWidth: 50,
  },
});
