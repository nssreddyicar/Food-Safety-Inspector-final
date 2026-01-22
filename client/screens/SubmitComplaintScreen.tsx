import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { generateAcknowledgementHTML, ComplaintAcknowledgementData } from "@/lib/complaint-acknowledgement-template";
import EvidenceImageCapture, { EvidenceImageCaptureRef } from "@/components/EvidenceImageCapture";
import { EvidenceImage, ComplaintInfo } from "@/lib/image-watermark";
import type { ComplaintsStackParamList } from "@/navigation/ComplaintsStackNavigator";

type SubmitComplaintRouteProp = RouteProp<ComplaintsStackParamList, "SubmitComplaint">;

interface SharedLinkInfo {
  token: string;
  districtId?: string;
  districtAbbreviation?: string;
  sharedByOfficerName?: string;
}

interface FormFieldConfig {
  id: string;
  fieldName: string;
  fieldLabel: string;
  fieldType: string;
  fieldGroup: string;
  displayOrder: number;
  isRequired: boolean;
  isVisible: boolean;
  dropdownOptions?: { value: string; label: string }[];
  defaultValue?: string;
  helpText?: string;
}

interface DropdownOption {
  value: string;
  label: string;
}

export default function SubmitComplaintScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const route = useRoute<SubmitComplaintRouteProp>();
  
  // Estimate tab bar height (safe area bottom + typical tab bar)
  const tabBarHeight = insets.bottom + 60;

  // Shared link state
  const [sharedLinkInfo, setSharedLinkInfo] = useState<SharedLinkInfo | null>(null);
  const [isValidatingLink, setIsValidatingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [submittedData, setSubmittedData] = useState<ComplaintAcknowledgementData | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfUri, setPdfUri] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [establishmentName, setEstablishmentName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [evidenceImages, setEvidenceImages] = useState<EvidenceImage[]>([]);
  const evidenceRef = useRef<EvidenceImageCaptureRef>(null);
  const [location, setLocation] = useState<{
    latitude: string;
    longitude: string;
    accuracy: string;
  } | null>(null);

  // Dynamic form configuration from admin panel
  const [formConfig, setFormConfig] = useState<FormFieldConfig[]>([]);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [complaintType, setComplaintType] = useState("");
  const [complaintNature, setComplaintNature] = useState("");
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showNatureDropdown, setShowNatureDropdown] = useState(false);

  // Extract dropdown options from form config
  const complaintTypeOptions: DropdownOption[] = React.useMemo(() => {
    const typeField = formConfig.find(f => f.fieldName === "complaint_type");
    if (typeField?.dropdownOptions) {
      return typeField.dropdownOptions;
    }
    return [{ value: "Food Safety", label: "Food Safety" }];
  }, [formConfig]);

  const complaintNatureOptions: DropdownOption[] = React.useMemo(() => {
    const natureField = formConfig.find(f => f.fieldName === "complaint_nature");
    if (natureField?.dropdownOptions) {
      return natureField.dropdownOptions;
    }
    return [{ value: "General", label: "General" }];
  }, [formConfig]);

  // Validate shared link token if provided
  useEffect(() => {
    const validateToken = async () => {
      const token = route.params?.token;
      if (!token) return;

      setIsValidatingLink(true);
      setLinkError(null);

      try {
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/complaints/share-link/${token}`);
        const data = await response.json();

        if (!response.ok) {
          setLinkError(data.error || "Invalid link");
          if (data.code === "LINK_USED" && data.complaintCode) {
            setLinkError(`This link has already been used. Complaint ID: ${data.complaintCode}`);
          }
          return;
        }

        setSharedLinkInfo({
          token: data.token,
          districtId: data.districtId,
          districtAbbreviation: data.districtAbbreviation,
          sharedByOfficerName: data.sharedByOfficerName,
        });
      } catch (error) {
        setLinkError("Failed to validate link. Please try again.");
      } finally {
        setIsValidatingLink(false);
      }
    };

    validateToken();
  }, [route.params?.token]);

  // Fetch dynamic form configuration from admin panel
  useEffect(() => {
    const fetchFormConfig = async () => {
      try {
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/complaints/form-config`);
        if (response.ok) {
          const config = await response.json();
          setFormConfig(config);
          
          // Set default values for dropdowns
          const typeField = config.find((f: FormFieldConfig) => f.fieldName === "complaint_type");
          const natureField = config.find((f: FormFieldConfig) => f.fieldName === "complaint_nature");
          
          if (typeField?.defaultValue) {
            setComplaintType(typeField.defaultValue);
          } else if (typeField?.dropdownOptions?.length > 0) {
            setComplaintType(typeField.dropdownOptions[0].value);
          }
          
          if (natureField?.defaultValue) {
            setComplaintNature(natureField.defaultValue);
          } else if (natureField?.dropdownOptions?.length > 0) {
            setComplaintNature(natureField.dropdownOptions[0].value);
          }
        }
      } catch (error) {
        console.error("Failed to fetch form config:", error);
        // Use default values on error
        setComplaintType("Food Safety");
        setComplaintNature("General");
      } finally {
        setIsLoadingConfig(false);
      }
    };

    fetchFormConfig();
  }, []);

  const handleGetLocation = async () => {
    setIsGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location permission is required to capture incident location");
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setLocation({
        latitude: loc.coords.latitude.toString(),
        longitude: loc.coords.longitude.toString(),
        accuracy: loc.coords.accuracy?.toString() || "0",
      });

      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      if (reverseGeocode.length > 0) {
        const addr = reverseGeocode[0];
        const addressStr = [addr.street, addr.city, addr.region, addr.postalCode]
          .filter(Boolean)
          .join(", ");
        setAddress(addressStr);
      }

      Alert.alert("Success", "Location captured successfully");
    } catch (error) {
      console.error("Location error:", error);
      Alert.alert("Error", "Failed to get location. Please enter address manually.");
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert("Required", "Please enter your name");
      return;
    }
    if (!mobile.trim()) {
      Alert.alert("Required", "Please enter your mobile number");
      return;
    }
    if (!establishmentName.trim()) {
      Alert.alert("Required", "Please enter the establishment name");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Required", "Please describe the incident");
      return;
    }

    setIsSubmitting(true);
    try {
      // Capture watermarked images if any
      let watermarkedImageUris: string[] = [];
      if (evidenceImages.length > 0 && evidenceRef.current) {
        try {
          watermarkedImageUris = await evidenceRef.current.captureWatermarkedImages();
        } catch (imgError) {
          console.error("Failed to capture watermarked images:", imgError);
          watermarkedImageUris = evidenceImages.map(img => img.uri);
        }
      }

      // Prepare evidence data with metadata
      const evidenceData = evidenceImages.map((img, index) => ({
        uri: watermarkedImageUris[index] || img.uri,
        metadata: {
          capturedAt: img.metadata.capturedAt.toISOString(),
          uploadedAt: img.metadata.uploadedAt.toISOString(),
          latitude: img.metadata.latitude,
          longitude: img.metadata.longitude,
        },
      }));

      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/complaints/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sharedLinkToken: sharedLinkInfo?.token,
          districtId: sharedLinkInfo?.districtId || route.params?.districtId,
          complainantName: name.trim(),
          complainantMobile: mobile.trim(),
          complainantEmail: email.trim() || undefined,
          incidentDescription: description.trim(),
          location: location ? {
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
            source: "gps",
            address: address.trim(),
          } : {
            latitude: "0",
            longitude: "0",
            source: "manual",
            address: address.trim(),
          },
          evidence: evidenceData,
          submittedVia: "mobile",
          complaintType: complaintType || "Food Safety",
          complaintNature: complaintNature || "General",
          establishmentName: establishmentName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit complaint");
      }

      // Prepare acknowledgement data for PDF
      const baseUrl = getApiUrl();
      const trackingUrl = `${baseUrl}/track/${data.complaintCode}`;
      
      const ackData: ComplaintAcknowledgementData = {
        complaintCode: data.complaintCode,
        submittedAt: data.submittedAt || new Date().toISOString(),
        districtName: sharedLinkInfo?.districtAbbreviation || "Assigned District",
        complaintType: complaintType || data.complaintType || "Food Safety",
        complaintNature: complaintNature || data.complaintNature || "General",
        address: address.trim() || undefined,
        trackingUrl,
      };
      
      setSubmittedData(ackData);
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error("Submit error:", error);
      Alert.alert("Error", error.message || "Failed to submit complaint");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate PDF acknowledgement
  const generatePdf = async () => {
    if (!submittedData) return;
    
    try {
      setIsGeneratingPdf(true);
      const html = generateAcknowledgementHTML(submittedData);
      
      if (Platform.OS === "web") {
        const newWindow = window.open("", "_blank");
        if (newWindow) {
          newWindow.document.write(html);
          newWindow.document.close();
          newWindow.print();
        }
        setPdfUri("web-print");
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        setPdfUri(uri);
      }
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      Alert.alert("Error", "Failed to generate acknowledgement PDF");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Share/download PDF
  const sharePdf = async () => {
    if (!pdfUri || pdfUri === "web-print") return;
    
    try {
      const sharingAvailable = await Sharing.isAvailableAsync();
      if (sharingAvailable) {
        await Sharing.shareAsync(pdfUri, {
          mimeType: "application/pdf",
          dialogTitle: `Complaint Acknowledgement - ${submittedData?.complaintCode}`,
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("Sharing not available", "Please use the print option instead.");
      }
    } catch (error) {
      console.error("Failed to share PDF:", error);
      Alert.alert("Error", "Failed to share the PDF");
    }
  };

  // Close success modal and go back
  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    navigation.goBack();
  };

  // Show loading state while validating link
  if (isValidatingLink) {
    return (
      <ThemedView style={styles.centerContent}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText style={{ marginTop: Spacing.md }}>Validating link...</ThemedText>
      </ThemedView>
    );
  }

  // Show error state if link is invalid
  if (linkError && route.params?.token) {
    return (
      <ThemedView style={styles.centerContent}>
        <Card style={styles.errorCard}>
          <Feather name="alert-circle" size={48} color="#dc3545" style={{ marginBottom: Spacing.md }} />
          <ThemedText type="h4" style={{ textAlign: "center", marginBottom: Spacing.sm }}>
            Link Error
          </ThemedText>
          <ThemedText style={{ textAlign: "center", opacity: 0.7 }}>
            {linkError}
          </ThemedText>
          <Button onPress={() => navigation.goBack()} style={{ marginTop: Spacing.lg }}>
            Go Back
          </Button>
        </Card>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={headerHeight}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: headerHeight + Spacing.md, paddingBottom: tabBarHeight + Spacing.xl + 20 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {sharedLinkInfo ? (
            <Card style={styles.complaintIdCard}>
              <View style={[styles.sharedLinkBadge, { backgroundColor: theme.primary + "20" }]}>
                <Feather name="link" size={14} color={theme.primary} />
                <ThemedText style={[styles.sharedLinkText, { color: theme.primary }]}>
                  Verified Link
                </ThemedText>
              </View>
              {sharedLinkInfo.districtAbbreviation ? (
                <ThemedText style={styles.complaintIdHint}>
                  District: {sharedLinkInfo.districtAbbreviation}
                </ThemedText>
              ) : null}
              {sharedLinkInfo.sharedByOfficerName ? (
                <ThemedText style={styles.complaintIdHint}>
                  Shared by: {sharedLinkInfo.sharedByOfficerName}
                </ThemedText>
              ) : null}
              <ThemedText style={[styles.complaintIdHint, { marginTop: Spacing.sm }]}>
                Your Complaint ID will be assigned after submission
              </ThemedText>
            </Card>
          ) : (
            <Card style={styles.complaintIdCard}>
              <Feather name="file-text" size={24} color={theme.primary} style={{ marginBottom: Spacing.xs }} />
              <ThemedText style={styles.complaintIdHint}>
                Your Complaint ID will be assigned after submission
              </ThemedText>
            </Card>
          )}

          <Card style={styles.infoCard}>
            <Feather name="info" size={20} color={theme.primary} />
            <ThemedText style={styles.infoText}>
              Report food safety violations such as expired products, unsanitary conditions, adulteration, or any health hazards.
            </ThemedText>
          </Card>

          <Card style={styles.section}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              Your Details
            </ThemedText>
            <Input
              label="Full Name *"
              placeholder="Enter your full name"
              value={name}
              onChangeText={setName}
              icon="user"
            />
            <Input
              label="Mobile Number *"
              placeholder="Enter your mobile number"
              value={mobile}
              onChangeText={setMobile}
              keyboardType="phone-pad"
              icon="phone"
              containerStyle={styles.inputSpacing}
            />
            <Input
              label="Email (Optional)"
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              icon="mail"
              containerStyle={styles.inputSpacing}
            />

            <Input
              label="Establishment Name *"
              placeholder="Enter the name of the establishment"
              value={establishmentName}
              onChangeText={setEstablishmentName}
              icon="briefcase"
              containerStyle={styles.inputSpacing}
            />
          </Card>

          <Card style={styles.section}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              Incident Details
            </ThemedText>
            
            {/* Complaint Type Dropdown */}
            <View style={styles.inputSpacing}>
              <ThemedText style={styles.dropdownLabel}>Complaint Type *</ThemedText>
              <Pressable
                style={[styles.dropdownButton, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}
                onPress={() => setShowTypeDropdown(true)}
              >
                <ThemedText style={styles.dropdownButtonText}>
                  {complaintTypeOptions.find(o => o.value === complaintType)?.label || "Select Type"}
                </ThemedText>
                <Feather name="chevron-down" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>

            {/* Complaint Nature Dropdown */}
            <View style={styles.inputSpacing}>
              <ThemedText style={styles.dropdownLabel}>Complaint Nature *</ThemedText>
              <Pressable
                style={[styles.dropdownButton, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}
                onPress={() => setShowNatureDropdown(true)}
              >
                <ThemedText style={styles.dropdownButtonText}>
                  {complaintNatureOptions.find(o => o.value === complaintNature)?.label || "Select Nature"}
                </ThemedText>
                <Feather name="chevron-down" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>

            <Input
              label="Description *"
              placeholder="Describe the food safety violation in detail..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              containerStyle={styles.inputSpacing}
            />
          </Card>

          <Card style={styles.section}>
            <ThemedText type="h4" style={styles.sectionTitle}>
              Location
            </ThemedText>
            
            {(!name.trim() || !mobile.trim() || !establishmentName.trim() || !description.trim()) ? (
              <View style={[styles.locationDisabledNotice, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="info" size={16} color={theme.textSecondary} />
                <ThemedText style={[styles.locationDisabledText, { color: theme.textSecondary }]}>
                  Please fill in Name, Mobile, Establishment Name, and Description before capturing location
                </ThemedText>
              </View>
            ) : null}

            <Button
              onPress={handleGetLocation}
              disabled={isGettingLocation || !name.trim() || !mobile.trim() || !establishmentName.trim() || !description.trim()}
              style={styles.locationButton}
            >
              {isGettingLocation ? "Getting Location..." : "Capture Current Location"}
            </Button>

            {location ? (
              <View style={[styles.locationInfo, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="check-circle" size={16} color={theme.primary} />
                <ThemedText style={styles.locationText}>
                  Location captured: {location.latitude.slice(0, 8)}, {location.longitude.slice(0, 8)}
                </ThemedText>
              </View>
            ) : null}

            <Input
              label="Address / Landmark"
              placeholder="Enter the location address or nearby landmark"
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={2}
              containerStyle={styles.inputSpacing}
            />
          </Card>

          {/* Evidence Image Capture */}
          <EvidenceImageCapture
            ref={evidenceRef}
            images={evidenceImages}
            onImagesChange={setEvidenceImages}
            currentLocation={location}
            complaintInfo={{
              complainantName: name.trim() || undefined,
              establishmentName: establishmentName.trim() || undefined,
              complainantMobile: mobile.trim() || undefined,
            }}
            disabled={isSubmitting}
          />

          <Button
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={styles.submitButton}
          >
            {isSubmitting ? "Submitting..." : "Submit Complaint"}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        animationType="fade"
        transparent
        onRequestClose={handleSuccessClose}
      >
        <View style={styles.modalOverlay}>
          <Card style={styles.successModal}>
            <View style={[styles.successIconContainer, { backgroundColor: "#28a74520" }]}>
              <Feather name="check-circle" size={48} color="#28a745" />
            </View>
            
            <ThemedText type="h3" style={styles.successTitle}>
              Complaint Submitted!
            </ThemedText>
            
            <View style={[styles.complaintCodeBox, { borderColor: theme.primary }]}>
              <ThemedText style={styles.codeLabel}>Complaint ID</ThemedText>
              <ThemedText style={[styles.codeValue, { color: theme.primary }]}>
                {submittedData?.complaintCode}
              </ThemedText>
            </View>
            
            <ThemedText style={styles.successDescription}>
              Please save this ID to track your complaint status. You can download an acknowledgement receipt below.
            </ThemedText>
            
            <View style={styles.modalButtons}>
              {!pdfUri ? (
                <Button
                  onPress={generatePdf}
                  disabled={isGeneratingPdf}
                  style={styles.pdfButton}
                >
                  <View style={styles.buttonContent}>
                    {isGeneratingPdf ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Feather name="file-text" size={18} color="white" />
                    )}
                    <ThemedText style={styles.buttonText}>
                      {isGeneratingPdf ? "Generating..." : "Generate Receipt"}
                    </ThemedText>
                  </View>
                </Button>
              ) : (
                <Button onPress={sharePdf} style={styles.pdfButton}>
                  <View style={styles.buttonContent}>
                    <Feather name="share-2" size={18} color="white" />
                    <ThemedText style={styles.buttonText}>Share Receipt</ThemedText>
                  </View>
                </Button>
              )}
              
              <Pressable onPress={handleSuccessClose} style={styles.closeLink}>
                <ThemedText style={[styles.closeLinkText, { color: theme.primary }]}>
                  Close
                </ThemedText>
              </Pressable>
            </View>
          </Card>
        </View>
      </Modal>

      {/* Complaint Type Dropdown Modal */}
      <Modal
        visible={showTypeDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTypeDropdown(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowTypeDropdown(false)}>
          <Card style={styles.dropdownModal}>
            <View style={[styles.dropdownHeader, { borderBottomColor: theme.border }]}>
              <ThemedText style={styles.dropdownTitle}>Select Complaint Type</ThemedText>
              <Pressable onPress={() => setShowTypeDropdown(false)}>
                <Feather name="x" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>
            <ScrollView style={styles.dropdownList}>
              {complaintTypeOptions.map((option) => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.dropdownItem,
                    complaintType === option.value && { backgroundColor: theme.primary + "15" },
                  ]}
                  onPress={() => {
                    setComplaintType(option.value);
                    setShowTypeDropdown(false);
                  }}
                >
                  <ThemedText style={styles.dropdownItemText}>{option.label}</ThemedText>
                  {complaintType === option.value ? (
                    <Feather name="check" size={20} color={theme.primary} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </Card>
        </Pressable>
      </Modal>

      {/* Complaint Nature Dropdown Modal */}
      <Modal
        visible={showNatureDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNatureDropdown(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowNatureDropdown(false)}>
          <Card style={styles.dropdownModal}>
            <View style={[styles.dropdownHeader, { borderBottomColor: theme.border }]}>
              <ThemedText style={styles.dropdownTitle}>Select Complaint Nature</ThemedText>
              <Pressable onPress={() => setShowNatureDropdown(false)}>
                <Feather name="x" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>
            <ScrollView style={styles.dropdownList}>
              {complaintNatureOptions.map((option) => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.dropdownItem,
                    complaintNature === option.value && { backgroundColor: theme.primary + "15" },
                  ]}
                  onPress={() => {
                    setComplaintNature(option.value);
                    setShowNatureDropdown(false);
                  }}
                >
                  <ThemedText style={styles.dropdownItemText}>{option.label}</ThemedText>
                  {complaintNature === option.value ? (
                    <Feather name="check" size={20} color={theme.primary} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </Card>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  errorCard: {
    padding: Spacing.xl,
    alignItems: "center",
    maxWidth: 320,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  complaintIdCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    alignItems: "center",
  },
  complaintIdHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  complaintIdLabel: {
    fontSize: 11,
    letterSpacing: 1.5,
    opacity: 0.6,
  },
  refreshButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  complaintIdValue: {
    fontSize: 24,
    fontWeight: "700",
    marginTop: Spacing.xs,
    letterSpacing: 1,
  },
  complaintIdHint: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: Spacing.xs,
    textAlign: "center",
  },
  sharedLinkBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.sm,
  },
  sharedLinkText: {
    fontSize: 12,
    fontWeight: "600",
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    marginBottom: Spacing.md,
  },
  inputSpacing: {
    marginTop: Spacing.md,
  },
  locationButton: {
    marginBottom: Spacing.md,
  },
  locationDisabledNotice: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  locationDisabledText: {
    fontSize: 13,
    flex: 1,
  },
  locationInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  locationText: {
    fontSize: 13,
    flex: 1,
  },
  submitButton: {
    marginTop: Spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  successModal: {
    width: "100%",
    maxWidth: 360,
    padding: Spacing.xl,
    alignItems: "center",
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  successTitle: {
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  complaintCodeBox: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    alignItems: "center",
    width: "100%",
    marginBottom: Spacing.lg,
  },
  codeLabel: {
    fontSize: 12,
    opacity: 0.6,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  codeValue: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 2,
    fontFamily: Platform.select({ ios: "Courier", android: "monospace", default: "monospace" }),
  },
  successDescription: {
    fontSize: 14,
    textAlign: "center",
    opacity: 0.7,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  modalButtons: {
    width: "100%",
    alignItems: "center",
    gap: Spacing.md,
  },
  pdfButton: {
    width: "100%",
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
  closeLink: {
    paddingVertical: Spacing.md,
  },
  closeLinkText: {
    fontSize: 16,
    fontWeight: "500",
  },
  dropdownLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  dropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
  },
  dropdownButtonText: {
    fontSize: 16,
  },
  dropdownModal: {
    width: "100%",
    maxWidth: 360,
    maxHeight: "60%",
    borderRadius: BorderRadius.lg,
  },
  dropdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  dropdownTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  dropdownList: {
    padding: Spacing.sm,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginVertical: 2,
  },
  dropdownItemText: {
    fontSize: 16,
  },
});
