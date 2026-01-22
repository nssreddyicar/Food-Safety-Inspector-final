/// =============================================================================
/// FILE: android-app/lib/services/api_client.dart
/// PURPOSE: HTTP client for backend API communication
/// =============================================================================
/// 
/// DEPRECATED: Use NetworkService instead for production-grade networking.
/// 
/// This file is kept for backwards compatibility but will be removed.
/// NetworkService provides:
/// - Exponential backoff retry
/// - Offline queue for mutations
/// - Connectivity monitoring
/// - Automatic token refresh
/// =============================================================================

import 'network_service.dart';

/// API client - wrapper around NetworkService for backwards compatibility.
/// @deprecated Use NetworkService directly for new code.
class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;
  
  final _networkService = NetworkService();

  ApiClient._internal();

  /// Store authentication token.
  Future<void> setToken(String token) async {
    await _networkService.setTokens(accessToken: token, refreshToken: '');
  }

  /// Clear authentication token.
  Future<void> clearToken() async {
    await _networkService.clearTokens();
  }

  /// Check if user is authenticated.
  Future<bool> isAuthenticated() async {
    return _networkService.hasValidTokens();
  }

  /// GET request.
  Future<dynamic> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    return _networkService.get<T>(path, queryParameters: queryParameters);
  }

  /// POST request.
  Future<dynamic> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
  }) async {
    return _networkService.post<T>(path, data: data, queryParameters: queryParameters);
  }

  /// PUT request.
  Future<dynamic> put<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
  }) async {
    return _networkService.put<T>(path, data: data, queryParameters: queryParameters);
  }

  /// DELETE request.
  Future<dynamic> delete<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    return _networkService.delete<T>(path, queryParameters: queryParameters);
  }

  /// Upload file.
  Future<dynamic> uploadFile<T>(
    String path,
    String filePath,
    String fieldName,
  ) async {
    return _networkService.uploadFile<T>(path, filePath, fieldName);
  }
}
