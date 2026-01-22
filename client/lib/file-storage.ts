/**
 * =============================================================================
 * FILE: client/lib/file-storage.ts
 * PURPOSE: File storage service for uploading images and documents
 * =============================================================================
 * 
 * Handles file uploads for:
 * - Inspection photos (FBO premises, violations, evidence)
 * - Sample images (product photos, labels)
 * - Documents (lab reports, legal notices)
 * =============================================================================
 */

import { getApiUrl, apiRequest } from "./query-client";
import { readAsStringAsync } from "expo-file-system";

export interface UploadedFile {
  id: string;
  originalName: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedAt: string;
}

export type FileCategory = "inspection" | "sample" | "document" | "profile";

/**
 * Upload a file to the server.
 */
export async function uploadFile(
  fileUri: string,
  category: FileCategory,
  entityId?: string,
  officerId?: string
): Promise<UploadedFile> {
  const filename = fileUri.split("/").pop() || "file";
  const mimeType = getMimeType(filename);

  const base64 = await readAsStringAsync(fileUri, {
    encoding: "base64",
  });

  const response = await apiRequest("POST", "/api/files/upload", {
    file: base64,
    filename,
    mimeType,
    category,
    entityId,
    officerId,
  });

  return response.json();
}

/**
 * Get the full URL for a file.
 */
export function getFileUrl(filename: string): string {
  return `${getApiUrl()}api/files/${filename}`;
}

/**
 * Delete a file.
 */
export async function deleteFile(filename: string): Promise<boolean> {
  try {
    await apiRequest("DELETE", `/api/files/${filename}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * List files by category.
 */
export async function listFiles(category?: FileCategory): Promise<string[]> {
  const url = category ? `/api/files?category=${category}` : "/api/files";
  const response = await apiRequest("GET", url);
  const data = await response.json();
  return data.files || [];
}

/**
 * Get mime type from filename.
 */
function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const mimeTypes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };

  return mimeTypes[ext] || "application/octet-stream";
}
