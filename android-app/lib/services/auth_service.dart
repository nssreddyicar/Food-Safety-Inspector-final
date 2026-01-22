/// =============================================================================
/// FILE: android-app/lib/services/auth_service.dart
/// PURPOSE: Authentication service for officer login/logout with JWT refresh
/// =============================================================================

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'network_service.dart';
import 'crash_reporter.dart';
import '../models/officer.dart';

/// Authentication state.
class AuthState {
  final bool isAuthenticated;
  final Officer? officer;
  final bool isLoading;
  final String? error;

  const AuthState({
    this.isAuthenticated = false,
    this.officer,
    this.isLoading = false,
    this.error,
  });

  AuthState copyWith({
    bool? isAuthenticated,
    Officer? officer,
    bool? isLoading,
    String? error,
  }) {
    return AuthState(
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      officer: officer ?? this.officer,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

/// Authentication service provider.
final authServiceProvider = StateNotifierProvider<AuthService, AuthState>(
  (ref) => AuthService(),
);

/// Authentication service with JWT refresh token support.
class AuthService extends StateNotifier<AuthState> {
  final _networkService = NetworkService();

  AuthService() : super(const AuthState()) {
    // Listen for token expiration
    _networkService.onTokenExpired = _handleTokenExpired;
  }

  void _handleTokenExpired() {
    crashReporter.addBreadcrumb(
      category: 'auth',
      message: 'Token expired, logging out',
      level: BreadcrumbLevel.warning,
    );
    logout();
  }

  /// Login with email and password.
  Future<void> login({
    required String email,
    required String password,
  }) async {
    state = state.copyWith(isLoading: true, error: null);
    
    crashReporter.addBreadcrumb(
      category: 'auth',
      message: 'Login attempt',
      data: {'email': email},
    );

    try {
      final response = await _networkService.post<Map<String, dynamic>>(
        '/api/officer/login',
        data: {'email': email, 'password': password},
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data!;
        
        // Store tokens (access + refresh)
        final accessToken = data['accessToken'] ?? data['token'];
        final refreshToken = data['refreshToken'];
        
        if (accessToken != null) {
          await _networkService.setTokens(
            accessToken: accessToken,
            refreshToken: refreshToken ?? '',
          );
        }

        // Parse officer
        final officer = Officer.fromJson(data['officer']);
        
        // Set user in crash reporter
        await crashReporter.setUser(
          officer.id,
          email: officer.email,
          name: officer.name,
        );
        
        crashReporter.addBreadcrumb(
          category: 'auth',
          message: 'Login successful',
          data: {'officerId': officer.id},
        );
        
        state = state.copyWith(
          isAuthenticated: true,
          officer: officer,
          isLoading: false,
        );
      } else {
        crashReporter.addBreadcrumb(
          category: 'auth',
          message: 'Login failed - invalid response',
          level: BreadcrumbLevel.warning,
        );
        
        state = state.copyWith(
          isLoading: false,
          error: 'Invalid credentials',
        );
      }
    } catch (e) {
      crashReporter.addBreadcrumb(
        category: 'auth',
        message: 'Login failed - exception',
        data: {'error': e.toString()},
        level: BreadcrumbLevel.error,
      );
      
      state = state.copyWith(
        isLoading: false,
        error: 'Login failed. Please try again.',
      );
    }
  }

  /// Logout and clear session.
  Future<void> logout() async {
    crashReporter.addBreadcrumb(
      category: 'auth',
      message: 'User logout',
    );
    
    await _networkService.clearTokens();
    await crashReporter.clearUser();
    state = const AuthState();
  }

  /// Check if user is authenticated.
  Future<void> checkAuth() async {
    final hasTokens = await _networkService.hasValidTokens();
    if (!hasTokens) {
      state = const AuthState();
      return;
    }

    try {
      final response = await _networkService.get<Map<String, dynamic>>(
        '/api/officer/me',
      );

      if (response.statusCode == 200 && response.data != null) {
        final officer = Officer.fromJson(response.data!);
        
        // Set user in crash reporter
        await crashReporter.setUser(
          officer.id,
          email: officer.email,
          name: officer.name,
        );
        
        state = state.copyWith(
          isAuthenticated: true,
          officer: officer,
        );
      } else {
        await logout();
      }
    } catch (e) {
      await logout();
    }
  }
}
