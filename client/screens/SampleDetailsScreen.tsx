import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import * as ImagePicker from "expo-image-picker";
import { WebView } from "react-native-webview";
import { ThemedText } from "@/components/ThemedText";
import { StatusBadge } from "@/components/StatusBadge";
import { useTheme } from "@/hooks/useTheme";
import { useAuthContext } from "@/context/AuthContext";
import { storage } from "@/lib/storage";
import { getApiUrl, apiRequest } from "@/lib/query-client";
import { Sample } from "@/types";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

interface DocumentTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  content: string;
  pageSize: string;
  orientation: string;
  fontFamily?: string;
  fontSize?: number;
  showPageNumbers?: boolean;
  pageNumberFormat?: string;
  pageNumberPosition?: string;
  pageNumberOffset?: number;
  showContinuationText?: boolean;
  continuationFormat?: string;
  createdAt: string;
}

interface InputField {
  name: string;
  type: "text" | "date" | "select" | "textarea" | "number" | "image";
  label: string;
  required?: boolean;
  options?: string[];
}

interface WorkflowNode {
  id: string;
  name: string;
  description: string;
  position: number;
  nodeType: "action" | "decision" | "end";
  icon: string;
  color: string;
  inputFields: InputField[];
  templateIds: string[];
  isStartNode: boolean;
  isEndNode: boolean;
  autoAdvanceCondition?: string;
  editFreezeHours?: number;
  status: string;
}

interface WorkflowTransition {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  conditionType: "always" | "lab_result" | "field_value";
  conditionField?: string;
  conditionOperator?: "equals" | "not_equals" | "contains";
  conditionValue?: string;
  label?: string;
  status: string;
}

interface WorkflowState {
  id: string;
  sampleId: string;
  currentNodeId: string;
  nodeData: Record<string, any> | null;
  enteredAt: string;
  completedAt: string | null;
  status: "active" | "completed" | "skipped";
}

type RouteParams = {
  SampleDetails: { sampleId: string };
};

const iconMap: Record<string, keyof typeof Feather.glyphMap> = {
  package: "package",
  truck: "truck",
  "file-text": "file-text",
  "check-circle": "check-circle",
  "alert-triangle": "alert-triangle",
  clock: "clock",
  shield: "shield",
  send: "send",
};

interface DynamicTimelineStepProps {
  node: WorkflowNode;
  date?: string;
  isActive: boolean;
  isComplete: boolean;
  isLast?: boolean;
  isBranch?: boolean;
  branchLabel?: string;
  isLocked?: boolean;
  savedData?: Record<string, any> | null;
  templates?: DocumentTemplate[];
  onPress: () => void;
  onPreviewTemplate?: (template: DocumentTemplate) => void;
  onDownloadTemplate?: (template: DocumentTemplate) => void;
  onPreviewImage?: (uri: string) => void;
}

function isImageUri(value: any): boolean {
  if (typeof value !== "string") return false;
  return (
    value.startsWith("file://") ||
    value.startsWith("data:image") ||
    value.startsWith("content://") ||
    value.startsWith("blob:") ||
    /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(value)
  );
}

