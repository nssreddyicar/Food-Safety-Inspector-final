import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Dimensions,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import { useQuery } from "@tanstack/react-query";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { useTheme } from "@/hooks/useTheme";
import { useAuthContext } from "@/context/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { storage } from "@/lib/storage";
import { Sample, Inspection } from "@/types";

let WebView: any = null;
if (Platform.OS !== "web") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  WebView = require("react-native-webview").WebView;
}

interface DocumentTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  content: string;
  placeholders: string[];
  pageSize: string;
  orientation: string;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  fontFamily: string;
  fontSize: number;
  showPageNumbers: boolean;
  pageNumberFormat?: string;
  pageNumberPosition: string;
  pageNumberOffset: number;
  showContinuationText?: boolean;
  continuationFormat?: string;
  showHeader: boolean;
  showFooter: boolean;
  headerText?: string;
  footerText?: string;
  headerAlignment: string;
  footerAlignment: string;
  status: string;
}

const categoryColors: Record<string, { bg: string; text: string }> = {
  general: { bg: "#e0e7ff", text: "#4338ca" },
  inspection: { bg: "#dbeafe", text: "#1E40AF" },
  sample: { bg: "#dcfce7", text: "#059669" },
  notice: { bg: "#fef3c7", text: "#d97706" },
  prosecution: { bg: "#fee2e2", text: "#dc2626" },
  certificate: { bg: "#e0e7ff", text: "#6366f1" },
};

const pageSizes: Record<
  string,
  { width: number; height: number; label: string }
> = {
  A4: { width: 210, height: 297, label: "A4" },
  Letter: { width: 215.9, height: 279.4, label: "Letter" },
  Legal: { width: 215.9, height: 355.6, label: "Legal" },
  A3: { width: 297, height: 420, label: "A3" },
};

