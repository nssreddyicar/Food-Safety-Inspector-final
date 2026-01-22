import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Switch,
  ActivityIndicator,
  Modal,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { SampleForm } from "@/components/SampleForm";
import { WitnessForm } from "@/components/WitnessForm";
import { ActionForm } from "@/components/ActionForm";
import { useTheme } from "@/hooks/useTheme";
import { useAuthContext } from "@/context/AuthContext";
import { storage } from "@/lib/storage";
import { getApiUrl, apiRequest } from "@/lib/query-client";
import {
  Inspection,
  Deviation,
  Sample,
  Witness,
  ActionTaken,
  SampleType,
} from "@/types";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

const INSPECTION_TYPES = [
  "Routine",
  "Special Drive",
  "Complaint Based",
  "VVIP",
  "Initiatives",
];

export default function NewInspectionScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const { user } = useAuthContext();

  const [isLoading, setIsLoading] = useState(false);
  const [inspectionType, setInspectionType] = useState("Routine");
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  const [fboEstablishmentName, setFboEstablishmentName] = useState("");
  const [fboName, setFboName] = useState("");
  const [fboSonOf, setFboSonOf] = useState("");
  const [fboAge, setFboAge] = useState("");
  const [fboAddress, setFboAddress] = useState("");
  const [hasLicense, setHasLicense] = useState(true);
  const [licenseNumber, setLicenseNumber] = useState("");

  const [proprietorSame, setProprietorSame] = useState(false);
  const [proprietorName, setProprietorName] = useState("");
  const [proprietorSonOf, setProprietorSonOf] = useState("");
  const [proprietorAge, setProprietorAge] = useState("");
  const [proprietorAddress, setProprietorAddress] = useState("");
  const [proprietorPhone, setProprietorPhone] = useState("");

  const [deviations, setDeviations] = useState<Deviation[]>([]);
  const [actions, setActions] = useState<Partial<ActionTaken>[]>([]);
  const [samples, setSamples] = useState<Partial<Sample>[]>([]);
  const [witnesses, setWitnesses] = useState<Partial<Witness>[]>([]);

  const handleAddDeviation = () => {
    const newDeviation: Deviation = {
      id: `dev_${Date.now()}`,
      category: "Hygiene",
      description: "",
      severity: "minor",
    };
    setDeviations([...deviations, newDeviation]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleRemoveDeviation = (id: string) => {
    setDeviations(deviations.filter((d) => d.id !== id));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleUpdateDeviation = (
    id: string,
    field: keyof Deviation,
    value: string,
  ) => {
    setDeviations(
      deviations.map((d) => (d.id === id ? { ...d, [field]: value } : d)),
    );
  };

  const handleAddAction = () => {
    const newAction: Partial<ActionTaken> = {
      id: `action_${Date.now()}`,
      actionType: "",
      description: "",
      images: [],
    };
    setActions([...actions, newAction]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleRemoveAction = (id: string) => {
    setActions(actions.filter((a) => a.id !== id));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleUpdateAction = (
    id: string,
    updatedAction: Partial<ActionTaken>,
  ) => {
    setActions(actions.map((a) => (a.id === id ? updatedAction : a)));
  };

  const handleAddSample = (sampleType: SampleType) => {
    const sampleCode = `${user?.district?.substring(0, 3).toUpperCase() || "XXX"}-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
    const newSample: Partial<Sample> = {
      id: `sample_${Date.now()}`,
      sampleType,
      name: "",
      code: sampleCode,
      liftedDate: new Date().toISOString(),
      liftedPlace: "",
      officerId: user?.id || "",
      officerName: user?.name || "",
      officerDesignation: user?.designation || "",
      cost: 0,
      quantityInGrams: 0,
      preservativeAdded: false,
      packingType: "loose",
    };
    setSamples([...samples, newSample]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleRemoveSample = (id: string) => {
    setSamples(samples.filter((s) => s.id !== id));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleUpdateSample = (id: string, updatedSample: Partial<Sample>) => {
    setSamples(samples.map((s) => (s.id === id ? updatedSample : s)));
  };

  const handleAddWitness = () => {
    const newWitness: Partial<Witness> = {
      id: `witness_${Date.now()}`,
      name: "",
      sonOfName: "",
      age: undefined,
      address: "",
      phone: "",
    };
    setWitnesses([...witnesses, newWitness]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleRemoveWitness = (id: string) => {
    setWitnesses(witnesses.filter((w) => w.id !== id));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleUpdateWitness = (
    id: string,
    updatedWitness: Partial<Witness>,
  ) => {
    setWitnesses(witnesses.map((w) => (w.id === id ? updatedWitness : w)));
  };

  const handleSaveDraft = async () => {
    await saveInspection("draft");
  };

  const handleSubmit = async () => {
    if (!fboEstablishmentName.trim() && !fboName.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    await saveInspection("submitted");
  };

  const saveInspection = async (status: "draft" | "submitted") => {
    setIsLoading(true);
    try {
      const inspection: Inspection = {
        id: `insp_${Date.now()}`,
        type: inspectionType,
        status,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        fboDetails: {
          establishmentName: fboEstablishmentName,
          name: fboName,
          sonOfName: fboSonOf || undefined,
          age: fboAge ? parseInt(fboAge) : undefined,
          address: fboAddress,
          licenseNumber: hasLicense ? licenseNumber : undefined,
          hasLicense,
        },
        proprietorDetails: {
          name: proprietorSame ? fboName : proprietorName,
          sonOfName: proprietorSame ? fboSonOf : proprietorSonOf || undefined,
          age: proprietorSame
            ? fboAge
              ? parseInt(fboAge)
              : undefined
            : proprietorAge
              ? parseInt(proprietorAge)
              : undefined,
          address: proprietorSame ? fboAddress : proprietorAddress,
          phone: proprietorPhone,
          isSameAsFBO: proprietorSame,
        },
        deviations,
        actionsTaken: actions
          .filter((a) => a.actionType)
          .map((a) => ({
            id: a.id || `action_${Date.now()}`,
            actionType: a.actionType || "",
            description: a.description || "",
            images: a.images || [],
            countdownDate: a.countdownDate,
            remarks: a.remarks,
          })),
        sampleLifted: samples.length > 0,
        samples: samples
          .filter((s) => s.name)
          .map((s) => ({
            id: s.id || `sample_${Date.now()}`,
            inspectionId: `insp_${Date.now()}`,
            sampleType: s.sampleType || "enforcement",
            name: s.name || "",
            code: s.code || "",
            liftedDate: s.liftedDate || new Date().toISOString(),
            liftedPlace: s.liftedPlace || "",
            officerId: s.officerId || user?.id || "",
            officerName: s.officerName || user?.name || "",
            officerDesignation: s.officerDesignation || user?.designation || "",
            cost: s.cost || 0,
            quantityInGrams: s.quantityInGrams || 0,
            preservativeAdded: s.preservativeAdded || false,
            preservativeType: s.preservativeType,
            packingType: s.packingType || "loose",
            manufacturerDetails: s.manufacturerDetails,
            distributorDetails: s.distributorDetails,
            repackerDetails: s.repackerDetails,
            relabellerDetails: s.relabellerDetails,
            mfgDate: s.mfgDate,
            useByDate: s.useByDate,
            lotBatchNumber: s.lotBatchNumber,
            remarks: s.remarks,
          })),
        witnesses: witnesses
          .filter((w) => w.name)
          .map((w) => ({
            id: w.id || `witness_${Date.now()}`,
            name: w.name || "",
            sonOfName: w.sonOfName,
            age: w.age,
            address: w.address || "",
            phone: w.phone || "",
            aadhaarNumber: w.aadhaarNumber,
            aadhaarImage: w.aadhaarImage,
            signature: w.signature,
          })),
        fsoId: user?.id || "",
        fsoName: user?.name || "",
        district: user?.district || "",
        jurisdictionId: user?.jurisdiction?.unitId,
      };

      await storage.addInspection(inspection);

      // If inspection is submitted with samples, auto-trigger first workflow node for each sample
      if (
        status === "submitted" &&
        inspection.samples &&
        inspection.samples.length > 0
      ) {
        try {
          // Fetch workflow nodes to find the start node
          const workflowUrl = new URL("/api/workflow/config", getApiUrl());
          const workflowResponse = await fetch(workflowUrl.toString());
          if (workflowResponse.ok) {
            const workflowConfig = await workflowResponse.json();
            const startNode = workflowConfig.nodes?.find(
              (n: any) => n.isStartNode,
            );

            if (startNode) {
              // Format current date as DD-MM-YYYY
              const now = new Date();
              const formattedDate = `${String(now.getDate()).padStart(2, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`;

              // For each sample, create workflow state for the first node
              for (const sample of inspection.samples) {
                const nodeData = {
                  liftedDate: formattedDate,
                  liftedPlace:
                    fboAddress || inspection.fboDetails.address || "",
                  remarks: `Auto-created from inspection submission: ${inspection.fboDetails.establishmentName || "Unnamed FBO"}`,
                };

                await apiRequest(
                  "POST",
                  `/api/samples/${sample.id}/workflow-state`,
                  {
                    nodeId: startNode.id,
                    nodeData,
                  },
                );
              }
            }
          }
        } catch (workflowError) {
          console.error(
            "Failed to auto-trigger sample workflow:",
            workflowError,
          );
          // Don't fail the whole inspection save if workflow trigger fails
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (error) {
      console.error("Failed to save inspection:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderDropdownModal = () => (
    <Modal
      visible={showTypeDropdown}
      transparent
      animationType="fade"
      onRequestClose={() => setShowTypeDropdown(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowTypeDropdown(false)}
      >
        <View
          style={[
            styles.modalContent,
            {
              backgroundColor: theme.backgroundDefault,
              marginTop: headerHeight + Spacing.xl + 100,
            },
          ]}
        >
          {INSPECTION_TYPES.map((type) => (
            <Pressable
              key={type}
              onPress={() => {
                setInspectionType(type);
                setShowTypeDropdown(false);
                Haptics.selectionAsync();
              }}
              style={[
                styles.dropdownItem,
                type === inspectionType && {
                  backgroundColor: theme.primary + "15",
                },
              ]}
            >
              <ThemedText
                style={
                  type === inspectionType
                    ? { color: theme.primary, fontWeight: "600" }
                    : undefined
                }
              >
                {type}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {renderDropdownModal()}
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + Spacing["2xl"],
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <ThemedText type="h3">Inspection Type</ThemedText>
          <Pressable
            onPress={() => setShowTypeDropdown(true)}
            style={[
              styles.dropdown,
              {
                backgroundColor: theme.backgroundSecondary,
                borderColor: theme.border,
              },
            ]}
          >
            <ThemedText>{inspectionType}</ThemedText>
            <Feather
              name="chevron-down"
              size={18}
              color={theme.textSecondary}
            />
          </Pressable>
        </View>

        <View style={styles.section}>
          <ThemedText type="h3">FBO Details</ThemedText>
          <Input
            label="Establishment Name"
            placeholder="Enter establishment/business name"
            value={fboEstablishmentName}
            onChangeText={setFboEstablishmentName}
            testID="input-fbo-establishment"
          />
          <Input
            label="Owner/Operator Name"
            placeholder="Enter owner/operator full name"
            value={fboName}
            onChangeText={setFboName}
            testID="input-fbo-name"
          />
          <View style={styles.row}>
            <View style={styles.flexTwo}>
              <Input
                label="S/o, D/o, W/o"
                placeholder="Son of / Daughter of / Wife of"
                value={fboSonOf}
                onChangeText={setFboSonOf}
              />
            </View>
            <View style={styles.flexOne}>
              <Input
                label="Age (Years)"
                placeholder="Age"
                value={fboAge}
                onChangeText={setFboAge}
                keyboardType="numeric"
              />
            </View>
          </View>
          <Input
            label="Address"
            placeholder="Enter complete address"
            value={fboAddress}
            onChangeText={setFboAddress}
            multiline
            testID="input-fbo-address"
          />

          <View style={styles.switchRow}>
            <ThemedText type="body">Has Food License/Registration?</ThemedText>
            <Switch
              value={hasLicense}
              onValueChange={setHasLicense}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          {hasLicense ? (
            <Input
              label="License/Registration Number"
              placeholder="Enter license number"
              value={licenseNumber}
              onChangeText={setLicenseNumber}
              testID="input-license"
            />
          ) : null}
        </View>

        <View style={styles.section}>
          <View style={styles.switchRow}>
            <ThemedText type="h3">Proprietor Details</ThemedText>
            <View style={styles.switchContainer}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Same as FBO
              </ThemedText>
              <Switch
                value={proprietorSame}
                onValueChange={setProprietorSame}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {!proprietorSame ? (
            <>
              <Input
                label="Name"
                placeholder="Proprietor full name"
                value={proprietorName}
                onChangeText={setProprietorName}
              />
              <View style={styles.row}>
                <View style={styles.flexTwo}>
                  <Input
                    label="S/o, D/o, W/o"
                    placeholder="Son of / Daughter of / Wife of"
                    value={proprietorSonOf}
                    onChangeText={setProprietorSonOf}
                  />
                </View>
                <View style={styles.flexOne}>
                  <Input
                    label="Age (Years)"
                    placeholder="Age"
                    value={proprietorAge}
                    onChangeText={setProprietorAge}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <Input
                label="Address"
                placeholder="Proprietor address"
                value={proprietorAddress}
                onChangeText={setProprietorAddress}
                multiline
              />
            </>
          ) : null}
          <Input
            label="Phone"
            placeholder="Contact number"
            value={proprietorPhone}
            onChangeText={setProprietorPhone}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText type="h3">Deviations Found</ThemedText>
            <Pressable
              onPress={handleAddDeviation}
              style={[styles.addButton, { borderColor: theme.primary }]}
            >
              <Feather name="plus" size={16} color={theme.primary} />
              <ThemedText type="small" style={{ color: theme.primary }}>
                Add
              </ThemedText>
            </Pressable>
          </View>

          {deviations.length === 0 ? (
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              No deviations added
            </ThemedText>
          ) : null}

          {deviations.map((deviation, index) => (
            <View
              key={deviation.id}
              style={[
                styles.deviationCard,
                { backgroundColor: theme.backgroundDefault },
              ]}
            >
              <View style={styles.deviationHeader}>
                <ThemedText type="h4">Deviation {index + 1}</ThemedText>
                <Pressable onPress={() => handleRemoveDeviation(deviation.id)}>
                  <Feather name="trash-2" size={18} color={theme.accent} />
                </Pressable>
              </View>
              <Input
                placeholder="Describe the deviation"
                value={deviation.description}
                onChangeText={(text) =>
                  handleUpdateDeviation(deviation.id, "description", text)
                }
                multiline
              />
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText type="h3">Actions Taken</ThemedText>
            <Pressable
              onPress={handleAddAction}
              style={[styles.addButton, { borderColor: theme.primary }]}
            >
              <Feather name="plus" size={16} color={theme.primary} />
              <ThemedText type="small" style={{ color: theme.primary }}>
                Add Action
              </ThemedText>
            </Pressable>
          </View>

          {actions.length === 0 ? (
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              No actions added
            </ThemedText>
          ) : null}

          {actions.map((action, index) => (
            <ActionForm
              key={action.id}
              action={action}
              onUpdate={(updated) => handleUpdateAction(action.id!, updated)}
              onRemove={() => handleRemoveAction(action.id!)}
              index={index}
            />
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText type="h3">Samples Lifted</ThemedText>
          </View>

          {samples.length === 0 ? (
            <View
              style={[
                styles.addSampleContainer,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                },
              ]}
            >
              <ThemedText
                type="small"
                style={{
                  color: theme.textSecondary,
                  textAlign: "center",
                  marginBottom: Spacing.md,
                }}
              >
                No samples added. Add enforcement or surveillance samples.
              </ThemedText>
              <View style={styles.addSampleButtons}>
                <Pressable
                  onPress={() => handleAddSample("enforcement")}
                  style={[
                    styles.addSampleButton,
                    {
                      backgroundColor: theme.accent + "15",
                      borderColor: theme.accent,
                    },
                  ]}
                >
                  <Feather name="shield" size={18} color={theme.accent} />
                  <ThemedText
                    type="small"
                    style={{ color: theme.accent, fontWeight: "600" }}
                  >
                    Add Enforcement Sample
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => handleAddSample("surveillance")}
                  style={[
                    styles.addSampleButton,
                    {
                      backgroundColor: theme.primary + "15",
                      borderColor: theme.primary,
                    },
                  ]}
                >
                  <Feather name="eye" size={18} color={theme.primary} />
                  <ThemedText
                    type="small"
                    style={{ color: theme.primary, fontWeight: "600" }}
                  >
                    Add Surveillance Sample
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              {samples.map((sample, index) => (
                <SampleForm
                  key={sample.id}
                  sample={sample}
                  onUpdate={(updated) =>
                    handleUpdateSample(sample.id!, updated)
                  }
                  onRemove={() => handleRemoveSample(sample.id!)}
                  index={index}
                  officerName={user?.name || ""}
                  officerDesignation={user?.designation || ""}
                  officerId={user?.id || ""}
                />
              ))}
              <View style={styles.addMoreSamplesRow}>
                <Pressable
                  onPress={() => handleAddSample("enforcement")}
                  style={[styles.addMoreButton, { borderColor: theme.accent }]}
                >
                  <Feather name="plus" size={14} color={theme.accent} />
                  <ThemedText type="small" style={{ color: theme.accent }}>
                    Enforcement
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => handleAddSample("surveillance")}
                  style={[styles.addMoreButton, { borderColor: theme.primary }]}
                >
                  <Feather name="plus" size={14} color={theme.primary} />
                  <ThemedText type="small" style={{ color: theme.primary }}>
                    Surveillance
                  </ThemedText>
                </Pressable>
              </View>
            </>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText type="h3">Witness Details</ThemedText>
            <Pressable
              onPress={handleAddWitness}
              style={[styles.addButton, { borderColor: theme.primary }]}
            >
              <Feather name="plus" size={16} color={theme.primary} />
              <ThemedText type="small" style={{ color: theme.primary }}>
                Add Witness
              </ThemedText>
            </Pressable>
          </View>

          {witnesses.length === 0 ? (
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              No witnesses added
            </ThemedText>
          ) : null}

          {witnesses.map((witness, index) => (
            <WitnessForm
              key={witness.id}
              witness={witness}
              onUpdate={(updated) => handleUpdateWitness(witness.id!, updated)}
              onRemove={() => handleRemoveWitness(witness.id!)}
              index={index}
            />
          ))}
        </View>

        <View style={styles.buttonRow}>
          <Button
            onPress={handleSaveDraft}
            style={[
              styles.draftButton,
              { backgroundColor: theme.backgroundSecondary },
            ]}
            disabled={isLoading}
          >
            <ThemedText style={{ color: theme.text }}>Save Draft</ThemedText>
          </Button>
          <Button
            onPress={handleSubmit}
            style={styles.submitButton}
            disabled={
              isLoading || (!fboEstablishmentName.trim() && !fboName.trim())
            }
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              "Submit"
            )}
          </Button>
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing["2xl"],
  },
  section: {
    gap: Spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  switchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  row: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  flexOne: {
    flex: 1,
  },
  flexTwo: {
    flex: 2,
  },
  dropdown: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: Spacing.inputHeight,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "flex-start",
    paddingHorizontal: Spacing.lg,
  },
  modalContent: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    ...Shadows.lg,
  },
  dropdownItem: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  deviationCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  deviationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  addSampleContainer: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  addSampleButtons: {
    gap: Spacing.sm,
  },
  addSampleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  addMoreSamplesRow: {
    flexDirection: "row",
    gap: Spacing.md,
    justifyContent: "center",
  },
  addMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  draftButton: {
    flex: 1,
  },
  submitButton: {
    flex: 2,
  },
});
