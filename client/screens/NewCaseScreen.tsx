import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import DateTimePicker from "@react-native-community/datetimepicker";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuthContext } from "@/context/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

const CASE_STATUSES = ["pending", "ongoing"];

export default function NewCaseScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const { user } = useAuthContext();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    caseNumber: "",
    courtName: "",
    courtLocation: "",
    respondentName: "",
    respondentAddress: "",
    complainantName: user?.name || "",
    complainantDesignation: user?.designation || "Food Safety Officer",
    offenceDetails: "",
    sectionsCharged: "",
    firstRegistrationDate: "",
    firstHearingDate: "",
    status: "pending" as const,
  });

  const [showDatePicker, setShowDatePicker] = useState<
    "registration" | "hearing" | null
  >(null);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/prosecution-cases", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prosecution-cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/upcoming-hearings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      navigation.goBack();
    },
    onError: (error) => {
      Alert.alert("Error", "Failed to create case. Please try again.");
    },
  });

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Select date";
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const handleSubmit = () => {
    if (!formData.caseNumber.trim()) {
      Alert.alert("Error", "Case number is required");
      return;
    }
    if (!formData.respondentName.trim()) {
      Alert.alert("Error", "Respondent name is required");
      return;
    }
    if (!formData.complainantName.trim()) {
      Alert.alert("Error", "Complainant name is required");
      return;
    }

    createMutation.mutate({
      ...formData,
      jurisdictionId: user?.jurisdiction?.unitId,
      officerId: user?.id,
    });
  };

  const handleDateChange = (type: "registration" | "hearing", date?: Date) => {
    setShowDatePicker(null);
    if (date) {
      const dateStr = date.toISOString().split("T")[0];
      if (type === "registration") {
        setFormData({ ...formData, firstRegistrationDate: dateStr });
      } else {
        setFormData({ ...formData, firstHearingDate: dateStr });
      }
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formSection}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Case Information
          </ThemedText>

          <View style={styles.formGroup}>
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary, marginBottom: 4 }}
            >
              Case Number *
            </ThemedText>
            <TextInput
              value={formData.caseNumber}
              onChangeText={(t) => setFormData({ ...formData, caseNumber: t })}
              placeholder="e.g., FSS/2024/001"
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
              Status
            </ThemedText>
            <View style={styles.statusButtons}>
              {CASE_STATUSES.map((status) => (
                <Pressable
                  key={status}
                  onPress={() =>
                    setFormData({ ...formData, status: status as any })
                  }
                  style={[
                    styles.statusButton,
                    {
                      borderColor:
                        formData.status === status
                          ? theme.primary
                          : theme.border,
                    },
                    formData.status === status && {
                      backgroundColor: theme.primary + "15",
                    },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{
                      color:
                        formData.status === status ? theme.primary : theme.text,
                      textTransform: "capitalize",
                    }}
                  >
                    {status}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.formSection}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Court Details
          </ThemedText>

          <View style={styles.formGroup}>
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary, marginBottom: 4 }}
            >
              Court Name
            </ThemedText>
            <TextInput
              value={formData.courtName}
              onChangeText={(t) => setFormData({ ...formData, courtName: t })}
              placeholder="e.g., District Court"
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
              Court Location
            </ThemedText>
            <TextInput
              value={formData.courtLocation}
              onChangeText={(t) =>
                setFormData({ ...formData, courtLocation: t })
              }
              placeholder="City, District"
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
        </View>

        <View style={styles.formSection}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Respondent
          </ThemedText>

          <View style={styles.formGroup}>
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary, marginBottom: 4 }}
            >
              Respondent Name *
            </ThemedText>
            <TextInput
              value={formData.respondentName}
              onChangeText={(t) =>
                setFormData({ ...formData, respondentName: t })
              }
              placeholder="Name of the accused"
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
              Respondent Address
            </ThemedText>
            <TextInput
              value={formData.respondentAddress}
              onChangeText={(t) =>
                setFormData({ ...formData, respondentAddress: t })
              }
              placeholder="Address of the accused"
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={2}
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
        </View>

        <View style={styles.formSection}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Complainant
          </ThemedText>

          <View style={styles.formGroup}>
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary, marginBottom: 4 }}
            >
              Complainant Name *
            </ThemedText>
            <TextInput
              value={formData.complainantName}
              onChangeText={(t) =>
                setFormData({ ...formData, complainantName: t })
              }
              placeholder="Your name"
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
              Designation
            </ThemedText>
            <TextInput
              value={formData.complainantDesignation}
              onChangeText={(t) =>
                setFormData({ ...formData, complainantDesignation: t })
              }
              placeholder="e.g., Food Safety Officer"
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
        </View>

        <View style={styles.formSection}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Offence Details
          </ThemedText>

          <View style={styles.formGroup}>
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary, marginBottom: 4 }}
            >
              Sections Charged
            </ThemedText>
            <TextInput
              value={formData.sectionsCharged}
              onChangeText={(t) =>
                setFormData({ ...formData, sectionsCharged: t })
              }
              placeholder="e.g., Section 26, 27, 59"
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
              Offence Details
            </ThemedText>
            <TextInput
              value={formData.offenceDetails}
              onChangeText={(t) =>
                setFormData({ ...formData, offenceDetails: t })
              }
              placeholder="Brief description of the offence"
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
        </View>

        <View style={styles.formSection}>
          <ThemedText type="h4" style={styles.sectionTitle}>
            Key Dates
          </ThemedText>

          <View style={styles.formGroup}>
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary, marginBottom: 4 }}
            >
              First Registration Date
            </ThemedText>
            <Pressable
              onPress={() => setShowDatePicker("registration")}
              style={[
                styles.dateInput,
                {
                  backgroundColor: theme.backgroundSecondary,
                  borderColor: theme.border,
                },
              ]}
            >
              <ThemedText type="body">
                {formatDate(formData.firstRegistrationDate)}
              </ThemedText>
              <Feather name="calendar" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.formGroup}>
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary, marginBottom: 4 }}
            >
              First Hearing Date
            </ThemedText>
            <Pressable
              onPress={() => setShowDatePicker("hearing")}
              style={[
                styles.dateInput,
                {
                  backgroundColor: theme.backgroundSecondary,
                  borderColor: theme.border,
                },
              ]}
            >
              <ThemedText type="body">
                {formatDate(formData.firstHearingDate)}
              </ThemedText>
              <Feather name="calendar" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>
        </View>

        {showDatePicker ? (
          <DateTimePicker
            value={new Date()}
            mode="date"
            display="spinner"
            onChange={(_, date) => handleDateChange(showDatePicker, date)}
          />
        ) : null}

        <Button
          onPress={handleSubmit}
          disabled={createMutation.isPending}
          style={styles.submitButton}
        >
          {createMutation.isPending ? "Creating Case..." : "Create Case"}
        </Button>
      </KeyboardAwareScrollViewCompat>
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
  formSection: {
    gap: Spacing.md,
  },
  sectionTitle: {
    marginBottom: Spacing.xs,
  },
  formGroup: {
    marginBottom: Spacing.sm,
  },
  textInput: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  dateInput: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  statusButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  statusButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  submitButton: {
    marginTop: Spacing.lg,
  },
});