function DynamicTimelineStep({
  node,
  date,
  isActive,
  isComplete,
  isLast,
  isBranch,
  branchLabel,
  isLocked,
  savedData,
  templates = [],
  onPress,
  onPreviewTemplate,
  onDownloadTemplate,
  onPreviewImage,
}: DynamicTimelineStepProps) {
  const { theme } = useTheme();
  const nodeColor = node.color || theme.primary;
  const color = isComplete
    ? theme.success
    : isActive
      ? nodeColor
      : theme.textSecondary;
  const iconName = iconMap[node.icon] || "circle";

  const assignedTemplates = templates.filter((t) =>
    node.templateIds?.includes(t.id),
  );

  return (
    <Pressable onPress={onPress} style={styles.timelineStep}>
      <View style={styles.timelineLeft}>
        <View
          style={[
            styles.timelineIcon,
            { backgroundColor: color + "20", borderColor: color },
          ]}
        >
          <Feather
            name={isComplete ? "check" : iconName}
            size={16}
            color={color}
          />
        </View>
        {!isLast ? (
          <View
            style={[
              styles.timelineLine,
              { backgroundColor: isComplete ? theme.success : theme.border },
            ]}
          />
        ) : null}
      </View>
      <View style={styles.timelineContent}>
        <View style={styles.timelineHeader}>
          <ThemedText type="h4" style={{ color }}>
            {node.name}
          </ThemedText>
          {node.nodeType === "decision" ? (
            <View
              style={[
                styles.nodeTypeBadge,
                { backgroundColor: theme.warning + "20" },
              ]}
            >
              <ThemedText
                type="small"
                style={{ color: theme.warning, fontSize: 10 }}
              >
                DECISION
              </ThemedText>
            </View>
          ) : node.isEndNode ? (
            <View
              style={[
                styles.nodeTypeBadge,
                { backgroundColor: theme.success + "20" },
              ]}
            >
              <ThemedText
                type="small"
                style={{ color: theme.success, fontSize: 10 }}
              >
                END
              </ThemedText>
            </View>
          ) : null}
          {isLocked ? (
            <View
              style={[
                styles.tapBadge,
                { backgroundColor: theme.textSecondary + "15" },
              ]}
            >
              <Feather name="lock" size={10} color={theme.textSecondary} />
              <ThemedText
                type="small"
                style={{ color: theme.textSecondary, fontSize: 10 }}
              >
                LOCKED
              </ThemedText>
            </View>
          ) : (
            <View
              style={[
                styles.tapBadge,
                { backgroundColor: theme.primary + "15" },
              ]}
            >
              <Feather name="edit-2" size={10} color={theme.primary} />
              <ThemedText
                type="small"
                style={{ color: theme.primary, fontSize: 10 }}
              >
                TAP
              </ThemedText>
            </View>
          )}
        </View>
        {isBranch && branchLabel ? (
          <ThemedText
            type="small"
            style={{ color: theme.warning, fontStyle: "italic" }}
          >
            {branchLabel}
          </ThemedText>
        ) : null}
        {date ? (
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {date}
          </ThemedText>
        ) : (
          <ThemedText type="small" style={{ color: theme.textDisabled }}>
            Pending
          </ThemedText>
        )}
        {node.description ? (
          <ThemedText
            type="small"
            style={{ color: theme.textSecondary, marginTop: 2 }}
          >
            {node.description}
          </ThemedText>
        ) : null}
        {assignedTemplates.length > 0 ? (
          <View
            style={[
              styles.nodeTemplatesContainer,
              {
                backgroundColor: theme.primary + "08",
                borderColor: theme.primary + "20",
              },
            ]}
          >
            <View style={styles.nodeTemplatesHeader}>
              <Feather name="file-text" size={12} color={theme.primary} />
              <ThemedText
                type="small"
                style={{ color: theme.primary, fontWeight: "600" }}
              >
                Documents
              </ThemedText>
            </View>
            <View style={styles.nodeTemplatesListVertical}>
              {assignedTemplates.map((template) => (
                <View
                  key={template.id}
                  style={[
                    styles.nodeTemplateRow,
                    {
                      backgroundColor: theme.backgroundDefault,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Feather name="file" size={14} color={theme.primary} />
                  <ThemedText
                    type="small"
                    style={[styles.nodeTemplateName, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {template.name}
                  </ThemedText>
                  <View style={styles.nodeTemplateActions}>
                    <Pressable
                      style={[
                        styles.templateActionBtn,
                        { backgroundColor: theme.primary + "15" },
                      ]}
                      onPress={(e) => {
                        e.stopPropagation();
                        onPreviewTemplate?.(template);
                      }}
                    >
                      <Feather name="eye" size={14} color={theme.primary} />
                    </Pressable>
                    <Pressable
                      style={[
                        styles.templateActionBtn,
                        { backgroundColor: theme.success + "15" },
                      ]}
                      onPress={(e) => {
                        e.stopPropagation();
                        onDownloadTemplate?.(template);
                      }}
                    >
                      <Feather
                        name="download"
                        size={14}
                        color={theme.success}
                      />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        {savedData && Object.keys(savedData).length > 0 ? (
          <View
            style={[
              styles.savedDataContainer,
              {
                backgroundColor: theme.success + "10",
                borderColor: theme.success + "30",
              },
            ]}
          >
            <View style={styles.savedDataHeader}>
              <Feather name="check-circle" size={12} color={theme.success} />
              <ThemedText
                type="small"
                style={{ color: theme.success, fontWeight: "600" }}
              >
                Update Recorded
              </ThemedText>
            </View>
            {Object.entries(savedData)
              .slice(0, 5)
              .map(([key, value]) =>
                isImageUri(value) ? (
                  <View key={key} style={styles.savedDataImageRow}>
                    <ThemedText
                      type="small"
                      style={{
                        color: theme.textSecondary,
                        textTransform: "capitalize",
                      }}
                    >
                      {key.replace(/_/g, " ")}:
                    </ThemedText>
                    <View style={styles.savedImageThumbnailContainer}>
                      <Image
                        source={{ uri: value }}
                        style={styles.savedImageThumbnail}
                        resizeMode="cover"
                      />
                    </View>
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        onPreviewImage?.(value);
                      }}
                      style={[
                        styles.savedImagePreviewBtn,
                        { backgroundColor: theme.primary },
                      ]}
                    >
                      <Feather name="eye" size={12} color="#fff" />
                    </Pressable>
                  </View>
                ) : (
                  <View key={key} style={styles.savedDataRow}>
                    <ThemedText
                      type="small"
                      style={{
                        color: theme.textSecondary,
                        textTransform: "capitalize",
                      }}
                    >
                      {key.replace(/_/g, " ")}:
                    </ThemedText>
                    <ThemedText
                      type="small"
                      style={{ color: theme.text }}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {String(value)}
                    </ThemedText>
                  </View>
                ),
              )}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

interface SampleWithInspection extends Sample {
  establishmentName?: string;
  fboName?: string;
  fboAddress?: string;
  fboLicense?: string;
  inspectionDate?: string;
  inspectionType?: string;
}

export default function SampleDetailsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<RouteProp<RouteParams, "SampleDetails">>();
  const { user, activeJurisdiction } = useAuthContext();
  const queryClient = useQueryClient();

  const [sample, setSample] = useState<SampleWithInspection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeDateField, setActiveDateField] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] =
    useState<DocumentTemplate | null>(null);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(0.5);
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const [imagePreviewModalVisible, setImagePreviewModalVisible] =
    useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const sampleId = route.params.sampleId;

  const { data: templates = [] } = useQuery<DocumentTemplate[]>({
    queryKey: ["/api/templates"],
  });

  const { data: workflowNodes = [] } = useQuery<WorkflowNode[]>({
    queryKey: ["/api/admin/workflow/nodes"],
  });

  const { data: workflowTransitions = [] } = useQuery<WorkflowTransition[]>({
    queryKey: ["/api/admin/workflow/transitions"],
  });

  const { data: workflowStates = [], refetch: refetchWorkflowStates } =
    useQuery<WorkflowState[]>({
      queryKey: ["/api/samples", sampleId, "workflow-state"],
      queryFn: async () => {
        const url = new URL(
          `/api/samples/${sampleId}/workflow-state`,
          getApiUrl(),
        );
        const response = await fetch(url.toString());
        if (!response.ok) throw new Error("Failed to fetch workflow state");
        return response.json();
      },
      enabled: !!sampleId,
    });

  const { data: workflowSettings } = useQuery<{
    nodeEditHours: number;
    allowNodeEdit: boolean;
  }>({
    queryKey: ["/api/workflow/settings"],
    queryFn: async () => {
      const url = new URL("/api/workflow/settings", getApiUrl());
      const response = await fetch(url.toString());
      if (!response.ok) return { nodeEditHours: 48, allowNodeEdit: true };
      return response.json();
    },
  });

  const saveWorkflowStateMutation = useMutation({
    mutationFn: async ({
      nodeId,
      nodeData,
    }: {
      nodeId: string;
      nodeData: Record<string, any>;
    }) => {
      return apiRequest("POST", `/api/samples/${sampleId}/workflow-state`, {
        nodeId,
        nodeData,
      });
    },
    onSuccess: () => {
      refetchWorkflowStates();
      queryClient.invalidateQueries({
        queryKey: ["/api/samples", sampleId, "workflow-state"],
      });
    },
  });

  const loadSample = useCallback(async () => {
    try {
      const inspections = await storage.getInspections(
        activeJurisdiction?.unitId,
      );
      let foundSample: SampleWithInspection | null = null;

      for (const inspection of inspections) {
        if (inspection.samples) {
          const found = inspection.samples.find(
            (s: Sample) => s.id === route.params.sampleId,
          );
          if (found) {
            foundSample = {
              ...found,
              establishmentName: inspection.fboDetails?.establishmentName,
              fboName: inspection.fboDetails?.name,
              fboAddress: inspection.fboDetails?.address,
              fboLicense:
                inspection.fboDetails?.licenseNumber ||
                inspection.fboDetails?.registrationNumber,
              inspectionDate: inspection.createdAt,
              inspectionType: inspection.type,
            };
            break;
          }
        }
      }

      if (!foundSample) {
        const samples = await storage.getSamples();
        const found = samples.find((s) => s.id === route.params.sampleId);
        if (found) {
          foundSample = found;
        }
      }

      setSample(foundSample);
    } catch (error) {
      console.error("Failed to load sample:", error);
    } finally {
      setIsLoading(false);
    }
  }, [activeJurisdiction?.unitId, route.params.sampleId]);

  useEffect(() => {
    loadSample();
  }, [loadSample]);

  // Listen for postMessage from iframe on web for page tracking
  useEffect(() => {
    if (Platform.OS !== "web") return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = event.data;
        if (data && typeof data === "object") {
          if (data.type === "totalPages") {
            setTotalPages(Math.max(1, data.value));
          } else if (data.type === "currentPage") {
            setCurrentPage(Math.min(data.value, totalPages));
          }
        }
      } catch (_e) {
        // Ignore parse errors
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [totalPages]);

  const getStateForNode = useCallback(
    (nodeId: string): WorkflowState | undefined => {
      return workflowStates.find((s) => s.currentNodeId === nodeId);
    },
    [workflowStates],
  );

  const isNodeEditable = useCallback(
    (nodeId: string): { editable: boolean; reason?: string } => {
      if (!workflowSettings?.allowNodeEdit) {
        return {
          editable: false,
          reason: "Node editing is disabled by administrator",
        };
      }

      const nodeState = getStateForNode(nodeId);
      if (!nodeState?.completedAt) {
        return { editable: true }; // Node not completed yet, always editable
      }

      // Get node-specific freeze hours, fall back to global setting
      const node = workflowNodes.find((n) => n.id === nodeId);
      const nodeEditHours =
        node?.editFreezeHours ?? workflowSettings?.nodeEditHours ?? 48;

      // Special cases: 0 = always editable, -1 = never editable
      if (nodeEditHours === 0) {
        return { editable: true };
      }
      if (nodeEditHours === -1) {
        return {
          editable: false,
          reason: "This node is locked and cannot be edited after submission.",
        };
      }

      const completedAt = new Date(nodeState.completedAt);
      const now = new Date();
      const hoursSinceCompletion =
        (now.getTime() - completedAt.getTime()) / (1000 * 60 * 60);

      if (hoursSinceCompletion > nodeEditHours) {
        const hoursAgo = Math.round(hoursSinceCompletion);
        const freezeLabel =
          nodeEditHours < 24
            ? `${nodeEditHours} hours`
            : `${Math.round(nodeEditHours / 24)} day(s)`;
        return {
          editable: false,
          reason: `This node was completed ${hoursAgo} hours ago. Editing is only allowed within ${freezeLabel} of completion.`,
        };
      }

      return { editable: true };
    },
    [workflowSettings, workflowNodes, getStateForNode],
  );

  const openNodeModal = (node: WorkflowNode) => {
    const { editable, reason } = isNodeEditable(node.id);

    if (!editable) {
      Alert.alert("Node Locked", reason || "This node cannot be edited.");
      return;
    }

    const existingState = getStateForNode(node.id);
    setSelectedNode(node);
    setFormData(existingState?.nodeData || {});
    setModalVisible(true);
  };

  const handleSaveNodeData = async () => {
    if (!selectedNode) return;

    setIsSaving(true);
    try {
      await saveWorkflowStateMutation.mutateAsync({
        nodeId: selectedNode.id,
        nodeData: formData,
      });
      setModalVisible(false);
      setSelectedNode(null);
      setFormData({});
      Alert.alert("Success", "Workflow update saved successfully");
    } catch (error) {
      console.error("Failed to save workflow state:", error);
      Alert.alert("Error", "Failed to save workflow update. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const replacePlaceholders = (content: string): string => {
    const now = new Date();

    const formatDateFn = (dateStr?: string) => {
      if (!dateStr) return "[Date]";
      return new Date(dateStr).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    };

    const formatDateShort = (dateStr?: string) => {
      if (!dateStr) return "[Date]";
      const date = new Date(dateStr);
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    };

    const placeholderValues: Record<string, string> = {
      officer_name: user?.name || "",
      officer_designation: user?.designation || "Food Safety Officer",
      officer_email: user?.email || "",
      officer_phone: user?.phone || "",
      officer_employee_id: user?.employeeId || "",
      jurisdiction_name:
        user?.jurisdiction?.unitName || activeJurisdiction?.unitName || "",
      jurisdiction_type:
        user?.jurisdiction?.roleName || activeJurisdiction?.roleName || "",
      current_date: now.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
      current_time: now.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      fbo_name: sample?.fboName || "[FBO Name]",
      fbo_address: sample?.fboAddress || "[FBO Address]",
      fbo_license: sample?.fboLicense || "[FBO License Number]",
      establishment_name: sample?.establishmentName || "[Establishment Name]",
      inspection_date: sample?.inspectionDate
        ? formatDateFn(sample.inspectionDate)
        : "[Inspection Date]",
      inspection_type: sample?.inspectionType || "[Inspection Type]",
      sample_code: sample?.code || "[Sample Code]",
      sample_name: sample?.name || "[Sample Name]",
      sample_type:
        sample?.sampleType === "enforcement"
          ? "Enforcement"
          : sample?.sampleType === "surveillance"
            ? "Surveillance"
            : "[Sample Type]",
      sample_lifted_date: sample?.liftedDate
        ? formatDateFn(sample.liftedDate)
        : "[Lifted Date]",
      sample_lifted_date_short: sample?.liftedDate
        ? formatDateShort(sample.liftedDate)
        : "[Lifted Date]",
      sample_lifted_place: sample?.liftedPlace || "[Lifted Place]",
      sample_cost: sample?.cost ? `Rs. ${sample.cost}` : "[Sample Cost]",
      sample_quantity: sample?.quantityInGrams
        ? `${sample.quantityInGrams} grams`
        : "[Quantity]",
      sample_packing_type:
        sample?.packingType === "packed"
          ? "PACKED"
          : sample?.packingType === "loose"
            ? "LOOSE"
            : "[Packing Type]",
      sample_preservative: sample?.preservativeAdded
        ? sample.preservativeType?.toUpperCase() || "YES"
        : "NIL",
      sample_dispatch_date: sample?.dispatchDate
        ? formatDateFn(sample.dispatchDate)
        : "[Dispatch Date]",
      sample_dispatch_mode: sample?.dispatchMode || "[Dispatch Mode]",
      manufacturer_name:
        sample?.manufacturerDetails?.name || "[Manufacturer Name]",
      manufacturer_address:
        sample?.manufacturerDetails?.address || "[Manufacturer Address]",
      manufacturer_license:
        sample?.manufacturerDetails?.licenseNumber || "[Manufacturer License]",
      mfg_date: sample?.mfgDate || "[Manufacturing Date]",
      expiry_date: sample?.useByDate || "[Expiry Date]",
      lot_batch_number: sample?.lotBatchNumber || "[Lot/Batch Number]",
      lab_report_date: sample?.labReportDate
        ? formatDateFn(sample.labReportDate)
        : "[Lab Report Date]",
      lab_result: sample?.labResult
        ? sample.labResult.replace("_", " ").toUpperCase()
        : "[Lab Result]",
    };

    let result = content;
    Object.entries(placeholderValues).forEach(([key, value]) => {
      // Wrap replaced values in bold tags for emphasis
      const boldValue =
        value && !value.startsWith("[") ? `<strong>${value}</strong>` : value;
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), boldValue);
    });
    return result;
  };

  const generatePdfHtml = (
    template: DocumentTemplate,
    zoom: number = 1,
  ): string => {
    const content = replacePlaceholders(template.content);

    // Page number settings from template
    const showPageNumbers = template.showPageNumbers !== false;
    const pageNumberFormat = template.pageNumberFormat || "page_x_of_y";
    const pageNumberPosition = template.pageNumberPosition || "center";
    const pageNumberOffset = template.pageNumberOffset || 0;
    const showContinuationText = template.showContinuationText || false;
    const continuationFormat = template.continuationFormat || "contd_on_page";

    // Page tracking script for multi-page support
    const pageTrackingScript = `
      <script>
        (function() {
          let totalPagesCount = 1;
          const showPageNumbers = ${showPageNumbers};
          const pageNumberFormat = '${pageNumberFormat}';
          const pageNumberPosition = '${pageNumberPosition}';
          const pageNumberOffset = ${pageNumberOffset};
          const showContinuationText = ${showContinuationText};
          const continuationFormat = '${continuationFormat}';
          
          function sendMessage(data) {
            // React Native WebView
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify(data));
            }
            // Web iframe - post to parent
            if (window.parent && window.parent !== window) {
              window.parent.postMessage(data, '*');
            }
          }
          
          function formatPageNumber(current, total) {
            switch(pageNumberFormat) {
              case 'x_of_y': return current + ' of ' + total;
              case 'x_colon': return current + ' :';
              case 'page_x': return 'Page ' + current;
              case 'x_only': return '' + current;
              case 'dash_x_dash': return '— ' + current + ' —';
              default: return 'Page ' + current + ' of ' + total;
            }
          }
          
          function getContinuationText(nextPage) {
            switch(continuationFormat) {
              case 'contd_on_page': return '—Contd. on Page ' + nextPage + '—';
              case 'continued_on': return 'Continued on Page ' + nextPage;
              case 'see_next': return 'See next page...';
              case 'to_be_continued': return 'To be continued...';
              default: return '—Contd. on Page ' + nextPage + '—';
            }
          }
          
          function calculatePages() {
            let pages = document.querySelectorAll('.page');
            if (pages.length === 0) {
              pages = document.querySelectorAll('.preview-page');
            }
            totalPagesCount = pages.length || 1;
            sendMessage({ type: 'totalPages', value: totalPagesCount });
            
            pages.forEach((page, index) => {
              page.style.position = 'relative';
              
              // Create or get footer row container for page number and continuation text
              let footerRow = page.querySelector('.footer-row');
              if (!footerRow) {
                footerRow = document.createElement('div');
                footerRow.className = 'footer-row';
                footerRow.style.cssText = 'position:absolute;bottom:8mm;left:0;right:0;display:flex;align-items:center;padding:0 ' + (pageNumberOffset || 15) + 'mm;font-family:serif;';
                page.appendChild(footerRow);
              }
              
              // Clear footer row content
              footerRow.innerHTML = '';
              
              const showCont = showContinuationText && index < pages.length - 1;
              
              if (showPageNumbers && showCont) {
                // Both: page number based on position, continuation on right
                if (pageNumberPosition === 'center') {
                  footerRow.innerHTML = '<span style="flex:1;"></span><span style="font-size:10pt;color:#374151;">' + formatPageNumber(index + 1, totalPagesCount) + '</span><span style="flex:1;text-align:right;font-size:9pt;color:#9ca3af;font-style:italic;">' + getContinuationText(index + 2) + '</span>';
                } else if (pageNumberPosition === 'left') {
                  footerRow.innerHTML = '<span style="font-size:10pt;color:#374151;">' + formatPageNumber(index + 1, totalPagesCount) + '</span><span style="flex:1;"></span><span style="font-size:9pt;color:#9ca3af;font-style:italic;">' + getContinuationText(index + 2) + '</span>';
                } else {
                  footerRow.innerHTML = '<span style="flex:1;"></span><span style="font-size:9pt;color:#9ca3af;font-style:italic;">' + getContinuationText(index + 2) + '</span><span style="margin-left:20px;font-size:10pt;color:#374151;">' + formatPageNumber(index + 1, totalPagesCount) + '</span>';
                }
              } else if (showPageNumbers) {
                // Only page number
                let justify = pageNumberPosition === 'left' ? 'flex-start' : (pageNumberPosition === 'right' ? 'flex-end' : 'center');
                footerRow.style.justifyContent = justify;
                footerRow.innerHTML = '<span style="font-size:10pt;color:#374151;">' + formatPageNumber(index + 1, totalPagesCount) + '</span>';
              } else if (showCont) {
                // Only continuation text on right
                footerRow.style.justifyContent = 'flex-end';
                footerRow.innerHTML = '<span style="font-size:9pt;color:#9ca3af;font-style:italic;">' + getContinuationText(index + 2) + '</span>';
              }
            });
          }
          
          function handleScroll() {
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            let pages = document.querySelectorAll('.page');
            if (pages.length === 0) {
              pages = document.querySelectorAll('.preview-page');
            }
            
            let currentPage = 1;
            for (let i = 0; i < pages.length; i++) {
              const pageTop = pages[i].offsetTop;
              if (scrollTop >= pageTop - 50) {
                currentPage = i + 1;
              }
            }
            
            currentPage = Math.min(currentPage, totalPagesCount);
            sendMessage({ type: 'currentPage', value: currentPage });
          }
          
          window.addEventListener('scroll', handleScroll);
          window.addEventListener('load', function() {
            setTimeout(function() {
              calculatePages();
              handleScroll();
            }, 200);
          });
          
          setTimeout(calculatePages, 300);
          setTimeout(handleScroll, 350);
        })();
      </script>
    `;

    const pageHeightMM = 297;
    const pageWidthMM = 210;
    const scaledHeightMM = pageHeightMM * zoom;
    const scaledWidthMM = pageWidthMM * zoom;
    const verticalGapMM = pageHeightMM - scaledHeightMM;
    const horizontalGapMM = (pageWidthMM - scaledWidthMM) / 2;

    const previewCSS = `
      * {
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
        -webkit-overflow-scrolling: touch !important;
      }
      *::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
        background: transparent !important;
      }
      *::-webkit-scrollbar-track {
        background: transparent !important;
      }
      *::-webkit-scrollbar-thumb {
        background: transparent !important;
      }
      html {
        overflow-x: hidden !important;
        overflow-y: scroll !important;
        scrollbar-width: none !important;
        background: #4b5563 !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
      }
      body {
        background: #4b5563 !important;
        margin: 0 !important;
        padding: 20px 0 !important;
        min-height: 100vh !important;
        overflow-x: hidden !important;
        width: 100% !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
      }
      .page {
        background: white !important;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3) !important;
        transform: scale(${zoom}) !important;
        transform-origin: top center !important;
        margin-left: -${horizontalGapMM}mm !important;
        margin-right: -${horizontalGapMM}mm !important;
        margin-bottom: calc(-${verticalGapMM}mm + 20px) !important;
      }
      .page:last-child {
        margin-bottom: 20px !important;
      }
      @media print {
        html, body {
          width: 210mm !important;
          height: auto !important;
          background: white !important;
          background-color: white !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          margin: 0 !important;
          padding: 0 !important;
        }
        .page {
          width: 210mm !important;
          height: 297mm !important;
          min-height: 297mm !important;
          max-height: 297mm !important;
          box-shadow: none !important;
          background: white !important;
          transform: none !important;
          margin: 0 !important;
          page-break-after: always;
          page-break-inside: avoid;
          overflow: hidden !important;
        }
        .page:last-child {
          page-break-after: auto;
        }
        .footer-row {
          position: absolute !important;
          bottom: 8mm !important;
        }
      }
    `;

    // Auto-detect if content is HTML by checking for HTML tags
    const trimmedContent = content.trim();
    const isHtml =
      trimmedContent.startsWith("<!DOCTYPE") ||
      trimmedContent.startsWith("<html") ||
      (trimmedContent.startsWith("<") &&
        (trimmedContent.includes("<style>") ||
          trimmedContent.includes("<style ") ||
          trimmedContent.includes("<div") ||
          trimmedContent.includes("<table") ||
          trimmedContent.includes("<head>")));

    if (isHtml) {
      // Inject preview CSS at the END of body for maximum override priority
      const overrideStyles = `<style id="preview-override">${previewCSS}</style>`;
      if (content.includes("</body>")) {
        return content.replace(
          "</body>",
          `${overrideStyles}${pageTrackingScript}</body>`,
        );
      } else if (content.includes("</html>")) {
        return content.replace(
          "</html>",
          `${overrideStyles}${pageTrackingScript}</html>`,
        );
      } else {
        return `${content}${overrideStyles}${pageTrackingScript}`;
      }
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    ${previewCSS}
    body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; }
    pre { white-space: pre-wrap; word-wrap: break-word; font-family: inherit; }
  </style>
</head>
<body>
  <pre>${content}</pre>
  ${pageTrackingScript}
</body>
</html>`;
  };

  const getSampleWorkflowPosition = () => {
    if (!sample)
      return { currentNodeIndex: -1, completedNodes: new Set<number>() };

    const sortedNodes = [...workflowNodes].sort(
      (a, b) => a.position - b.position,
    );
    const completedNodes = new Set<number>();
    let currentNodeIndex = 0;

    for (let i = 0; i < sortedNodes.length; i++) {
      const node = sortedNodes[i];
      const nodeState = getStateForNode(node.id);
      const nodeName = node.name.toLowerCase();

      if (nodeState?.status === "completed") {
        completedNodes.add(i);
        currentNodeIndex = i + 1;
      } else if (
        nodeName.includes("lifted") ||
        nodeName.includes("sample lifted")
      ) {
        if (sample.liftedDate) {
          completedNodes.add(i);
          currentNodeIndex = i + 1;
        }
      } else if (nodeName.includes("dispatch") || nodeName.includes("lab")) {
        if (nodeName.includes("dispatch")) {
          if (sample.dispatchDate) {
            completedNodes.add(i);
            currentNodeIndex = i + 1;
          }
        } else if (
          nodeName.includes("report") ||
          nodeName.includes("received")
        ) {
          if (sample.labReportDate) {
            completedNodes.add(i);
            currentNodeIndex = i + 1;
          }
        }
      } else if (node.nodeType === "decision" && sample.labReportDate) {
        completedNodes.add(i);
        currentNodeIndex = i + 1;
      }
    }

    return {
      currentNodeIndex: Math.min(currentNodeIndex, sortedNodes.length - 1),
      completedNodes,
    };
  };

  const getRelevantBranchNodes = () => {
    const sortedNodes = [...workflowNodes].sort(
      (a, b) => a.position - b.position,
    );
    const decisionNode = sortedNodes.find((n) => n.nodeType === "decision");
    if (!decisionNode) return [];

    // Try to get labResult from sample first, then from workflow state node data
    let labResult = sample?.labResult;
    if (!labResult) {
      const decisionNodeState = workflowStates.find(
        (s) => s.currentNodeId === decisionNode.id,
      );
      labResult = decisionNodeState?.nodeData?.labResult;
    }

    if (!labResult) return [];

    const relevantTransitions = workflowTransitions.filter(
      (t) =>
        t.fromNodeId === decisionNode.id &&
        t.conditionType === "lab_result" &&
        t.conditionValue?.toLowerCase() === labResult?.toLowerCase(),
    );

    return relevantTransitions
      .map((t) => {
        const targetNode = workflowNodes.find((n) => n.id === t.toNodeId);
        return { node: targetNode, transition: t };
      })
      .filter((item) => item.node) as {
      node: WorkflowNode;
      transition: WorkflowTransition;
    }[];
  };

  const renderDynamicTimeline = () => {
    if (workflowNodes.length === 0) {
      return (
        <View style={styles.emptyWorkflow}>
          <Feather name="loader" size={24} color={theme.textSecondary} />
          <ThemedText
            type="body"
            style={{ color: theme.textSecondary, textAlign: "center" }}
          >
            Loading workflow configuration...
          </ThemedText>
        </View>
      );
    }

    const sortedNodes = [...workflowNodes].sort(
      (a, b) => a.position - b.position,
    );
    const mainNodes = sortedNodes.filter(
      (n) => !n.isEndNode && n.nodeType !== "end" && n.position <= 2,
    );
    const { currentNodeIndex, completedNodes } = getSampleWorkflowPosition();
    const branchNodes = getRelevantBranchNodes();

    const getDateForNode = (node: WorkflowNode) => {
      const nodeState = getStateForNode(node.id);
      if (nodeState?.completedAt) {
        return formatDate(nodeState.completedAt);
      }
      const nodeName = node.name.toLowerCase();
      if (nodeName.includes("lifted")) return formatDate(sample?.liftedDate);
      if (nodeName.includes("dispatch"))
        return formatDate(sample?.dispatchDate);
      if (nodeName.includes("report") || nodeName.includes("received"))
        return formatDate(sample?.labReportDate);
      return undefined;
    };

    const timeline = mainNodes.map((node, idx) => {
      const isComplete = completedNodes.has(idx);
      const isActive = idx === currentNodeIndex;
      const isLast = idx === mainNodes.length - 1 && branchNodes.length === 0;
      const nodeState = getStateForNode(node.id);
      const { editable } = isNodeEditable(node.id);

      return (
        <DynamicTimelineStep
          key={node.id}
          node={node}
          date={getDateForNode(node)}
          isActive={isActive}
          isComplete={isComplete}
          isLast={isLast}
          isLocked={!editable}
          savedData={nodeState?.nodeData}
          templates={templates}
          onPress={() => openNodeModal(node)}
          onPreviewTemplate={handlePreviewTemplate}
          onDownloadTemplate={handleDownload}
          onPreviewImage={(uri) => {
            setPreviewImageUri(uri);
            setImagePreviewModalVisible(true);
          }}
        />
      );
    });

    if (branchNodes.length > 0) {
      branchNodes.forEach((item, idx) => {
        const nodeState = getStateForNode(item.node.id);
        const { editable: branchEditable } = isNodeEditable(item.node.id);
        timeline.push(
          <DynamicTimelineStep
            key={item.node.id}
            node={item.node}
            date={
              nodeState?.completedAt
                ? formatDate(nodeState.completedAt)
                : undefined
            }
            isActive={sample?.labReportDate != null}
            isComplete={nodeState?.status === "completed"}
            isLast={idx === branchNodes.length - 1}
            isBranch={true}
            branchLabel={item.transition.label}
            isLocked={!branchEditable}
            savedData={nodeState?.nodeData}
            templates={templates}
            onPress={() => openNodeModal(item.node)}
            onPreviewTemplate={handlePreviewTemplate}
            onDownloadTemplate={handleDownload}
            onPreviewImage={(uri) => {
              setPreviewImageUri(uri);
              setImagePreviewModalVisible(true);
            }}
          />,
        );
      });
    } else if (mainNodes.length > 0) {
      const decisionNode = sortedNodes.find((n) => n.nodeType === "decision");
      if (decisionNode && sample?.labReportDate && !sample?.labResult) {
        const pendingTransitions = workflowTransitions.filter(
          (t) => t.fromNodeId === decisionNode.id,
        );
        if (pendingTransitions.length > 0) {
          timeline.push(
            <View key="pending-branch" style={styles.branchInfo}>
              <Feather name="git-branch" size={16} color={theme.warning} />
              <ThemedText type="small" style={{ color: theme.warning }}>
                Awaiting lab result to determine next step...
              </ThemedText>
            </View>,
          );
        }
      }
    }

    return timeline;
  };

  const handleDownload = async (template: DocumentTemplate) => {
    setDownloadingId(template.id);
    try {
      const html = generatePdfHtml(template);

      if (Platform.OS === "web") {
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
          }, 500);
        } else {
          Alert.alert(
            "Popup Blocked",
            "Please allow popups to download the PDF.",
          );
        }
      } else {
        const { uri } = await Print.printToFileAsync({ html });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: "application/pdf",
            dialogTitle: `Share ${template.name}`,
            UTI: "com.adobe.pdf",
          });
        } else {
          Alert.alert("PDF Generated", `Document saved to: ${uri}`);
        }
      }
    } catch (error) {
      console.error("Download error:", error);
      Alert.alert("Error", "Failed to generate document. Please try again.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePreviewTemplate = (template: DocumentTemplate) => {
    setPreviewTemplate(template);
    // Calculate optimal zoom to fit A4 page in viewport
    // A4 at 96 DPI: 794 x 1123 pixels
    const pageWidth = 794;
    const pageHeight = 1123;
    // Get viewport dimensions (approximate, accounting for header and padding)
    const viewportWidth =
      (typeof window !== "undefined" ? window.innerWidth : 400) - 80;
    const viewportHeight =
      (typeof window !== "undefined" ? window.innerHeight : 700) - 150;
    // Calculate zoom to fit both dimensions
    const zoomX = viewportWidth / pageWidth;
    const zoomY = viewportHeight / pageHeight;
    const optimalZoom = Math.min(zoomX, zoomY, 1); // Max zoom 100%
    setPreviewZoom(Math.max(optimalZoom, 0.2)); // Min zoom 20%
    setPreviewModalVisible(true);
  };

  const renderInputField = (field: InputField) => {
    const value = formData[field.name] || "";

    switch (field.type) {
      case "textarea":
        return (
          <View key={field.name} style={styles.formField}>
            <ThemedText type="body" style={styles.fieldLabel}>
              {field.label}
              {field.required ? " *" : ""}
            </ThemedText>
            <TextInput
              style={[
                styles.textArea,
                {
                  borderColor: theme.border,
                  color: theme.text,
                  backgroundColor: theme.backgroundRoot,
                },
              ]}
              value={value}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, [field.name]: text }))
              }
              placeholder={`Enter ${field.label.toLowerCase()}`}
              placeholderTextColor={theme.textDisabled}
              multiline
              numberOfLines={4}
            />
          </View>
        );
      case "date":
        const formatDateValue = (dateStr: string) => {
          if (!dateStr) return "";
          try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            const day = String(date.getDate()).padStart(2, "0");
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const year = date.getFullYear();
            return `${day}-${month}-${year}`;
          } catch {
            return dateStr;
          }
        };

        const parseDateValue = (dateStr: string): Date => {
          if (!dateStr) return new Date();
          const parts = dateStr.split("-");
          if (parts.length === 3 && parts[0].length === 2) {
            return new Date(
              parseInt(parts[2]),
              parseInt(parts[1]) - 1,
              parseInt(parts[0]),
            );
          }
          const parsed = new Date(dateStr);
          return isNaN(parsed.getTime()) ? new Date() : parsed;
        };

        return (
          <View key={field.name} style={styles.formField}>
            <ThemedText type="body" style={styles.fieldLabel}>
              {field.label}
              {field.required ? " *" : ""}
            </ThemedText>
            <Pressable
              style={[
                styles.dateInput,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundRoot,
                },
              ]}
              onPress={() => {
                setActiveDateField(field.name);
                setShowDatePicker(true);
              }}
            >
              <Feather name="calendar" size={18} color={theme.primary} />
              <ThemedText
                type="body"
                style={{
                  color: value ? theme.text : theme.textDisabled,
                  flex: 1,
                }}
              >
                {value ? formatDateValue(value) : "DD-MM-YYYY"}
              </ThemedText>
            </Pressable>
            {showDatePicker && activeDateField === field.name ? (
              Platform.OS === "web" ? (
                <View style={styles.webDatePickerContainer}>
                  <input
                    type="date"
                    value={
                      value
                        ? parseDateValue(value).toISOString().split("T")[0]
                        : ""
                    }
                    onChange={(e) => {
                      const date = new Date(e.target.value);
                      const day = String(date.getDate()).padStart(2, "0");
                      const month = String(date.getMonth() + 1).padStart(
                        2,
                        "0",
                      );
                      const year = date.getFullYear();
                      setFormData((prev) => ({
                        ...prev,
                        [field.name]: `${day}-${month}-${year}`,
                      }));
                      setShowDatePicker(false);
                      setActiveDateField(null);
                    }}
                    style={{
                      padding: 12,
                      fontSize: 16,
                      borderRadius: 8,
                      border: `1px solid ${theme.border}`,
                      backgroundColor: theme.backgroundDefault,
                      color: theme.text,
                      width: "100%",
                    }}
                  />
                </View>
              ) : (
                <DateTimePicker
                  value={parseDateValue(value)}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(Platform.OS === "ios");
                    if (selectedDate) {
                      const day = String(selectedDate.getDate()).padStart(
                        2,
                        "0",
                      );
                      const month = String(
                        selectedDate.getMonth() + 1,
                      ).padStart(2, "0");
                      const year = selectedDate.getFullYear();
                      setFormData((prev) => ({
                        ...prev,
                        [field.name]: `${day}-${month}-${year}`,
                      }));
                    }
                    if (Platform.OS !== "ios") {
                      setActiveDateField(null);
                    }
                  }}
                />
              )
            ) : null}
          </View>
        );
      case "select":
        return (
          <View key={field.name} style={styles.formField}>
            <ThemedText type="body" style={styles.fieldLabel}>
              {field.label}
              {field.required ? " *" : ""}
            </ThemedText>
            <View style={styles.selectOptions}>
              {field.options?.map((option) => (
                <Pressable
                  key={option}
                  style={[
                    styles.selectOption,
                    {
                      borderColor:
                        value === option ? theme.primary : theme.border,
                      backgroundColor:
                        value === option
                          ? theme.primary + "15"
                          : theme.backgroundRoot,
                    },
                  ]}
                  onPress={() =>
                    setFormData((prev) => ({ ...prev, [field.name]: option }))
                  }
                >
                  <ThemedText
                    type="small"
                    style={{
                      color: value === option ? theme.primary : theme.text,
                    }}
                  >
                    {option}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        );
      case "number":
        return (
          <View key={field.name} style={styles.formField}>
            <ThemedText type="body" style={styles.fieldLabel}>
              {field.label}
              {field.required ? " *" : ""}
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: theme.border,
                  color: theme.text,
                  backgroundColor: theme.backgroundRoot,
                },
              ]}
              value={value}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, [field.name]: text }))
              }
              placeholder={`Enter ${field.label.toLowerCase()}`}
              placeholderTextColor={theme.textDisabled}
              keyboardType="numeric"
            />
          </View>
        );
      case "image":
        const pickImage = async () => {
          const permissionResult =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!permissionResult.granted) {
            Alert.alert(
              "Permission Required",
              "Please allow access to your photo library to upload images.",
            );
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
          });
          if (!result.canceled && result.assets[0]) {
            setFormData((prev) => ({
              ...prev,
              [field.name]: result.assets[0].uri,
            }));
          }
        };

        const takePhoto = async () => {
          const permissionResult =
            await ImagePicker.requestCameraPermissionsAsync();
          if (!permissionResult.granted) {
            Alert.alert(
              "Permission Required",
              "Please allow access to your camera to take photos.",
            );
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
          });
          if (!result.canceled && result.assets[0]) {
            setFormData((prev) => ({
              ...prev,
              [field.name]: result.assets[0].uri,
            }));
          }
        };

        const removeImage = () => {
          setFormData((prev) => ({ ...prev, [field.name]: "" }));
        };

        return (
          <View key={field.name} style={styles.formField}>
            <ThemedText type="body" style={styles.fieldLabel}>
              {field.label}
              {field.required ? " *" : ""}
            </ThemedText>
            <View style={styles.imagePreviewContainer}>
              {value ? (
                <View style={styles.uploadedImageContainer}>
                  <View style={styles.imagePreviewWrapper}>
                    <Image
                      source={{ uri: value }}
                      style={styles.imagePreview}
                      resizeMode="cover"
                    />
                    <Pressable
                      style={[
                        styles.removeImageButton,
                        { backgroundColor: theme.accent },
                      ]}
                      onPress={removeImage}
                    >
                      <Feather name="x" size={12} color="#fff" />
                    </Pressable>
                  </View>
                  <Pressable
                    style={[
                      styles.previewUploadedImageBtn,
                      { backgroundColor: theme.primary },
                    ]}
                    onPress={() => {
                      setPreviewImageUri(value);
                      setImagePreviewModalVisible(true);
                    }}
                  >
                    <Feather name="eye" size={14} color="#fff" />
                  </Pressable>
                </View>
              ) : null}
              <View style={styles.imageThumbnailButtons}>
                <Pressable
                  style={[
                    styles.imageThumbnailButton,
                    {
                      borderColor: theme.primary,
                      backgroundColor: theme.primary + "10",
                    },
                  ]}
                  onPress={takePhoto}
                >
                  <Feather name="camera" size={18} color={theme.primary} />
                  <ThemedText
                    type="small"
                    style={{ color: theme.primary, fontSize: 10, marginTop: 2 }}
                  >
                    Camera
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[
                    styles.imageThumbnailButton,
                    {
                      borderColor: theme.primary,
                      backgroundColor: theme.primary + "10",
                    },
                  ]}
                  onPress={pickImage}
                >
                  <Feather name="image" size={18} color={theme.primary} />
                  <ThemedText
                    type="small"
                    style={{ color: theme.primary, fontSize: 10, marginTop: 2 }}
                  >
                    Gallery
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        );
      default:
        return (
          <View key={field.name} style={styles.formField}>
            <ThemedText type="body" style={styles.fieldLabel}>
              {field.label}
              {field.required ? " *" : ""}
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: theme.border,
                  color: theme.text,
                  backgroundColor: theme.backgroundRoot,
                },
              ]}
              value={value}
              onChangeText={(text) =>
                setFormData((prev) => ({ ...prev, [field.name]: text }))
              }
              placeholder={`Enter ${field.label.toLowerCase()}`}
              placeholderTextColor={theme.textDisabled}
            />
          </View>
        );
    }
  };

  if (isLoading || !sample) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      >
        <View
          style={[
            styles.loadingContainer,
            { paddingTop: headerHeight + Spacing.xl },
          ]}
        >
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            {isLoading ? "Loading..." : "Sample not found"}
          </ThemedText>
        </View>
      </View>
    );
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return undefined;
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const isOverdue =
    sample.daysRemaining !== undefined &&
    sample.daysRemaining <= 0 &&
    !sample.labResult;
  const isUrgent =
    sample.daysRemaining !== undefined &&
    sample.daysRemaining <= 3 &&
    !sample.labResult;
  const countdownColor = isOverdue
    ? theme.accent
    : isUrgent
      ? theme.warning
      : theme.primary;

  const inputFields: InputField[] = selectedNode?.inputFields || [];
  const hasInputFields = inputFields.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <View
          style={[
            styles.card,
            { backgroundColor: theme.backgroundDefault },
            Shadows.md,
          ]}
        >
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: theme.primary + "20" },
              ]}
            >
              <Feather name="droplet" size={24} color={theme.primary} />
            </View>
            <View style={styles.headerContent}>
              <ThemedText type="h2">{sample.name}</ThemedText>
              <ThemedText type="body" style={{ color: theme.textSecondary }}>
                {sample.code}
              </ThemedText>
            </View>
          </View>

          {sample.labResult ? (
            <View style={styles.resultContainer}>
              <ThemedText type="h4">Lab Result</ThemedText>
              <StatusBadge status={sample.labResult} size="medium" />
            </View>
          ) : sample.daysRemaining !== undefined ? (
            <View
              style={[
                styles.countdownCard,
                {
                  backgroundColor: countdownColor + "10",
                  borderColor: countdownColor,
                },
              ]}
            >
              <Feather name="clock" size={24} color={countdownColor} />
              <View style={styles.countdownContent}>
                <ThemedText type="h1" style={{ color: countdownColor }}>
                  {isOverdue ? "OVERDUE" : sample.daysRemaining}
                </ThemedText>
                <ThemedText type="body" style={{ color: countdownColor }}>
                  {isOverdue ? "Lab report was due" : "days until deadline"}
                </ThemedText>
              </View>
            </View>
          ) : null}
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: theme.backgroundDefault },
            Shadows.md,
          ]}
        >
          <ThemedText type="h3" style={styles.sectionTitle}>
            Sample Details
          </ThemedText>

          <View style={styles.detailRow}>
            <View
              style={[
                styles.detailIcon,
                { backgroundColor: theme.primary + "15" },
              ]}
            >
              <Feather name="map-pin" size={16} color={theme.primary} />
            </View>
            <View style={styles.detailContent}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Place of Lifting
              </ThemedText>
              <ThemedText type="body">{sample.liftedPlace}</ThemedText>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View
              style={[
                styles.detailIcon,
                { backgroundColor: theme.primary + "15" },
              ]}
            >
              <Feather name="calendar" size={16} color={theme.primary} />
            </View>
            <View style={styles.detailContent}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Lifted Date
              </ThemedText>
              <ThemedText type="body">
                {formatDate(sample.liftedDate)}
              </ThemedText>
            </View>
          </View>

          {sample.dispatchMode ? (
            <View style={styles.detailRow}>
              <View
                style={[
                  styles.detailIcon,
                  { backgroundColor: theme.primary + "15" },
                ]}
              >
                <Feather name="send" size={16} color={theme.primary} />
              </View>
              <View style={styles.detailContent}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Dispatch Mode
                </ThemedText>
                <ThemedText type="body" style={{ textTransform: "capitalize" }}>
                  {sample.dispatchMode.replace("_", " ")}
                </ThemedText>
              </View>
            </View>
          ) : null}
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: theme.backgroundDefault },
            Shadows.md,
          ]}
        >
          <View style={styles.workflowHeader}>
            <ThemedText type="h3">Sample Workflow</ThemedText>
            <View
              style={[
                styles.interactiveHint,
                { backgroundColor: theme.primary + "10" },
              ]}
            >
              <Feather name="info" size={14} color={theme.primary} />
              <ThemedText type="small" style={{ color: theme.primary }}>
                Tap nodes to add updates
              </ThemedText>
            </View>
          </View>

          <View style={styles.timeline}>{renderDynamicTimeline()}</View>
        </View>

        {sample.remarks ? (
          <View
            style={[
              styles.card,
              { backgroundColor: theme.backgroundDefault },
              Shadows.md,
            ]}
          >
            <ThemedText type="h3" style={styles.sectionTitle}>
              Remarks
            </ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              {sample.remarks}
            </ThemedText>
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={[
            styles.modalContainer,
            { backgroundColor: theme.backgroundRoot },
          ]}
        >
          <View
            style={[styles.modalHeader, { borderBottomColor: theme.border }]}
          >
            <Pressable
              onPress={() => setModalVisible(false)}
              style={styles.modalCloseBtn}
            >
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
            <ThemedText type="h3" style={{ flex: 1, textAlign: "center" }}>
              {selectedNode?.name}
            </ThemedText>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            {selectedNode?.description ? (
              <View
                style={[
                  styles.nodeDescriptionCard,
                  { backgroundColor: theme.primary + "10" },
                ]}
              >
                <Feather name="info" size={16} color={theme.primary} />
                <ThemedText
                  type="body"
                  style={{ color: theme.primary, flex: 1 }}
                >
                  {selectedNode.description}
                </ThemedText>
              </View>
            ) : null}

            {hasInputFields ? (
              inputFields.map((field) => renderInputField(field))
            ) : (
              <View style={styles.noFieldsContainer}>
                <View
                  style={[
                    styles.noFieldsIcon,
                    { backgroundColor: theme.textSecondary + "15" },
                  ]}
                >
                  <Feather
                    name="edit-3"
                    size={32}
                    color={theme.textSecondary}
                  />
                </View>
                <ThemedText
                  type="h4"
                  style={{ color: theme.text, textAlign: "center" }}
                >
                  Add Notes
                </ThemedText>
                <ThemedText
                  type="body"
                  style={{ color: theme.textSecondary, textAlign: "center" }}
                >
                  Record any notes or observations for this workflow step
                </ThemedText>
                <View style={styles.formField}>
                  <TextInput
                    style={[
                      styles.textArea,
                      {
                        borderColor: theme.border,
                        color: theme.text,
                        backgroundColor: theme.backgroundDefault,
                      },
                    ]}
                    value={formData.notes || ""}
                    onChangeText={(text) =>
                      setFormData((prev) => ({ ...prev, notes: text }))
                    }
                    placeholder="Enter your notes here..."
                    placeholderTextColor={theme.textDisabled}
                    multiline
                    numberOfLines={6}
                  />
                </View>
              </View>
            )}
          </ScrollView>

          <View
            style={[
              styles.modalFooter,
              {
                borderTopColor: theme.border,
                paddingBottom: insets.bottom + Spacing.md,
              },
            ]}
          >
            <Pressable
              style={[styles.cancelBtn, { borderColor: theme.border }]}
              onPress={() => setModalVisible(false)}
            >
              <ThemedText type="body" style={{ color: theme.text }}>
                Cancel
              </ThemedText>
            </Pressable>
            <Pressable
              style={[styles.saveBtn, { backgroundColor: theme.primary }]}
              onPress={handleSaveNodeData}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Feather name="check" size={18} color="white" />
                  <ThemedText
                    type="body"
                    style={{ color: "white", fontWeight: "600" }}
                  >
                    Save Update
                  </ThemedText>
                </>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={previewModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setPreviewModalVisible(false)}
      >
        <View
          style={[styles.previewModalContainer, { backgroundColor: "#1f2937" }]}
        >
          <View
            style={[
              styles.previewModalHeader,
              {
                paddingTop:
                  insets.top > 0 ? insets.top + Spacing.sm : Spacing.md,
              },
            ]}
          >
            <View style={styles.previewControlsRow}>
              <Pressable
                style={styles.zoomBtn}
                onPress={() =>
                  setPreviewZoom((prev) => Math.max(prev - 0.1, 0.2))
                }
              >
                <Feather name="minus" size={16} color="white" />
              </Pressable>
              <View style={styles.zoomLevelBadge}>
                <ThemedText type="small" style={{ color: "white" }}>
                  {Math.round(previewZoom * 100)}%
                </ThemedText>
              </View>
              <Pressable
                style={styles.zoomBtn}
                onPress={() =>
                  setPreviewZoom((prev) => Math.min(prev + 0.1, 1.5))
                }
              >
                <Feather name="plus" size={16} color="white" />
              </Pressable>
              <Pressable
                style={styles.zoomBtn}
                onPress={() => setPreviewZoom(0.5)}
              >
                <Feather name="maximize-2" size={16} color="white" />
              </Pressable>
              <Pressable
                style={styles.zoomBtn}
                onPress={() => setPreviewZoom(1)}
              >
                <Feather name="square" size={16} color="white" />
              </Pressable>
              <Pressable
                style={[
                  styles.zoomBtn,
                  { backgroundColor: theme.success, marginLeft: Spacing.sm },
                ]}
                onPress={() => {
                  if (previewTemplate) {
                    handleDownload(previewTemplate);
                  }
                }}
                disabled={downloadingId === previewTemplate?.id}
              >
                {downloadingId === previewTemplate?.id ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Feather name="download" size={16} color="white" />
                )}
              </Pressable>
              <View style={styles.panHintBadge}>
                <Feather name="move" size={14} color="rgba(255,255,255,0.8)" />
                <ThemedText
                  type="small"
                  style={{ color: "rgba(255,255,255,0.8)", marginLeft: 4 }}
                >
                  Pan
                </ThemedText>
              </View>
            </View>
            <Pressable
              style={styles.closeIconBtn}
              onPress={() => setPreviewModalVisible(false)}
            >
              <Feather name="x" size={24} color="white" />
            </Pressable>
          </View>
          <View style={styles.pageNavBar}>
            <Pressable
              style={[
                styles.pageNavBtn,
                currentPage <= 1 && styles.pageNavBtnDisabled,
              ]}
              onPress={() => setCurrentPage(1)}
              disabled={currentPage <= 1}
            >
              <Feather
                name="chevrons-left"
                size={18}
                color={currentPage <= 1 ? "#6b7280" : "white"}
              />
            </Pressable>
            <Pressable
              style={[
                styles.pageNavBtn,
                currentPage <= 1 && styles.pageNavBtnDisabled,
              ]}
              onPress={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage <= 1}
            >
              <Feather
                name="chevron-left"
                size={18}
                color={currentPage <= 1 ? "#6b7280" : "white"}
              />
            </Pressable>

            <View style={styles.pageIndicator}>
              <ThemedText style={styles.pageIndicatorText}>
                {currentPage} OF {totalPages}
              </ThemedText>
            </View>

            <Pressable
              style={[
                styles.pageNavBtn,
                currentPage >= totalPages && styles.pageNavBtnDisabled,
              ]}
              onPress={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
              disabled={currentPage >= totalPages}
            >
              <Feather
                name="chevron-right"
                size={18}
                color={currentPage >= totalPages ? "#6b7280" : "white"}
              />
            </Pressable>
            <Pressable
              style={[
                styles.pageNavBtn,
                currentPage >= totalPages && styles.pageNavBtnDisabled,
              ]}
              onPress={() => setCurrentPage(totalPages)}
              disabled={currentPage >= totalPages}
            >
              <Feather
                name="chevrons-right"
                size={18}
                color={currentPage >= totalPages ? "#6b7280" : "white"}
              />
            </Pressable>
          </View>
          <View style={styles.previewViewport}>
            {previewTemplate ? (
              Platform.OS === "web" ? (
                <div
                  id="preview-container"
                  style={{
                    flex: 1,
                    width: "100%",
                    height: "100%",
                    overflow: "auto",
                    backgroundColor: "#4b5563",
                  }}
                >
                  <iframe
                    key={`preview-${previewZoom}`}
                    srcDoc={generatePdfHtml(previewTemplate, previewZoom)}
                    style={{
                      width: "100%",
                      height: "100%",
                      border: "none",
                      backgroundColor: "#4b5563",
                    }}
                    title="Document Preview"
                  />
                </div>
              ) : (
                <WebView
                  key={`preview-${previewZoom}`}
                  source={{
                    html: generatePdfHtml(previewTemplate, previewZoom),
                  }}
                  style={{ flex: 1 }}
                  originWhitelist={["*"]}
                  scalesPageToFit={false}
                  scrollEnabled={true}
                  showsVerticalScrollIndicator={false}
                  onMessage={(event: { nativeEvent: { data: string } }) => {
                    try {
                      const data = JSON.parse(event.nativeEvent.data);
                      if (data.type === "totalPages") {
                        setTotalPages(Math.max(1, data.value));
                      } else if (data.type === "currentPage") {
                        setCurrentPage(Math.min(data.value, totalPages));
                      }
                    } catch (_e) {
                      // Ignore parse errors
                    }
                  }}
                />
              )
            ) : null}
          </View>
          <View
            style={[
              styles.previewFooter,
              { paddingBottom: insets.bottom > 0 ? insets.bottom : Spacing.md },
            ]}
          >
            <ThemedText type="small" style={{ color: "rgba(255,255,255,0.7)" }}>
              {previewTemplate?.pageSize || "A4"}{" "}
              {previewTemplate?.orientation || "Portrait"} -{" "}
              {previewTemplate?.pageSize === "A4" ? "210 x 297" : "216 x 279"}{" "}
              mm
            </ThemedText>
          </View>
        </View>
      </Modal>

      <Modal
        visible={imagePreviewModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setImagePreviewModalVisible(false)}
      >
        <View style={styles.imagePreviewModalContainer}>
          <Pressable
            style={styles.imagePreviewModalBackdrop}
            onPress={() => setImagePreviewModalVisible(false)}
          />
          <View style={styles.imagePreviewModalContent}>
            {previewImageUri ? (
              <Image
                source={{ uri: previewImageUri }}
                style={styles.imagePreviewFull}
                resizeMode="contain"
              />
            ) : null}
            <Pressable
              style={styles.imagePreviewCloseBtn}
              onPress={() => setImagePreviewModalVisible(false)}
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
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  headerContent: {
    flex: 1,
    gap: Spacing.xs,
  },
  resultContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
  },
  countdownCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  countdownContent: {
    flex: 1,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  detailContent: {
    flex: 1,
    gap: 2,
  },
  workflowHeader: {
    gap: Spacing.sm,
  },
  interactiveHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    alignSelf: "flex-start",
  },
  timeline: {
    gap: 0,
  },
  timelineStep: {
    flexDirection: "row",
    minHeight: 70,
  },
  timelineLeft: {
    width: 40,
    alignItems: "center",
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: Spacing.xs,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: 2,
  },
  timelineHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  nodeTypeBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  tapBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  savedDataContainer: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  savedDataHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: 2,
  },
  savedDataRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    flexWrap: "wrap",
  },
  savedDataImageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  savedImageThumbnailContainer: {
    position: "relative",
  },
  savedImageThumbnail: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
  },
  savedImagePreviewBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  imagePreviewModalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  imagePreviewModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  imagePreviewModalContent: {
    width: "90%",
    height: "80%",
    alignItems: "center",
    justifyContent: "center",
  },
  imagePreviewFull: {
    width: "100%",
    height: "100%",
    borderRadius: BorderRadius.lg,
  },
  imagePreviewCloseBtn: {
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
  emptyWorkflow: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  branchInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingLeft: 52,
    paddingVertical: Spacing.sm,
    marginTop: -Spacing.md,
  },
  templatesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  labelActionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  labelIconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  printLabelsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  templateIconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  templatesList: {
    gap: Spacing.md,
  },
  templateItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  templateInfo: {
    flex: 1,
  },
  categoryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  templateMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  downloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  nodeDescriptionCard: {
    flexDirection: "row",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  noFieldsContainer: {
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  noFieldsIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  formField: {
    gap: Spacing.xs,
    width: "100%",
  },
  fieldLabel: {
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: "top",
  },
  selectOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  selectOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 48,
  },
  webDatePickerContainer: {
    marginTop: Spacing.sm,
  },
  modalFooter: {
    flexDirection: "row",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  cancelBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  saveBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  imageButtonsContainer: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  imageButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  imagePreviewContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  uploadedImageContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  imagePreviewWrapper: {
    position: "relative",
  },
  previewUploadedImageBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  imagePreview: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.md,
  },
  removeImageButton: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  imageThumbnailButtons: {
    flex: 1,
    flexDirection: "row",
    gap: Spacing.sm,
  },
  imageThumbnailButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  nodeTemplatesContainer: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  nodeTemplatesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  nodeTemplatesList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  nodeTemplateChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  nodeTemplatesListVertical: {
    gap: Spacing.xs,
  },
  nodeTemplateRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  nodeTemplateName: {
    flex: 1,
    fontSize: 12,
  },
  nodeTemplateActions: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  templateActionBtn: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  previewContent: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  webPreviewScroll: {
    flex: 1,
  },
  webPreviewContent: {
    padding: Spacing.lg,
  },
  webPreviewCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    minHeight: 500,
    overflow: "hidden",
  },
  previewModalContainer: {
    flex: 1,
  },
  previewModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 0,
  },
  previewControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  closeIconBtn: {
    padding: Spacing.xs,
  },
  pageNavBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    backgroundColor: "#374151",
    borderBottomWidth: 1,
    borderBottomColor: "#4b5563",
    gap: Spacing.xs,
  },
  pageNavBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  pageNavBtnDisabled: {
    opacity: 0.5,
  },
  pageIndicator: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: "#1E40AF",
    borderRadius: BorderRadius.sm,
    marginHorizontal: Spacing.xs,
  },
  pageIndicatorText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  zoomBtn: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  zoomLevelBadge: {
    minWidth: 50,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: BorderRadius.xs,
    alignItems: "center",
  },
  panHintBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: BorderRadius.xs,
    marginLeft: Spacing.sm,
  },
  previewViewport: {
    flex: 1,
    backgroundColor: "#374151",
    overflow: "hidden",
  },
  previewPageWrapper: {
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    overflow: "hidden",
  },
  previewPageSizeLabel: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
  },
  previewFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    backgroundColor: "#1f2937",
    borderTopWidth: 1,
    borderTopColor: "#374151",
  },
});
