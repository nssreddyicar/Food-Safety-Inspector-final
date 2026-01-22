/// =============================================================================
/// FILE: android-app/lib/widgets/urgent_action_card.dart
/// PURPOSE: Card for displaying urgent actions
/// =============================================================================

import 'package:flutter/material.dart';
import '../config/theme.dart';

enum UrgencyLevel { critical, high, medium, low }

class UrgentActionCard extends StatelessWidget {
  final String title;
  final String description;
  final IconData icon;
  final UrgencyLevel urgencyLevel;
  final VoidCallback? onTap;

  const UrgentActionCard({
    super.key,
    required this.title,
    required this.description,
    required this.icon,
    required this.urgencyLevel,
    this.onTap,
  });

  Color get _urgencyColor {
    switch (urgencyLevel) {
      case UrgencyLevel.critical:
        return AppColors.urgent;
      case UrgencyLevel.high:
        return Colors.orange;
      case UrgencyLevel.medium:
        return AppColors.warning;
      case UrgencyLevel.low:
        return AppColors.primary;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(Spacing.md),
          child: Row(
            children: [
              Container(
                width: 4,
                height: 50,
                decoration: BoxDecoration(
                  color: _urgencyColor,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: Spacing.md),
              Container(
                padding: const EdgeInsets.all(Spacing.sm),
                decoration: BoxDecoration(
                  color: _urgencyColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: _urgencyColor),
              ),
              const SizedBox(width: Spacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: Spacing.xs),
                    Text(
                      description,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right,
                color: AppColors.textSecondary,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
