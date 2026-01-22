/// =============================================================================
/// FILE: android-app/lib/screens/login_screen.dart
/// PURPOSE: Officer authentication screen
/// =============================================================================
/// 
/// Handles officer login with email and password.
/// Validates credentials against backend API.
/// 
/// RULES:
/// - No password validation logic here (backend handles it)
/// - Store tokens securely using flutter_secure_storage
/// =============================================================================

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/theme.dart';
import '../widgets/primary_button.dart';
import '../widgets/text_input.dart';
import 'dashboard_screen.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      // TODO: Call auth service
      // final authService = ref.read(authServiceProvider);
      // await authService.login(
      //   email: _emailController.text,
      //   password: _passwordController.text,
      // );

      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const DashboardScreen()),
        );
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Invalid email or password';
      });
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(Spacing.lg),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Logo and title
                  Icon(
                    Icons.verified_user,
                    size: 80,
                    color: AppColors.primary,
                  ),
                  const SizedBox(height: Spacing.md),
                  Text(
                    'Food Safety Inspector',
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: AppColors.primary,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: Spacing.xs),
                  Text(
                    'FSSAI Officer Portal',
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: AppColors.textSecondary,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: Spacing.xxl),

                  // Error message
                  if (_errorMessage != null) ...[
                    Container(
                      padding: const EdgeInsets.all(Spacing.md),
                      decoration: BoxDecoration(
                        color: AppColors.urgent.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.urgent),
                      ),
                      child: Text(
                        _errorMessage!,
                        style: TextStyle(color: AppColors.urgent),
                        textAlign: TextAlign.center,
                      ),
                    ),
                    const SizedBox(height: Spacing.md),
                  ],

                  // Email input
                  AppTextInput(
                    controller: _emailController,
                    label: 'Email',
                    hint: 'Enter your official email',
                    keyboardType: TextInputType.emailAddress,
                    prefixIcon: Icons.email_outlined,
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Email is required';
                      }
                      if (!value.contains('@')) {
                        return 'Enter a valid email';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: Spacing.md),

                  // Password input
                  AppTextInput(
                    controller: _passwordController,
                    label: 'Password',
                    hint: 'Enter your password',
                    obscureText: true,
                    prefixIcon: Icons.lock_outlined,
                    validator: (value) {
                      if (value == null || value.isEmpty) {
                        return 'Password is required';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: Spacing.lg),

                  // Login button
                  PrimaryButton(
                    onPressed: _isLoading ? null : _handleLogin,
                    isLoading: _isLoading,
                    child: const Text('Sign In'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
