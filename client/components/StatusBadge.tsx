import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";
import { InspectionStatus, SampleResult } from "@/types";

interface StatusBadgeProps {
  status: InspectionStatus | SampleResult | "overdue";
  size?: "small" | "medium";
}

const statusLabels: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  closed: "Closed",
  pending: "Pending",
  not_unsafe: "Safe",
  substandard: "Substandard",
  unsafe: "Unsafe",
  overdue: "Overdue",
};

export function StatusBadge({ status, size = "small" }: StatusBadgeProps) {
  const { theme } = useTheme();

  const getStatusColor = () => {
    switch (status) {
      case "draft":
      case "pending":
        return theme.statusDraft;
      case "submitted":
        return theme.statusSubmitted;
      case "under_review":
        return theme.statusUnderReview;
      case "closed":
      case "not_unsafe":
        return theme.statusClosed;
      case "overdue":
      case "unsafe":
        return theme.statusOverdue;
      case "substandard":
        return theme.statusUnderReview;
      default:
        return theme.statusDraft;
    }
  };

  const backgroundColor = getStatusColor();

  return (
    <View
      style={[
        styles.badge,
        size === "medium" && styles.badgeMedium,
        { backgroundColor },
      ]}
    >
      <ThemedText
        style={[
          styles.text,
          size === "medium" && styles.textMedium,
          { color: "#FFFFFF" },
        ]}
      >
        {statusLabels[status] || status}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
    alignSelf: "flex-start",
  },
  badgeMedium: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  text: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  textMedium: {
    fontSize: 12,
  },
});
