import React, { useRef, forwardRef, useImperativeHandle } from "react";
import { View, StyleSheet, Alert, Platform, Pressable } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import ViewShot from "react-native-view-shot";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import {
  EvidenceImage,
  ImageMetadata,
  ComplaintInfo,
  generateWatermarkLines,
  generateUniqueId,
} from "@/lib/image-watermark";

const MAX_IMAGES = 3;

interface EvidenceImageCaptureProps {
  images: EvidenceImage[];
  onImagesChange: (images: EvidenceImage[]) => void;
  currentLocation: { latitude: string; longitude: string } | null;
  complaintInfo?: ComplaintInfo;
  disabled?: boolean;
}

export interface EvidenceImageCaptureRef {
  captureWatermarkedImages: () => Promise<string[]>;
}

interface WatermarkedImageViewProps {
  image: EvidenceImage;
  onRemove: () => void;
  viewShotRef: React.RefObject<ViewShot | null>;
  complaintInfo?: ComplaintInfo;
}

function WatermarkedImageView({ image, onRemove, viewShotRef, complaintInfo }: WatermarkedImageViewProps) {
  const { theme } = useTheme();
  const watermarkLines = generateWatermarkLines(image.metadata, complaintInfo);

  return (
    <View style={styles.imageContainer}>
      <ViewShot
        ref={viewShotRef}
        options={{ format: "jpg", quality: 0.9 }}
        style={styles.viewShot}
      >
        <Image source={{ uri: image.uri }} style={styles.image} contentFit="cover" />
        <View style={styles.watermarkContainer}>
          {watermarkLines.map((line, index) => (
            <ThemedText
              key={index}
              style={[
                styles.watermarkText,
                index === 2 ? styles.gpsText : null,
              ]}
            >
              {line}
            </ThemedText>
          ))}
        </View>
      </ViewShot>
      <Pressable
        style={[styles.removeButton, { backgroundColor: "#dc3545" }]}
        onPress={onRemove}
      >
        <Feather name="x" size={16} color="white" />
      </Pressable>
    </View>
  );
}

const EvidenceImageCapture = forwardRef<EvidenceImageCaptureRef, EvidenceImageCaptureProps>(
  ({ images, onImagesChange, currentLocation, complaintInfo, disabled }, ref) => {
    const { theme } = useTheme();
    const viewShotRefs = useRef<(React.RefObject<ViewShot | null>)[]>([]);

    images.forEach((_, index) => {
      if (!viewShotRefs.current[index]) {
        viewShotRefs.current[index] = React.createRef<ViewShot | null>();
      }
    });

    useImperativeHandle(ref, () => ({
      captureWatermarkedImages: async () => {
        const watermarkedUris: string[] = [];
        for (let i = 0; i < images.length; i++) {
          const vsRef = viewShotRefs.current[i];
          if (vsRef?.current?.capture) {
            try {
              const uri = await vsRef.current.capture();
              watermarkedUris.push(uri);
            } catch (error) {
              console.error("Failed to capture watermarked image:", error);
              watermarkedUris.push(images[i].uri);
            }
          } else {
            watermarkedUris.push(images[i].uri);
          }
        }
        return watermarkedUris;
      },
    }));

    const handleCaptureImage = async () => {
      if (images.length >= MAX_IMAGES) {
        Alert.alert("Limit Reached", `You can only add up to ${MAX_IMAGES} evidence images.`);
        return;
      }

      if (!currentLocation) {
        Alert.alert(
          "Location Required",
          "Please capture your location first before adding evidence images. This is required to verify the authenticity of the evidence."
        );
        return;
      }

      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Camera Permission Required",
          "Please enable camera access in your device settings to capture evidence images."
        );
        return;
      }

      try {
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: "images",
          allowsEditing: false,
          quality: 0.8,
          exif: true,
        });

        if (result.canceled || !result.assets?.[0]) {
          return;
        }

        const asset = result.assets[0];
        const capturedAt = new Date();
        const uploadedAt = new Date();

        let imageLat = currentLocation.latitude;
        let imageLng = currentLocation.longitude;

        if (asset.exif) {
          if (asset.exif.GPSLatitude && asset.exif.GPSLongitude) {
            imageLat = String(asset.exif.GPSLatitude);
            imageLng = String(asset.exif.GPSLongitude);
          }
          if (asset.exif.DateTimeOriginal) {
            try {
              const exifDate = new Date(asset.exif.DateTimeOriginal.replace(/:/g, "-").replace(" ", "T"));
              if (!isNaN(exifDate.getTime())) {
                capturedAt.setTime(exifDate.getTime());
              }
            } catch {}
          }
        }

        const metadata: ImageMetadata = {
          capturedAt,
          uploadedAt,
          latitude: imageLat,
          longitude: imageLng,
        };

        const newImage: EvidenceImage = {
          id: generateUniqueId(),
          uri: asset.uri,
          metadata,
        };

        onImagesChange([...images, newImage]);
      } catch (error) {
        console.error("Error capturing image:", error);
        Alert.alert("Error", "Failed to capture image. Please try again.");
      }
    };

    const handleRemoveImage = (id: string) => {
      onImagesChange(images.filter((img) => img.id !== id));
    };

    return (
      <Card style={styles.container}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Feather name="camera" size={20} color={theme.primary} />
            <ThemedText type="h4" style={styles.title}>
              Evidence Images
            </ThemedText>
          </View>
          <ThemedText style={styles.subtitle}>
            {images.length}/{MAX_IMAGES} images captured (Camera only)
          </ThemedText>
        </View>

        {images.length > 0 ? (
          <View style={styles.imagesGrid}>
            {images.map((image, index) => (
              <WatermarkedImageView
                key={image.id}
                image={image}
                onRemove={() => handleRemoveImage(image.id)}
                viewShotRef={viewShotRefs.current[index]}
                complaintInfo={complaintInfo}
              />
            ))}
          </View>
        ) : null}

        {images.length < MAX_IMAGES ? (
          <Button
            onPress={handleCaptureImage}
            disabled={disabled || !currentLocation}
            style={styles.captureButton}
          >
            <View style={styles.buttonContent}>
              <Feather name="camera" size={18} color="white" />
              <ThemedText style={styles.buttonText}>
                {currentLocation ? "Capture Evidence Photo" : "Get Location First"}
              </ThemedText>
            </View>
          </Button>
        ) : null}

        <View style={[styles.infoBox, { backgroundColor: theme.primary + "15" }]}>
          <Feather name="shield" size={16} color={theme.primary} />
          <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
            Each image is watermarked with GPS coordinates and timestamps to prevent tampering and ensure authenticity.
          </ThemedText>
        </View>
      </Card>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  header: {
    marginBottom: Spacing.md,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  title: {
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 13,
    opacity: 0.6,
  },
  imagesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  imageContainer: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    marginBottom: Spacing.sm,
    position: "relative",
  },
  viewShot: {
    flex: 1,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  watermarkContainer: {
    position: "absolute",
    bottom: 3,
    right: 3,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    maxWidth: "65%",
  },
  watermarkText: {
    fontFamily: Platform.select({ ios: "Courier", android: "monospace", default: "monospace" }),
    fontSize: 7,
    color: "#ffffff",
    lineHeight: 9,
    textShadowColor: "rgba(0, 0, 0, 0.9)",
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 0.5,
  },
  gpsText: {
    color: "#90EE90",
  },
  removeButton: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  captureButton: {
    marginBottom: Spacing.md,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  buttonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});

export default EvidenceImageCapture;
