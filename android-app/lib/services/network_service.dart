/// =============================================================================
/// FILE: android-app/lib/services/network_service.dart
/// PURPOSE: Production-grade network handling with retry, offline queue, connectivity
/// =============================================================================
///
/// Provides:
/// - Exponential backoff retry for failed requests
/// - Offline queue for mutations when network is unavailable
/// - Connectivity monitoring with user feedback
/// - Automatic token refresh on 401 errors
/// =============================================================================

import 'dart:async';
import 'dart:collection';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../config/env.dart';

/// Network connectivity status
enum NetworkStatus {
  online,
  offline,
  unknown,
}

/// Queued request for offline handling
class QueuedRequest {
  final String id;
  final String method;
  final String path;
  final dynamic data;
  final Map<String, dynamic>? queryParameters;
  final DateTime createdAt;
  int retryCount;

  QueuedRequest({
    required this.id,
    required this.method,
    required this.path,
    this.data,
    this.queryParameters,
    required this.createdAt,
    this.retryCount = 0,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'method': method,
    'path': path,
    'data': data,
    'queryParameters': queryParameters,
    'createdAt': createdAt.toIso8601String(),
    'retryCount': retryCount,
  };
}

/// Retry configuration
class RetryConfig {
  final int maxRetries;
  final Duration initialDelay;
  final double backoffMultiplier;
  final Duration maxDelay;
  final List<int> retryStatusCodes;

  const RetryConfig({
    this.maxRetries = 3,
    this.initialDelay = const Duration(seconds: 1),
    this.backoffMultiplier = 2.0,
    this.maxDelay = const Duration(seconds: 30),
    this.retryStatusCodes = const [408, 429, 500, 502, 503, 504],
  });

  Duration getDelayForAttempt(int attempt) {
    final delay = initialDelay * (backoffMultiplier * attempt);
    return delay > maxDelay ? maxDelay : delay;
  }
}

/// Network service singleton for production-grade networking
class NetworkService {
  static final NetworkService _instance = NetworkService._internal();
  factory NetworkService() => _instance;

  late final Dio _dio;
  final _storage = const FlutterSecureStorage();
  final _connectivity = Connectivity();
  
  // Keys for secure storage
  static const String _accessTokenKey = 'access_token';
  static const String _refreshTokenKey = 'refresh_token';
  static const String _offlineQueueKey = 'offline_queue';

  // Retry configuration
  final _retryConfig = const RetryConfig();
  
  // Offline queue
  final Queue<QueuedRequest> _offlineQueue = Queue<QueuedRequest>();
  
  // Connectivity state
  final _networkStatusController = StreamController<NetworkStatus>.broadcast();
  Stream<NetworkStatus> get networkStatus => _networkStatusController.stream;
  NetworkStatus _currentStatus = NetworkStatus.unknown;
  NetworkStatus get currentStatus => _currentStatus;

  // Callbacks
  VoidCallback? onTokenExpired;
  void Function(String message)? onNetworkError;

  NetworkService._internal() {
    _initializeDio();
    _initializeConnectivity();
  }

  void _initializeDio() {
    _dio = Dio(BaseOptions(
      baseUrl: Env.apiBaseUrl,
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));

    // Add retry interceptor
    _dio.interceptors.add(_RetryInterceptor(
      dio: _dio,
      retryConfig: _retryConfig,
      storage: _storage,
      onTokenRefresh: _refreshToken,
      onTokenExpired: () => onTokenExpired?.call(),
    ));
  }

  void _initializeConnectivity() {
    // Check initial connectivity
    _connectivity.checkConnectivity().then(_updateConnectivity);
    
    // Listen for changes
    _connectivity.onConnectivityChanged.listen(_updateConnectivity);
  }

  void _updateConnectivity(List<ConnectivityResult> results) {
    final result = results.isNotEmpty ? results.first : ConnectivityResult.none;
    final newStatus = result == ConnectivityResult.none 
        ? NetworkStatus.offline 
        : NetworkStatus.online;
    
    if (newStatus != _currentStatus) {
      _currentStatus = newStatus;
      _networkStatusController.add(newStatus);
      
      // Process offline queue when back online
      if (newStatus == NetworkStatus.online) {
        _processOfflineQueue();
      }
    }
  }

  /// Refresh access token using refresh token
  Future<bool> _refreshToken() async {
    try {
      final refreshToken = await _storage.read(key: _refreshTokenKey);
      if (refreshToken == null) return false;

      final response = await Dio().post(
        '${Env.apiBaseUrl}/api/officer/refresh-token',
        data: {'refreshToken': refreshToken},
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data as Map<String, dynamic>;
        await _storage.write(key: _accessTokenKey, value: data['accessToken']);
        if (data['refreshToken'] != null) {
          await _storage.write(key: _refreshTokenKey, value: data['refreshToken']);
        }
        return true;
      }
    } catch (e) {
      debugPrint('Token refresh failed: $e');
    }
    return false;
  }

  /// Store authentication tokens
  Future<void> setTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await _storage.write(key: _accessTokenKey, value: accessToken);
    await _storage.write(key: _refreshTokenKey, value: refreshToken);
  }

