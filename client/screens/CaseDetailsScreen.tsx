import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  Image,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { useTheme } from "@/hooks/useTheme";
import { useAuthContext } from "@/context/AuthContext";
import { ProsecutionCase, ProsecutionHearing } from "@/types";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl, apiRequest } from "@/lib/query-client";
import DateTimePicker from "@react-native-community/datetimepicker";

type RouteParams = {
  CaseDetails: { caseId: string };
};

const HEARING_STATUSES = ["scheduled", "completed", "adjourned", "cancelled"];

export default function CaseDetailsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "CaseDetails">>();
  const { user } = useAuthContext();
  const queryClient = useQueryClient();

  const { caseId } = route.params;

  const [showNewHearing, setShowNewHearing] = useState(false);
  const [newHearing, setNewHearing] = useState({
    hearingDate: new Date().toISOString().split("T")[0],
    hearingType: "",
    courtRoom: "",
    judgeName: "",
    notes: "",
    status: "scheduled" as const,
  });
  const [hearingImages, setHearingImages] = useState<string[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const { data: caseData, isLoading: caseLoading } = useQuery<ProsecutionCase>({
    queryKey: ["/api/prosecution-cases", caseId],
    queryFn: async () => {
      const res = await fetch(
        new URL(`/api/prosecution-cases/${caseId}`, getApiUrl()).toString(),
      );
      if (!res.ok) throw new Error("Failed to fetch case");
      return res.json();
    },
  });

  const { data: hearings = [], isLoading: hearingsLoading } = useQuery<
    ProsecutionHearing[]
  >({
    queryKey: ["/api/prosecution-cases", caseId, "hearings"],
    queryFn: async () => {
      const res = await fetch(
        new URL(
          `/api/prosecution-cases/${caseId}/hearings`,
          getApiUrl(),
        ).toString(),
      );
      if (!res.ok) throw new Error("Failed to fetch hearings");
      return res.json();
    },
  });

  const addHearingMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/prosecution-hearings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/prosecution-cases", caseId, "hearings"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/prosecution-cases", caseId],
      });
      setShowNewHearing(false);
      resetNewHearing();
    },
  });

  const resetNewHearing = () => {
    setNewHearing({
      hearingDate: new Date().toISOString().split("T")[0],
      hearingType: "",
      courtRoom: "",
      judgeName: "",
      notes: "",
      status: "scheduled",
    });
    setHearingImages([]);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setHearingImages([...hearingImages, result.assets[0].uri]);
    }
  };

  const handleAddHearing = () => {
    if (!newHearing.hearingDate) {
      Alert.alert("Error", "Please select a hearing date");
      return;
    }
    addHearingMutation.mutate({
      caseId,
      ...newHearing,
      images: hearingImages,
      createdByOfficerId: user?.id,
    });
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Not set";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return theme.warning;
      case "ongoing":
        return theme.primary;
      case "convicted":
        return theme.accent;
      case "acquitted":
        return theme.success;
      case "closed":
        return theme.textSecondary;
      case "scheduled":
        return theme.primary;
      case "completed":
        return theme.success;
      case "adjourned":
        return theme.warning;
      case "cancelled":
        return theme.accent;
      default:
        return theme.textSecondary;
    }
  };

  const isLoading = caseLoading || hearingsLoading;

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: headerHeight + Spacing.lg,
              paddingBottom: insets.bottom + Spacing.xl,
            },
          ]}
        >
          <SkeletonLoader height={200} borderRadius={BorderRadius.xl} />
          <View style={{ height: Spacing.lg }} />
          <SkeletonLoader height={300} borderRadius={BorderRadius.xl} />
        </ScrollView>
      </ThemedView>
    );
  }

  if (!caseData) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.centered, { paddingTop: headerHeight }]}>
          <Feather name="alert-circle" size={48} color={theme.textSecondary} />
          <ThemedText
            type="body"
            style={{ marginTop: Spacing.md, color: theme.textSecondary }}
          >
            Case not found
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400)}>
          <Card style={styles.caseCard}>
            <View style={styles.caseHeader}>
              <View style={styles.caseNumberRow}>
                <Feather name="briefcase" size={20} color={theme.primary} />
                <ThemedText type="h3" style={{ marginLeft: Spacing.sm }}>
                  {caseData.caseNumber}
                </ThemedText>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(caseData.status) + "20" },
                ]}
              >
                <ThemedText
                  type="small"
                  style={{
                    color: getStatusColor(caseData.status),
                    textTransform: "capitalize",
                  }}
                >
                  {caseData.status}
                </ThemedText>
              </View>
            </View>

            <View style={styles.section}>
              <ThemedText
                type="small"
                style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}
              >
                Respondent
              </ThemedText>
              <ThemedText type="body">{caseData.respondentName}</ThemedText>
              {caseData.respondentAddress ? (
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {caseData.respondentAddress}
                </ThemedText>
              ) : null}
            </View>

            <View style={styles.section}>
              <ThemedText
                type="small"
                style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}
              >
                Complainant
              </ThemedText>
              <ThemedText type="body">{caseData.complainantName}</ThemedText>
              {caseData.complainantDesignation ? (
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {caseData.complainantDesignation}
                </ThemedText>
              ) : null}
            </View>

            {caseData.courtName ? (
              <View style={styles.section}>
                <ThemedText
                  type="small"
                  style={{
                    color: theme.textSecondary,
                    marginBottom: Spacing.xs,
                  }}
                >
                  Court
                </ThemedText>
                <ThemedText type="body">{caseData.courtName}</ThemedText>
                {caseData.courtLocation ? (
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary }}
                  >
                    {caseData.courtLocation}
                  </ThemedText>
                ) : null}
              </View>
            ) : null}

            {caseData.sectionsCharged ? (
              <View style={styles.section}>
                <ThemedText
                  type="small"
                  style={{
                    color: theme.textSecondary,
                    marginBottom: Spacing.xs,
                  }}
                >
                  Sections Charged
                </ThemedText>
                <ThemedText type="body">{caseData.sectionsCharged}</ThemedText>
              </View>
            ) : null}

            <View style={styles.datesRow}>
              <View style={styles.dateItem}>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, fontSize: 11 }}
                >
                  First Registered
                </ThemedText>
                <ThemedText type="small" style={{ fontWeight: "500" }}>
                  {formatDate(caseData.firstRegistrationDate)}
                </ThemedText>
              </View>
              <View style={styles.dateItem}>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, fontSize: 11 }}
                >
                  First Hearing
                </ThemedText>
                <ThemedText type="small" style={{ fontWeight: "500" }}>
                  {formatDate(caseData.firstHearingDate)}
                </ThemedText>
              </View>
              <View style={styles.dateItem}>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, fontSize: 11 }}
                >
                  Next Hearing
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ fontWeight: "500", color: theme.primary }}
                >
                  {formatDate(caseData.nextHearingDate)}
                </ThemedText>
              </View>
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <View style={styles.sectionHeader}>
            <ThemedText type="h4">Hearings</ThemedText>
            <Pressable
              onPress={() => setShowNewHearing(true)}
              style={[styles.addButton, { backgroundColor: theme.primary }]}
            >
              <Feather name="plus" size={16} color="#fff" />
              <ThemedText type="small" style={{ color: "#fff", marginLeft: 4 }}>
                Add Hearing
              </ThemedText>
            </Pressable>
          </View>

          {hearings.length === 0 ? (
            <Card style={styles.emptyHearings}>
              <Feather
                name="calendar"
                size={32}
                color={theme.textSecondary}
                style={{ marginBottom: Spacing.sm }}
              />
              <ThemedText type="body" style={{ color: theme.textSecondary }}>
                No hearings recorded
              </ThemedText>
            </Card>
          ) : (
            hearings.map((hearing, index) => (
              <Animated.View
                key={hearing.id}
                entering={FadeInDown.delay(150 + index * 50).duration(300)}
              >
                <Card style={styles.hearingCard}>
                  <View style={styles.hearingHeader}>
                    <View style={styles.hearingDateRow}>
                      <Feather
                        name="calendar"
                        size={14}
                        color={theme.primary}
                      />
                      <ThemedText
                        type="body"
                        style={{ marginLeft: 6, fontWeight: "600" }}
                      >
                        {formatDate(hearing.hearingDate)}
                      </ThemedText>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor:
                            getStatusColor(hearing.status) + "20",
                        },
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={{
                          color: getStatusColor(hearing.status),
                          textTransform: "capitalize",
                        }}
                      >
                        {hearing.status}
                      </ThemedText>
                    </View>
                  </View>

                  {hearing.hearingType ? (
                    <View style={styles.hearingInfo}>
                      <ThemedText
                        type="small"
                        style={{ color: theme.textSecondary }}
                      >
                        Type:
                      </ThemedText>
                      <ThemedText type="small" style={{ marginLeft: 4 }}>
                        {hearing.hearingType}
                      </ThemedText>
                    </View>
                  ) : null}

                  {hearing.judgeName ? (
                    <View style={styles.hearingInfo}>
                      <ThemedText
                        type="small"
                        style={{ color: theme.textSecondary }}
                      >
                        Judge:
                      </ThemedText>
                      <ThemedText type="small" style={{ marginLeft: 4 }}>
                        {hearing.judgeName}
                      </ThemedText>
                    </View>
                  ) : null}

                  {hearing.notes ? (
                    <View style={styles.notesSection}>
                      <ThemedText
                        type="small"
                        style={{ color: theme.textSecondary, marginBottom: 4 }}
                      >
                        Notes
                      </ThemedText>
                      <ThemedText type="small">{hearing.notes}</ThemedText>
                    </View>
                  ) : null}

                  {hearing.images && hearing.images.length > 0 ? (
                    <View style={styles.imagesRow}>
                      {hearing.images.map((img, imgIdx) => (
                        <Image
                          key={imgIdx}
                          source={{ uri: img }}
                          style={styles.hearingImage}
                        />
                      ))}
                    </View>
                  ) : null}

                  {hearing.nextDate ? (
                    <View
                      style={[
                        styles.nextDateBadge,
                        { backgroundColor: theme.primary + "10" },
                      ]}
                    >
                      <Feather
                        name="arrow-right"
                        size={12}
                        color={theme.primary}
                      />
                      <ThemedText
                        type="small"
                        style={{ marginLeft: 4, color: theme.primary }}
                      >
                        Next: {formatDate(hearing.nextDate)}{" "}
                        {hearing.nextDatePurpose
                          ? `(${hearing.nextDatePurpose})`
                          : ""}
                      </ThemedText>
                    </View>
                  ) : null}
                </Card>
              </Animated.View>
            ))
          )}
        </Animated.View>
      </ScrollView>

      <Modal visible={showNewHearing} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <View style={styles.modalHeader}>
              <ThemedText type="h4">Add Hearing</ThemedText>
              <Pressable
                onPress={() => {
                  setShowNewHearing(false);
                  resetNewHearing();
                }}
              >
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.formGroup}>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginBottom: 4 }}
                >
                  Hearing Date *
                </ThemedText>
                <Pressable
                  onPress={() => setShowDatePicker(true)}
                  style={[
                    styles.dateInput,
                    {
                      backgroundColor: theme.backgroundSecondary,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <ThemedText type="body">
                    {formatDate(newHearing.hearingDate)}
                  </ThemedText>
                  <Feather
                    name="calendar"
                    size={18}
                    color={theme.textSecondary}
                  />
                </Pressable>
              </View>

              {showDatePicker ? (
                <DateTimePicker
                  value={new Date(newHearing.hearingDate)}
                  mode="date"
                  display="spinner"
                  onChange={(_, date) => {
                    setShowDatePicker(false);
                    if (date)
                      setNewHearing({
                        ...newHearing,
                        hearingDate: date.toISOString().split("T")[0],
                      });
                  }}
                />
              ) : null}

              <View style={styles.formGroup}>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginBottom: 4 }}
                >
                  Hearing Type
                </ThemedText>
                <TextInput
                  value={newHearing.hearingType}
                  onChangeText={(t) =>
                    setNewHearing({ ...newHearing, hearingType: t })
                  }
                  placeholder="e.g., Arguments, Evidence, Judgement"
                  placeholderTextColor={theme.textSecondary}
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.backgroundSecondary,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginBottom: 4 }}
                >
                  Judge Name
                </ThemedText>
                <TextInput
                  value={newHearing.judgeName}
                  onChangeText={(t) =>
                    setNewHearing({ ...newHearing, judgeName: t })
                  }
                  placeholder="Name of presiding judge"
                  placeholderTextColor={theme.textSecondary}
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.backgroundSecondary,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginBottom: 4 }}
                >
                  Court Room
                </ThemedText>
                <TextInput
                  value={newHearing.courtRoom}
                  onChangeText={(t) =>
                    setNewHearing({ ...newHearing, courtRoom: t })
                  }
                  placeholder="Room number"
                  placeholderTextColor={theme.textSecondary}
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.backgroundSecondary,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginBottom: 4 }}
                >
                  Notes
                </ThemedText>
                <TextInput
                  value={newHearing.notes}
                  onChangeText={(t) =>
                    setNewHearing({ ...newHearing, notes: t })
                  }
                  placeholder="Observations, proceedings, orders..."
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  numberOfLines={4}
                  style={[
                    styles.textInput,
                    styles.textArea,
                    {
                      backgroundColor: theme.backgroundSecondary,
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginBottom: 4 }}
                >
                  Status
                </ThemedText>
                <View style={styles.statusButtons}>
                  {HEARING_STATUSES.map((status) => (
                    <Pressable
                      key={status}
                      onPress={() =>
                        setNewHearing({ ...newHearing, status: status as any })
                      }
                      style={[
                        styles.statusButton,
                        {
                          borderColor:
                            newHearing.status === status
                              ? theme.primary
                              : theme.border,
                        },
                        newHearing.status === status && {
                          backgroundColor: theme.primary + "15",
                        },
                      ]}
                    >
                      <ThemedText
                        type="small"
                        style={{
                          color:
                            newHearing.status === status
                              ? theme.primary
                              : theme.text,
                          textTransform: "capitalize",
                        }}
                      >
                        {status}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginBottom: 4 }}
                >
                  Images
                </ThemedText>
                <View style={styles.imagesSection}>
                  {hearingImages.map((img, idx) => (
                    <View key={idx} style={styles.imageWrapper}>
                      <Image
                        source={{ uri: img }}
                        style={styles.selectedImage}
                      />
                      <Pressable
                        onPress={() =>
                          setHearingImages(
                            hearingImages.filter((_, i) => i !== idx),
                          )
                        }
                        style={styles.removeImageBtn}
                      >
                        <Feather name="x" size={14} color="#fff" />
                      </Pressable>
                    </View>
                  ))}
                  {hearingImages.length < 5 ? (
                    <Pressable
                      onPress={pickImage}
                      style={[
                        styles.addImageBtn,
                        { borderColor: theme.border },
                      ]}
                    >
                      <Feather
                        name="camera"
                        size={24}
                        color={theme.textSecondary}
                      />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                onPress={() => {
                  setShowNewHearing(false);
                  resetNewHearing();
                }}
                style={[styles.cancelButton, { borderColor: theme.border }]}
              >
                <ThemedText type="body" style={{ color: theme.text }}>
                  Cancel
                </ThemedText>
              </Pressable>
              <Button
                onPress={handleAddHearing}
                disabled={addHearingMutation.isPending}
                style={{ flex: 1 }}
              >
                {addHearingMutation.isPending ? "Saving..." : "Save Hearing"}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
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
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  caseCard: {
    padding: Spacing.lg,
  },
  caseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  caseNumberRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  section: {
    marginBottom: Spacing.md,
  },
  datesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  dateItem: {
    alignItems: "center",
    gap: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  emptyHearings: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  hearingCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  hearingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  hearingDateRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  hearingInfo: {
    flexDirection: "row",
    marginBottom: 4,
  },
  notesSection: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: "rgba(0,0,0,0.02)",
    borderRadius: BorderRadius.sm,
  },
  imagesRow: {
    flexDirection: "row",
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  hearingImage: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.sm,
  },
  nextDateBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
    padding: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignSelf: "flex-start",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    maxHeight: "90%",
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  modalBody: {
    padding: Spacing.lg,
  },
  modalFooter: {
    flexDirection: "row",
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  formGroup: {
    marginBottom: Spacing.lg,
  },
  dateInput: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  textInput: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  statusButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  statusButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  imagesSection: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  imageWrapper: {
    position: "relative",
  },
  selectedImage: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
  },
  removeImageBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 12,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  addImageBtn: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    flex: 1,
    marginRight: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: "center",
  },
});
