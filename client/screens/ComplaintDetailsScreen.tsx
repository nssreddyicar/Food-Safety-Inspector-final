import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Alert,
  Share,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuthContext } from "@/context/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import type { Complaint, ComplaintHistoryRecord, ComplaintEvidence } from "@shared/types/complaint.types";

function getStatusColor(status: string, theme: any) {
  switch (status) {
    case "new":
      return theme.accent;
    case "assigned":
      return theme.primary;
    case "investigating":
      return theme.link;
    case "resolved":
      return theme.primary;
    case "closed":
      return theme.textSecondary;
    default:
      return theme.textSecondary;
  }
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string | undefined;
}) {
  const { theme } = useTheme();
  if (!value) return null;

  return (
    <View style={styles.infoRow}>
      <Feather name={icon as any} size={16} color={theme.textSecondary} />
      <View style={styles.infoContent}>
        <ThemedText style={styles.infoLabel}>{label}</ThemedText>
        <ThemedText style={styles.infoValue}>{value}</ThemedText>
      </View>
    </View>
  );
}

function HistoryItem({ record }: { record: ComplaintHistoryRecord }) {
  const { theme } = useTheme();

  const getActionIcon = (action: string) => {
    switch (action) {
      case "status_change":
        return "refresh-cw";
      case "assigned":
        return "user-plus";
      case "evidence_added":
        return "paperclip";
      case "remark_added":
        return "message-square";
      case "created":
        return "plus-circle";
      default:
        return "activity";
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "status_change":
        return `Status changed to ${record.toStatus}`;
      case "assigned":
        return `Assigned to officer`;
      case "evidence_added":
        return `Evidence added`;
      case "remark_added":
        return `Remark added`;
      case "created":
        return `Complaint submitted`;
      default:
        return action;
    }
  };

  return (
    <View style={styles.historyItem}>
      <View style={[styles.historyIcon, { backgroundColor: theme.primary + "20" }]}>
        <Feather name={getActionIcon(record.action) as any} size={14} color={theme.primary} />
      </View>
      <View style={styles.historyContent}>
        <ThemedText style={styles.historyAction}>
          {getActionLabel(record.action)}
        </ThemedText>
        {record.remarks ? (
          <ThemedText style={styles.historyRemarks}>{record.remarks}</ThemedText>
        ) : null}
        <ThemedText style={styles.historyTime}>
          {new Date(record.performedAt).toLocaleString()}
          {record.officerName ? ` by ${record.officerName}` : ""}
        </ThemedText>
      </View>
    </View>
  );
}

function EvidenceItem({ evidence }: { evidence: ComplaintEvidence }) {
  const { theme } = useTheme();

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case "image":
        return "image";
      case "video":
        return "video";
      case "audio":
        return "mic";
      default:
        return "file";
    }
  };

  return (
    <View style={[styles.evidenceItem, { borderColor: theme.border }]}>
      <Feather name={getFileIcon(evidence.fileType) as any} size={20} color={theme.primary} />
      <View style={styles.evidenceContent}>
        <ThemedText style={styles.evidenceName} numberOfLines={1}>
          {evidence.originalName}
        </ThemedText>
        <ThemedText style={styles.evidenceInfo}>
          {evidence.uploadedBy} - {new Date(evidence.uploadedAt).toLocaleDateString()}
        </ThemedText>
      </View>
    </View>
  );
}

