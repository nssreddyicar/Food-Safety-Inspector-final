/// =============================================================================
/// FILE: android-app/lib/main.dart
/// PURPOSE: Application entry point and root configuration
/// =============================================================================
/// 
/// This file initializes the Flutter application and sets up:
/// - State management (Riverpod)
/// - Theme configuration
/// - Navigation
/// - Environment-based API configuration
/// - Crash reporting
/// - Connectivity monitoring
/// 
/// PRODUCTION APP: This is the Flutter app for Play Store deployment.
/// For development/testing on Replit, use the Expo React Native app.
/// =============================================================================

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'screens/login_screen.dart';
import 'navigation/app_navigator.dart';
import 'services/auth_service.dart';
import 'services/crash_reporter.dart';
import 'services/connectivity_service.dart';
import 'config/theme.dart';
import 'config/env.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  await Env.initialize();
  
  // Initialize crash reporter
  await crashReporter.initialize();
  
  // Run app with error capture
  runZonedGuarded(
    () => runApp(
      const ProviderScope(
        child: FoodSafetyApp(),
      ),
    ),
    (error, stack) => crashReporter.captureException(error, stackTrace: stack),
  );
}

class FoodSafetyApp extends ConsumerWidget {
  const FoodSafetyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp(
      title: 'Food Safety Inspector',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.system,
      home: const AuthWrapper(),
    );
  }
}

class AuthWrapper extends ConsumerStatefulWidget {
  const AuthWrapper({super.key});

  @override
  ConsumerState<AuthWrapper> createState() => _AuthWrapperState();
}

class _AuthWrapperState extends ConsumerState<AuthWrapper> {
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    crashReporter.addBreadcrumb(
      category: 'auth',
      message: 'Checking authentication status',
    );
    
    await ref.read(authServiceProvider.notifier).checkAuth();
    if (mounted) {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    final authState = ref.watch(authServiceProvider);
    
    if (authState.isAuthenticated) {
      // Wrap with connectivity banner for authenticated screens
      return const ConnectivityWrapper(
        child: AppNavigator(),
      );
    }
    
    return const LoginScreen();
  }
}
