/// =============================================================================
/// FILE: android-app/lib/services/crash_reporter.dart
/// PURPOSE: Production-grade crash reporting and error tracking
/// =============================================================================
///
/// Provides:
/// - Automatic crash capture with stack traces
/// - Non-fatal error logging
/// - User context for debugging
/// - Breadcrumb trail for error context
/// =============================================================================

import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:dio/dio.dart';
import '../config/env.dart';

/// Breadcrumb for tracking user actions before a crash
class Breadcrumb {
  final String category;
  final String message;
  final Map<String, dynamic>? data;
  final DateTime timestamp;
  final BreadcrumbLevel level;

  Breadcrumb({
    required this.category,
    required this.message,
    this.data,
    DateTime? timestamp,
    this.level = BreadcrumbLevel.info,
  }) : timestamp = timestamp ?? DateTime.now();

  Map<String, dynamic> toJson() => {
    'category': category,
    'message': message,
    'data': data,
    'timestamp': timestamp.toIso8601String(),
    'level': level.name,
  };
}

enum BreadcrumbLevel { debug, info, warning, error }

/// Error report to send to backend
class ErrorReport {
  final String type;
  final String message;
  final String? stackTrace;
  final Map<String, dynamic>? context;
  final List<Breadcrumb> breadcrumbs;
  final DateTime timestamp;
  final String? userId;
  final Map<String, dynamic>? deviceInfo;

  ErrorReport({
    required this.type,
    required this.message,
    this.stackTrace,
    this.context,
    required this.breadcrumbs,
    DateTime? timestamp,
    this.userId,
    this.deviceInfo,
  }) : timestamp = timestamp ?? DateTime.now();

  Map<String, dynamic> toJson() => {
    'type': type,
    'message': message,
    'stackTrace': stackTrace,
    'context': context,
    'breadcrumbs': breadcrumbs.map((b) => b.toJson()).toList(),
    'timestamp': timestamp.toIso8601String(),
    'userId': userId,
    'deviceInfo': deviceInfo,
  };
}

/// Crash reporter singleton
class CrashReporter {
  static final CrashReporter _instance = CrashReporter._internal();
  factory CrashReporter() => _instance;

  final List<Breadcrumb> _breadcrumbs = [];
  final _storage = const FlutterSecureStorage();
  final Dio _dio = Dio();
  
  static const int _maxBreadcrumbs = 50;
  static const String _userIdKey = 'crash_reporter_user_id';

  String? _userId;
  Map<String, dynamic>? _deviceInfo;
  bool _initialized = false;

  CrashReporter._internal();

  /// Initialize crash reporter
  Future<void> initialize() async {
    if (_initialized) return;
    
    // Capture Flutter errors
    FlutterError.onError = (details) {
      captureException(
        details.exception,
        stackTrace: details.stack,
        context: {'library': details.library, 'context': details.context?.toString()},
      );
    };

    // Capture async errors
    PlatformDispatcher.instance.onError = (error, stack) {
      captureException(error, stackTrace: stack);
      return true;
    };

    // Get device info
    _deviceInfo = await _getDeviceInfo();
    
    // Try to restore user ID
    _userId = await _storage.read(key: _userIdKey);
    
    _initialized = true;
    debugPrint('CrashReporter initialized');
  }

  /// Set user context for crash reports
  Future<void> setUser(String userId, {String? email, String? name}) async {
    _userId = userId;
    await _storage.write(key: _userIdKey, value: userId);
    
    addBreadcrumb(
      category: 'user',
      message: 'User set: $userId',
      data: {'email': email, 'name': name},
    );
  }

  /// Clear user context
  Future<void> clearUser() async {
    _userId = null;
    await _storage.delete(key: _userIdKey);
  }

  /// Add a breadcrumb for error context
  void addBreadcrumb({
    required String category,
    required String message,
    Map<String, dynamic>? data,
    BreadcrumbLevel level = BreadcrumbLevel.info,
  }) {
    _breadcrumbs.add(Breadcrumb(
      category: category,
      message: message,
      data: data,
      level: level,
    ));

    // Keep only last N breadcrumbs
    while (_breadcrumbs.length > _maxBreadcrumbs) {
      _breadcrumbs.removeAt(0);
    }
  }

  /// Capture an exception
  Future<void> captureException(
    dynamic exception, {
    StackTrace? stackTrace,
    Map<String, dynamic>? context,
  }) async {
    final report = ErrorReport(
      type: exception.runtimeType.toString(),
      message: exception.toString(),
      stackTrace: stackTrace?.toString(),
      context: context,
      breadcrumbs: List.from(_breadcrumbs),
      userId: _userId,
      deviceInfo: _deviceInfo,
    );

    // Log locally in debug mode
    if (kDebugMode) {
      debugPrint('=== CRASH REPORT ===');
      debugPrint('Type: ${report.type}');
      debugPrint('Message: ${report.message}');
      debugPrint('Stack: ${report.stackTrace}');
      debugPrint('==================');
    }

    // Send to backend
    await _sendReport(report);
  }

  /// Capture a non-fatal message
  Future<void> captureMessage(
    String message, {
    BreadcrumbLevel level = BreadcrumbLevel.info,
    Map<String, dynamic>? context,
  }) async {
    final report = ErrorReport(
      type: 'Message',
      message: message,
      context: {'level': level.name, ...?context},
      breadcrumbs: List.from(_breadcrumbs),
      userId: _userId,
      deviceInfo: _deviceInfo,
    );

    if (kDebugMode) {
      debugPrint('[${level.name.toUpperCase()}] $message');
    }

    if (level == BreadcrumbLevel.error || level == BreadcrumbLevel.warning) {
      await _sendReport(report);
    }
  }

  /// Send report to backend
  Future<void> _sendReport(ErrorReport report) async {
    try {
      await _dio.post(
        '${Env.apiBaseUrl}/api/crash-reports',
        data: report.toJson(),
      );
    } catch (e) {
      // Silently fail - don't crash while reporting crash
      debugPrint('Failed to send crash report: $e');
    }
  }

  /// Get device information
  Future<Map<String, dynamic>> _getDeviceInfo() async {
    return {
      'platform': Platform.operatingSystem,
      'platformVersion': Platform.operatingSystemVersion,
      'locale': Platform.localeName,
      'numberOfProcessors': Platform.numberOfProcessors,
      'isDebug': kDebugMode,
    };
  }

  /// Wrap a function with error capture
  Future<T> captureErrors<T>(Future<T> Function() fn) async {
    try {
      return await fn();
    } catch (e, stack) {
      await captureException(e, stackTrace: stack);
      rethrow;
    }
  }

  /// Create a zone that captures all errors
  void runZonedGuarded(void Function() body) {
    runZonedGuarded(
      body,
      (error, stack) => captureException(error, stackTrace: stack),
    );
  }
}

/// Convenience global instance
final crashReporter = CrashReporter();
