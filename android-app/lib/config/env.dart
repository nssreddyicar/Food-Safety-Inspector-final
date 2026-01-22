/// =============================================================================
/// FILE: android-app/lib/config/env.dart
/// PURPOSE: Environment configuration for API endpoints
/// =============================================================================
/// 
/// Manages environment-specific configuration:
/// - Development: Local/staging API
/// - Production: Live API server
/// 
/// RULES:
/// - Never hardcode production URLs in code
/// - Use environment variables or build-time config
/// =============================================================================

import 'package:flutter/foundation.dart';

/// Environment types.
enum Environment {
  development,
  production,
}

/// Environment configuration singleton.
class Env {
  static late Environment _current;
  static late String _apiBaseUrl;
  
  /// Initialize environment based on build mode.
  static Future<void> initialize() async {
    if (kReleaseMode) {
      _current = Environment.production;
      _apiBaseUrl = const String.fromEnvironment(
        'API_BASE_URL',
        defaultValue: 'https://api.foodsafety.gov.in',
      );
    } else {
      _current = Environment.development;
      _apiBaseUrl = const String.fromEnvironment(
        'API_BASE_URL',
        defaultValue: 'https://0afd0d5a-1dd7-4a9f-9619-6f8e5c1118e9-00-1zo5eoxc9298j.riker.replit.dev',
      );
    }
  }
  
  /// Current environment.
  static Environment get current => _current;
  
  /// API base URL for current environment.
  static String get apiBaseUrl => _apiBaseUrl;
  
  /// Whether running in development mode.
  static bool get isDevelopment => _current == Environment.development;
  
  /// Whether running in production mode.
  static bool get isProduction => _current == Environment.production;
}
