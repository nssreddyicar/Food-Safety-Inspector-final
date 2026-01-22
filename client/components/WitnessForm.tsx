import React, { useState } from "react";
import { View, StyleSheet, Pressable, Image, Modal } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { Input } from "@/components/Input";
import { useTheme } from "@/hooks/useTheme";
import { Witness } from "@/types";
import { Spacing, BorderRadius } from "@/constants/theme";

interface WitnessFormProps {
  witness: Partial<Witness>;
  onUpdate: (witness: Partial<Witness>) => void;
  onRemove: () => void;
  index: number;
}

export function WitnessForm({
  witness,
  onUpdate,
  onRemove,
  index,
}: WitnessFormProps) {
  const { theme } = useTheme();
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleAadhaarImagePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      onUpdate({ ...witness, aadhaarImage: result.assets[0].uri });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleSignaturePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      onUpdate({ ...witness, signature: result.assets[0].uri });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
      ]}
    >
      <View style={styles.header}>
        <ThemedText type="h4">Witness {index + 1}</ThemedText>
        <Pressable onPress={onRemove} style={styles.removeButton}>
          <Feather name="trash-2" size={18} color={theme.accent} />
        </Pressable>
      </View>

      <Input
        label="Witness Name"
        placeholder="Enter full name"
        value={witness.name || ""}
        onChangeText={(text) => onUpdate({ ...witness, name: text })}
      />

      <View style={styles.row}>
        <View style={styles.flexTwo}>
          <Input
            label="S/o, D/o, W/o"
            placeholder="Son of / Daughter of / Wife of"
            value={witness.sonOfName || ""}
            onChangeText={(text) => onUpdate({ ...witness, sonOfName: text })}
          />
        </View>
        <View style={styles.flexOne}>
          <Input
            label="Age (Years)"
            placeholder="Age"
            value={witness.age?.toString() || ""}
            onChangeText={(text) =>
              onUpdate({ ...witness, age: text ? parseInt(text) : undefined })
            }
            keyboardType="numeric"
          />
        </View>
      </View>

      <Input
        label="Address"
        placeholder="Enter complete address"
        value={witness.address || ""}
        onChangeText={(text) => onUpdate({ ...witness, address: text })}
        multiline
      />

      <Input
        label="Phone Number"
        placeholder="Enter phone number"
        value={witness.phone || ""}
        onChangeText={(text) => onUpdate({ ...witness, phone: text })}
        keyboardType="phone-pad"
      />

      <Input
        label="Aadhaar Number (Optional)"
        placeholder="XXXX XXXX XXXX"
        value={witness.aadhaarNumber || ""}
        onChangeText={(text) => onUpdate({ ...witness, aadhaarNumber: text })}
        keyboardType="numeric"
      />

      <View style={styles.imageRow}>
        <View style={styles.imageContainer}>
          <ThemedText
            type="small"
            style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}
          >
            Aadhaar Image (Optional)
          </ThemedText>
          <View style={styles.imageUploadRow}>
            {witness.aadhaarImage ? (
              <>
                <View style={styles.thumbnailWrapper}>
                  <Image
                    source={{ uri: witness.aadhaarImage }}
                    style={styles.thumbnailImage}
                  />
                  <Pressable
                    onPress={() =>
                      onUpdate({ ...witness, aadhaarImage: undefined })
                    }
                    style={[
                      styles.removeThumbBtn,
                      { backgroundColor: theme.accent },
                    ]}
                  >
                    <Feather name="x" size={10} color="#fff" />
                  </Pressable>
                </View>
                <Pressable
                  onPress={() => setPreviewImage(witness.aadhaarImage || null)}
                  style={[styles.eyeBtn, { backgroundColor: theme.primary }]}
                >
                  <Feather name="eye" size={14} color="#fff" />
                </Pressable>
              </>
            ) : null}
            <Pressable
              onPress={handleAadhaarImagePick}
              style={[
                styles.uploadBtn,
                {
                  borderColor: theme.primary,
                  backgroundColor: theme.primary + "10",
                },
              ]}
            >
              <Feather name="image" size={16} color={theme.primary} />
            </Pressable>
          </View>
        </View>

        <View style={styles.imageContainer}>
          <ThemedText
            type="small"
            style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}
          >
            Signature (Optional)
          </ThemedText>
          <View style={styles.imageUploadRow}>
            {witness.signature ? (
              <>
                <View style={styles.thumbnailWrapper}>
                  <Image
                    source={{ uri: witness.signature }}
                    style={styles.thumbnailImage}
                  />
                  <Pressable
                    onPress={() =>
                      onUpdate({ ...witness, signature: undefined })
                    }
                    style={[
                      styles.removeThumbBtn,
                      { backgroundColor: theme.accent },
                    ]}
                  >
                    <Feather name="x" size={10} color="#fff" />
                  </Pressable>
                </View>
                <Pressable
                  onPress={() => setPreviewImage(witness.signature || null)}
                  style={[styles.eyeBtn, { backgroundColor: theme.primary }]}
                >
                  <Feather name="eye" size={14} color="#fff" />
                </Pressable>
              </>
            ) : null}
            <Pressable
              onPress={handleSignaturePick}
              style={[
                styles.uploadBtn,
                {
                  borderColor: theme.primary,
                  backgroundColor: theme.primary + "10",
                },
              ]}
            >
              <Feather name="edit-3" size={16} color={theme.primary} />
            </Pressable>
          </View>
        </View>
      </View>

      <Modal
        visible={!!previewImage}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setPreviewImage(null)}
      >
        <View style={styles.previewModal}>
          <Pressable
            style={styles.previewBackdrop}
            onPress={() => setPreviewImage(null)}
          />
          <View style={styles.previewContent}>
            {previewImage ? (
              <Image
                source={{ uri: previewImage }}
                style={styles.previewFullImage}
                resizeMode="contain"
              />
            ) : null}
            <Pressable
              style={styles.previewCloseBtn}
              onPress={() => setPreviewImage(null)}
            >
              <Feather name="x" size={24} color="#fff" />
            </Pressable>
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
    alignItems: "center",
  },
  removeButton: {
    padding: Spacing.sm,
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
  imageRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  imageContainer: {
    flex: 1,
  },
  imageUploadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  thumbnailWrapper: {
    position: "relative",
  },
  thumbnailImage: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
  },
  removeThumbBtn: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  eyeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  previewModal: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  previewContent: {
    width: "90%",
    height: "80%",
    alignItems: "center",
    justifyContent: "center",
  },
  previewFullImage: {
    width: "100%",
    height: "100%",
    borderRadius: BorderRadius.lg,
  },
  previewCloseBtn: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
});
