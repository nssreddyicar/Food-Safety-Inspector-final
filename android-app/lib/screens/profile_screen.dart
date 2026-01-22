/// =============================================================================
/// FILE: android-app/lib/screens/profile_screen.dart
/// PURPOSE: Officer profile and settings screen
/// =============================================================================

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/theme.dart';
import '../services/auth_service.dart';
import 'login_screen.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authServiceProvider);
    
    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(Spacing.md),
        child: Column(
          children: [
            // Profile header
            Container(
              padding: const EdgeInsets.all(Spacing.lg),
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 50,
                    backgroundColor: AppColors.primary,
                    child: Text(
                      authState.officer?.name.substring(0, 1).toUpperCase() ?? 'O',
                      style: const TextStyle(
                        fontSize: 40,
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  const SizedBox(height: Spacing.md),
                  Text(
                    authState.officer?.name ?? 'Officer Name',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: Spacing.xs),
                  Text(
                    authState.officer?.designation ?? 'Food Safety Officer',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: Spacing.xs),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: Spacing.md,
                      vertical: Spacing.xs,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      authState.officer?.role.toUpperCase() ?? 'FSO',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: Spacing.lg),

            // Info cards
            _InfoCard(
              icon: Icons.email_outlined,
              label: 'Email',
              value: authState.officer?.email ?? 'officer@fssai.gov.in',
            ),
            _InfoCard(
              icon: Icons.phone_outlined,
              label: 'Phone',
              value: authState.officer?.phone ?? 'Not set',
            ),
            _InfoCard(
              icon: Icons.location_city_outlined,
              label: 'Primary Jurisdiction',
              value: authState.officer?.primaryJurisdiction?.jurisdictionName ?? 'Not assigned',
            ),

            const SizedBox(height: Spacing.lg),
            const Divider(),
            const SizedBox(height: Spacing.lg),

            // Settings options
            _SettingsItem(
              icon: Icons.notifications_outlined,
              label: 'Notifications',
              onTap: () {
                // TODO: Navigate to notification settings
              },
            ),
            _SettingsItem(
              icon: Icons.security_outlined,
              label: 'Change Password',
              onTap: () {
                // TODO: Navigate to change password
              },
            ),
            _SettingsItem(
              icon: Icons.help_outline,
              label: 'Help & Support',
              onTap: () {
                // TODO: Navigate to help
              },
            ),
            _SettingsItem(
              icon: Icons.info_outline,
              label: 'About',
              onTap: () {
                // TODO: Show about dialog
              },
            ),

            const SizedBox(height: Spacing.xl),

            // Logout button
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () async {
                  final confirmed = await showDialog<bool>(
                    context: context,
                    builder: (context) => AlertDialog(
                      title: const Text('Logout'),
                      content: const Text('Are you sure you want to logout?'),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(context, false),
                          child: const Text('Cancel'),
                        ),
                        TextButton(
                          onPressed: () => Navigator.pop(context, true),
                          child: const Text('Logout'),
                        ),
                      ],
                    ),
                  );
                  
                  if (confirmed == true) {
                    await ref.read(authServiceProvider.notifier).logout();
                    if (context.mounted) {
                      Navigator.of(context).pushAndRemoveUntil(
                        MaterialPageRoute(builder: (_) => const LoginScreen()),
                        (route) => false,
                      );
                    }
                  }
                },
                icon: const Icon(Icons.logout, color: AppColors.urgent),
                label: const Text(
                  'Logout',
                  style: TextStyle(color: AppColors.urgent),
                ),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: AppColors.urgent),
                  padding: const EdgeInsets.all(Spacing.md),
                ),
              ),
            ),

            const SizedBox(height: Spacing.lg),
            Text(
              'Version 1.0.0',
              style: TextStyle(
                color: AppColors.textSecondary,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;

  const _InfoCard({
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: Spacing.sm),
      child: Padding(
        padding: const EdgeInsets.all(Spacing.md),
        child: Row(
          children: [
            Icon(icon, color: AppColors.primary),
            const SizedBox(width: Spacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: Spacing.xs),
                  Text(
                    value,
                    style: const TextStyle(
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SettingsItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _SettingsItem({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: AppColors.primary),
      title: Text(label),
      trailing: const Icon(Icons.chevron_right),
      onTap: onTap,
    );
  }
}
