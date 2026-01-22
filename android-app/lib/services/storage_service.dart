/// =============================================================================
/// FILE: android-app/lib/services/storage_service.dart
/// PURPOSE: File storage service for uploading images and documents
/// =============================================================================

import 'dart:convert';
import 'dart:io';
import 'api_client.dart';

class StorageService {
  final ApiClient _apiClient = ApiClient();

  /// Upload a file from path (for camera/gallery images).
  Future<UploadedFile> uploadFile({
    required String filePath,
    required String category,
    String? entityId,
    String? officerId,
  }) async {
    final file = File(filePath);
    final bytes = await file.readAsBytes();
    final base64Data = base64Encode(bytes);
    final filename = filePath.split('/').last;
    final mimeType = _getMimeType(filename);

    final response = await _apiClient.post<Map<String, dynamic>>(
      '/api/files/upload',
      data: {
        'file': base64Data,
        'filename': filename,
        'mimeType': mimeType,
        'category': category,
        'entityId': entityId,
        'officerId': officerId,
      },
    );

    if (response.statusCode == 200 && response.data != null) {
      return UploadedFile.fromJson(response.data!);
    }

    throw Exception('Failed to upload file');
  }

  /// Upload a file from bytes (for processed images).
  Future<UploadedFile> uploadBytes({
    required List<int> bytes,
    required String filename,
    required String category,
    String? entityId,
    String? officerId,
  }) async {
    final base64Data = base64Encode(bytes);
    final mimeType = _getMimeType(filename);

    final response = await _apiClient.post<Map<String, dynamic>>(
      '/api/files/upload',
      data: {
        'file': base64Data,
        'filename': filename,
        'mimeType': mimeType,
        'category': category,
        'entityId': entityId,
        'officerId': officerId,
      },
    );

    if (response.statusCode == 200 && response.data != null) {
      return UploadedFile.fromJson(response.data!);
    }

    throw Exception('Failed to upload file');
  }

  /// Get the full URL for a file.
  String getFileUrl(String filename) {
    return '${_apiClient.toString()}/api/files/$filename';
  }

  /// Delete a file.
  Future<bool> deleteFile(String filename) async {
    final response = await _apiClient.delete<Map<String, dynamic>>(
      '/api/files/$filename',
    );

    return response.statusCode == 200;
  }

  /// Get mime type from filename.
  String _getMimeType(String filename) {
    final ext = filename.split('.').last.toLowerCase();
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };

    return mimeTypes[ext] ?? 'application/octet-stream';
  }
}

/// Uploaded file response.
class UploadedFile {
  final String id;
  final String originalName;
  final String filename;
  final String mimeType;
  final int size;
  final String url;
  final DateTime uploadedAt;

  const UploadedFile({
    required this.id,
    required this.originalName,
    required this.filename,
    required this.mimeType,
    required this.size,
    required this.url,
    required this.uploadedAt,
  });

  factory UploadedFile.fromJson(Map<String, dynamic> json) {
    return UploadedFile(
      id: json['id'],
      originalName: json['originalName'],
      filename: json['filename'],
      mimeType: json['mimeType'],
      size: json['size'],
      url: json['url'],
      uploadedAt: DateTime.parse(json['uploadedAt']),
    );
  }
}