function TemplateCard({
  template,
  onDownload,
  onPreview,
  isDownloading,
}: {
  template: DocumentTemplate;
  onDownload: () => void;
  onPreview: () => void;
  isDownloading: boolean;
}) {
  const { theme } = useTheme();
  const colors = categoryColors[template.category] || categoryColors.general;

  return (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.categoryBadge, { backgroundColor: colors.bg }]}>
          <ThemedText
            type="small"
            style={{ color: colors.text, fontWeight: "600" }}
          >
            {template.category.toUpperCase()}
          </ThemedText>
        </View>
        <View style={styles.formatInfo}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {template.pageSize} | {template.orientation}
          </ThemedText>
        </View>
      </View>

      <ThemedText type="h4" style={styles.templateName}>
        {template.name}
      </ThemedText>

      {template.description ? (
        <ThemedText
          type="small"
          style={{ color: theme.textSecondary, marginTop: Spacing.xs }}
        >
          {template.description}
        </ThemedText>
      ) : null}

      <View style={styles.cardFooter}>
        <View style={styles.formatTags}>
          <View style={[styles.tag, { backgroundColor: theme.backgroundRoot }]}>
            <Feather name="type" size={12} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {template.fontFamily}
            </ThemedText>
          </View>
          <View style={[styles.tag, { backgroundColor: theme.backgroundRoot }]}>
            <Feather name="maximize-2" size={12} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {template.fontSize}pt
            </ThemedText>
          </View>
        </View>

        <View style={styles.buttonGroup}>
          <Pressable
            style={({ pressed }) => [
              styles.previewBtn,
              {
                backgroundColor: theme.backgroundRoot,
                borderColor: theme.primary,
              },
              pressed && { opacity: 0.8 },
            ]}
            onPress={onPreview}
          >
            <Feather name="eye" size={16} color={theme.primary} />
            <ThemedText
              type="small"
              style={{ color: theme.primary, fontWeight: "600" }}
            >
              Preview
            </ThemedText>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.downloadBtn,
              { backgroundColor: theme.primary },
              pressed && { opacity: 0.8 },
              isDownloading && { opacity: 0.6 },
            ]}
            onPress={onDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="download" size={16} color="#FFFFFF" />
                <ThemedText
                  type="small"
                  style={{ color: "#FFFFFF", fontWeight: "600" }}
                >
                  PDF
                </ThemedText>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Card>
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

export default function TemplatesScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { user, activeJurisdiction } = useAuthContext();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] =
    useState<DocumentTemplate | null>(null);
  const [zoomLevel, setZoomLevel] = useState(0.5);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const screenWidth = Dimensions.get("window").width;
  const webViewRef = useRef<any>(null);

  // Sample selection state
  const [samples, setSamples] = useState<SampleWithInspection[]>([]);
  const [selectedSample, setSelectedSample] =
    useState<SampleWithInspection | null>(null);
  const [showSampleSelector, setShowSampleSelector] = useState(false);

  // Filter state
  const [sampleTypeFilter, setSampleTypeFilter] = useState<
    "all" | "enforcement" | "surveillance"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<
    "all" | "7days" | "30days" | "90days"
  >("all");

  const { data: templates = [], isLoading } = useQuery<DocumentTemplate[]>({
    queryKey: ["/api/templates"],
  });

  // Load samples from storage
  useEffect(() => {
    const loadSamples = async () => {
      try {
        const inspections = await storage.getInspections(
          activeJurisdiction?.unitId,
        );
        const allSamples: SampleWithInspection[] = [];

        inspections.forEach((inspection: Inspection) => {
          if (inspection.samples && inspection.samples.length > 0) {
            inspection.samples.forEach((sample: Sample) => {
              allSamples.push({
                ...sample,
                establishmentName: inspection.fboDetails?.establishmentName,
                fboName: inspection.fboDetails?.name,
                fboAddress: inspection.fboDetails?.address,
                fboLicense:
                  inspection.fboDetails?.licenseNumber ||
                  inspection.fboDetails?.registrationNumber,
                inspectionDate: inspection.createdAt,
                inspectionType: inspection.type,
              });
            });
          }
        });

        // Sort by lifted date (most recent first)
        allSamples.sort(
          (a, b) =>
            new Date(b.liftedDate).getTime() - new Date(a.liftedDate).getTime(),
        );
        setSamples(allSamples);
      } catch (error) {
        console.error("Failed to load samples:", error);
      }
    };

    loadSamples();
  }, [activeJurisdiction?.unitId]);

  // Filter samples based on current filters
  const filteredSamples = useMemo(() => {
    let result = [...samples];

    // Type filter
    if (sampleTypeFilter !== "all") {
      result = result.filter((s) => s.sampleType === sampleTypeFilter);
    }

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date();
      const daysAgo =
        dateFilter === "7days" ? 7 : dateFilter === "30days" ? 30 : 90;
      const cutoffDate = new Date(
        now.getTime() - daysAgo * 24 * 60 * 60 * 1000,
      );
      result = result.filter((s) => new Date(s.liftedDate) >= cutoffDate);
    }

    // Search filter (establishment name, sample code, sample name)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name?.toLowerCase().includes(query) ||
          s.code?.toLowerCase().includes(query) ||
          s.establishmentName?.toLowerCase().includes(query) ||
          s.fboName?.toLowerCase().includes(query),
      );
    }

    return result;
  }, [samples, sampleTypeFilter, dateFilter, searchQuery]);

  const replacePlaceholders = (content: string): string => {
    const now = new Date();
    const sample = selectedSample;

    // Format date helper
    const formatDate = (dateStr?: string) => {
      if (!dateStr) return "[Date]";
      return new Date(dateStr).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    };

    const placeholderValues: Record<string, string> = {
      // Officer details
      officer_name: user?.name || "",
      officer_designation: user?.designation || "Food Safety Officer",
      officer_email: user?.email || "",
      officer_phone: user?.phone || "",
      officer_employee_id: user?.employeeId || "",

      // Jurisdiction details
      jurisdiction_name:
        user?.jurisdiction?.unitName || activeJurisdiction?.unitName || "",
      jurisdiction_type:
        user?.jurisdiction?.roleName || activeJurisdiction?.roleName || "",

      // Current date/time
      current_date: now.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
      current_time: now.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      }),

      // FBO/Establishment details (from selected sample's inspection)
      fbo_name: sample?.fboName || "[FBO Name]",
      fbo_address: sample?.fboAddress || "[FBO Address]",
      fbo_license: sample?.fboLicense || "[FBO License Number]",
      establishment_name: sample?.establishmentName || "[Establishment Name]",

      // Inspection details
      inspection_date: sample?.inspectionDate
        ? formatDate(sample.inspectionDate)
        : "[Inspection Date]",
      inspection_type: sample?.inspectionType || "[Inspection Type]",

      // Sample details
      sample_code: sample?.code || "[Sample Code]",
      sample_name: sample?.name || "[Sample Name]",
      sample_type:
        sample?.sampleType === "enforcement"
          ? "Enforcement"
          : sample?.sampleType === "surveillance"
            ? "Surveillance"
            : "[Sample Type]",
      sample_lifted_date: sample?.liftedDate
        ? formatDate(sample.liftedDate)
        : "[Lifted Date]",
      sample_lifted_place: sample?.liftedPlace || "[Lifted Place]",
      sample_cost: sample?.cost ? `Rs. ${sample.cost}` : "[Sample Cost]",
      sample_quantity: sample?.quantityInGrams
        ? `${sample.quantityInGrams} grams`
        : "[Quantity]",
      sample_packing_type:
        sample?.packingType === "packed"
          ? "Packed"
          : sample?.packingType === "loose"
            ? "Loose"
            : "[Packing Type]",
      sample_preservative: sample?.preservativeAdded
        ? sample.preservativeType || "Yes"
        : "No",
      sample_dispatch_date: sample?.dispatchDate
        ? formatDate(sample.dispatchDate)
        : "[Dispatch Date]",
      sample_dispatch_mode: sample?.dispatchMode || "[Dispatch Mode]",

      // Manufacturer details (for packed samples)
      manufacturer_name:
        sample?.manufacturerDetails?.name || "[Manufacturer Name]",
      manufacturer_address:
        sample?.manufacturerDetails?.address || "[Manufacturer Address]",
      manufacturer_license:
        sample?.manufacturerDetails?.licenseNumber || "[Manufacturer License]",

      // Additional packed sample details
      mfg_date: sample?.mfgDate || "[Manufacturing Date]",
      expiry_date: sample?.useByDate || "[Expiry Date]",
      lot_batch_number: sample?.lotBatchNumber || "[Lot/Batch Number]",

      // Lab result (if available)
      lab_report_date: sample?.labReportDate
        ? formatDate(sample.labReportDate)
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

  const getPageDimensions = (pageSize: string, orientation: string) => {
    const size = pageSizes[pageSize] || pageSizes["A4"];
    if (orientation === "landscape") {
      return { width: size.height, height: size.width, label: size.label };
    }
    return { width: size.width, height: size.height, label: size.label };
  };

  const isRawHtmlContent = (content: string): boolean => {
    const trimmed = content.trim();
    return (
      trimmed.startsWith("<!DOCTYPE") ||
      trimmed.startsWith("<html") ||
      (trimmed.startsWith("<") &&
        (trimmed.includes("<style>") ||
          trimmed.includes("<div class=") ||
          trimmed.includes("<table")))
    );
  };

  const generatePreviewHtml = (
    template: DocumentTemplate,
    scale: number = 1,
  ): string => {
    const processedContent = replacePlaceholders(template.content);
    const dims = getPageDimensions(template.pageSize, template.orientation);
    const mmToPx = 3.7795275591;
    const pageHeightPx = dims.height * mmToPx;
    const marginPx =
      template.marginTop * mmToPx + template.marginBottom * mmToPx;

    // JavaScript for page calculation and scroll tracking
    const showPageNumbers = template.showPageNumbers !== false;
    const pageNumberFormat = template.pageNumberFormat || "page_x_of_y";
    const pageNumberPosition = template.pageNumberPosition || "center";
    const pageNumberOffset = template.pageNumberOffset || 0;
    const showContinuationText = template.showContinuationText || false;
    const continuationFormat = template.continuationFormat || "contd_on_page";

    const pageTrackingScript = `
      <script>
        (function() {
          const pageHeight = ${pageHeightPx};
          const scale = ${scale};
          const pageGap = 20;
          const showPageNumbers = ${showPageNumbers};
          const pageNumberFormat = '${pageNumberFormat}';
          const pageNumberPosition = '${pageNumberPosition}';
          const pageNumberOffset = ${pageNumberOffset};
          const showContinuationText = ${showContinuationText};
          const continuationFormat = '${continuationFormat}';
          let totalPagesCount = 1;
          
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
            // Look for .page elements (multi-page HTML) or .preview-page elements
            let pages = document.querySelectorAll('.page');
            if (pages.length === 0) {
              pages = document.querySelectorAll('.preview-page');
            }
            totalPagesCount = pages.length || 1;
            
            // Send total pages to React Native
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'totalPages', value: totalPagesCount }));
            }
            // Also send to parent for web iframe
            if (window.parent && window.parent !== window) {
              window.parent.postMessage(JSON.stringify({ type: 'totalPages', value: totalPagesCount }), '*');
            }
            
            // Update page indicators on each page
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
            // Get actual page heights from DOM
            let pages = document.querySelectorAll('.page');
            if (pages.length === 0) {
              pages = document.querySelectorAll('.preview-page');
            }
            
            let currentPage = 1;
            let accumulatedHeight = 0;
            
            for (let i = 0; i < pages.length; i++) {
              const rect = pages[i].getBoundingClientRect();
              const pageTop = pages[i].offsetTop;
              if (scrollTop >= pageTop - 50) {
                currentPage = i + 1;
              }
            }
            
            currentPage = Math.min(currentPage, totalPagesCount);
            
            // Send current page to React Native
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'currentPage', value: currentPage }));
            }
          }
          
          window.addEventListener('scroll', handleScroll);
          window.addEventListener('load', function() {
            setTimeout(function() {
              calculatePages();
              handleScroll();
            }, 200);
          });
          
          // Initial calculation with delay for content to render
          setTimeout(calculatePages, 300);
          setTimeout(handleScroll, 350);
        })();
      </script>
    `;

    // Check if content is raw HTML - render it directly
    if (isRawHtmlContent(processedContent)) {
      // Extract styles from raw HTML
      let extractedStyles = "";
      const styleMatches = processedContent.matchAll(
        /<style[^>]*>([\s\S]*?)<\/style>/gi,
      );
      for (const match of styleMatches) {
        extractedStyles += match[1];
      }

      // Extract body content if full HTML document
      let bodyContent = processedContent;
      const bodyMatch = processedContent.match(
        /<body[^>]*>([\s\S]*?)<\/body>/i,
      );
      if (bodyMatch) {
        bodyContent = bodyMatch[1];
      }

      // Check if content has multiple .page divs (multi-page document)
      const hasMultiplePages =
        bodyContent.includes('class="page"') ||
        bodyContent.includes("class='page'");

      // For raw HTML with multi-page support - render with scale wrapper
      return `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              /* Template's original styles first */
              ${extractedStyles}
              
              /* Override styles for preview - must come after template styles */
              * { 
                box-sizing: border-box;
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
                margin: 0 !important;
                padding: 0 !important;
                background: #4b5563 !important;
                overflow-x: hidden !important;
                overflow-y: scroll !important;
                scrollbar-width: none !important;
                height: auto !important;
                min-height: 100vh !important;
                width: 100% !important;
              }
              body { 
                margin: 0 !important;
                padding: 20px 0 !important;
                background: #4b5563 !important;
                overflow-x: hidden !important;
                height: auto !important;
                min-height: 100vh !important;
                width: 100% !important;
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
              }
              
              /* Override .page styles for preview display with scale */
              .page {
                box-shadow: 0 4px 20px rgba(0,0,0,0.3) !important;
                overflow: visible !important;
                position: relative !important;
                transform: scale(${scale}) !important;
                transform-origin: top center !important;
                margin-left: auto !important;
                margin-right: auto !important;
                margin-bottom: calc(-297mm * (1 - ${scale}) + 20px) !important;
              }
              .page:last-child {
                margin-bottom: 20px !important;
              }
              
              /* Remove page-break CSS for screen preview */
              .page-break {
                page-break-before: unset !important;
              }
              
              /* Single page wrapper */
              .preview-single-page {
                background: white;
                width: 210mm;
                min-height: 297mm;
                margin: 0 auto;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                padding: ${template.marginTop}mm ${template.marginRight}mm ${template.marginBottom}mm ${template.marginLeft}mm;
              }
            </style>
          </head>
          <body>
            ${hasMultiplePages ? bodyContent : `<div class="page preview-single-page">${bodyContent}</div>`}
            ${pageTrackingScript}
          </body>
        </html>
      `;
    }

    // Plain text content - use standard formatting
    const contentWithLineBreaks = processedContent.replace(/\n/g, "<br>");

    const headerAlignment = template.headerAlignment || "center";
    const footerAlignment = template.footerAlignment || "center";

    let pageNumberStyle = `text-align: ${pageNumberPosition};`;
    if (pageNumberPosition === "left") {
      pageNumberStyle += ` padding-left: ${pageNumberOffset}mm;`;
    } else if (pageNumberPosition === "right") {
      pageNumberStyle += ` padding-right: ${-pageNumberOffset}mm;`;
    } else {
      pageNumberStyle += ` margin-left: ${pageNumberOffset}mm;`;
    }

    const headerHtml =
      template.showHeader !== false && template.headerText
        ? `<div class="header" style="text-align: ${headerAlignment};">${template.headerText}</div>`
        : "";

    const footerHtml =
      template.showFooter !== false && template.footerText
        ? `<div class="footer" style="text-align: ${footerAlignment};">${template.footerText}</div>`
        : "";

    const pageNumberHtml =
      template.showPageNumbers !== false
        ? `<div class="page-number" style="${pageNumberStyle}">Page 1 of 1</div>`
        : "";

    const verticalGapMM = 297 * (1 - scale);

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            * { 
              box-sizing: border-box; 
              margin: 0; 
              padding: 0;
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
              background: #4b5563; 
              overflow-x: hidden;
              overflow-y: scroll;
              scrollbar-width: none !important;
              min-height: 100vh;
              width: 100%;
            }
            body { 
              background: #4b5563; 
              display: flex; 
              flex-direction: column;
              align-items: center;
              padding: 20px 0;
              min-height: 100vh;
              width: 100%;
              overflow-x: hidden;
            }
            .page {
              background: white;
              width: 210mm;
              height: 297mm;
              padding: ${template.marginTop}mm ${template.marginRight}mm ${template.marginBottom}mm ${template.marginLeft}mm;
              box-shadow: 0 4px 20px rgba(0,0,0,0.3);
              font-family: "${template.fontFamily}", serif;
              font-size: ${template.fontSize}pt;
              line-height: 1.6;
              color: #1f2937;
              display: flex;
              flex-direction: column;
              transform: scale(${scale});
              transform-origin: top center;
              margin-bottom: calc(-${verticalGapMM}mm + 20px);
            }
            .page:last-child {
              margin-bottom: 20px;
            }
            .header {
              padding-bottom: 12px;
              border-bottom: 1px solid #e5e7eb;
              margin-bottom: 16px;
              font-weight: 600;
            }
            .footer {
              padding-top: 12px;
              border-top: 1px solid #e5e7eb;
              margin-top: auto;
              font-size: 10pt;
              color: #6b7280;
            }
            .page-number {
              margin-top: 12px;
              font-size: 10pt;
              color: #6b7280;
            }
            .content {
              flex: 1;
              white-space: pre-wrap;
            }
            table { border-collapse: collapse; width: 100%; margin: 12px 0; }
            th, td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; }
            th { background: #f3f4f6; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="page">
            ${headerHtml}
            <div class="content">${contentWithLineBreaks}</div>
            ${footerHtml}
            ${pageNumberHtml}
          </div>
        </body>
      </html>
    `;
  };

  const generatePdfHtml = (template: DocumentTemplate): string => {
    const processedContent = replacePlaceholders(template.content);

    // Check if content is raw HTML - use it directly for PDF
    if (isRawHtmlContent(processedContent)) {
      // For raw HTML templates, use the content as-is (it already has proper styling)
      // Just add @page rule for print sizing if not present
      if (processedContent.includes("@page")) {
        return processedContent;
      }

      // Insert @page rule for proper print sizing
      const pageRule = `
        @page {
          size: ${template.pageSize} ${template.orientation};
          margin: 0;
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
        }
      `;

      // Insert style into existing HTML
      if (processedContent.includes("<style>")) {
        return processedContent.replace("<style>", `<style>${pageRule}`);
      } else if (processedContent.includes("</head>")) {
        return processedContent.replace(
          "</head>",
          `<style>${pageRule}</style></head>`,
        );
      }

      return processedContent;
    }

    // Plain text content - use standard formatting
    const contentWithLineBreaks = processedContent.replace(/\n/g, "<br>");

    const headerAlignment = template.headerAlignment || "center";
    const footerAlignment = template.footerAlignment || "center";

    const headerHtml =
      template.showHeader !== false && template.headerText
        ? `<div class="doc-header" style="text-align: ${headerAlignment};">${template.headerText}</div>`
        : "";

    const footerHtml =
      template.showFooter !== false && template.footerText
        ? `<div class="doc-footer" style="text-align: ${footerAlignment};">${template.footerText}</div>`
        : "";

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${template.name}</title>
          <style>
            /* Multi-page CSS with automatic pagination */
            @page {
              size: ${template.pageSize} ${template.orientation};
              margin: ${template.marginTop}mm ${template.marginRight}mm ${template.marginBottom + 15}mm ${template.marginLeft}mm;
            }
            
            * { box-sizing: border-box; margin: 0; padding: 0; }
            html, body {
              font-family: "${template.fontFamily}", serif;
              font-size: ${template.fontSize}pt;
              line-height: 1.6;
              color: #1f2937;
            }
            
            /* Document header - appears once at start */
            .doc-header {
              padding-bottom: 16px;
              border-bottom: 1px solid #e5e7eb;
              margin-bottom: 24px;
              font-weight: 600;
            }
            
            /* Document footer - appears once at end */
            .doc-footer {
              padding-top: 16px;
              border-top: 1px solid #e5e7eb;
              margin-top: 24px;
              font-size: 10pt;
              color: #6b7280;
            }
            
            .content {
              white-space: pre-wrap;
            }
            
            /* Tables with proper page break handling */
            table { 
              border-collapse: collapse; 
              width: 100%; 
              margin: 12px 0;
              page-break-inside: auto;
            }
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
            tbody { display: table-row-group; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            th, td { 
              border: 1px solid #d1d5db; 
              padding: 8px 12px; 
              text-align: left; 
            }
            th { 
              background: #f3f4f6; 
              font-weight: 600;
            }
            
            /* Headings */
            h1, h2, h3, h4, h5, h6 { 
              margin: 16px 0 8px 0; 
              page-break-after: avoid;
            }
            p { margin: 8px 0; }
            ul, ol { margin: 8px 0; padding-left: 24px; }
            
            /* Page break utilities */
            .page-break { page-break-after: always; }
            .page-break-before { page-break-before: always; }
            .avoid-break { page-break-inside: avoid; }
            
            .signature-line { 
              border-bottom: 1px solid #000; 
              width: 200px; 
              display: inline-block; 
              margin-top: 40px; 
            }
            
            /* Print-specific styles */
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
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${headerHtml}
          <div class="content">${contentWithLineBreaks}</div>
          ${footerHtml}
        </body>
      </html>
    `;
  };

  const handleDownload = async (template: DocumentTemplate) => {
    try {
      setDownloadingId(template.id);

      const html = generatePdfHtml(template);

      if (Platform.OS === "web") {
        // For web: Use html2pdf.js library loaded from CDN
        const generateWebPdf = async () => {
          return new Promise<void>((resolve, reject) => {
            // Check if html2pdf is already loaded
            if ((window as any).html2pdf) {
              createPdf(
                (window as any).html2pdf,
                template,
                html,
                resolve,
                reject,
              );
              return;
            }

            // Load html2pdf.js from CDN
            const script = document.createElement("script");
            script.src =
              "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
            script.onload = () => {
              createPdf(
                (window as any).html2pdf,
                template,
                html,
                resolve,
                reject,
              );
            };
            script.onerror = () =>
              reject(new Error("Failed to load PDF library"));
            document.head.appendChild(script);
          });
        };

        const createPdf = (
          html2pdf: any,
          template: DocumentTemplate,
          html: string,
          resolve: () => void,
          reject: (error: Error) => void,
        ) => {
          try {
            // Create a hidden container for rendering
            const container = document.createElement("div");
            container.innerHTML = html;
            container.style.position = "absolute";
            container.style.left = "-9999px";
            container.style.top = "0";
            document.body.appendChild(container);

            const dims = getPageDimensions(
              template.pageSize,
              template.orientation,
            );

            const opt = {
              margin: 0,
              filename: `${template.name.replace(/\s+/g, "_")}.pdf`,
              image: { type: "jpeg", quality: 0.98 },
              html2canvas: { scale: 2, useCORS: true },
              jsPDF: {
                unit: "mm",
                format: [dims.width, dims.height],
                orientation: template.orientation || "portrait",
              },
              pagebreak: { mode: ["css", "legacy"] },
            };

            html2pdf()
              .set(opt)
              .from(container)
              .save()
              .then(() => {
                document.body.removeChild(container);
                resolve();
              })
              .catch((err: Error) => {
                document.body.removeChild(container);
                reject(err);
              });
          } catch (err) {
            reject(err as Error);
          }
        };

        await generateWebPdf();
        setDownloadingId(null);
        return;
      }

      // Mobile: Use expo-print
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: `Share ${template.name}`,
        });
      } else {
        Alert.alert("Success", "PDF generated successfully");
      }
    } catch (error) {
      console.error("PDF generation error:", error);
      Alert.alert("Error", "Failed to generate PDF. Please try again.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePreview = (template: DocumentTemplate) => {
    setZoomLevel(0.5);
    setCurrentPage(1);
    setTotalPages(1);
    setPreviewTemplate(template);
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.1, 1.5));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 0.1, 0.2));
  };

  const handleZoomFit = () => {
    if (previewTemplate) {
      const dims = getPageDimensions(
        previewTemplate.pageSize,
        previewTemplate.orientation,
      );
      const mmToPx = 3.7795275591;
      const pageWidth = dims.width * mmToPx;
      const fitZoom = (screenWidth - 60) / pageWidth;
      setZoomLevel(Math.min(fitZoom, 0.8));
    }
  };

  const handleZoomActual = () => {
    setZoomLevel(1);
  };

  const renderTemplate = ({ item }: { item: DocumentTemplate }) => (
    <TemplateCard
      template={item}
      onDownload={() => handleDownload(item)}
      onPreview={() => handlePreview(item)}
      isDownloading={downloadingId === item.id}
    />
  );

  if (isLoading) {
    return (
      <ThemedView
        style={[styles.container, { paddingTop: headerHeight + Spacing.xl }]}
      >
        <View style={styles.loadingContainer}>
          <SkeletonLoader height={180} />
          <SkeletonLoader height={180} />
          <SkeletonLoader height={180} />
        </View>
      </ThemedView>
    );
  }

  const previewDims = previewTemplate
    ? getPageDimensions(previewTemplate.pageSize, previewTemplate.orientation)
    : null;

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={templates}
        renderItem={renderTemplate}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather
              name="file-text"
              size={64}
              color={theme.textSecondary}
              style={{ opacity: 0.4 }}
            />
            <ThemedText
              type="h3"
              style={[styles.emptyTitle, { color: theme.text }]}
            >
              No Templates Available
            </ThemedText>
            <ThemedText
              type="body"
              style={{ color: theme.textSecondary, textAlign: "center" }}
            >
              Document templates will appear here once they are configured by
              the administrator.
            </ThemedText>
          </View>
        }
        ListHeaderComponent={
          templates.length > 0 ? (
            <View style={styles.header}>
              <ThemedText
                type="body"
                style={{ color: theme.textSecondary, marginBottom: Spacing.md }}
              >
                Select a sample to fill template placeholders with actual data
              </ThemedText>

              {/* Sample Selection Button */}
              <Pressable
                style={[
                  styles.sampleSelectorBtn,
                  {
                    backgroundColor: theme.backgroundRoot,
                    borderColor: selectedSample ? theme.success : theme.border,
                  },
                ]}
                onPress={() => setShowSampleSelector(true)}
              >
                <Feather
                  name="database"
                  size={18}
                  color={selectedSample ? theme.success : theme.primary}
                />
                <View style={styles.sampleSelectorText}>
                  {selectedSample ? (
                    <>
                      <ThemedText type="body" style={{ fontWeight: "600" }}>
                        {selectedSample.code}
                      </ThemedText>
                      <ThemedText
                        type="small"
                        style={{ color: theme.textSecondary }}
                      >
                        {selectedSample.name} -{" "}
                        {selectedSample.establishmentName}
                      </ThemedText>
                    </>
                  ) : (
                    <ThemedText
                      type="body"
                      style={{ color: theme.textSecondary }}
                    >
                      Select a sample to fill placeholders...
                    </ThemedText>
                  )}
                </View>
                <Feather
                  name="chevron-down"
                  size={20}
                  color={theme.textSecondary}
                />
              </Pressable>

              {selectedSample ? (
                <Pressable
                  style={[styles.clearSampleBtn]}
                  onPress={() => setSelectedSample(null)}
                >
                  <Feather name="x" size={14} color={theme.accent} />
                  <ThemedText type="small" style={{ color: theme.accent }}>
                    Clear selection
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
          ) : null
        }
      />

      <Modal
        visible={previewTemplate !== null}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setPreviewTemplate(null)}
      >
        <View style={[styles.modalContainer, { backgroundColor: "#374151" }]}>
          <View
            style={[
              styles.modalHeader,
              { paddingTop: insets.top + Spacing.sm },
            ]}
          >
            <View style={styles.modalTitleRow}>
              <Feather name="eye" size={20} color="white" />
              <ThemedText
                type="h4"
                style={{ color: "white", marginLeft: Spacing.sm }}
              >
                Preview
              </ThemedText>
            </View>
            <View style={styles.zoomControls}>
              <Pressable style={styles.zoomBtn} onPress={handleZoomOut}>
                <Feather name="minus" size={18} color="white" />
              </Pressable>
              <View style={styles.zoomLevel}>
                <ThemedText type="small" style={{ color: "white" }}>
                  {Math.round(zoomLevel * 100)}%
                </ThemedText>
              </View>
              <Pressable style={styles.zoomBtn} onPress={handleZoomIn}>
                <Feather name="plus" size={18} color="white" />
              </Pressable>
              <Pressable style={styles.zoomBtn} onPress={handleZoomFit}>
                <Feather name="maximize" size={18} color="white" />
              </Pressable>
              <Pressable style={styles.zoomBtn} onPress={handleZoomActual}>
                <Feather name="square" size={18} color="white" />
              </Pressable>
            </View>
          </View>

          {previewTemplate && Platform.OS !== "web" && WebView ? (
            <WebView
              key={`preview-${zoomLevel}`}
              ref={webViewRef}
              source={{ html: generatePreviewHtml(previewTemplate, zoomLevel) }}
              style={styles.webview}
              scrollEnabled={true}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
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
          ) : previewTemplate && Platform.OS === "web" ? (
            <View style={styles.webPreview}>
              <iframe
                key={`preview-${zoomLevel}`}
                srcDoc={generatePreviewHtml(previewTemplate, zoomLevel)}
                style={
                  {
                    width: "100%",
                    height: "100%",
                    border: "none",
                    backgroundColor: "#4b5563",
                    overflow: "auto",
                  } as any
                }
              />
            </View>
          ) : null}

          <View
            style={[
              styles.bottomBar,
              { paddingBottom: Math.max(insets.bottom, Spacing.sm) },
            ]}
          >
            <View style={styles.pdfNavBar}>
              <Pressable
                style={[
                  styles.pdfNavBtn,
                  currentPage <= 1 && styles.pdfNavBtnDisabled,
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
                  styles.pdfNavBtn,
                  currentPage <= 1 && styles.pdfNavBtnDisabled,
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

              <View style={styles.pdfPageIndicator}>
                <ThemedText style={styles.pdfPageText}>
                  {currentPage} OF {totalPages}
                </ThemedText>
              </View>

              <Pressable
                style={[
                  styles.pdfNavBtn,
                  currentPage >= totalPages && styles.pdfNavBtnDisabled,
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
                  styles.pdfNavBtn,
                  currentPage >= totalPages && styles.pdfNavBtnDisabled,
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

            {previewDims ? (
              <ThemedText type="small" style={{ color: "#9ca3af" }}>
                {previewDims.label}
              </ThemedText>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Sample Selector Modal */}
      <Modal
        visible={showSampleSelector}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSampleSelector(false)}
      >
        <View
          style={[
            styles.sampleModal,
            { backgroundColor: theme.backgroundDefault },
          ]}
        >
          <View
            style={[
              styles.sampleModalHeader,
              {
                paddingTop: insets.top + Spacing.sm,
                borderBottomColor: theme.border,
              },
            ]}
          >
            <ThemedText type="h3">Select Sample</ThemedText>
            <Pressable onPress={() => setShowSampleSelector(false)}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          {/* Search Bar */}
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: theme.backgroundRoot,
                borderColor: theme.border,
              },
            ]}
          >
            <Feather name="search" size={18} color={theme.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search by sample code, name, establishment..."
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery("")}>
                <Feather
                  name="x-circle"
                  size={18}
                  color={theme.textSecondary}
                />
              </Pressable>
            ) : null}
          </View>

          {/* Filter Chips */}
          <View style={styles.filterRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChips}
            >
              {/* Type Filter */}
              <Pressable
                style={[
                  styles.filterChip,
                  sampleTypeFilter === "all" && {
                    backgroundColor: theme.primary,
                  },
                ]}
                onPress={() => setSampleTypeFilter("all")}
              >
                <ThemedText
                  type="small"
                  style={{
                    color: sampleTypeFilter === "all" ? "white" : theme.text,
                  }}
                >
                  All Types
                </ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.filterChip,
                  sampleTypeFilter === "enforcement" && {
                    backgroundColor: "#dc2626",
                  },
                ]}
                onPress={() => setSampleTypeFilter("enforcement")}
              >
                <ThemedText
                  type="small"
                  style={{
                    color:
                      sampleTypeFilter === "enforcement" ? "white" : theme.text,
                  }}
                >
                  Enforcement
                </ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.filterChip,
                  sampleTypeFilter === "surveillance" && {
                    backgroundColor: "#059669",
                  },
                ]}
                onPress={() => setSampleTypeFilter("surveillance")}
              >
                <ThemedText
                  type="small"
                  style={{
                    color:
                      sampleTypeFilter === "surveillance"
                        ? "white"
                        : theme.text,
                  }}
                >
                  Surveillance
                </ThemedText>
              </Pressable>

              <View style={styles.filterDivider} />

              {/* Date Filter */}
              <Pressable
                style={[
                  styles.filterChip,
                  dateFilter === "all" && { backgroundColor: theme.primary },
                ]}
                onPress={() => setDateFilter("all")}
              >
                <ThemedText
                  type="small"
                  style={{ color: dateFilter === "all" ? "white" : theme.text }}
                >
                  All Time
                </ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.filterChip,
                  dateFilter === "7days" && { backgroundColor: theme.primary },
                ]}
                onPress={() => setDateFilter("7days")}
              >
                <ThemedText
                  type="small"
                  style={{
                    color: dateFilter === "7days" ? "white" : theme.text,
                  }}
                >
                  Last 7 Days
                </ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.filterChip,
                  dateFilter === "30days" && { backgroundColor: theme.primary },
                ]}
                onPress={() => setDateFilter("30days")}
              >
                <ThemedText
                  type="small"
                  style={{
                    color: dateFilter === "30days" ? "white" : theme.text,
                  }}
                >
                  Last 30 Days
                </ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.filterChip,
                  dateFilter === "90days" && { backgroundColor: theme.primary },
                ]}
                onPress={() => setDateFilter("90days")}
              >
                <ThemedText
                  type="small"
                  style={{
                    color: dateFilter === "90days" ? "white" : theme.text,
                  }}
                >
                  Last 90 Days
                </ThemedText>
              </Pressable>
            </ScrollView>
          </View>

          {/* Sample List */}
          <FlatList
            data={filteredSamples}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.sampleList}
            ListEmptyComponent={
              <View style={styles.emptySampleList}>
                <Feather
                  name="inbox"
                  size={48}
                  color={theme.textSecondary}
                  style={{ opacity: 0.5 }}
                />
                <ThemedText
                  type="body"
                  style={{
                    color: theme.textSecondary,
                    textAlign: "center",
                    marginTop: Spacing.md,
                  }}
                >
                  {samples.length === 0
                    ? "No samples found. Lift samples during inspections to see them here."
                    : "No samples match your filters."}
                </ThemedText>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.sampleItem,
                  {
                    backgroundColor: theme.backgroundRoot,
                    borderColor:
                      selectedSample?.id === item.id
                        ? theme.primary
                        : theme.border,
                  },
                ]}
                onPress={() => {
                  setSelectedSample(item);
                  setShowSampleSelector(false);
                }}
              >
                <View style={styles.sampleItemHeader}>
                  <View
                    style={[
                      styles.sampleTypeBadge,
                      {
                        backgroundColor:
                          item.sampleType === "enforcement"
                            ? "#fee2e2"
                            : "#dcfce7",
                      },
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={{
                        color:
                          item.sampleType === "enforcement"
                            ? "#dc2626"
                            : "#059669",
                        fontWeight: "600",
                      }}
                    >
                      {item.sampleType === "enforcement" ? "ENF" : "SRV"}
                    </ThemedText>
                  </View>
                  <ThemedText
                    type="body"
                    style={{ fontWeight: "700", flex: 1 }}
                  >
                    {item.code}
                  </ThemedText>
                  {selectedSample?.id === item.id ? (
                    <Feather
                      name="check-circle"
                      size={20}
                      color={theme.primary}
                    />
                  ) : null}
                </View>

                <ThemedText type="body" style={{ marginTop: Spacing.xs }}>
                  {item.name}
                </ThemedText>

                <View style={styles.sampleItemDetails}>
                  <View style={styles.sampleDetail}>
                    <Feather
                      name="home"
                      size={12}
                      color={theme.textSecondary}
                    />
                    <ThemedText
                      type="small"
                      style={{ color: theme.textSecondary }}
                    >
                      {item.establishmentName || "Unknown Establishment"}
                    </ThemedText>
                  </View>
                  <View style={styles.sampleDetail}>
                    <Feather
                      name="calendar"
                      size={12}
                      color={theme.textSecondary}
                    />
                    <ThemedText
                      type="small"
                      style={{ color: theme.textSecondary }}
                    >
                      {new Date(item.liftedDate).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </ThemedText>
                  </View>
                </View>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  header: {
    marginBottom: Spacing.md,
  },
  card: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  formatInfo: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  templateName: {
    marginTop: Spacing.xs,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  formatTags: {
    flexDirection: "row",
    gap: Spacing.sm,
    flexWrap: "wrap",
    flex: 1,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  buttonGroup: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  previewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  downloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing["2xl"],
    gap: Spacing.md,
  },
  emptyTitle: {
    marginTop: Spacing.md,
    textAlign: "center",
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    backgroundColor: "#1f2937",
  },
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  zoomControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  zoomBtn: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  zoomLevel: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 4,
    minWidth: 50,
    alignItems: "center",
  },
  webview: {
    flex: 1,
    backgroundColor: "#4b5563",
  },
  webPreview: {
    flex: 1,
    backgroundColor: "#4b5563",
  },
  webPreviewContent: {
    padding: 20,
  },
  bottomBar: {
    backgroundColor: "#374151",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#4b5563",
  },
  pdfNavBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1f2937",
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  pdfNavBtn: {
    width: 32,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
  },
  pdfNavBtnDisabled: {
    opacity: 0.5,
  },
  pdfPageIndicator: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    backgroundColor: "#374151",
    borderRadius: 4,
    marginHorizontal: 4,
  },
  pdfPageText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  bottomBarRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  bottomBarLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  pageNavigation: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E40AF",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    gap: 6,
  },
  pageNavText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  // Sample selector styles
  sampleSelectorBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  sampleSelectorText: {
    flex: 1,
  },
  clearSampleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    alignSelf: "flex-start",
  },
  sampleModal: {
    flex: 1,
  },
  sampleModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    margin: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.xs,
  },
  filterRow: {
    marginBottom: Spacing.md,
  },
  filterChips: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    backgroundColor: "#e5e7eb",
  },
  filterDivider: {
    width: 1,
    backgroundColor: "#d1d5db",
    marginHorizontal: Spacing.sm,
  },
  sampleList: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  emptySampleList: {
    alignItems: "center",
    padding: Spacing["2xl"],
  },
  sampleItem: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  sampleItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  sampleTypeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  sampleItemDetails: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginTop: Spacing.sm,
  },
  sampleDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
});
