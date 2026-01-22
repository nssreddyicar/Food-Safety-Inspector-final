/// =============================================================================
/// FILE: android-app/lib/services/biometric_service.dart
/// PURPOSE: Biometric authentication (fingerprint, face recognition)
/// =============================================================================

import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Biometric authentication state
class BiometricState {
  final bool isAvailable;
  final bool isEnabled;
  final List<BiometricType> availableTypes;
  final bool isAuthenticating;

  const BiometricState({
    this.isAvailable = false,
    this.isEnabled = false,
    this.availableTypes = const [],
    this.isAuthenticating = false,
  });

  BiometricState copyWith({
    bool? isAvailable,
    bool? isEnabled,
    List<BiometricType>? availableTypes,
    bool? isAuthenticating,
  }) {
    return BiometricState(
      isAvailable: isAvailable ?? this.isAvailable,
      isEnabled: isEnabled ?? this.isEnabled,
      availableTypes: availableTypes ?? this.availableTypes,
      isAuthenticating: isAuthenticating ?? this.isAuthenticating,
    );
  }
}

/// Biometric service provider
final biometricServiceProvider = StateNotifierProvider<BiometricService, BiometricState>(
  (ref) => BiometricService(),
);

/// Biometric authentication service
class BiometricService extends StateNotifier<BiometricState> {
  final LocalAuthentication _auth = LocalAuthentication();
  final _storage = const FlutterSecureStorage();
  
  static const String _biometricEnabledKey = 'biometric_enabled';
  static const String _biometricCredentialsKey = 'biometric_credentials';

  BiometricService() : super(const BiometricState()) {
    _initialize();
  }

  Future<void> _initialize() async {
    try {
      final isAvailable = await _auth.canCheckBiometrics;
      final isDeviceSupported = await _auth.isDeviceSupported();
      final availableTypes = await _auth.getAvailableBiometrics();
      final isEnabled = await _storage.read(key: _biometricEnabledKey) == 'true';

      state = state.copyWith(
        isAvailable: isAvailable && isDeviceSupported,
        isEnabled: isEnabled,
        availableTypes: availableTypes,
      );
    } catch (e) {
      state = state.copyWith(isAvailable: false);
    }
  }

  /// Check if biometric is available on device
  bool get canUseBiometric => state.isAvailable;

  /// Check if biometric login is enabled
  bool get isBiometricEnabled => state.isEnabled;

  /// Get available biometric types as string
  String get biometricTypeLabel {
    if (state.availableTypes.contains(BiometricType.face)) {
      return 'Face ID';
    } else if (state.availableTypes.contains(BiometricType.fingerprint)) {
      return 'Fingerprint';
    } else if (state.availableTypes.contains(BiometricType.iris)) {
      return 'Iris';
    }
    return 'Biometric';
  }

  /// Enable biometric login with stored credentials
  Future<bool> enableBiometric({
    required String email,
    required String password,
  }) async {
    if (!state.isAvailable) return false;

    try {
      // Authenticate first
      final authenticated = await authenticate(
        reason: 'Authenticate to enable biometric login',
      );

      if (authenticated) {
        // Store encrypted credentials
        await _storage.write(
          key: _biometricCredentialsKey,
          value: '$email:$password',
        );
        await _storage.write(key: _biometricEnabledKey, value: 'true');
        
        state = state.copyWith(isEnabled: true);
        return true;
      }
    } catch (e) {
      // Handle error silently
    }
    return false;
  }

  /// Disable biometric login
  Future<void> disableBiometric() async {
    await _storage.delete(key: _biometricCredentialsKey);
    await _storage.delete(key: _biometricEnabledKey);
    state = state.copyWith(isEnabled: false);
  }

  /// Authenticate with biometric
  Future<bool> authenticate({String reason = 'Authenticate to continue'}) async {
    if (!state.isAvailable) return false;

    state = state.copyWith(isAuthenticating: true);

    try {
      final result = await _auth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: true,
        ),
      );
      
      state = state.copyWith(isAuthenticating: false);
      return result;
    } on PlatformException catch (e) {
      state = state.copyWith(isAuthenticating: false);
      throw BiometricException(e.message ?? 'Biometric authentication failed');
    }
  }

  /// Get stored credentials after biometric auth
  Future<Map<String, String>?> getStoredCredentials() async {
    if (!state.isEnabled) return null;

    try {
      final authenticated = await authenticate(
        reason: 'Authenticate to login',
      );

      if (authenticated) {
        final credentials = await _storage.read(key: _biometricCredentialsKey);
        if (credentials != null && credentials.contains(':')) {
          final parts = credentials.split(':');
          return {
            'email': parts[0],
            'password': parts.sublist(1).join(':'),
          };
        }
      }
    } catch (e) {
      // Authentication failed or cancelled
    }
    return null;
  }

  /// Check if credentials are stored
  Future<bool> hasStoredCredentials() async {
    final credentials = await _storage.read(key: _biometricCredentialsKey);
    return credentials != null && credentials.isNotEmpty;
  }
}

/// Custom exception for biometric errors
class BiometricException implements Exception {
  final String message;
  BiometricException(this.message);
  
  @override
  String toString() => message;
}
