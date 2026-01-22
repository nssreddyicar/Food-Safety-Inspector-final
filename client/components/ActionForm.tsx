import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  Modal,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { Input } from "@/components/Input";
import { useTheme } from "@/hooks/useTheme";
import { ActionTaken, ACTION_TYPES } from "@/types";
import { Spacing, BorderRadius } from "@/constants/theme";

interface ActionFormProps {
  action: Partial<ActionTaken>;
  onUpdate: (action: Partial<ActionTaken>) => void;
  onRemove: () => void;
  index: number;
}

export function ActionForm({
  action,
  onUpdate,
  onRemove,
  index,
}: ActionFormProps) {
  const { theme } = useTheme();
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleImagePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 5,
    });

    if (!result.canceled && result.assets.length > 0) {
      const newImages = result.assets.map((asset) => asset.uri);
      const existingImages = action.images || [];
      onUpdate({
        ...action,
        images: [...existingImages, ...newImages].slice(0, 5),
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleRemoveImage = (imageIndex: number) => {
    const images = action.images || [];
    const newImages = images.filter((_, i) => i !== imageIndex);
    onUpdate({ ...action, images: newImages });
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
        <ThemedText type="h4">Action {index + 1}</ThemedText>
        <Pressable onPress={onRemove} style={styles.removeButton}>
          <Feather name="trash-2" size={18} color={theme.accent} />
        </Pressable>
      </View>

      <View style={styles.dropdownContainer}>
        <ThemedText
          type="small"
          style={{ color: theme.textSecondary, marginBottom: Spacing.xs }}
        >
          Action Type
        </ThemedText>
        <Pressable
          onPress={() => setShowTypeDropdown(!showTypeDropdown)}
          style={[
            styles.dropdown,
            {
              backgroundColor: theme.backgroundSecondary,
              borderColor: theme.border,
            },
          ]}
        >
          <ThemedText>{action.actionType || "Select action type"}</ThemedText>
          <Feather
            name={showTypeDropdown ? "chevron-up" : "chevron-down"}
            size={18}
            color={theme.textSecondary}
          />
        </Pressable>
        {showTypeDropdown ? (
          <View
            style={[
              styles.dropdownMenu,
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: theme.border,
              },
            ]}
          >
            <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
              {ACTION_TYPES.map((type) => (
                <Pressable
                  key={type}
                  onPress={() => {
                    onUpdate({ ...action, actionType: type });
                    setShowTypeDropdown(false);
                    Haptics.selectionAsync();
                  }}
                  style={[
                    styles.dropdownItem,
                    type === action.actionType && {
                      backgroundColor: theme.primary + "15",
                    },
                  ]}
                >
                  <ThemedText
                    style={
                      type === action.actionType
                        ? { color: theme.primary, fontWeight: "600" }
                        : undefined
                    }
                  >
                    {type}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>

      <Input
        label="Description"
        placeholder="Describe the action taken in detail..."
        value={action.description || ""}
        onChangeText={(text) => onUpdate({ ...action, description: text })}
        multiline
        numberOfLines={4}
      />

      <Input
        label="Countdown/Due Date (Optional)"
        placeholder="DD/MM/YYYY"
        value={action.countdownDate || ""}
        onChangeText={(text) => onUpdate({ ...action, countdownDate: text })}
      />

      <Input
        label="Remarks (Optional)"
        placeholder="Any additional remarks"
        value={action.remarks || ""}
        onChangeText={(text) => onUpdate({ ...action, remarks: text })}
        multiline
      />

      <View style={styles.imagesSection}>
        <View style={styles.imageHeader}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Supporting Images (Max 5)
          </ThemedText>
          <Pressable
            onPress={handleImagePick}
            style={[styles.addImageButton, { borderColor: theme.primary }]}
          >
            <Feather name="camera" size={16} color={theme.primary} />
            <ThemedText type="small" style={{ color: theme.primary }}>
              Add Photo
            </ThemedText>
          </Pressable>
        </View>

        {(action.images?.length || 0) > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.imagesList}
          >
            {action.images?.map((image, imageIndex) => (
              <View key={imageIndex} style={styles.imageWrapper}>
                <Image source={{ uri: image }} style={styles.thumbnailImage} />
                <Pressable
                  onPress={() => handleRemoveImage(imageIndex)}
                  style={[
                    styles.removeImageButton,
                    { backgroundColor: theme.accent },
                  ]}
                >
                  <Feather name="x" size={10} color="#FFFFFF" />
                </Pressable>
                <Pressable
                  onPress={() => setPreviewImage(image)}
                  style={[styles.eyeButton, { backgroundColor: theme.primary }]}
                >
                  <Feather name="eye" size={10} color="#FFFFFF" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={[styles.noImages, { borderColor: theme.border }]}>
            <Feather name="image" size={24} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              No images added
            </ThemedText>
          </View>
        )}
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
    overflow: "hidden",
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  imagesSection: {
    gap: Spacing.sm,
  },
  imageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  addImageButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  imagesList: {
    flexDirection: "row",
  },
  imageWrapper: {
    marginRight: Spacing.sm,
    position: "relative",
  },
  thumbnailImage: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
  },
  removeImageButton: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  eyeButton: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  noImages: {
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
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