  /// Clear all tokens
  Future<void> clearTokens() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
  }

  /// Check if user has valid tokens
  Future<bool> hasValidTokens() async {
    final accessToken = await _storage.read(key: _accessTokenKey);
    return accessToken != null;
  }

  /// Add request to offline queue
  void _addToOfflineQueue(QueuedRequest request) {
    _offlineQueue.add(request);
    debugPrint('Request queued for offline: ${request.path}');
  }

  /// Process offline queue when back online
  Future<void> _processOfflineQueue() async {
    if (_offlineQueue.isEmpty) return;
    
    debugPrint('Processing ${_offlineQueue.length} queued requests');
    
    while (_offlineQueue.isNotEmpty) {
      final request = _offlineQueue.removeFirst();
      
      try {
        await _executeRequest(request.method, request.path, 
          data: request.data, 
          queryParameters: request.queryParameters,
        );
        debugPrint('Queued request succeeded: ${request.path}');
      } catch (e) {
        if (request.retryCount < _retryConfig.maxRetries) {
          request.retryCount++;
          _offlineQueue.add(request);
          debugPrint('Queued request failed, will retry: ${request.path}');
        } else {
          debugPrint('Queued request failed permanently: ${request.path}');
          onNetworkError?.call('Failed to sync: ${request.path}');
        }
      }
    }
  }

  /// Execute request with offline queue support
  Future<Response<T>> _executeRequest<T>(
    String method,
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    bool queueIfOffline = true,
  }) async {
    // Check connectivity
    if (_currentStatus == NetworkStatus.offline && queueIfOffline) {
      if (method != 'GET') {
        _addToOfflineQueue(QueuedRequest(
          id: DateTime.now().millisecondsSinceEpoch.toString(),
          method: method,
          path: path,
          data: data,
          queryParameters: queryParameters,
          createdAt: DateTime.now(),
        ));
      }
      throw DioException(
        requestOptions: RequestOptions(path: path),
        type: DioExceptionType.connectionError,
        message: 'No network connection. Request queued for later.',
      );
    }

    switch (method.toUpperCase()) {
      case 'GET':
        return _dio.get<T>(path, queryParameters: queryParameters);
      case 'POST':
        return _dio.post<T>(path, data: data, queryParameters: queryParameters);
      case 'PUT':
        return _dio.put<T>(path, data: data, queryParameters: queryParameters);
      case 'DELETE':
        return _dio.delete<T>(path, queryParameters: queryParameters);
      case 'PATCH':
        return _dio.patch<T>(path, data: data, queryParameters: queryParameters);
      default:
        throw ArgumentError('Unsupported HTTP method: $method');
    }
  }

  /// GET request
  Future<Response<T>> get<T>(String path, {Map<String, dynamic>? queryParameters}) =>
      _executeRequest<T>('GET', path, queryParameters: queryParameters, queueIfOffline: false);

  /// POST request
  Future<Response<T>> post<T>(String path, {dynamic data, Map<String, dynamic>? queryParameters}) =>
      _executeRequest<T>('POST', path, data: data, queryParameters: queryParameters);

  /// PUT request
  Future<Response<T>> put<T>(String path, {dynamic data, Map<String, dynamic>? queryParameters}) =>
      _executeRequest<T>('PUT', path, data: data, queryParameters: queryParameters);

  /// DELETE request
  Future<Response<T>> delete<T>(String path, {Map<String, dynamic>? queryParameters}) =>
      _executeRequest<T>('DELETE', path, queryParameters: queryParameters);

  /// Upload file with progress
  Future<Response<T>> uploadFile<T>(
    String path,
    String filePath,
    String fieldName, {
    void Function(int sent, int total)? onProgress,
  }) async {
    final formData = FormData.fromMap({
      fieldName: await MultipartFile.fromFile(filePath),
    });
    return _dio.post<T>(
      path,
      data: formData,
      onSendProgress: onProgress,
    );
  }

  /// Get pending offline requests count
  int get pendingRequestsCount => _offlineQueue.length;

  /// Dispose resources
  void dispose() {
    _networkStatusController.close();
  }
}

/// Retry interceptor with exponential backoff and token refresh
class _RetryInterceptor extends Interceptor {
  final Dio dio;
  final RetryConfig retryConfig;
  final FlutterSecureStorage storage;
  final Future<bool> Function() onTokenRefresh;
  final VoidCallback onTokenExpired;

  _RetryInterceptor({
    required this.dio,
    required this.retryConfig,
    required this.storage,
    required this.onTokenRefresh,
    required this.onTokenExpired,
  });

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    // Add auth token to request
    final token = await storage.read(key: 'access_token');
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    final statusCode = err.response?.statusCode;
    final retryCount = err.requestOptions.extra['retryCount'] ?? 0;

    // Handle 401 - try token refresh
    if (statusCode == 401) {
      final refreshed = await onTokenRefresh();
      if (refreshed) {
        // Retry with new token
        try {
          final response = await dio.fetch(err.requestOptions);
          return handler.resolve(response);
        } catch (e) {
          return handler.next(err);
        }
      } else {
        onTokenExpired();
        return handler.next(err);
      }
    }

    // Check if we should retry
    if (retryCount < retryConfig.maxRetries &&
        (retryConfig.retryStatusCodes.contains(statusCode) ||
         err.type == DioExceptionType.connectionTimeout ||
         err.type == DioExceptionType.receiveTimeout)) {
      
      final delay = retryConfig.getDelayForAttempt(retryCount);
      debugPrint('Retrying request (attempt ${retryCount + 1}) after ${delay.inMilliseconds}ms');
      
      await Future.delayed(delay);
      
      err.requestOptions.extra['retryCount'] = retryCount + 1;
      
      try {
        final response = await dio.fetch(err.requestOptions);
        return handler.resolve(response);
      } catch (e) {
        if (e is DioException) {
          return handler.next(e);
        }
        return handler.next(err);
      }
    }

    handler.next(err);
  }
}
