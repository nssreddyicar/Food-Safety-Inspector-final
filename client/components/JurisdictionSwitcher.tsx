import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  FlatList,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuthContext } from "@/context/AuthContext";
import { JurisdictionInfo } from "@/types";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

interface JurisdictionSwitcherProps {
  visible: boolean;
  onClose: () => void;
}

export function JurisdictionSwitcher({
  visible,
  onClose,
}: JurisdictionSwitcherProps) {
  const { theme } = useTheme();
  const { user, activeJurisdiction, switchJurisdiction } = useAuthContext();

  const handleSelect = async (jurisdiction: JurisdictionInfo) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    await switchJurisdiction(jurisdiction);
    onClose();
  };

  const jurisdictions = user?.allJurisdictions || [];

  const renderItem = ({ item }: { item: JurisdictionInfo }) => {
    const isActive = activeJurisdiction?.assignmentId === item.assignmentId;

    return (
      <Pressable
        onPress={() => handleSelect(item)}
        style={({ pressed }) => [
          styles.jurisdictionItem,
          {
            backgroundColor: isActive
              ? theme.primary + "15"
              : theme.backgroundDefault,
            borderColor: isActive ? theme.primary : theme.border,
          },
          pressed && { opacity: 0.8 },
        ]}
      >
        <View style={styles.jurisdictionContent}>
          <View style={styles.jurisdictionHeader}>
            <ThemedText type="body" style={{ fontWeight: "600" }}>
              {item.unitName || "Unknown Unit"}
            </ThemedText>
            {item.isPrimary ? (
              <View
                style={[
                  styles.primaryBadge,
                  { backgroundColor: theme.primary },
                ]}
              >
                <ThemedText
                  type="small"
                  style={{ color: "#FFFFFF", fontSize: 10 }}
                >
                  PRIMARY
                </ThemedText>
              </View>
            ) : null}
          </View>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {item.roleName}
            {item.capacityName ? ` (${item.capacityName})` : ""}
          </ThemedText>
        </View>
        {isActive ? (
          <View style={[styles.checkIcon, { backgroundColor: theme.primary }]}>
            <Feather name="check" size={14} color="#FFFFFF" />
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            <ThemedText type="h3">Switch Jurisdiction</ThemedText>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          <ThemedText
            type="body"
            style={[styles.subtitle, { color: theme.textSecondary }]}
          >
            Select the jurisdiction you want to work in
          </ThemedText>

          {jurisdictions.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="map-pin" size={48} color={theme.textSecondary} />
              <ThemedText
                type="body"
                style={{
                  color: theme.textSecondary,
                  textAlign: "center",
                  marginTop: Spacing.md,
                }}
              >
                No jurisdictions assigned.{"\n"}Contact your administrator.
              </ThemedText>
            </View>
          ) : (
            <FlatList
              data={jurisdictions}
              keyExtractor={(item) => item.assignmentId || item.unitId || ""}
              renderItem={renderItem}
              contentContainerStyle={styles.list}
              ItemSeparatorComponent={() => (
                <View style={{ height: Spacing.sm }} />
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  container: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing["3xl"],
    maxHeight: "70%",
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#E0E0E0",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  subtitle: {
    marginBottom: Spacing.lg,
  },
  list: {
    paddingBottom: Spacing.lg,
  },
  jurisdictionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
  },
  jurisdictionContent: {
    flex: 1,
    gap: Spacing.xs,
  },
  jurisdictionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  primaryBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
  },
});
