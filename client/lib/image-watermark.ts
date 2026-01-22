export interface ImageMetadata {
  capturedAt: Date;
  uploadedAt: Date;
  latitude: string;
  longitude: string;
  accuracy?: string;
}

export interface ComplaintInfo {
  complainantName?: string;
  establishmentName?: string;
  complainantMobile?: string;
}

export interface EvidenceImage {
  id: string;
  uri: string;
  watermarkedUri?: string;
  metadata: ImageMetadata;
}

export const formatDateTime = (date: Date): string => {
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

export const formatCoordinates = (lat: string, lng: string): string => {
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  if (isNaN(latNum) || isNaN(lngNum)) return "Location unavailable";
  const latDir = latNum >= 0 ? "N" : "S";
  const lngDir = lngNum >= 0 ? "E" : "W";
  return `${Math.abs(latNum).toFixed(6)}${latDir}, ${Math.abs(lngNum).toFixed(6)}${lngDir}`;
};

export function generateWatermarkLines(metadata: ImageMetadata, complaintInfo?: ComplaintInfo): string[] {
  const lines: string[] = [];
  
  if (complaintInfo?.complainantName) {
    lines.push(`Name: ${complaintInfo.complainantName}`);
  }
  if (complaintInfo?.establishmentName) {
    lines.push(`Est: ${complaintInfo.establishmentName}`);
  }
  if (complaintInfo?.complainantMobile) {
    lines.push(`Mobile: ${complaintInfo.complainantMobile}`);
  }
  
  lines.push(`Captured: ${formatDateTime(metadata.capturedAt)}`);
  lines.push(`Uploaded: ${formatDateTime(metadata.uploadedAt)}`);
  lines.push(`GPS: ${formatCoordinates(metadata.latitude, metadata.longitude)}`);
  
  return lines;
}

export function generateUniqueId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
