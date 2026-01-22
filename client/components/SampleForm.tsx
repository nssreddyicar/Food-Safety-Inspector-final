import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Switch,
  Modal,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";
import { ThemedText } from "@/components/ThemedText";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuthContext } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/query-client";
import { Sample, SampleType, PackingType, PRESERVATIVE_TYPES } from "@/types";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

interface SampleCodeOption {
  id: string;
  fullCode: string;
  prefix: string;
  middle: string;
  suffix: string;
}

interface SampleFormProps {
  sample: Partial<Sample>;
  onUpdate: (sample: Partial<Sample>) => void;
  onRemove: () => void;
  index: number;
  officerName: string;
  officerDesignation: string;
  officerId: string;
}

export function SampleForm({
  sample,
  onUpdate,
  onRemove,
  index,
  officerName,
  officerDesignation,
  officerId,
}: SampleFormProps) {
  const { theme } = useTheme();
  const { user } = useAuthContext();
  const [showPreservativeDropdown, setShowPreservativeDropdown] =
    useState(false);
  const [showCodePicker, setShowCodePicker] = useState(false);

  const sampleTypeLabel =
    sample.sampleType === "enforcement"
      ? "Enforcement Sample"
      : "Surveillance Sample";
  const jurisdictionId = user?.jurisdiction?.unitId;

  const { data: availableCodes = [], isLoading: codesLoading } = useQuery<
    SampleCodeOption[]
  >({
    queryKey: [
      "/api/sample-codes/available",
      sample.sampleType,
      jurisdictionId,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (jurisdictionId) params.set("jurisdictionId", jurisdictionId);
      const url = new URL(
        `/api/sample-codes/available/${sample.sampleType}?${params}`,
        getApiUrl(),
      );
      const response = await fetch(url.toString());
      return response.json();
    },
    enabled: showCodePicker,
  });

  const handleSelectCode = (code: SampleCodeOption) => {
    onUpdate({ ...sample, code: code.fullCode });
    setShowCodePicker(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <View
            style={[
              styles.sampleTypeBadge,
              {
                backgroundColor:
                  sample.sampleType === "enforcement"
                    ? theme.accent + "20"
                    : theme.primary + "20",
              },
            ]}
          >
            <ThemedText
              type="small"
              style={{
                color:
                  sample.sampleType === "enforcement"
                    ? theme.accent
                    : theme.primary,
                fontWeight: "600",
              }}
            >
              {sampleTypeLabel}
            </ThemedText>
          </View>
          <ThemedText type="h4">Sample {index + 1}</ThemedText>
        </View>
        <Pressable onPress={onRemove} style={styles.removeButton}>
          <Feather name="trash-2" size={18} color={theme.accent} />
        </Pressable>
      </View>

      <Input
        label="Sample Name"
        placeholder="e.g., Cooking Oil, Milk, Spices"
        value={sample.name || ""}
        onChangeText={(text) => onUpdate({ ...sample, name: text })}
      />

      <View style={styles.codePickerContainer}>
        <ThemedText
          type="small"
          style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}
        >
          Sample Code
        </ThemedText>
        <Pressable
          onPress={() => {
            setShowCodePicker(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={[
            styles.codePickerButton,
            {
              backgroundColor: theme.backgroundSecondary,
              borderColor: sample.code ? theme.primary : theme.border,
            },
          ]}
        >
          {sample.code ? (
            <ThemedText
              type="body"
              style={{
                fontFamily: "monospace",
                letterSpacing: 2,
                color: theme.primary,
                fontWeight: "600",
              }}
            >
              {sample.code}
            </ThemedText>
          ) : (
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Select from Code Bank
            </ThemedText>
          )}
          <Feather
            name="database"
            size={18}
            color={sample.code ? theme.primary : theme.textSecondary}
          />
        </Pressable>
      </View>

      <Input
        label="Place of Sample Collection"
        placeholder="e.g., Kitchen Store Room, Display Counter"
        value={sample.liftedPlace || ""}
        onChangeText={(text) => onUpdate({ ...sample, liftedPlace: text })}
      />

      <View style={styles.autoFieldsContainer}>
        <View style={styles.autoField}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Date of Collection
          </ThemedText>
          <ThemedText>
            {new Date(sample.liftedDate || new Date()).toLocaleDateString(
              "en-IN",
            )}
          </ThemedText>
        </View>
        <View style={styles.autoField}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Collecting Officer
          </ThemedText>
          <ThemedText>{officerName}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {officerDesignation}
          </ThemedText>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <Input
            label="Sample Cost (Rs.)"
            placeholder="0.00"
            value={sample.cost?.toString() || ""}
            onChangeText={(text) =>
              onUpdate({ ...sample, cost: parseFloat(text) || 0 })
            }
            keyboardType="numeric"
          />
        </View>
        <View style={styles.halfInput}>
          <Input
            label="Quantity (grams)"
            placeholder="500"
            value={sample.quantityInGrams?.toString() || ""}
            onChangeText={(text) =>
              onUpdate({ ...sample, quantityInGrams: parseFloat(text) || 0 })
            }
            keyboardType="numeric"
          />
        </View>
      </View>

      <View style={[styles.switchRow, { borderColor: theme.border }]}>
        <ThemedText>Preservative Added?</ThemedText>
        <Switch
          value={sample.preservativeAdded || false}
          onValueChange={(value) =>
            onUpdate({
              ...sample,
              preservativeAdded: value,
              preservativeType: value ? sample.preservativeType : undefined,
            })
          }
          trackColor={{ false: theme.border, true: theme.primary }}
          thumbColor="#FFFFFF"
        />
      </View>

      {sample.preservativeAdded ? (
        <View style={styles.dropdownContainer}>
          <ThemedText
            type="small"
            style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}
          >
            Select Preservative
          </ThemedText>
          <Pressable
            onPress={() =>
              setShowPreservativeDropdown(!showPreservativeDropdown)
            }
            style={[
              styles.dropdown,
              {
                backgroundColor: theme.backgroundSecondary,
                borderColor: theme.border,
              },
            ]}
          >
            <ThemedText>
              {sample.preservativeType || "Select preservative"}
            </ThemedText>
            <Feather
              name={showPreservativeDropdown ? "chevron-up" : "chevron-down"}
              size={18}
              color={theme.textSecondary}
            />
          </Pressable>
          {showPreservativeDropdown ? (
            <View
              style={[
                styles.dropdownMenu,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                },
              ]}
            >
              {PRESERVATIVE_TYPES.map((type) => (
                <Pressable
                  key={type}
                  onPress={() => {
                    onUpdate({ ...sample, preservativeType: type });
                    setShowPreservativeDropdown(false);
                    Haptics.selectionAsync();
                  }}
                  style={[
                    styles.dropdownItem,
                    type === sample.preservativeType && {
                      backgroundColor: theme.primary + "15",
                    },
                  ]}
                >
                  <ThemedText
                    style={
                      type === sample.preservativeType
                        ? { color: theme.primary, fontWeight: "600" }
                        : undefined
                    }
                  >
                    {type}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.packingTypeContainer}>
        <ThemedText
          type="small"
          style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}
        >
          Sample Packing
        </ThemedText>
        <View style={styles.packingButtons}>
          <Pressable
            onPress={() => {
              onUpdate({ ...sample, packingType: "packed" });
              Haptics.selectionAsync();
            }}
            style={[
              styles.packingButton,
              {
                borderColor:
                  sample.packingType === "packed"
                    ? theme.primary
                    : theme.border,
              },
              sample.packingType === "packed" && {
                backgroundColor: theme.primary + "15",
              },
            ]}
          >
            <Feather
              name="package"
              size={18}
              color={
                sample.packingType === "packed"
                  ? theme.primary
                  : theme.textSecondary
              }
            />
            <ThemedText
              style={
                sample.packingType === "packed"
                  ? { color: theme.primary, fontWeight: "600" }
                  : undefined
              }
            >
              Packed
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => {
              onUpdate({ ...sample, packingType: "loose" });
              Haptics.selectionAsync();
            }}
            style={[
              styles.packingButton,
              {
                borderColor:
                  sample.packingType === "loose" ? theme.primary : theme.border,
              },
              sample.packingType === "loose" && {
                backgroundColor: theme.primary + "15",
              },
            ]}
          >
            <Feather
              name="box"
              size={18}
              color={
                sample.packingType === "loose"
                  ? theme.primary
                  : theme.textSecondary
              }
            />
            <ThemedText
              style={
                sample.packingType === "loose"
                  ? { color: theme.primary, fontWeight: "600" }
                  : undefined
              }
            >
              Loose
            </ThemedText>
          </Pressable>
        </View>
      </View>

      {sample.packingType === "packed" ? (
        <View
          style={[styles.packedDetailsSection, { borderColor: theme.border }]}
        >
          <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
            Packed Product Details
          </ThemedText>

          <ThemedText
            type="small"
            style={{
              color: theme.textSecondary,
              fontWeight: "600",
              marginBottom: Spacing.xs,
            }}
          >
            Manufacturer Details
          </ThemedText>
          <Input
            label="Manufacturer Name"
            placeholder="Enter manufacturer name"
            value={sample.manufacturerDetails?.name || ""}
            onChangeText={(text) =>
              onUpdate({
                ...sample,
                manufacturerDetails: {
                  ...sample.manufacturerDetails,
                  name: text,
                  address: sample.manufacturerDetails?.address || "",
                  licenseNumber: sample.manufacturerDetails?.licenseNumber,
                },
              })
            }
          />
          <Input
            label="Manufacturer Address"
            placeholder="Enter manufacturer address"
            value={sample.manufacturerDetails?.address || ""}
            onChangeText={(text) =>
              onUpdate({
                ...sample,
                manufacturerDetails: {
                  ...sample.manufacturerDetails,
                  name: sample.manufacturerDetails?.name || "",
                  address: text,
                  licenseNumber: sample.manufacturerDetails?.licenseNumber,
                },
              })
            }
            multiline
          />
          <Input
            label="License Number (Optional)"
            placeholder="FSSAI License Number"
            value={sample.manufacturerDetails?.licenseNumber || ""}
            onChangeText={(text) =>
              onUpdate({
                ...sample,
                manufacturerDetails: {
                  ...sample.manufacturerDetails,
                  name: sample.manufacturerDetails?.name || "",
                  address: sample.manufacturerDetails?.address || "",
                  licenseNumber: text,
                },
              })
            }
          />

          <View style={styles.divider} />

          <ThemedText
            type="small"
            style={{
              color: theme.textSecondary,
              fontWeight: "600",
              marginBottom: Spacing.xs,
            }}
          >
            Distributor Details (Optional)
          </ThemedText>
          <Input
            label="Distributor Name"
            placeholder="Enter distributor name"
            value={sample.distributorDetails?.name || ""}
            onChangeText={(text) =>
              onUpdate({
                ...sample,
                distributorDetails: {
                  ...sample.distributorDetails,
                  name: text,
                  address: sample.distributorDetails?.address || "",
                },
              })
            }
          />
          <Input
            label="Distributor Address"
            placeholder="Enter distributor address"
            value={sample.distributorDetails?.address || ""}
            onChangeText={(text) =>
              onUpdate({
                ...sample,
                distributorDetails: {
                  ...sample.distributorDetails,
                  name: sample.distributorDetails?.name || "",
                  address: text,
                },
              })
            }
            multiline
          />

          <View style={styles.divider} />

          <ThemedText
            type="small"
            style={{
              color: theme.textSecondary,
              fontWeight: "600",
              marginBottom: Spacing.xs,
            }}
          >
            Repacker Details (Optional)
          </ThemedText>
          <Input
            label="Repacker Name"
            placeholder="Enter repacker name"
            value={sample.repackerDetails?.name || ""}
            onChangeText={(text) =>
              onUpdate({
                ...sample,
                repackerDetails: {
                  ...sample.repackerDetails,
                  name: text,
                  address: sample.repackerDetails?.address || "",
                },
              })
            }
          />
          <Input
            label="Repacker Address"
            placeholder="Enter repacker address"
            value={sample.repackerDetails?.address || ""}
            onChangeText={(text) =>
              onUpdate({
                ...sample,
                repackerDetails: {
                  ...sample.repackerDetails,
                  name: sample.repackerDetails?.name || "",
                  address: text,
                },
              })
            }
            multiline
          />

          <View style={styles.divider} />

          <ThemedText
            type="small"
            style={{
              color: theme.textSecondary,
              fontWeight: "600",
              marginBottom: Spacing.xs,
            }}
          >
            Relabeller Details (Optional)
          </ThemedText>
          <Input
            label="Relabeller Name"
            placeholder="Enter relabeller name"
            value={sample.relabellerDetails?.name || ""}
            onChangeText={(text) =>
              onUpdate({
                ...sample,
                relabellerDetails: {
                  ...sample.relabellerDetails,
                  name: text,
                  address: sample.relabellerDetails?.address || "",
                },
              })
            }
          />
          <Input
            label="Relabeller Address"
            placeholder="Enter relabeller address"
            value={sample.relabellerDetails?.address || ""}
            onChangeText={(text) =>
              onUpdate({
                ...sample,
                relabellerDetails: {
                  ...sample.relabellerDetails,
                  name: sample.relabellerDetails?.name || "",
                  address: text,
                },
              })
            }
            multiline
          />

          <View style={styles.divider} />

          <ThemedText
            type="small"
            style={{
              color: theme.textSecondary,
              fontWeight: "600",
              marginBottom: Spacing.xs,
            }}
          >
            Product Information
          </ThemedText>
          <View style={styles.row}>
            <View style={styles.halfInput}>
              <Input
                label="Mfg. Date"
                placeholder="DD/MM/YYYY"
                value={sample.mfgDate || ""}
                onChangeText={(text) => onUpdate({ ...sample, mfgDate: text })}
              />
            </View>
            <View style={styles.halfInput}>
              <Input
                label="Use By/Expiry Date"
                placeholder="DD/MM/YYYY"
                value={sample.useByDate || ""}
                onChangeText={(text) =>
                  onUpdate({ ...sample, useByDate: text })
                }
              />
            </View>
          </View>
          <Input
            label="Lot/Batch Number"
            placeholder="Enter batch or lot number"
            value={sample.lotBatchNumber || ""}
            onChangeText={(text) =>
              onUpdate({ ...sample, lotBatchNumber: text })
            }
          />
        </View>
      ) : null}

      <Input
        label="Remarks (Optional)"
        placeholder="Any additional notes about the sample"
        value={sample.remarks || ""}
        onChangeText={(text) => onUpdate({ ...sample, remarks: text })}
        multiline
      />

      {/* Code Picker Modal */}
      <Modal
        visible={showCodePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCodePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <View style={styles.modalHeader}>
              <ThemedText type="h3">Select Sample Code</ThemedText>
              <Pressable onPress={() => setShowCodePicker(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <View
              style={[
                styles.codeTypeBadge,
                {
                  backgroundColor:
                    sample.sampleType === "enforcement"
                      ? theme.accent + "15"
                      : theme.success + "15",
                },
              ]}
            >
              <ThemedText
                type="small"
                style={{
                  color:
                    sample.sampleType === "enforcement"
                      ? theme.accent
                      : theme.success,
                  fontWeight: "600",
                }}
              >
                {sampleTypeLabel} Codes
              </ThemedText>
            </View>

            {codesLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
              </View>
            ) : availableCodes.length > 0 ? (
              <FlatList
                data={availableCodes}
                keyExtractor={(item) => item.id}
                style={styles.codeList}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => handleSelectCode(item)}
                    style={[styles.codeOption, { borderColor: theme.border }]}
                  >
                    <ThemedText
                      type="body"
                      style={{ fontFamily: "monospace", letterSpacing: 2 }}
                    >
                      {item.fullCode}
                    </ThemedText>
                    <Feather
                      name="check-circle"
                      size={18}
                      color={theme.success}
                    />
                  </Pressable>
                )}
              />
            ) : (
              <View style={styles.emptyCodesState}>
                <Feather name="inbox" size={40} color={theme.textSecondary} />
                <ThemedText
                  type="body"
                  style={{
                    color: theme.textSecondary,
                    textAlign: "center",
                    marginTop: Spacing.md,
                  }}
                >
                  No available codes for {sampleTypeLabel.toLowerCase()}.
                </ThemedText>
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, textAlign: "center" }}
                >
                  Go to Profile → Sample Code Bank to generate codes.
                </ThemedText>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerTitle: {
    gap: Spacing.xs,
  },
  sampleTypeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    alignSelf: "flex-start",
  },
  removeButton: {
    padding: Spacing.sm,
  },
  autoFieldsContainer: {
    flexDirection: "row",
    gap: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  autoField: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  dropdownContainer: {
    zIndex: 100,
  },
  dropdown: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: 48,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  dropdownMenu: {
    position: "absolute",
    top: 72,
    left: 0,
    right: 0,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    zIndex: 100,
    maxHeight: 200,
  },
  dropdownItem: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  packingTypeContainer: {
    marginTop: Spacing.sm,
  },
  packingButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  packingButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  packedDetailsSection: {
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E5E5",
    marginVertical: Spacing.md,
  },
  codePickerContainer: {
    marginBottom: Spacing.sm,
  },
  codePickerButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: 48,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
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
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  codeTypeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  loadingContainer: {
    padding: Spacing["2xl"],
    alignItems: "center",
  },
  codeList: {
    maxHeight: 300,
  },
  codeOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
  },
  emptyCodesState: {
    alignItems: "center",
    padding: Spacing["2xl"],
  },
});
