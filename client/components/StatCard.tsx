import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, Shadows } from "@/constants/theme";

interface StatCardProps {
  title: string;
  value: number;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  onPress?: () => void;
}

export function StatCard({
  title,
  value,
  icon,
  color,
  onPress,
}: StatCardProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.backgroundDefault },
        Shadows.md,
        pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: color + "20" }]}>
        <Feather name={icon} size={20} color={color} />
      </View>
      <View style={styles.content}>
        <ThemedText type="h1" style={[styles.value, { color }]}>
          {value}
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {title}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    minWidth: 140,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  content: {
    gap: Spacing.xs,
  },
  value: {
    fontSize: 28,
    lineHeight: 32,
  },
});
