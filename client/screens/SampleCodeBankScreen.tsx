import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  FlatList,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { useTheme } from "@/hooks/useTheme";
import { useAuthContext } from "@/context/AuthContext";
import { getApiUrl, apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

interface SampleCode {
  id: string;
  prefix: string;
  middle: string;
  suffix: string;
  fullCode: string;
  sampleType: string;
  status: string;
  generatedByOfficerId?: string;
  generatedAt: string;
  batchId?: string;
  jurisdictionId?: string;
  usedByOfficerId?: string;
  usedAt?: string;
  linkedSampleId?: string;
  linkedSampleReference?: string;
  usageLocation?: string;
}

interface AuditLogEntry {
  id: string;
  action: string;
  performedByName?: string;
  createdAt: string;
  details?: any;
}

type TabType = "enforcement" | "surveillance";
type StatusFilter = "all" | "available" | "used";

export default function SampleCodeBankScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();
  const { user } = useAuthContext();

  const [activeTab, setActiveTab] = useState<TabType>("enforcement");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedCode, setSelectedCode] = useState<SampleCode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Generation form state
  const [prefixStart, setPrefixStart] = useState("001");
  const [middleStart, setMiddleStart] = useState("001");
  const [suffixStart, setSuffixStart] = useState("001");
  const [prefixFieldType, setPrefixFieldType] = useState<"text" | "number">(
    "number",
  );
  const [middleFieldType, setMiddleFieldType] = useState<"text" | "number">(
    "number",
  );
  const [suffixFieldType, setSuffixFieldType] = useState<"text" | "number">(
    "number",
  );
  const [prefixIncrementEnabled, setPrefixIncrementEnabled] = useState(true);
  const [middleIncrementEnabled, setMiddleIncrementEnabled] = useState(false);
  const [suffixIncrementEnabled, setSuffixIncrementEnabled] = useState(false);
  const [prefixIncrement, setPrefixIncrement] = useState("1");
  const [middleIncrement, setMiddleIncrement] = useState("1");
  const [suffixIncrement, setSuffixIncrement] = useState("1");
  const [quantity, setQuantity] = useState("10");
  const [showFieldTypeDropdown, setShowFieldTypeDropdown] = useState<
    string | null
  >(null);

  const jurisdictionId = user?.jurisdiction?.unitId;

  const {
    data: codesData,
    isLoading,
    refetch,
  } = useQuery<{
    codes: SampleCode[];
    counts: { available: number; used: number };
  }>({
    queryKey: [
      "/api/sample-codes",
      activeTab,
      statusFilter,
      jurisdictionId,
      searchQuery,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("sampleType", activeTab);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (jurisdictionId) params.set("jurisdictionId", jurisdictionId);
      if (searchQuery) {
        params.set("prefix", searchQuery);
        params.set("middle", searchQuery);
        params.set("suffix", searchQuery);
      }
      const url = new URL(`/api/sample-codes?${params}`, getApiUrl());
      const response = await fetch(url.toString());
      return response.json();
    },
  });

  const { data: codeDetails } = useQuery<{
    code: SampleCode;
    auditLog: AuditLogEntry[];
  }>({
    queryKey: ["/api/sample-codes", selectedCode?.id],
    queryFn: async () => {
      if (!selectedCode?.id) return { code: selectedCode!, auditLog: [] };
      const url = new URL(`/api/sample-codes/${selectedCode.id}`, getApiUrl());
      const response = await fetch(url.toString());
      return response.json();
    },
    enabled: !!selectedCode?.id && showDetailsModal,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/sample-codes/generate", {
        sampleType: activeTab,
        prefixStart,
        middleStart,
        suffixStart,
        prefixFieldType,
        middleFieldType,
        suffixFieldType,
        prefixIncrement: parseInt(prefixIncrement),
        middleIncrement: parseInt(middleIncrement),
        suffixIncrement: parseInt(suffixIncrement),
        prefixIncrementEnabled,
        middleIncrementEnabled,
        suffixIncrementEnabled,
        quantity: parseInt(quantity),
        officerId: user?.id,
        officerName: user?.name,
        jurisdictionId,
      });
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/sample-codes"] });
      setShowGenerateModal(false);
      resetGenerateForm();
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const resetGenerateForm = () => {
    setPrefixStart("001");
    setMiddleStart("001");
    setSuffixStart("001");
    setPrefixFieldType("number");
    setMiddleFieldType("number");
    setSuffixFieldType("number");
    setPrefixIncrementEnabled(true);
    setMiddleIncrementEnabled(false);
    setSuffixIncrementEnabled(false);
    setPrefixIncrement("1");
    setMiddleIncrement("1");
    setSuffixIncrement("1");
    setQuantity("10");
    setShowFieldTypeDropdown(null);
  };

  const openCodeDetails = (code: SampleCode) => {
    setSelectedCode(code);
    setShowDetailsModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const renderCodeItem = useCallback(
    ({ item }: { item: SampleCode }) => {
      const isUsed = item.status === "used";

      return (
        <Pressable
          onPress={() => openCodeDetails(item)}
          style={[
            styles.codeCard,
            { backgroundColor: theme.backgroundDefault },
            Shadows.sm,
          ]}
        >
          <View style={styles.codeContent}>
            <ThemedText
              type="h3"
              style={{ fontFamily: "monospace", letterSpacing: 2 }}
            >
              {item.fullCode}
            </ThemedText>
            <View style={styles.codeDetails}>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: isUsed
                      ? theme.accent + "15"
                      : theme.success + "15",
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: isUsed ? theme.accent : theme.success },
                  ]}
                />
                <ThemedText
                  type="small"
                  style={{
                    color: isUsed ? theme.accent : theme.success,
                    fontWeight: "600",
                  }}
                >
                  {isUsed ? "USED" : "AVAILABLE"}
                </ThemedText>
              </View>
              {isUsed && item.usedAt ? (
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Used: {new Date(item.usedAt).toLocaleDateString()}
                </ThemedText>
              ) : (
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Generated: {new Date(item.generatedAt).toLocaleDateString()}
                </ThemedText>
              )}
            </View>
          </View>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </Pressable>
      );
    },
    [theme],
  );

  const renderTab = (type: TabType, label: string) => {
    const isActive = activeTab === type;
    return (
      <Pressable
        onPress={() => {
          setActiveTab(type);
          Haptics.selectionAsync();
        }}
        style={[
          styles.tab,
          {
            backgroundColor: isActive ? theme.primary : "transparent",
            borderColor: theme.primary,
          },
        ]}
      >
        <ThemedText
          type="body"
          style={{
            color: isActive ? "#FFFFFF" : theme.primary,
            fontWeight: "600",
          }}
        >
          {label}
        </ThemedText>
      </Pressable>
    );
  };

  const renderStatusChip = (
    status: StatusFilter,
    label: string,
    count?: number,
  ) => {
    const isActive = statusFilter === status;
    return (
      <Pressable
        onPress={() => {
          setStatusFilter(status);
          Haptics.selectionAsync();
        }}
        style={[
          styles.statusChip,
          {
            backgroundColor: isActive
              ? theme.primary + "15"
              : theme.backgroundDefault,
            borderColor: isActive ? theme.primary : theme.border,
          },
        ]}
      >
        <ThemedText
          type="small"
          style={{
            color: isActive ? theme.primary : theme.textSecondary,
            fontWeight: isActive ? "600" : "400",
          }}
        >
          {label}
          {count !== undefined ? ` (${count})` : ""}
        </ThemedText>
      </Pressable>
    );
  };

  const renderIncrementControl = (
    label: string,
    fieldKey: string,
    value: string,
    setValue: (v: string) => void,
    fieldType: "text" | "number",
    setFieldType: (v: "text" | "number") => void,
    enabled: boolean,
    setEnabled: (v: boolean) => void,
    increment: string,
    setIncrement: (v: string) => void,
  ) => {
    const isDropdownOpen = showFieldTypeDropdown === fieldKey;

    return (
      <View
        style={[styles.incrementControl, { zIndex: isDropdownOpen ? 100 : 1 }]}
      >
        <View style={styles.incrementHeader}>
          <ThemedText type="body" style={{ fontWeight: "600" }}>
            {label}
          </ThemedText>
          <View style={styles.headerControls}>
            {/* Field Type Dropdown */}
            <View style={styles.fieldTypeContainer}>
              <Pressable
                onPress={() => {
                  setShowFieldTypeDropdown(isDropdownOpen ? null : fieldKey);
                  Haptics.selectionAsync();
                }}
                style={[
                  styles.fieldTypeButton,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    borderColor: theme.border,
                  },
                ]}
              >
                <ThemedText type="small" style={{ fontWeight: "500" }}>
                  {fieldType === "text" ? "Text" : "Number"}
                </ThemedText>
                <Feather
                  name={isDropdownOpen ? "chevron-up" : "chevron-down"}
                  size={14}
                  color={theme.textSecondary}
                />
              </Pressable>
              {isDropdownOpen ? (
                <View
                  style={[
                    styles.fieldTypeDropdown,
                    {
                      backgroundColor: theme.backgroundDefault,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Pressable
                    onPress={() => {
                      setFieldType("text");
                      setShowFieldTypeDropdown(null);
                      Haptics.selectionAsync();
                    }}
                    style={[
                      styles.fieldTypeOption,
                      fieldType === "text" && {
                        backgroundColor: theme.primary + "15",
                      },
                    ]}
                  >
                    <Feather
                      name="type"
                      size={14}
                      color={fieldType === "text" ? theme.primary : theme.text}
                    />
                    <ThemedText
                      type="small"
                      style={{
                        color:
                          fieldType === "text" ? theme.primary : theme.text,
                        fontWeight: fieldType === "text" ? "600" : "400",
                      }}
                    >
                      Text
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setFieldType("number");
                      setShowFieldTypeDropdown(null);
                      Haptics.selectionAsync();
                    }}
                    style={[
                      styles.fieldTypeOption,
                      fieldType === "number" && {
                        backgroundColor: theme.primary + "15",
                      },
                    ]}
                  >
                    <Feather
                      name="hash"
                      size={14}
                      color={
                        fieldType === "number" ? theme.primary : theme.text
                      }
                    />
                    <ThemedText
                      type="small"
                      style={{
                        color:
                          fieldType === "number" ? theme.primary : theme.text,
                        fontWeight: fieldType === "number" ? "600" : "400",
                      }}
                    >
                      Number
                    </ThemedText>
                  </Pressable>
                </View>
              ) : null}
            </View>
            {/* Auto/Fixed Toggle */}
            <Pressable
              onPress={() => setEnabled(!enabled)}
              style={[
                styles.incrementToggle,
                { backgroundColor: enabled ? theme.primary : theme.border },
              ]}
            >
              <ThemedText
                type="small"
                style={{ color: "#FFFFFF", fontWeight: "600" }}
              >
                {enabled ? "AUTO" : "FIXED"}
              </ThemedText>
            </Pressable>
          </View>
        </View>
        <TextInput
          value={value}
          onChangeText={setValue}
          keyboardType={fieldType === "number" ? "numeric" : "default"}
          style={[
            styles.incrementInput,
            {
              backgroundColor: theme.backgroundRoot,
              borderColor: theme.border,
              color: theme.text,
            },
          ]}
          placeholder={
            fieldType === "number"
              ? "Start value (e.g., 001)"
              : "Start value (e.g., AAA)"
          }
          placeholderTextColor={theme.textSecondary}
        />
        {enabled ? (
          <View style={styles.incrementValueRow}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Increment by:
            </ThemedText>
            <TextInput
              value={increment}
              onChangeText={setIncrement}
              keyboardType="numeric"
              style={[
                styles.incrementValueInput,
                {
                  backgroundColor: theme.backgroundRoot,
                  borderColor: theme.border,
                  color: theme.text,
                },
              ]}
            />
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: headerHeight + Spacing.md }]}>
        <View style={styles.tabs}>
          {renderTab("enforcement", "Enforcement")}
          {renderTab("surveillance", "Surveillance")}
        </View>

        <View style={styles.statsRow}>
          <View
            style={[styles.statCard, { backgroundColor: theme.success + "15" }]}
          >
            <Feather name="check-circle" size={20} color={theme.success} />
            <ThemedText type="h3" style={{ color: theme.success }}>
              {codesData?.counts?.available || 0}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.success }}>
              Available
            </ThemedText>
          </View>
          <View
            style={[styles.statCard, { backgroundColor: theme.accent + "15" }]}
          >
            <Feather name="archive" size={20} color={theme.accent} />
            <ThemedText type="h3" style={{ color: theme.accent }}>
              {codesData?.counts?.used || 0}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.accent }}>
              Used
            </ThemedText>
          </View>
        </View>

        <View style={styles.filtersRow}>
          {renderStatusChip("all", "All")}
          {renderStatusChip(
            "available",
            "Available",
            codesData?.counts?.available,
          )}
          {renderStatusChip("used", "Used", codesData?.counts?.used)}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={codesData?.codes || []}
          renderItem={renderCodeItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: tabBarHeight + Spacing.xl + 80 },
          ]}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="inbox" size={48} color={theme.textSecondary} />
              <ThemedText
                type="h3"
                style={{ color: theme.textSecondary, marginTop: Spacing.md }}
              >
                No Sample Codes
              </ThemedText>
              <ThemedText
                type="body"
                style={{
                  color: theme.textSecondary,
                  textAlign: "center",
                  marginTop: Spacing.sm,
                }}
              >
                Generate sample codes to start tracking
              </ThemedText>
            </View>
          }
          refreshing={isLoading}
          onRefresh={refetch}
        />
      )}

      <Pressable
        onPress={() => {
          setShowGenerateModal(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }}
        style={[
          styles.fab,
          { backgroundColor: theme.primary, bottom: tabBarHeight + Spacing.xl },
        ]}
      >
        <Feather name="plus" size={24} color="#FFFFFF" />
      </Pressable>

      {/* Generate Modal */}
      <Modal
        visible={showGenerateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGenerateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <View style={styles.modalHeader}>
              <ThemedText type="h2">Generate Sample Codes</ThemedText>
              <Pressable onPress={() => setShowGenerateModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <View
              style={[
                styles.sampleTypeBadge,
                {
                  backgroundColor:
                    activeTab === "enforcement"
                      ? theme.accent + "15"
                      : theme.success + "15",
                },
              ]}
            >
              <ThemedText
                type="body"
                style={{
                  color:
                    activeTab === "enforcement" ? theme.accent : theme.success,
                  fontWeight: "600",
                }}
              >
                {activeTab === "enforcement"
                  ? "Enforcement Samples"
                  : "Surveillance Samples"}
              </ThemedText>
            </View>

            <View style={styles.incrementControls}>
              {renderIncrementControl(
                "Prefix",
                "prefix",
                prefixStart,
                setPrefixStart,
                prefixFieldType,
                setPrefixFieldType,
                prefixIncrementEnabled,
                setPrefixIncrementEnabled,
                prefixIncrement,
                setPrefixIncrement,
              )}
              {renderIncrementControl(
                "Middle",
                "middle",
                middleStart,
                setMiddleStart,
                middleFieldType,
                setMiddleFieldType,
                middleIncrementEnabled,
                setMiddleIncrementEnabled,
                middleIncrement,
                setMiddleIncrement,
              )}
              {renderIncrementControl(
                "Suffix",
                "suffix",
                suffixStart,
                setSuffixStart,
                suffixFieldType,
                setSuffixFieldType,
                suffixIncrementEnabled,
                setSuffixIncrementEnabled,
                suffixIncrement,
                setSuffixIncrement,
              )}
            </View>

            <View style={styles.quantityRow}>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                Quantity to Generate:
              </ThemedText>
              <TextInput
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                style={[
                  styles.quantityInput,
                  {
                    backgroundColor: theme.backgroundRoot,
                    borderColor: theme.border,
                    color: theme.text,
                  },
                ]}
              />
            </View>

            <View style={styles.previewBox}>
              <ThemedText
                type="small"
                style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}
              >
                Preview (first code):
              </ThemedText>
              <ThemedText
                type="h3"
                style={{ fontFamily: "monospace", letterSpacing: 2 }}
              >
                {prefixStart.padStart(3, "0")}-{middleStart.padStart(3, "0")}-
                {suffixStart.padStart(3, "0")}
              </ThemedText>
            </View>

            <Button
              onPress={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending
                ? "Generating..."
                : `Generate ${quantity} Codes`}
            </Button>
          </View>
        </View>
      </Modal>

      {/* Details Modal */}
      <Modal
        visible={showDetailsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <View style={styles.modalHeader}>
              <ThemedText type="h2">Code Details</ThemedText>
              <Pressable onPress={() => setShowDetailsModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            {codeDetails?.code ? (
              <>
                <View
                  style={[
                    styles.codeDisplay,
                    { backgroundColor: theme.primary + "10" },
                  ]}
                >
                  <ThemedText
                    type="h1"
                    style={{
                      fontFamily: "monospace",
                      letterSpacing: 3,
                      color: theme.primary,
                    }}
                  >
                    {codeDetails.code.fullCode}
                  </ThemedText>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          codeDetails.code.status === "used"
                            ? theme.accent + "15"
                            : theme.success + "15",
                        marginTop: Spacing.md,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor:
                            codeDetails.code.status === "used"
                              ? theme.accent
                              : theme.success,
                        },
                      ]}
                    />
                    <ThemedText
                      type="body"
                      style={{
                        color:
                          codeDetails.code.status === "used"
                            ? theme.accent
                            : theme.success,
                        fontWeight: "600",
                      }}
                    >
                      {codeDetails.code.status.toUpperCase()}
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.detailsSection}>
                  <View style={styles.detailRow}>
                    <ThemedText
                      type="small"
                      style={{ color: theme.textSecondary }}
                    >
                      Sample Type
                    </ThemedText>
                    <ThemedText
                      type="body"
                      style={{ fontWeight: "600", textTransform: "capitalize" }}
                    >
                      {codeDetails.code.sampleType}
                    </ThemedText>
                  </View>
                  <View style={styles.detailRow}>
                    <ThemedText
                      type="small"
                      style={{ color: theme.textSecondary }}
                    >
                      Generated
                    </ThemedText>
                    <ThemedText type="body">
                      {new Date(codeDetails.code.generatedAt).toLocaleString()}
                    </ThemedText>
                  </View>
                  {codeDetails.code.status === "used" &&
                  codeDetails.code.usedAt ? (
                    <>
                      <View style={styles.detailRow}>
                        <ThemedText
                          type="small"
                          style={{ color: theme.textSecondary }}
                        >
                          Used At
                        </ThemedText>
                        <ThemedText type="body">
                          {new Date(codeDetails.code.usedAt).toLocaleString()}
                        </ThemedText>
                      </View>
                      {codeDetails.code.linkedSampleReference ? (
                        <View style={styles.detailRow}>
                          <ThemedText
                            type="small"
                            style={{ color: theme.textSecondary }}
                          >
                            Linked Sample
                          </ThemedText>
                          <ThemedText
                            type="body"
                            style={{ color: theme.primary }}
                          >
                            {codeDetails.code.linkedSampleReference}
                          </ThemedText>
                        </View>
                      ) : null}
                      {codeDetails.code.usageLocation ? (
                        <View style={styles.detailRow}>
                          <ThemedText
                            type="small"
                            style={{ color: theme.textSecondary }}
                          >
                            Location
                          </ThemedText>
                          <ThemedText type="body">
                            {codeDetails.code.usageLocation}
                          </ThemedText>
                        </View>
                      ) : null}
                    </>
                  ) : null}
                </View>

                {codeDetails.auditLog?.length > 0 ? (
                  <View style={styles.auditSection}>
                    <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
                      Audit Trail
                    </ThemedText>
                    {codeDetails.auditLog.map((entry) => (
                      <View
                        key={entry.id}
                        style={[
                          styles.auditEntry,
                          { borderColor: theme.border },
                        ]}
                      >
                        <View
                          style={[
                            styles.auditDot,
                            {
                              backgroundColor:
                                entry.action === "used"
                                  ? theme.accent
                                  : theme.primary,
                            },
                          ]}
                        />
                        <View style={styles.auditContent}>
                          <ThemedText
                            type="body"
                            style={{
                              fontWeight: "600",
                              textTransform: "capitalize",
                            }}
                          >
                            {entry.action}
                          </ThemedText>
                          {entry.performedByName ? (
                            <ThemedText
                              type="small"
                              style={{ color: theme.textSecondary }}
                            >
                              by {entry.performedByName}
                            </ThemedText>
                          ) : null}
                          <ThemedText
                            type="small"
                            style={{ color: theme.textSecondary }}
                          >
                            {new Date(entry.createdAt).toLocaleString()}
                          </ThemedText>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}
              </>
            ) : (
              <ActivityIndicator size="large" color={theme.primary} />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  tabs: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    borderWidth: 1,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    gap: Spacing.xs,
  },
  filtersRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  statusChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  codeCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  codeContent: {
    gap: Spacing.sm,
  },
  codeDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
  },
  fab: {
    position: "absolute",
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.lg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  sampleTypeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
  },
  incrementControls: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  incrementControl: {
    flex: 1,
    gap: Spacing.sm,
  },
  incrementHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  headerControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  fieldTypeContainer: {
    position: "relative",
  },
  fieldTypeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  fieldTypeDropdown: {
    position: "absolute",
    top: 32,
    right: 0,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    minWidth: 100,
    zIndex: 1000,
    elevation: 5,
  },
  fieldTypeOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  incrementToggle: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  incrementInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
    textAlign: "center",
  },
  incrementValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  incrementValueInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    fontSize: 14,
    width: 40,
    textAlign: "center",
  },
  quantityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  quantityInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
    width: 80,
    textAlign: "center",
  },
  previewBox: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  codeDisplay: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  detailsSection: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  auditSection: {
    marginTop: Spacing.md,
  },
  auditEntry: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  auditDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  auditContent: {
    flex: 1,
  },
});
