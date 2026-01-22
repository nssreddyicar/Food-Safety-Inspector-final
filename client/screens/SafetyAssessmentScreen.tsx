import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Pressable,
  ActivityIndicator,
  Platform,
  Modal,
  TextInput as RNTextInput,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import ViewShot from "react-native-view-shot";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { useTheme } from "@/hooks/useTheme";
import { useAuthContext } from "@/context/AuthContext";
import { Spacing, FontSize, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import {
  EvidenceImage,
  ImageMetadata,
  formatDateTime,
  formatCoordinates,
  generateUniqueId,
} from "@/lib/image-watermark";

interface Pillar {
  id: string;
  pillarNumber: number;
  name: string;
  indicators: Indicator[];
}

interface Indicator {
  id: string;
  indicatorNumber: number;
  name: string;
  description?: string;
  riskLevel: 'high' | 'medium' | 'low';
  weight: number;
}

const INDICATOR_EXPLANATIONS: Record<string, string> = {
  "Cleanliness of Kitchen Area": "Evaluate overall hygiene of food preparation zones. Check for grease buildup, debris, and regular cleaning schedules.",
  "Food Storage Practices": "Assess proper storage of raw and cooked food. Verify temperature control, labeling, and first-in-first-out practices.",
  "Personnel Hygiene": "Check if food handlers follow hygiene protocols. Look for handwashing, clean uniforms, and health certificates.",
  "Water Quality & Supply": "Verify potable water source and testing. Check storage tanks, filtration systems, and water testing records.",
  "Pest Control Measures": "Evaluate pest prevention and control systems. Check for evidence of pests, treatment records, and structural barriers.",
  "Waste Disposal System": "Assess garbage collection and disposal methods. Verify segregation, covered bins, and timely removal.",
  "Ventilation & Lighting": "Check adequate ventilation and lighting in kitchen. Ensure exhaust systems work and lighting is sufficient.",
  "Food Preparation Practices": "Observe cooking and handling techniques. Check for cross-contamination prevention and proper cooking temperatures.",
  "Raw Material Quality": "Verify quality of incoming ingredients. Check supplier records, freshness, and rejection procedures.",
  "Temperature Maintenance": "Check cold chain and hot holding compliance. Verify refrigerator/freezer temps and hot food storage.",
  "Equipment Condition": "Assess condition of cooking and storage equipment. Check for rust, damage, and regular maintenance.",
  "Food Handlers Training": "Verify staff have received food safety training. Check training records and FoSTaC certification.",
  "Medical Fitness Records": "Check if food handlers have valid health certificates. Verify annual medical examinations are conducted.",
  "Protective Clothing Usage": "Observe use of aprons, caps, and gloves. Check if clean uniforms are worn properly.",
  "Hand Washing Facilities": "Verify soap, sanitizer, and hand drying available. Check if facilities are accessible and functional.",
  "Cross-Contamination Prevention": "Assess separation of raw and cooked foods. Check for color-coded cutting boards and utensils.",
  "Cooking Temperature Control": "Verify food is cooked to safe temperatures. Check thermometer use and cooking records.",
  "Reheating Practices": "Evaluate reheating procedures and temperatures. Ensure food reaches 74°C core temperature.",
  "Leftover Food Handling": "Check policies for handling leftover food. Verify cooling, storage, and discard procedures.",
  "Display & Service Hygiene": "Assess food display and serving practices. Check for covers, sneeze guards, and clean utensils.",
  "Menu Nutritional Balance": "Evaluate nutritional adequacy of menu. Check for variety, portion sizes, and dietary guidelines.",
  "Special Diet Provisions": "Verify accommodation for allergies and special diets. Check labeling and separate preparation.",
  "Serving Portion Standards": "Check if portions meet age-appropriate standards. Verify serving sizes are consistent.",
  "Food Tasting Protocol": "Verify official food tasting before serving. Check tasting records and designated tasters.",
  "Record Keeping Practices": "Assess documentation of food safety activities. Check logs, checklists, and audit trails.",
  "License & Registration Display": "Verify FSSAI license is valid and displayed. Check license category and expiry date.",
  "Self-Inspection Practices": "Check if internal audits are conducted. Review self-inspection records and corrective actions.",
  "Complaint Handling System": "Assess procedure for food complaints. Check if complaints are logged and resolved.",
  "Emergency Preparedness": "Evaluate food safety emergency plans. Check fire safety, first aid, and evacuation procedures.",
  "Supplier Quality Verification": "Assess vendor selection and monitoring. Check approved supplier list and quality audits.",
  "Traceability System": "Verify batch tracking and recall capability. Check if ingredients can be traced back to source.",
  "Allergen Management": "Evaluate allergen identification and control. Check labeling, segregation, and staff awareness.",
  "Oil & Fat Quality Control": "Assess frying oil quality monitoring. Check TPC testing, oil change frequency, and records.",
  "Microbiological Testing": "Verify regular food and water testing. Check lab reports, frequency, and corrective actions.",
  "HACCP Implementation": "Assess HACCP plan documentation and execution. Check CCPs, monitoring, and verification records.",
};

interface PersonTypeField {
  key: string;
  label: string;
  type: 'text' | 'phone' | 'email' | 'date';
  required: boolean;
  showInWatermark: boolean;
}

interface PersonType {
  id: string;
  typeName: string;
  typeCode: string;
  description: string;
  displayOrder: number;
  isActive: boolean;
  isRequired: boolean;
  maxCount: number;
  fields: PersonTypeField[];
}

interface AddedPerson {
  id: string;
  personTypeId: string;
  personTypeName: string;
  data: Record<string, string>;
}

interface InstitutionType {
  id: string;
  name: string;
  code: string;
  description: string;
}

interface IndicatorResponse {
  indicatorId: string;
  response: 'yes' | 'no' | 'na';
}

interface IndicatorImageData {
  [indicatorId: string]: EvidenceImage[];
}

const RISK_COLORS = {
  high: { bg: '#FEE2E2', text: '#DC2626' },
  medium: { bg: '#FEF3C7', text: '#D97706' },
  low: { bg: '#D1FAE5', text: '#059669' },
};

function generateCompactWatermark(
  metadata: ImageMetadata,
  institutionName: string,
  persons: AddedPerson[],
  personTypes: PersonType[]
): string[] {
  const lines: string[] = [];
  if (institutionName) lines.push(`Inst: ${institutionName.substring(0, 20)}`);
  
  persons.slice(0, 3).forEach(person => {
    const pt = personTypes.find(t => t.id === person.personTypeId);
    const label = pt?.typeCode?.substring(0, 4).toUpperCase() || 'PERS';
    const name = person.data.fullName?.substring(0, 15) || '';
    const mobile = person.data.mobile ? ` ${person.data.mobile.slice(-4)}` : '';
    if (name) lines.push(`${label}: ${name}${mobile}`);
  });
  
  lines.push(formatDateTime(metadata.capturedAt));
  lines.push(formatCoordinates(metadata.latitude, metadata.longitude));
  return lines;
}

export default function SafetyAssessmentScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { user } = useAuthContext();

  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [personTypes, setPersonTypes] = useState<PersonType[]>([]);
  const [institutionTypes, setInstitutionTypes] = useState<InstitutionType[]>([]);
  const [selectedInstitutionTypeId, setSelectedInstitutionTypeId] = useState<string>("");
  const [addedPersons, setAddedPersons] = useState<AddedPerson[]>([]);
  const [responses, setResponses] = useState<Record<string, IndicatorResponse>>({});
  const [indicatorImages, setIndicatorImages] = useState<IndicatorImageData>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedInspection, setSubmittedInspection] = useState<{
    id: string;
    totalScore: number;
    riskClassification: string;
  } | null>(null);
  const [scorePreview, setScorePreview] = useState<{
    totalScore: number;
    riskClassification: string;
    pillarScores?: Array<{
      pillarName: string;
      score: number;
      maxScore: number;
      percentage: number;
    }>;
    highRiskCount?: number;
    mediumRiskCount?: number;
    lowRiskCount?: number;
  } | null>(null);

  const [institutionName, setInstitutionName] = useState("");
  const [institutionAddress, setInstitutionAddress] = useState("");
  
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: string;
    longitude: string;
  } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const [showPersonTypeModal, setShowPersonTypeModal] = useState(false);
  const [showPersonFormModal, setShowPersonFormModal] = useState(false);
  const [selectedPersonType, setSelectedPersonType] = useState<PersonType | null>(null);
  const [personFormData, setPersonFormData] = useState<Record<string, string>>({});
  const [showInstitutionTypeModal, setShowInstitutionTypeModal] = useState(false);

  const viewShotRefs = useRef<Record<string, React.RefObject<ViewShot | null>>>({});

  useEffect(() => {
    loadFormConfig();
    loadPersonTypes();
    requestLocation();
  }, []);

  useEffect(() => {
    if (pillars.length > 0 && Object.keys(responses).length > 0) {
      calculatePreview();
    }
  }, [responses]);

  const requestLocation = async () => {
    setIsGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setCurrentLocation({
          latitude: String(location.coords.latitude),
          longitude: String(location.coords.longitude),
        });
      }
    } catch (error) {
      console.error("Location error:", error);
    } finally {
      setIsGettingLocation(false);
    }
  };

  const loadFormConfig = async () => {
    try {
      const response = await fetch(
        new URL('/api/institutional-inspections/form-config', getApiUrl()).toString()
      );
      if (response.ok) {
        const data = await response.json();
        setPillars(data.pillars);
        
        if (data.institutionTypes && data.institutionTypes.length > 0) {
          setInstitutionTypes(data.institutionTypes);
          setSelectedInstitutionTypeId(data.institutionTypes[0].id);
        }
        
        const initialResponses: Record<string, IndicatorResponse> = {};
        data.pillars.forEach((pillar: Pillar) => {
          pillar.indicators.forEach((ind: Indicator) => {
            initialResponses[ind.id] = { indicatorId: ind.id, response: 'yes' };
          });
        });
        setResponses(initialResponses);
      }
    } catch (error) {
      console.error("Failed to load form config:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPersonTypes = async () => {
    try {
      const response = await fetch(
        new URL('/api/institutional-inspections/person-types', getApiUrl()).toString()
      );
      if (response.ok) {
        const data = await response.json();
        setPersonTypes(data);
      }
    } catch (error) {
      console.error("Failed to load person types:", error);
    }
  };

  const calculatePreview = async () => {
    try {
      const responsesArray = Object.values(responses);
      const response = await fetch(
        new URL('/api/institutional-inspections/calculate-score', getApiUrl()).toString(),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ responses: responsesArray }),
        }
      );
      if (response.ok) {
        const data = await response.json();
        
        // Calculate pillar-wise scores locally
        const pillarScores = pillars.map(pillar => {
          let pillarScore = 0;
          let pillarMaxScore = 0;
          
          pillar.indicators.forEach((ind: Indicator) => {
            const weight = ind.weight || 1;
            pillarMaxScore += weight;
            const resp = responses[ind.id];
            if (resp?.response === 'yes') {
              pillarScore += weight;
            } else if (resp?.response === 'na') {
              pillarMaxScore -= weight; // NA doesn't count
            }
          });
          
          return {
            pillarName: pillar.name,
            score: pillarScore,
            maxScore: pillarMaxScore,
            percentage: pillarMaxScore > 0 ? Math.round((pillarScore / pillarMaxScore) * 100) : 0,
          };
        });
        
        setScorePreview({
          totalScore: data.totalScore,
          riskClassification: data.riskClassification,
          pillarScores,
          highRiskCount: data.highRiskCount || 0,
          mediumRiskCount: data.mediumRiskCount || 0,
          lowRiskCount: data.lowRiskCount || 0,
        });
      }
    } catch (error) {
      console.error("Preview error:", error);
    }
  };

  const handleResponseChange = (indicatorId: string, value: 'yes' | 'no' | 'na') => {
    setResponses(prev => ({
      ...prev,
      [indicatorId]: { indicatorId, response: value },
    }));
  };

  const handleSelectPersonType = (pt: PersonType) => {
    const existingCount = addedPersons.filter(p => p.personTypeId === pt.id).length;
    if (existingCount >= pt.maxCount) {
      Alert.alert("Limit Reached", `Maximum ${pt.maxCount} ${pt.typeName} allowed.`);
      return;
    }
    setSelectedPersonType(pt);
    setPersonFormData({});
    setShowPersonTypeModal(false);
    setShowPersonFormModal(true);
  };

  const handleSavePerson = () => {
    if (!selectedPersonType) return;
    
    const requiredFields = selectedPersonType.fields.filter(f => f.required);
    for (const field of requiredFields) {
      if (!personFormData[field.key]?.trim()) {
        Alert.alert("Required", `Please enter ${field.label}`);
        return;
      }
    }

    const newPerson: AddedPerson = {
      id: generateUniqueId(),
      personTypeId: selectedPersonType.id,
      personTypeName: selectedPersonType.typeName,
      data: { ...personFormData },
    };

    setAddedPersons(prev => [...prev, newPerson]);
    setShowPersonFormModal(false);
    setSelectedPersonType(null);
    setPersonFormData({});
  };

  const handleRemovePerson = (personId: string) => {
    setAddedPersons(prev => prev.filter(p => p.id !== personId));
  };

  const handleCaptureImage = async (indicatorId: string) => {
    const existingImages = indicatorImages[indicatorId] || [];
    if (existingImages.length >= 3) {
      Alert.alert("Limit Reached", "Maximum 3 images per indicator.");
      return;
    }

    if (!currentLocation) {
      Alert.alert("Location Required", "Please wait for location to be captured.");
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Camera Permission Required", "Please enable camera access in settings.");
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: "images",
        allowsEditing: false,
        quality: 0.8,
        exif: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const capturedAt = new Date();
      const uploadedAt = new Date();

      let imageLat = currentLocation.latitude;
      let imageLng = currentLocation.longitude;

      if (asset.exif?.GPSLatitude && asset.exif?.GPSLongitude) {
        imageLat = String(asset.exif.GPSLatitude);
        imageLng = String(asset.exif.GPSLongitude);
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

      if (!viewShotRefs.current[newImage.id]) {
        viewShotRefs.current[newImage.id] = React.createRef<ViewShot | null>();
      }

      setIndicatorImages(prev => ({
        ...prev,
        [indicatorId]: [...(prev[indicatorId] || []), newImage],
      }));
    } catch (error) {
      console.error("Capture error:", error);
      Alert.alert("Error", "Failed to capture image.");
    }
  };

  const handleRemoveImage = (indicatorId: string, imageId: string) => {
    setIndicatorImages(prev => ({
      ...prev,
      [indicatorId]: (prev[indicatorId] || []).filter(img => img.id !== imageId),
    }));
  };

  const captureAllWatermarkedImages = async (): Promise<Record<string, string[]>> => {
    const result: Record<string, string[]> = {};
    
    for (const [indicatorId, images] of Object.entries(indicatorImages)) {
      const capturedUris: string[] = [];
      for (const image of images) {
        const vsRef = viewShotRefs.current[image.id];
        if (vsRef?.current?.capture) {
          try {
            const uri = await vsRef.current.capture();
            capturedUris.push(uri);
          } catch {
            capturedUris.push(image.uri);
          }
        } else {
          capturedUris.push(image.uri);
        }
      }
      if (capturedUris.length > 0) {
        result[indicatorId] = capturedUris;
      }
    }
    
    return result;
  };

  const handleDownloadReport = async (inspectionId: string) => {
    try {
      const reportUrl = new URL(`/api/institutional-inspections/${inspectionId}/report`, getApiUrl()).toString();
      const { openBrowserAsync } = await import('expo-web-browser');
      await openBrowserAsync(reportUrl);
    } catch (error) {
      console.error("Download error:", error);
    }
  };

  const handleSubmit = async () => {
    if (!selectedInstitutionTypeId) {
      Alert.alert("Required", "Please select institution type");
      return;
    }
    if (!institutionName.trim()) {
      Alert.alert("Required", "Please enter institution name");
      return;
    }

    setIsSubmitting(true);

    try {
      const watermarkedImages = await captureAllWatermarkedImages();

      const personsPayload = addedPersons.map(p => ({
        personTypeId: p.personTypeId,
        fullName: p.data.fullName || '',
        mobile: p.data.mobile || '',
        designation: p.data.designation || '',
        personData: p.data,
      }));

      const createResponse = await fetch(
        new URL('/api/institutional-inspections', getApiUrl()).toString(),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            institutionTypeId: selectedInstitutionTypeId,
            institutionName,
            institutionAddress,
            jurisdictionId: user?.jurisdiction?.unitId,
            districtId: user?.jurisdiction?.unitId,
            inspectionDate: new Date().toISOString(),
            officerId: user?.id,
            latitude: currentLocation?.latitude,
            longitude: currentLocation?.longitude,
            persons: personsPayload,
          }),
        }
      );

      if (!createResponse.ok) {
        const error = await createResponse.json();
        throw new Error(error.error || 'Failed to create inspection');
      }

      const inspection = await createResponse.json();
      
      const responsesArray = Object.values(responses).map(r => ({
        ...r,
        images: watermarkedImages[r.indicatorId] || [],
      }));
      
      await fetch(
        new URL(`/api/institutional-inspections/${inspection.id}/responses`, getApiUrl()).toString(),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ responses: responsesArray, officerId: user?.id }),
        }
      );

      await fetch(
        new URL(`/api/institutional-inspections/${inspection.id}/submit`, getApiUrl()).toString(),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ officerId: user?.id }),
        }
      );

      setSubmittedInspection({
        id: inspection.id,
        totalScore: scorePreview?.totalScore || 0,
        riskClassification: scorePreview?.riskClassification || 'Medium Risk',
      });
    } catch (error: any) {
      console.error("Submit error:", error);
      Alert.alert("Error", error.message || "Failed to submit assessment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubmittedInspection(null);
    setInstitutionName("");
    setInstitutionAddress("");
    setAddedPersons([]);
    setIndicatorImages({});
    const initialResponses: Record<string, IndicatorResponse> = {};
    pillars.forEach((pillar: Pillar) => {
      pillar.indicators.forEach((ind: Indicator) => {
        initialResponses[ind.id] = { indicatorId: ind.id, response: 'yes' };
      });
    });
    setResponses(initialResponses);
  };

  const renderWatermarkedImage = (image: EvidenceImage, indicatorId: string) => {
    const watermarkLines = generateCompactWatermark(
      image.metadata,
      institutionName,
      addedPersons,
      personTypes
    );

    if (!viewShotRefs.current[image.id]) {
      viewShotRefs.current[image.id] = React.createRef<ViewShot | null>();
    }

    return (
      <View key={image.id} style={styles.imageWrapper}>
        <ViewShot
          ref={viewShotRefs.current[image.id]}
          options={{ format: "jpg", quality: 0.9 }}
          style={styles.viewShot}
        >
          <Image source={{ uri: image.uri }} style={styles.capturedImage} contentFit="cover" />
          <View style={styles.watermarkContainer}>
            {watermarkLines.map((line, index) => (
              <ThemedText
                key={index}
                style={[styles.watermarkText, index === watermarkLines.length - 1 && styles.gpsText]}
              >
                {line}
              </ThemedText>
            ))}
          </View>
        </ViewShot>
        <Pressable
          style={styles.removeImageBtn}
          onPress={() => handleRemoveImage(indicatorId, image.id)}
        >
          <Feather name="x" size={14} color="white" />
        </Pressable>
      </View>
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText style={{ marginTop: Spacing.md }}>Loading safety assessment...</ThemedText>
      </ThemedView>
    );
  }

  if (submittedInspection) {
    const riskKey = submittedInspection.riskClassification?.toLowerCase().replace(' risk', '') as keyof typeof RISK_COLORS;
    const riskColors = RISK_COLORS[riskKey] || { bg: '#E5E7EB', text: '#6B7280' };
    
    return (
      <ThemedView style={styles.container}>
        <ScrollView 
          contentContainerStyle={{ 
            flexGrow: 1, 
            justifyContent: 'center', 
            paddingHorizontal: Spacing.lg, 
            paddingTop: insets.top + Spacing.xl,
            paddingBottom: tabBarHeight + Spacing.xl 
          }}
        >
          <Card style={styles.successCard}>
            <View style={styles.successIconContainer}>
              <Feather name="check-circle" size={64} color="#059669" />
            </View>
            <ThemedText style={styles.successTitle}>Inspection Submitted</ThemedText>
            <ThemedText style={styles.successSubtitle}>
              Your assessment has been saved successfully
            </ThemedText>
            
            <View style={styles.successScoreSection}>
              <View style={[styles.totalScoreCircle, { borderColor: theme.primary }]}>
                <ThemedText style={[styles.totalScoreValue, { color: theme.primary }]}>
                  {submittedInspection.totalScore}
                </ThemedText>
                <ThemedText style={styles.totalScoreLabel}>Score</ThemedText>
              </View>
              <View style={[styles.riskBadgeLarge, { backgroundColor: riskColors.bg }]}>
                <ThemedText style={[styles.riskBadgeLargeText, { color: riskColors.text }]}>
                  {submittedInspection.riskClassification?.toUpperCase()}
                </ThemedText>
              </View>
            </View>

            <Button
              onPress={() => handleDownloadReport(submittedInspection.id)}
              style={styles.downloadButton}
            >
              Download PDF Report
            </Button>
            <Pressable
              onPress={resetForm}
              style={[styles.newAssessmentButton, { borderWidth: 1, borderColor: theme.border, borderRadius: BorderRadius.md, paddingVertical: Spacing.md, alignItems: 'center' }]}
            >
              <ThemedText style={{ fontWeight: '600' }}>Start New Assessment</ThemedText>
            </Pressable>
          </Card>
        </ScrollView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.scoreHeader, { backgroundColor: theme.backgroundSecondary, borderBottomColor: theme.border }]}>
        <View style={styles.scoreRow}>
          <ThemedText style={styles.scoreLabel}>Safety Score:</ThemedText>
          <ThemedText style={[styles.scoreValue, { color: theme.primary }]}>
            {scorePreview?.totalScore ?? 0}
          </ThemedText>
        </View>
        <View style={[
          styles.classificationBadge,
          scorePreview?.riskClassification ? { 
            backgroundColor: RISK_COLORS[scorePreview.riskClassification as keyof typeof RISK_COLORS]?.bg 
          } : { backgroundColor: '#E5E7EB' }
        ]}>
          <ThemedText style={[
            styles.classificationText,
            scorePreview?.riskClassification ? {
              color: RISK_COLORS[scorePreview.riskClassification as keyof typeof RISK_COLORS]?.text
            } : { color: '#6B7280' }
          ]}>
            {scorePreview?.riskClassification?.toUpperCase() || 'PENDING'}
          </ThemedText>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: tabBarHeight + insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.institutionCard}>
          <ThemedText style={styles.sectionTitle}>Institution Details</ThemedText>
          
          <View style={styles.formField}>
            <ThemedText style={styles.fieldLabel}>Institution Type *</ThemedText>
            <Pressable
              style={[styles.dropdownButton, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}
              onPress={() => setShowInstitutionTypeModal(true)}
            >
              <ThemedText style={styles.dropdownText}>
                {institutionTypes.find(t => t.id === selectedInstitutionTypeId)?.name || "Select institution type"}
              </ThemedText>
              <Feather name="chevron-down" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>
          
          <Input
            label="Institution Name *"
            placeholder="Enter institution name"
            value={institutionName}
            onChangeText={setInstitutionName}
            style={styles.input}
          />
          <Input
            label="Address"
            placeholder="Enter address"
            value={institutionAddress}
            onChangeText={setInstitutionAddress}
            style={styles.input}
          />
          <View style={styles.locationRow}>
            <Feather 
              name={currentLocation ? "check-circle" : "map-pin"} 
              size={16} 
              color={currentLocation ? "#059669" : theme.textSecondary} 
            />
            <ThemedText style={[styles.locationText, { color: currentLocation ? "#059669" : theme.textSecondary }]}>
              {isGettingLocation ? "Getting location..." : 
               currentLocation ? `GPS: ${parseFloat(currentLocation.latitude).toFixed(6)}, ${parseFloat(currentLocation.longitude).toFixed(6)}` :
               "Location not available"}
            </ThemedText>
          </View>
        </Card>

        <Card style={styles.personsCard}>
          <View style={styles.personsHeader}>
            <ThemedText style={styles.sectionTitle}>Responsible Persons</ThemedText>
            <Pressable
              style={[styles.addPersonBtn, { backgroundColor: theme.primary }]}
              onPress={() => setShowPersonTypeModal(true)}
            >
              <Feather name="plus" size={18} color="white" />
              <ThemedText style={styles.addPersonBtnText}>Add Person</ThemedText>
            </Pressable>
          </View>

          {addedPersons.length > 0 ? (
            <View style={styles.personsList}>
              {addedPersons.map((person) => (
                <View key={person.id} style={[styles.personItem, { borderColor: theme.border }]}>
                  <View style={styles.personInfo}>
                    <ThemedText style={styles.personType}>{person.personTypeName}</ThemedText>
                    <ThemedText style={styles.personName}>{person.data.fullName}</ThemedText>
                    {person.data.mobile ? (
                      <ThemedText style={styles.personMobile}>{person.data.mobile}</ThemedText>
                    ) : null}
                    {person.data.designation ? (
                      <ThemedText style={styles.personDesignation}>{person.data.designation}</ThemedText>
                    ) : null}
                  </View>
                  <Pressable onPress={() => handleRemovePerson(person.id)}>
                    <Feather name="trash-2" size={18} color="#DC2626" />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <ThemedText style={styles.noPersonsText}>No persons added yet. Tap "Add Person" to add responsible persons.</ThemedText>
          )}
        </Card>

        <Card style={styles.assessmentTitleCard}>
          <View style={styles.assessmentTitleRow}>
            <Feather name="clipboard" size={24} color={theme.primary} />
            <View style={styles.assessmentTitleContent}>
              <ThemedText style={styles.assessmentTitle}>Food Safety Risk Assessment</ThemedText>
              <ThemedText style={styles.assessmentSubtitle}>
                7 Pillars with 35 FSSAI-Aligned Indicators
              </ThemedText>
            </View>
          </View>
          <ThemedText style={styles.assessmentDesc}>
            Evaluate each indicator below. Green = Compliant, Red = Non-Compliant, Gray = Not Applicable.
          </ThemedText>
        </Card>

        {pillars.map((pillar) => (
          <View key={pillar.id} style={styles.pillarSection}>
            <View style={[styles.pillarHeader, { backgroundColor: theme.primary }]}>
              <View style={styles.pillarNumberBadge}>
                <ThemedText style={styles.pillarNumber}>{pillar.pillarNumber}</ThemedText>
              </View>
              <ThemedText style={styles.pillarName}>{pillar.name}</ThemedText>
              <ThemedText style={styles.pillarIndicatorCount}>
                {pillar.indicators.length} indicators
              </ThemedText>
            </View>

            {pillar.indicators.map((indicator) => {
              const currentResponse = responses[indicator.id]?.response || 'yes';
              const riskColors = RISK_COLORS[indicator.riskLevel];
              const images = indicatorImages[indicator.id] || [];
              const explanation = indicator.description || INDICATOR_EXPLANATIONS[indicator.name] || "";

              return (
                <View key={indicator.id} style={styles.compactIndicator}>
                  <View style={styles.indicatorTopRow}>
                    <View style={styles.indicatorLeftSection}>
                      <View style={styles.indicatorNumberContainer}>
                        <ThemedText style={styles.indicatorNumberCompact}>
                          {pillar.pillarNumber}.{indicator.indicatorNumber}
                        </ThemedText>
                      </View>
                      <View style={[styles.riskDot, { backgroundColor: riskColors.text }]} />
                    </View>
                    
                    <View style={styles.indicatorMiddleSection}>
                      <ThemedText style={styles.indicatorNameCompact} numberOfLines={2}>
                        {indicator.name}
                      </ThemedText>
                      {explanation ? (
                        <ThemedText style={styles.indicatorExplanation} numberOfLines={2}>
                          {explanation}
                        </ThemedText>
                      ) : null}
                    </View>

                    <View style={styles.compactResponseButtons}>
                      {(['yes', 'no', 'na'] as const).map((value) => {
                        const isSelected = currentResponse === value;
                        return (
                          <Pressable
                            key={value}
                            style={[
                              styles.compactResponseBtn,
                              isSelected && value === 'yes' && styles.yesSelectedCompact,
                              isSelected && value === 'no' && styles.noSelectedCompact,
                              isSelected && value === 'na' && styles.naSelectedCompact,
                            ]}
                            onPress={() => handleResponseChange(indicator.id, value)}
                          >
                            <ThemedText style={[
                              styles.compactResponseText,
                              isSelected && value === 'yes' && { color: '#fff' },
                              isSelected && value === 'no' && { color: '#fff' },
                              isSelected && value === 'na' && { color: '#fff' },
                            ]}>
                              {value === 'yes' ? 'Y' : value === 'no' ? 'N' : 'NA'}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.indicatorBottomRow}>
                    {images.length > 0 ? (
                      <View style={styles.compactImagesRow}>
                        {images.map(img => (
                          <View key={img.id} style={styles.compactImageWrapper}>
                            <Image source={{ uri: img.uri }} style={styles.compactThumbnail} />
                            <Pressable 
                              style={styles.compactDeleteBtn}
                              onPress={() => handleRemoveImage(indicator.id, img.id)}
                            >
                              <Feather name="x" size={10} color="#fff" />
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    ) : null}
                    
                    <Pressable
                      style={styles.compactCameraBtn}
                      onPress={() => handleCaptureImage(indicator.id)}
                      disabled={images.length >= 3}
                    >
                      <Feather name="camera" size={14} color={theme.primary} />
                      <ThemedText style={[styles.compactCameraText, { color: theme.primary }]}>
                        {images.length > 0 ? `(${images.length}/3)` : "Photo"}
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        ))}

        {scorePreview ? (
          <Card style={styles.scoreSummaryCard}>
            <ThemedText style={styles.scoreSummaryTitle}>Assessment Summary</ThemedText>
            
            <View style={styles.totalScoreSection}>
              <View style={styles.totalScoreCircle}>
                <ThemedText style={styles.totalScoreValue}>{scorePreview.totalScore}</ThemedText>
                <ThemedText style={styles.totalScoreLabel}>Total Score</ThemedText>
              </View>
              <View style={[
                styles.riskBadgeLarge,
                { backgroundColor: RISK_COLORS[scorePreview.riskClassification as keyof typeof RISK_COLORS]?.bg || '#E5E7EB' }
              ]}>
                <ThemedText style={[
                  styles.riskBadgeLargeText,
                  { color: RISK_COLORS[scorePreview.riskClassification as keyof typeof RISK_COLORS]?.text || '#374151' }
                ]}>
                  {scorePreview.riskClassification?.toUpperCase()} RISK
                </ThemedText>
              </View>
            </View>
            
            <View style={styles.deviationCountsRow}>
              <View style={[styles.deviationBox, { backgroundColor: '#FEE2E2' }]}>
                <ThemedText style={[styles.deviationCount, { color: '#DC2626' }]}>{scorePreview.highRiskCount || 0}</ThemedText>
                <ThemedText style={styles.deviationLabel}>High Risk</ThemedText>
              </View>
              <View style={[styles.deviationBox, { backgroundColor: '#FEF3C7' }]}>
                <ThemedText style={[styles.deviationCount, { color: '#D97706' }]}>{scorePreview.mediumRiskCount || 0}</ThemedText>
                <ThemedText style={styles.deviationLabel}>Medium Risk</ThemedText>
              </View>
              <View style={[styles.deviationBox, { backgroundColor: '#D1FAE5' }]}>
                <ThemedText style={[styles.deviationCount, { color: '#059669' }]}>{scorePreview.lowRiskCount || 0}</ThemedText>
                <ThemedText style={styles.deviationLabel}>Low Risk</ThemedText>
              </View>
            </View>
            
            <ThemedText style={styles.pillarScoresTitle}>Pillar-wise Scores</ThemedText>
            {scorePreview.pillarScores?.map((pillar, index) => (
              <View key={index} style={styles.pillarScoreRow}>
                <View style={styles.pillarScoreInfo}>
                  <ThemedText style={styles.pillarScoreName}>{pillar.pillarName}</ThemedText>
                  <ThemedText style={styles.pillarScoreValue}>{pillar.score}/{pillar.maxScore}</ThemedText>
                </View>
                <View style={styles.pillarProgressBar}>
                  <View 
                    style={[
                      styles.pillarProgressFill, 
                      { 
                        width: `${pillar.percentage}%`,
                        backgroundColor: pillar.percentage >= 80 ? '#059669' : pillar.percentage >= 50 ? '#D97706' : '#DC2626'
                      }
                    ]} 
                  />
                </View>
                <ThemedText style={styles.pillarPercentage}>{pillar.percentage}%</ThemedText>
              </View>
            ))}
          </Card>
        ) : null}

        <View style={styles.submitSection}>
          <Button
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Submit & Generate PDF Report"}
          </Button>
        </View>
      </ScrollView>

      <Modal visible={showInstitutionTypeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Select Institution Type</ThemedText>
              <Pressable onPress={() => setShowInstitutionTypeModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView style={styles.personTypesList}>
              {institutionTypes.map((type) => (
                <Pressable
                  key={type.id}
                  style={[
                    styles.personTypeItem, 
                    { borderColor: theme.border },
                    selectedInstitutionTypeId === type.id && { backgroundColor: theme.primary + '15' }
                  ]}
                  onPress={() => {
                    setSelectedInstitutionTypeId(type.id);
                    setShowInstitutionTypeModal(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.personTypeName}>{type.name}</ThemedText>
                    <ThemedText style={styles.personTypeDesc}>{type.description}</ThemedText>
                  </View>
                  {selectedInstitutionTypeId === type.id ? (
                    <Feather name="check-circle" size={20} color={theme.primary} />
                  ) : (
                    <Feather name="circle" size={20} color={theme.textSecondary} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showPersonTypeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Select Person Type</ThemedText>
              <Pressable onPress={() => setShowPersonTypeModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView style={styles.personTypesList}>
              {personTypes.map((pt) => {
                const existingCount = addedPersons.filter(p => p.personTypeId === pt.id).length;
                const isMaxed = existingCount >= pt.maxCount;
                return (
                  <Pressable
                    key={pt.id}
                    style={[styles.personTypeItem, { borderColor: theme.border }, isMaxed && styles.personTypeItemDisabled]}
                    onPress={() => !isMaxed && handleSelectPersonType(pt)}
                    disabled={isMaxed}
                  >
                    <View>
                      <ThemedText style={styles.personTypeName}>{pt.typeName}</ThemedText>
                      <ThemedText style={styles.personTypeDesc}>{pt.description}</ThemedText>
                      <ThemedText style={styles.personTypeCount}>
                        {existingCount}/{pt.maxCount} added
                      </ThemedText>
                    </View>
                    <Feather name="chevron-right" size={20} color={isMaxed ? '#9CA3AF' : theme.primary} />
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showPersonFormModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Add {selectedPersonType?.typeName}</ThemedText>
              <Pressable onPress={() => setShowPersonFormModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView style={styles.personFormFields}>
              {selectedPersonType?.fields.map((field) => (
                <View key={field.key} style={styles.formField}>
                  <ThemedText style={styles.fieldLabel}>
                    {field.label} {field.required ? '*' : ''}
                  </ThemedText>
                  <RNTextInput
                    style={[styles.fieldInput, { borderColor: theme.border, color: theme.text }]}
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                    placeholderTextColor={theme.textSecondary}
                    value={personFormData[field.key] || ''}
                    onChangeText={(text) => setPersonFormData(prev => ({ ...prev, [field.key]: text }))}
                    keyboardType={field.type === 'phone' ? 'phone-pad' : field.type === 'email' ? 'email-address' : 'default'}
                  />
                </View>
              ))}
            </ScrollView>
            <Button onPress={handleSavePerson} style={styles.savePersonBtn}>
              Save Person
            </Button>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  scoreLabel: { fontSize: FontSize.md, fontWeight: '500' },
  scoreValue: { fontSize: FontSize.xl, fontWeight: '700' },
  classificationBadge: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: 20 },
  classificationText: { fontSize: FontSize.sm, fontWeight: '700' },
  scrollView: { flex: 1 },
  scrollContent: { padding: Spacing.md },
  institutionCard: { padding: Spacing.lg, marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '600', marginBottom: Spacing.md },
  input: { marginBottom: Spacing.sm },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  locationText: { fontSize: FontSize.sm },
  personsCard: { padding: Spacing.lg, marginBottom: Spacing.lg },
  personsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  addPersonBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: 8 },
  addPersonBtnText: { color: 'white', fontWeight: '600', fontSize: FontSize.sm },
  personsList: { gap: Spacing.sm },
  personItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, borderWidth: 1, borderRadius: 8 },
  personInfo: { flex: 1 },
  personType: { fontSize: FontSize.xs, color: '#6B7280', marginBottom: 2 },
  personName: { fontSize: FontSize.md, fontWeight: '600' },
  personMobile: { fontSize: FontSize.sm, color: '#6B7280' },
  personDesignation: { fontSize: FontSize.sm, color: '#6B7280', fontStyle: 'italic' },
  noPersonsText: { fontSize: FontSize.sm, color: '#9CA3AF', textAlign: 'center', paddingVertical: Spacing.md },
  assessmentTitleCard: { padding: Spacing.md, marginBottom: Spacing.lg },
  assessmentTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  assessmentTitleContent: { flex: 1 },
  assessmentTitle: { fontSize: FontSize.lg, fontWeight: '700' },
  assessmentSubtitle: { fontSize: FontSize.sm, color: '#6B7280' },
  assessmentDesc: { fontSize: FontSize.xs, color: '#9CA3AF', lineHeight: 18 },
  pillarSection: { marginBottom: Spacing.lg },
  pillarHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: 8, marginBottom: Spacing.xs, gap: Spacing.sm },
  pillarNumberBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center' },
  pillarNumber: { fontSize: FontSize.md, fontWeight: '700', color: '#FFFFFF' },
  pillarName: { fontSize: FontSize.sm, fontWeight: '600', color: '#FFFFFF', flex: 1 },
  pillarIndicatorCount: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.8)' },
  indicatorCard: { marginBottom: Spacing.sm, padding: Spacing.md },
  indicatorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  indicatorNumber: { fontSize: FontSize.sm, fontWeight: '600', color: '#6B7280' },
  riskBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: 10 },
  riskBadgeText: { fontSize: 10, fontWeight: '600' },
  indicatorName: { fontSize: FontSize.sm, marginBottom: Spacing.sm, lineHeight: 20 },
  responseButtons: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  responseBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: 6, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', backgroundColor: '#F9FAFB' },
  yesSelected: { backgroundColor: '#D1FAE5', borderColor: '#059669' },
  noSelected: { backgroundColor: '#FEE2E2', borderColor: '#DC2626' },
  naSelected: { backgroundColor: '#E5E7EB', borderColor: '#6B7280' },
  responseBtnText: { fontSize: FontSize.sm, fontWeight: '600', color: '#6B7280' },
  compactIndicator: { backgroundColor: '#fff', marginBottom: 2, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  indicatorTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  indicatorLeftSection: { alignItems: 'center', width: 40 },
  indicatorNumberContainer: { backgroundColor: '#F3F4F6', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  indicatorNumberCompact: { fontSize: 10, fontWeight: '600', color: '#6B7280' },
  riskDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  indicatorMiddleSection: { flex: 1 },
  indicatorNameCompact: { fontSize: FontSize.sm, fontWeight: '600', lineHeight: 18 },
  indicatorExplanation: { fontSize: 11, color: '#6B7280', lineHeight: 15, marginTop: 2 },
  compactResponseButtons: { flexDirection: 'row', gap: 4 },
  compactResponseBtn: { width: 28, height: 28, borderRadius: 4, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center' },
  yesSelectedCompact: { backgroundColor: '#059669', borderColor: '#059669' },
  noSelectedCompact: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  naSelectedCompact: { backgroundColor: '#6B7280', borderColor: '#6B7280' },
  compactResponseText: { fontSize: 10, fontWeight: '700', color: '#6B7280' },
  indicatorBottomRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.xs, marginLeft: 48 },
  compactImagesRow: { flexDirection: 'row', gap: 4, flex: 1 },
  compactImageWrapper: { width: 36, height: 36, borderRadius: 4, overflow: 'hidden', position: 'relative' },
  compactThumbnail: { width: '100%', height: '100%' },
  compactDeleteBtn: { position: 'absolute', top: 0, right: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: '#DC2626', justifyContent: 'center', alignItems: 'center' },
  compactCameraBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderStyle: 'dashed', borderColor: '#D1D5DB', borderRadius: 4 },
  compactCameraText: { fontSize: 10, fontWeight: '500' },
  imagesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  imageWrapper: { width: 100, height: 75, borderRadius: BorderRadius.sm, overflow: 'hidden', position: 'relative' },
  viewShot: { flex: 1, position: 'relative' },
  capturedImage: { width: '100%', height: '100%' },
  watermarkContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '20%', backgroundColor: 'rgba(0, 0, 0, 0.7)', paddingHorizontal: 2, justifyContent: 'center' },
  watermarkText: { fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }), fontSize: 4, color: '#ffffff', lineHeight: 5 },
  gpsText: { color: '#90EE90' },
  removeImageBtn: { position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#dc3545', justifyContent: 'center', alignItems: 'center' },
  cameraBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm, borderWidth: 1, borderStyle: 'dashed', borderRadius: 6 },
  cameraBtnText: { fontSize: FontSize.sm, fontWeight: '500' },
  submitSection: { marginTop: Spacing.xl, paddingTop: Spacing.lg, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '600' },
  personTypesList: { maxHeight: 400 },
  personTypeItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, borderWidth: 1, borderRadius: 8, marginBottom: Spacing.sm },
  personTypeItemDisabled: { opacity: 0.5 },
  personTypeName: { fontSize: FontSize.md, fontWeight: '600' },
  personTypeDesc: { fontSize: FontSize.sm, color: '#6B7280', marginTop: 2 },
  personTypeCount: { fontSize: FontSize.xs, color: '#9CA3AF', marginTop: 4 },
  personFormFields: { maxHeight: 350 },
  formField: { marginBottom: Spacing.md },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: '500', marginBottom: Spacing.xs },
  fieldInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: FontSize.md },
  savePersonBtn: { marginTop: Spacing.md },
  dropdownButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, marginBottom: Spacing.sm },
  dropdownText: { fontSize: FontSize.md, flex: 1 },
  scoreSummaryCard: { marginHorizontal: Spacing.md, marginBottom: Spacing.lg, padding: Spacing.lg },
  scoreSummaryTitle: { fontSize: FontSize.lg, fontWeight: '700', marginBottom: Spacing.md, textAlign: 'center' },
  totalScoreSection: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: Spacing.lg, marginBottom: Spacing.lg },
  totalScoreCircle: { alignItems: 'center', justifyContent: 'center', width: 80, height: 80, borderRadius: 40, backgroundColor: '#F3F4F6', borderWidth: 3, borderColor: '#3B82F6' },
  totalScoreValue: { fontSize: 24, fontWeight: '700', color: '#3B82F6' },
  totalScoreLabel: { fontSize: 10, color: '#6B7280' },
  riskBadgeLarge: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: 8 },
  riskBadgeLargeText: { fontSize: FontSize.md, fontWeight: '700' },
  deviationCountsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: Spacing.lg },
  deviationBox: { alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderRadius: 8, minWidth: 80 },
  deviationCount: { fontSize: FontSize.xl, fontWeight: '700' },
  deviationLabel: { fontSize: FontSize.xs, color: '#6B7280', marginTop: 2 },
  pillarScoresTitle: { fontSize: FontSize.md, fontWeight: '600', marginBottom: Spacing.sm },
  pillarScoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm, gap: Spacing.sm },
  pillarScoreInfo: { width: 140 },
  pillarScoreName: { fontSize: FontSize.xs, color: '#374151' },
  pillarScoreValue: { fontSize: FontSize.xs, color: '#6B7280' },
  pillarProgressBar: { flex: 1, height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  pillarProgressFill: { height: '100%', borderRadius: 4 },
  pillarPercentage: { width: 40, fontSize: FontSize.xs, fontWeight: '600', textAlign: 'right' },
  successCard: { padding: Spacing.xl, alignItems: 'center' },
  successIconContainer: { marginBottom: Spacing.lg },
  successTitle: { fontSize: 24, fontWeight: '700', marginBottom: Spacing.sm, textAlign: 'center' },
  successSubtitle: { fontSize: FontSize.md, color: '#6B7280', marginBottom: Spacing.xl, textAlign: 'center' },
  successScoreSection: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, marginBottom: Spacing.xl },
  downloadButton: { width: '100%', marginBottom: Spacing.md },
  newAssessmentButton: { width: '100%' },
});
