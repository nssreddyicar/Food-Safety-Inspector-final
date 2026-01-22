import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Linking,
  Alert,
} from "react-native";
import {
  CameraView,
  useCameraPermissions,
  BarcodeScanningResult,
  CameraType,
  scanFromURLAsync,
} from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";
import { ScannerStackParamList } from "@/navigation/ScannerStackNavigator";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

interface ScannedNote {
  id: string;
  data: string;
  type: string;
  heading: string;
  scannedAt: string;
}

const NOTES_STORAGE_KEY = "@scanned_notes";

const SCAN_FRAME_SIZE = 280;

export default function ScannerScreen() {
  const { theme } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<ScannerStackParamList>>();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastScannedType, setLastScannedType] = useState("");
  const [cameraFacing, setCameraFacing] = useState<CameraType>("back");
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  const scanLinePosition = useSharedValue(0);

  useEffect(() => {
    scanLinePosition.value = withRepeat(
      withSequence(
        withTiming(SCAN_FRAME_SIZE - 4, {
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [scanLinePosition]);

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLinePosition.value }],
  }));

  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    if (scanned) return;
    setScanned(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (_e) {
      // Haptics not available on all platforms
    }

    // Auto-save the scanned data
    try {
      const existingNotes = await AsyncStorage.getItem(NOTES_STORAGE_KEY);
      const notes: ScannedNote[] = existingNotes
        ? JSON.parse(existingNotes)
        : [];

      // Generate auto heading based on type and count
      const todayScans = notes.filter((n) => {
        const noteDate = new Date(n.scannedAt).toDateString();
        return noteDate === new Date().toDateString();
      });
      const scanNumber = todayScans.length + 1;
      const typeLabel = result.type.toLowerCase().includes("qr")
        ? "QR Code"
        : "Barcode";

      const newNote: ScannedNote = {
        id: Date.now().toString(),
        data: result.data,
        type: result.type,
        heading: `${typeLabel} #${scanNumber}`,
        scannedAt: new Date().toISOString(),
      };

      notes.unshift(newNote);
      await AsyncStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));

      setLastScannedType(typeLabel);
      setShowSuccess(true);

      // Hide success message after 2 seconds and allow new scan
      setTimeout(() => {
        setShowSuccess(false);
        setScanned(false);
      }, 2000);
    } catch (error) {
      console.error("Error saving note:", error);
      setScanned(false);
    }
  };

  const toggleCamera = () => {
    if (Platform.OS === "web") {
      Alert.alert(
        "Feature Unavailable",
        "Camera switching works best in the Expo Go app on your mobile device.",
      );
      return;
    }
    setCameraFacing((current) => (current === "back" ? "front" : "back"));
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_e) {
      // Haptics not available on all platforms
    }
  };

  const pickImageFromGallery = async () => {
    if (isProcessingImage) return;

    // Gallery scanning works best on native platforms
    if (Platform.OS === "web") {
      Alert.alert(
        "Feature Unavailable",
        "Gallery scanning works best in the Expo Go app. Please use your phone to scan images from gallery.",
      );
      return;
    }

    setIsProcessingImage(true);

    try {
      // Request media library permissions first
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Please grant access to your photo library to select images.",
        );
        setIsProcessingImage(false);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;

        try {
          // Use the correct barcode type format for scanFromURLAsync
          const scanResults = await scanFromURLAsync(imageUri, [
            "qr",
            "ean13",
            "ean8",
            "code39",
            "code93",
            "code128",
            "codabar",
            "itf14",
            "upc_e",
            "upc_a",
            "pdf417",
            "aztec",
            "datamatrix",
          ]);

          if (scanResults && scanResults.length > 0) {
            const scannedResult = scanResults[0];
            try {
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
            } catch (e) {
              // Haptics not available on all platforms
            }

            // Save the scanned data
            const existingNotes = await AsyncStorage.getItem(NOTES_STORAGE_KEY);
            const notes: ScannedNote[] = existingNotes
              ? JSON.parse(existingNotes)
              : [];

            const todayScans = notes.filter((n) => {
              const noteDate = new Date(n.scannedAt).toDateString();
              return noteDate === new Date().toDateString();
            });
            const scanNumber = todayScans.length + 1;
            const typeLabel = scannedResult.type.toLowerCase().includes("qr")
              ? "QR Code"
              : "Barcode";

            const newNote: ScannedNote = {
              id: Date.now().toString(),
              data: scannedResult.data,
              type: scannedResult.type,
              heading: `${typeLabel} #${scanNumber} (Gallery)`,
              scannedAt: new Date().toISOString(),
            };

            notes.unshift(newNote);
            await AsyncStorage.setItem(
              NOTES_STORAGE_KEY,
              JSON.stringify(notes),
            );

            setLastScannedType(typeLabel);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);
          } else {
            Alert.alert(
              "No Code Found",
              "No QR code or barcode was detected in the selected image. Make sure the image contains a clear, readable code.",
            );
          }
        } catch (scanError: any) {
          console.error("Error scanning image:", scanError);
          // Check if scanFromURLAsync is not available
          if (
            scanError?.message?.includes("not a function") ||
            scanError?.message?.includes("undefined")
          ) {
            Alert.alert(
              "Feature Not Available",
              "Gallery scanning requires Expo Go app on your mobile device. This feature may not work on all platforms.",
            );
          } else {
            Alert.alert(
              "Scan Error",
              "Could not scan the selected image. Make sure the image contains a clear QR code or barcode and try again.",
            );
          }
        }
      }
    } catch (error: any) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to access the image gallery.");
    } finally {
      setIsProcessingImage(false);
    }
  };

  if (!permission) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      >
        <Text style={[styles.message, { color: theme.text }]}>
          Loading camera...
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: theme.backgroundRoot, paddingTop: insets.top },
        ]}
      >
        <View style={styles.permissionCard}>
          <Feather name="camera-off" size={64} color={Colors.light.primary} />
          <Text style={[styles.permissionTitle, { color: theme.text }]}>
            Camera Access Required
          </Text>
          <Text style={[styles.permissionText, { color: theme.textSecondary }]}>
            To scan QR codes and barcodes, please grant camera access.
          </Text>
          {permission.status === "denied" && !permission.canAskAgain ? (
            Platform.OS !== "web" ? (
              <Pressable
                style={[
                  styles.permissionButton,
                  { backgroundColor: Colors.light.primary },
                ]}
                onPress={async () => {
                  try {
                    await Linking.openSettings();
                  } catch {
                    console.error("Cannot open settings");
                  }
                }}
              >
                <Text style={styles.permissionButtonText}>Open Settings</Text>
              </Pressable>
            ) : (
              <Text style={[styles.webMessage, { color: theme.textSecondary }]}>
                Run in Expo Go to use this feature
              </Text>
            )
          ) : (
            <Pressable
              style={[
                styles.permissionButton,
                { backgroundColor: Colors.light.primary },
              ]}
              onPress={requestPermission}
            >
              <Text style={styles.permissionButtonText}>Enable Camera</Text>
            </Pressable>
          )}
          <View style={styles.permissionLinks}>
            <Pressable
              style={styles.permissionLinkButton}
              onPress={pickImageFromGallery}
              disabled={isProcessingImage}
            >
              <View
                style={[
                  styles.permissionLinkIcon,
                  { backgroundColor: Colors.light.primary + "15" },
                ]}
              >
                <Feather name="image" size={20} color={Colors.light.primary} />
              </View>
              <Text
                style={[
                  styles.permissionLinkText,
                  { color: Colors.light.primary },
                ]}
              >
                Pick from Gallery
              </Text>
            </Pressable>

            <Pressable
              style={styles.permissionLinkButton}
              onPress={() => navigation.navigate("ScannedNotes")}
              testID="view-scanned-notes"
            >
              <View
                style={[
                  styles.permissionLinkIcon,
                  { backgroundColor: Colors.light.primary + "15" },
                ]}
              >
                <Feather
                  name="file-text"
                  size={20}
                  color={Colors.light.primary}
                />
              </View>
              <Text
                style={[
                  styles.permissionLinkText,
                  { color: Colors.light.primary },
                ]}
              >
                View Saved Notes
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // Web platform notice for limited camera support
  if (Platform.OS === "web") {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: theme.backgroundRoot, paddingTop: insets.top },
        ]}
      >
        <View style={styles.permissionCard}>
          <Feather name="smartphone" size={64} color={Colors.light.primary} />
          <Text style={[styles.permissionTitle, { color: theme.text }]}>
            Use Expo Go App
          </Text>
          <Text style={[styles.permissionText, { color: theme.textSecondary }]}>
            For the best scanning experience with camera, flash, and gallery
            features, please use the Expo Go app on your mobile device.
          </Text>
          <Text style={[styles.webHint, { color: theme.textSecondary }]}>
            Scan the QR code from the development server to open in Expo Go.
          </Text>
          <View style={styles.permissionLinks}>
            <Pressable
              style={styles.permissionLinkButton}
              onPress={() => navigation.navigate("ScannedNotes")}
              testID="view-scanned-notes-web"
            >
              <View
                style={[
                  styles.permissionLinkIcon,
                  { backgroundColor: Colors.light.primary + "15" },
                ]}
              >
                <Feather
                  name="file-text"
                  size={20}
                  color={Colors.light.primary}
                />
              </View>
              <Text
                style={[
                  styles.permissionLinkText,
                  { color: Colors.light.primary },
                ]}
              >
                View Saved Notes
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: "#000" }]}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing={cameraFacing}
        enableTorch={flashEnabled && cameraFacing === "back"}
        barcodeScannerSettings={{
          barcodeTypes: [
            "qr",
            "ean13",
            "ean8",
            "upc_a",
            "upc_e",
            "code39",
            "code93",
            "code128",
            "codabar",
            "itf14",
            "pdf417",
            "aztec",
            "datamatrix",
          ],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      <View style={[styles.overlay, { paddingTop: insets.top + Spacing.lg }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Scan Code</Text>
          <View style={styles.headerButtons}>
            <Pressable
              style={styles.notesButton}
              onPress={() => navigation.navigate("ScannedNotes")}
            >
              <Feather name="file-text" size={22} color="#fff" />
            </Pressable>
            <Pressable
              style={[
                styles.flashButton,
                flashEnabled && styles.flashButtonActive,
              ]}
              onPress={() => setFlashEnabled(!flashEnabled)}
            >
              <Feather
                name={flashEnabled ? "zap" : "zap-off"}
                size={24}
                color="#fff"
              />
            </Pressable>
          </View>
        </View>

        <View style={styles.scanArea}>
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            {!scanned && (
              <Animated.View style={[styles.scanLine, scanLineStyle]}>
                <View style={styles.scanLineGradient} />
              </Animated.View>
            )}
          </View>
          <Text style={styles.scanHint}>
            Position QR code or barcode within the frame
          </Text>
        </View>

        <View
          style={[
            styles.bottomInfo,
            { paddingBottom: tabBarHeight + Spacing.lg },
          ]}
        >
          {showSuccess ? (
            <View style={styles.successToast}>
              <Feather
                name="check-circle"
                size={20}
                color={Colors.light.success}
              />
              <Text style={styles.successText}>{lastScannedType} saved!</Text>
            </View>
          ) : (
            <View style={styles.supportedCodes}>
              <Feather name="check-circle" size={16} color="#fff" />
              <Text style={styles.supportedText}>
                QR, EAN, UPC, Code128, PDF417 & more
              </Text>
            </View>
          )}

          <View style={styles.bottomButtons}>
            <Pressable
              style={styles.bottomButton}
              onPress={pickImageFromGallery}
              disabled={isProcessingImage}
            >
              <Feather name="image" size={24} color="#fff" />
              <Text style={styles.bottomButtonText}>Gallery</Text>
            </Pressable>

            <Pressable style={styles.bottomButton} onPress={toggleCamera}>
              <Feather name="refresh-cw" size={24} color="#fff" />
              <Text style={styles.bottomButtonText}>
                {cameraFacing === "back" ? "Front" : "Back"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
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
  message: {
    fontSize: 16,
  },
  permissionCard: {
    alignItems: "center",
    padding: Spacing["3xl"],
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  permissionText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  permissionButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing["3xl"],
    borderRadius: BorderRadius.lg,
  },
  permissionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  webMessage: {
    fontSize: 14,
    textAlign: "center",
  },
  webHint: {
    fontSize: 13,
    textAlign: "center",
    marginTop: Spacing.md,
    fontStyle: "italic",
  },
  permissionLinks: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.xl,
    marginTop: Spacing["3xl"],
  },
  permissionLinkButton: {
    alignItems: "center",
    gap: Spacing.sm,
  },
  permissionLinkIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  permissionLinkText: {
    fontSize: 12,
    fontWeight: "500",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  notesButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  flashButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  flashButtonActive: {
    backgroundColor: Colors.light.warning,
  },
  scanArea: {
    alignItems: "center",
  },
  scanFrame: {
    width: SCAN_FRAME_SIZE,
    height: SCAN_FRAME_SIZE,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 40,
    height: 40,
    borderColor: "#fff",
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  scanLine: {
    position: "absolute",
    left: 10,
    right: 10,
    height: 4,
    overflow: "hidden",
  },
  scanLineGradient: {
    flex: 1,
    backgroundColor: Colors.light.primary,
    borderRadius: 2,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 5,
  },
  scanHint: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    marginTop: Spacing.lg,
    textAlign: "center",
  },
  bottomInfo: {
    alignItems: "center",
  },
  supportedCodes: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  supportedText: {
    color: "#fff",
    fontSize: 12,
  },
  successToast: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Colors.light.success,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
  },
  successText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  bottomButtons: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing["3xl"],
    marginTop: Spacing.xl,
  },
  bottomButton: {
    alignItems: "center",
    gap: Spacing.xs,
  },
  bottomButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  scannedInfo: {
    marginBottom: Spacing.lg,
  },
  codeTypeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    alignSelf: "flex-start",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  codeTypeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  scannedDataText: {
    fontSize: 16,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  formGroup: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: 14,
    marginBottom: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 16,
  },
  dateInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  dateText: {
    fontSize: 14,
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  modalButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  saveButton: {},
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
