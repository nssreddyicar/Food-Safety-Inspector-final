import React, { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { StatusBadge } from "@/components/StatusBadge";
import { SampleCard } from "@/components/SampleCard";
import { useTheme } from "@/hooks/useTheme";
import { storage } from "@/lib/storage";
import { Inspection } from "@/types";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

type RouteParams = {
  InspectionDetails: { inspectionId: string };
};

interface InfoRowProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  const { theme } = useTheme();

  return (
    <View style={styles.infoRow}>
      <View
        style={[styles.infoIcon, { backgroundColor: theme.primary + "15" }]}
      >
        <Feather name={icon} size={16} color={theme.primary} />
      </View>
      <View style={styles.infoContent}>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {label}
        </ThemedText>
        <ThemedText type="body">{value}</ThemedText>
      </View>
    </View>
  );
}

export default function InspectionDetailsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<RouteProp<RouteParams, "InspectionDetails">>();

  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadInspection = useCallback(async () => {
    try {
      const inspections = await storage.getInspections();
      const found = inspections.find((i) => i.id === route.params.inspectionId);
      setInspection(found || null);
    } catch (error) {
      console.error("Failed to load inspection:", error);
    } finally {
      setIsLoading(false);
    }
  }, [route.params.inspectionId]);

  useEffect(() => {
    loadInspection();
  }, [loadInspection]);

  if (isLoading || !inspection) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      >
        <View
          style={[
            styles.loadingContainer,
            { paddingTop: headerHeight + Spacing.xl },
          ]}
        >
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            {isLoading ? "Loading..." : "Inspection not found"}
          </ThemedText>
        </View>
      </View>
    );
  }

  const formattedDate = new Date(inspection.createdAt).toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <View
          style={[
            styles.card,
            { backgroundColor: theme.backgroundDefault },
            Shadows.md,
          ]}
        >
          <View style={styles.cardHeader}>
            <View>
              <ThemedText type="h2">{inspection.fboDetails.name}</ThemedText>
              <ThemedText
                type="small"
                style={{ color: theme.textSecondary, marginTop: Spacing.xs }}
              >
                {inspection.type} Inspection
              </ThemedText>
            </View>
            <StatusBadge status={inspection.status} size="medium" />
          </View>

          <View style={styles.divider} />

          <InfoRow
            icon="map-pin"
            label="Address"
            value={inspection.fboDetails.address}
          />
          <InfoRow icon="calendar" label="Date" value={formattedDate} />
          {inspection.fboDetails.licenseNumber ? (
            <InfoRow
              icon="file-text"
              label="License Number"
              value={inspection.fboDetails.licenseNumber}
            />
          ) : null}
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: theme.backgroundDefault },
            Shadows.md,
          ]}
        >
          <ThemedText type="h3" style={styles.sectionTitle}>
            Proprietor Details
          </ThemedText>
          <InfoRow
            icon="user"
            label="Name"
            value={inspection.proprietorDetails.name}
          />
          <InfoRow
            icon="phone"
            label="Phone"
            value={inspection.proprietorDetails.phone}
          />
          {!inspection.proprietorDetails.isSameAsFBO ? (
            <InfoRow
              icon="home"
              label="Address"
              value={inspection.proprietorDetails.address}
            />
          ) : null}
        </View>

        {inspection.deviations.length > 0 ? (
          <View
            style={[
              styles.card,
              { backgroundColor: theme.backgroundDefault },
              Shadows.md,
            ]}
          >
            <ThemedText type="h3" style={styles.sectionTitle}>
              Deviations Found ({inspection.deviations.length})
            </ThemedText>
            {inspection.deviations.map((deviation, index) => (
              <View
                key={deviation.id}
                style={[
                  styles.deviationItem,
                  { borderLeftColor: theme.warning },
                ]}
              >
                <View style={styles.deviationHeader}>
                  <ThemedText type="h4">{deviation.category}</ThemedText>
                  <View
                    style={[
                      styles.severityBadge,
                      { backgroundColor: theme.warning + "20" },
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={{
                        color: theme.warning,
                        textTransform: "capitalize",
                      }}
                    >
                      {deviation.severity}
                    </ThemedText>
                  </View>
                </View>
                <ThemedText type="body" style={{ color: theme.textSecondary }}>
                  {deviation.description || "No description provided"}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}

        {inspection.actionsTaken.length > 0 ? (
          <View
            style={[
              styles.card,
              { backgroundColor: theme.backgroundDefault },
              Shadows.md,
            ]}
          >
            <ThemedText type="h3" style={styles.sectionTitle}>
              Actions Taken
            </ThemedText>
            <View style={styles.actionsGrid}>
              {inspection.actionsTaken.map((action) => (
                <View
                  key={action.id}
                  style={[
                    styles.actionTag,
                    { backgroundColor: theme.success + "15" },
                  ]}
                >
                  <Feather
                    name="check-circle"
                    size={14}
                    color={theme.success}
                  />
                  <ThemedText type="small" style={{ color: theme.success }}>
                    {action.actionType}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {inspection.samples.length > 0 ? (
          <View style={styles.section}>
            <ThemedText type="h3" style={styles.sectionTitle}>
              Samples Lifted ({inspection.samples.length})
            </ThemedText>
            {inspection.samples.map((sample) => (
              <SampleCard key={sample.id} sample={sample} />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.1)",
    marginVertical: Spacing.sm,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
  },
  section: {
    gap: Spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  infoContent: {
    flex: 1,
    gap: 2,
  },
  deviationItem: {
    paddingLeft: Spacing.md,
    borderLeftWidth: 3,
    gap: Spacing.xs,
  },
  deviationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  severityBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  actionTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
});
