/**
 * =============================================================================
 * FILE: server/services/storage.service.ts
 * PURPOSE: File storage service for inspection photos, sample images, documents
 * =============================================================================
 * 
 * Handles file uploads and retrieval for:
 * - Inspection photos (FBO premises, violations, evidence)
 * - Sample images (product photos, labels)
 * - Documents (lab reports, legal notices)
 * 
 * STORAGE: Local filesystem (./server/uploads/)
 * For production, migrate to cloud storage (S3, GCS, etc.)
 * =============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'server', 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export interface UploadedFile {
  id: string;
  originalName: string;
  filename: string;
  mimeType: string;
  size: number;
  path: string;
  url: string;
  uploadedAt: Date;
}

export interface UploadOptions {
  category: 'inspection' | 'sample' | 'document' | 'profile';
  entityId?: string;
  officerId?: string;
}

/**
 * Save a base64-encoded file to storage.
 */
export async function saveFile(
  base64Data: string,
  originalName: string,
  mimeType: string,
  options: UploadOptions
): Promise<UploadedFile> {
  const id = randomUUID();
  const ext = getExtension(mimeType, originalName);
  const filename = `${options.category}_${id}${ext}`;
  const filePath = path.join(UPLOAD_DIR, filename);

  // Remove data URL prefix if present
  const base64Content = base64Data.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(base64Content, 'base64');

  await fs.promises.writeFile(filePath, buffer);

  const stats = await fs.promises.stat(filePath);

  return {
    id,
    originalName,
    filename,
    mimeType,
    size: stats.size,
    path: filePath,
    url: `/api/files/${filename}`,
    uploadedAt: new Date(),
  };
}

/**
 * Save a file from buffer.
 */
export async function saveFileBuffer(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  options: UploadOptions
): Promise<UploadedFile> {
  const id = randomUUID();
  const ext = getExtension(mimeType, originalName);
  const filename = `${options.category}_${id}${ext}`;
  const filePath = path.join(UPLOAD_DIR, filename);

  await fs.promises.writeFile(filePath, buffer);

  const stats = await fs.promises.stat(filePath);

  return {
    id,
    originalName,
    filename,
    mimeType,
    size: stats.size,
    path: filePath,
    url: `/api/files/${filename}`,
    uploadedAt: new Date(),
  };
}

/**
 * Get a file by filename.
 */
export async function getFile(filename: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const filePath = path.join(UPLOAD_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const buffer = await fs.promises.readFile(filePath);
  const mimeType = getMimeType(filename);

  return { buffer, mimeType };
}

/**
 * Delete a file by filename.
 */
export async function deleteFile(filename: string): Promise<boolean> {
  const filePath = path.join(UPLOAD_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return false;
  }

  await fs.promises.unlink(filePath);
  return true;
}

/**
 * List all files in a category.
 */
export async function listFiles(category?: string): Promise<string[]> {
  const files = await fs.promises.readdir(UPLOAD_DIR);
  
  if (category) {
    return files.filter(f => f.startsWith(`${category}_`));
  }
  
  return files;
}

/**
 * Get file extension from mime type or filename.
 */
function getExtension(mimeType: string, filename: string): string {
  const mimeExtensions: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  };

  if (mimeExtensions[mimeType]) {
    return mimeExtensions[mimeType];
  }

  const ext = path.extname(filename);
  return ext || '.bin';
}

/**
 * Get mime type from filename.
 */
function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const extMimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };

  return extMimeTypes[ext] || 'application/octet-stream';
}