export default function ComplaintDetailsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { user } = useAuthContext();

  const { complaintId } = route.params || {};

  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const loadComplaint = useCallback(async () => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/complaints/${complaintId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch complaint");
      }
      const data = await response.json();
      setComplaint(data);
    } catch (error) {
      console.error("Failed to load complaint:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [complaintId]);

  useEffect(() => {
    if (complaintId) {
      loadComplaint();
    }
  }, [complaintId, loadComplaint]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadComplaint();
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!complaint || !user) return;

    setIsUpdating(true);
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/complaints/${complaintId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toStatus: newStatus,
          officerId: user.id,
          officerName: user.name,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update status");
      }

      await loadComplaint();
      Alert.alert("Success", "Status updated successfully");
    } catch (error) {
      console.error("Failed to update status:", error);
      Alert.alert("Error", "Failed to update status");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAssign = async () => {
    if (!complaint || !user) return;

    setIsUpdating(true);
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/complaints/${complaintId}/assign`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          officerId: user.id,
          assignedBy: user.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to assign complaint");
      }

      await loadComplaint();
      Alert.alert("Success", "Complaint assigned to you");
    } catch (error) {
      console.error("Failed to assign complaint:", error);
      Alert.alert("Error", "Failed to assign complaint");
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ThemedText>Loading...</ThemedText>
      </ThemedView>
    );
  }

  if (!complaint) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <Feather name="alert-circle" size={48} color={theme.accent} />
        <ThemedText style={styles.errorText}>Complaint not found</ThemedText>
      </ThemedView>
    );
  }

  const statusColor = getStatusColor(complaint.status, theme);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
        }
      >
        <Animated.View entering={FadeInDown.springify()}>
          <Card style={styles.headerCard}>
            <View style={styles.headerRow}>
              <View>
                <ThemedText style={styles.codeLabel}>Complaint ID</ThemedText>
                <ThemedText type="h2" style={styles.complaintCode}>
                  {complaint.complaintCode}
                </ThemedText>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
                <ThemedText style={[styles.statusText, { color: statusColor }]}>
                  {complaint.status.toUpperCase()}
                </ThemedText>
              </View>
            </View>
            <ThemedText style={styles.submittedAt}>
              Submitted on {new Date(complaint.submittedAt).toLocaleString()}
            </ThemedText>
            
            <View style={styles.shareRow}>
              <Pressable 
                style={[styles.shareButton, { backgroundColor: theme.backgroundSecondary }]}
                onPress={async () => {
                  await Clipboard.setStringAsync(complaint.complaintCode);
                  Alert.alert("Copied", "Complaint ID copied to clipboard");
                }}
              >
                <Feather name="copy" size={16} color={theme.primary} />
                <ThemedText style={[styles.shareButtonText, { color: theme.primary }]}>
                  Copy ID
                </ThemedText>
              </Pressable>
              
              <Pressable 
                style={[styles.shareButton, { backgroundColor: theme.primary }]}
                onPress={async () => {
                  const trackingUrl = `Track complaint ${complaint.complaintCode} at your local food safety office`;
                  await Share.share({
                    message: `Food Safety Complaint\n\nComplaint ID: ${complaint.complaintCode}\nStatus: ${complaint.status}\n\n${trackingUrl}`,
                    title: "Share Complaint Details",
                  });
                }}
              >
                <Feather name="share-2" size={16} color="#fff" />
                <ThemedText style={[styles.shareButtonText, { color: "#fff" }]}>
                  Share
                </ThemedText>
              </Pressable>
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <Card style={styles.section}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              Complainant Details
            </ThemedText>
            <InfoRow icon="user" label="Name" value={complaint.complainantName} />
            <InfoRow icon="phone" label="Mobile" value={complaint.complainantMobile} />
            <InfoRow icon="mail" label="Email" value={complaint.complainantEmail} />
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <Card style={styles.section}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              Incident Details
            </ThemedText>
            <InfoRow
              icon="calendar"
              label="Date"
              value={complaint.incidentDate ? new Date(complaint.incidentDate).toLocaleDateString() : undefined}
            />
            <InfoRow
              icon="map-pin"
              label="Location"
              value={complaint.location?.address || `${complaint.location?.latitude}, ${complaint.location?.longitude}`}
            />
            {complaint.incidentDescription ? (
              <View style={styles.descriptionContainer}>
                <ThemedText style={styles.infoLabel}>Description</ThemedText>
                <ThemedText style={styles.descriptionText}>
                  {complaint.incidentDescription}
                </ThemedText>
              </View>
            ) : null}
          </Card>
        </Animated.View>

        {complaint.evidence && complaint.evidence.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(300).springify()}>
            <Card style={styles.section}>
              <ThemedText type="h4" style={styles.sectionTitle}>
                Evidence ({complaint.evidence.length})
              </ThemedText>
              {complaint.evidence.map((e) => (
                <EvidenceItem key={e.id} evidence={e} />
              ))}
            </Card>
          </Animated.View>
        ) : null}

        {complaint.history && complaint.history.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(400).springify()}>
            <Card style={styles.section}>
              <ThemedText type="h4" style={styles.sectionTitle}>
                Activity History
              </ThemedText>
              {complaint.history.map((h) => (
                <HistoryItem key={h.id} record={h} />
              ))}
            </Card>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(500).springify()}>
          <Card style={styles.section}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              Actions
            </ThemedText>
            <View style={styles.actionsContainer}>
              {complaint.status === "new" && !complaint.assignedOfficerId ? (
                <Button onPress={handleAssign} disabled={isUpdating} style={styles.actionButton}>
                  Assign to Me
                </Button>
              ) : null}
              {complaint.status === "assigned" ? (
                <Button onPress={() => handleStatusUpdate("investigating")} disabled={isUpdating} style={styles.actionButton}>
                  Start Investigation
                </Button>
              ) : null}
              {complaint.status === "investigating" ? (
                <Button onPress={() => handleStatusUpdate("resolved")} disabled={isUpdating} style={styles.actionButton}>
                  Mark Resolved
                </Button>
              ) : null}
              {complaint.status === "resolved" ? (
                <Pressable 
                  onPress={() => handleStatusUpdate("closed")} 
                  disabled={isUpdating}
                  style={[styles.outlineButton, { borderColor: theme.primary }]}
                >
                  <ThemedText style={{ color: theme.primary }}>Close Complaint</ThemedText>
                </Pressable>
              ) : null}
            </View>
          </Card>
        </Animated.View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  headerCard: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  complaintCode: {
    fontSize: 20,
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  submittedAt: {
    fontSize: 12,
    opacity: 0.7,
  },
  codeLabel: {
    fontSize: 11,
    opacity: 0.6,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  shareRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    flex: 1,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  section: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  infoContent: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
  },
  descriptionContainer: {
    marginTop: Spacing.sm,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 22,
    marginTop: Spacing.xs,
  },
  errorText: {
    marginTop: Spacing.md,
    fontSize: 16,
  },
  historyItem: {
    flexDirection: "row",
    marginBottom: Spacing.md,
  },
  historyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  historyContent: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  historyAction: {
    fontSize: 14,
    fontWeight: "500",
  },
  historyRemarks: {
    fontSize: 13,
    opacity: 0.7,
    marginTop: 2,
  },
  historyTime: {
    fontSize: 11,
    opacity: 0.5,
    marginTop: 4,
  },
  evidenceItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  evidenceContent: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  evidenceName: {
    fontSize: 14,
    fontWeight: "500",
  },
  evidenceInfo: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  actionsContainer: {
    gap: Spacing.sm,
  },
  actionButton: {
    marginBottom: Spacing.xs,
  },
  outlineButton: {
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
});
