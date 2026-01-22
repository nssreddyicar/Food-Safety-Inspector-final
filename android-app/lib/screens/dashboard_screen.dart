/// =============================================================================
/// FILE: android-app/lib/screens/dashboard_screen.dart
/// PURPOSE: Main dashboard for Food Safety Officers
/// =============================================================================

import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../services/api_client.dart';
import '../widgets/stat_card.dart';
import '../widgets/urgent_action_card.dart';
import 'profile_screen.dart';
import 'action_dashboard_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final ApiClient _api = ApiClient();
  bool _isLoading = true;
  
  Map<String, dynamic> _stats = {
    'pendingInspections': 0,
    'samplesInLab': 0,
    'courtCases': 0,
    'completedToday': 0,
    'pendingComplaints': 0,
    'institutionalInspections': 0,
  };
  List<dynamic> _urgentActions = [];

  @override
  void initState() {
    super.initState();
    _loadDashboard();
  }

  Future<void> _loadDashboard() async {
    try {
      final response = await _api.get('/api/dashboard');
      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        setState(() {
          _stats = data['stats'] ?? _stats;
          _urgentActions = data['urgentActions'] ?? [];
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  String _getGreeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const ActionDashboardScreen()),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.person_outline),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const ProfileScreen()),
              );
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadDashboard,
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(Spacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Greeting
                    Text(
                      '${_getGreeting()}, Officer',
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: Spacing.xs),
                    Text(
                      'Here\'s your daily overview',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: Spacing.lg),

                    // Stats grid
                    GridView.count(
                      crossAxisCount: 2,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      mainAxisSpacing: Spacing.md,
                      crossAxisSpacing: Spacing.md,
                      childAspectRatio: 1.5,
                      children: [
                        StatCard(
                          title: 'FBO Inspections',
                          value: '${_stats['pendingInspections'] ?? 0}',
                          icon: Icons.assignment_outlined,
                          color: AppColors.primary,
                        ),
                        StatCard(
                          title: 'Samples in Lab',
                          value: '${_stats['samplesInLab'] ?? 0}',
                          icon: Icons.science_outlined,
                          color: AppColors.warning,
                        ),
                        StatCard(
                          title: 'Complaints',
                          value: '${_stats['pendingComplaints'] ?? 0}',
                          icon: Icons.report_problem_outlined,
                          color: AppColors.urgent,
                        ),
                        StatCard(
                          title: 'Institutional',
                          value: '${_stats['institutionalInspections'] ?? 0}',
                          icon: Icons.business_outlined,
                          color: AppColors.success,
                        ),
                      ],
                    ),
                    const SizedBox(height: Spacing.lg),

                    // Urgent actions
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Urgent Actions',
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        TextButton(
                          onPressed: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(builder: (_) => const ActionDashboardScreen()),
                            );
                          },
                          child: const Text('View All'),
                        ),
                      ],
                    ),
                    const SizedBox(height: Spacing.sm),
                    
                    if (_urgentActions.isEmpty)
                      Container(
                        padding: const EdgeInsets.all(Spacing.lg),
                        decoration: BoxDecoration(
                          color: AppColors.success.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.check_circle, color: AppColors.success),
                            const SizedBox(width: Spacing.md),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text('All caught up!', style: TextStyle(fontWeight: FontWeight.bold)),
                                  Text(
                                    'No urgent actions at the moment',
                                    style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      )
                    else
                      ..._urgentActions.take(5).map((action) => Padding(
                        padding: const EdgeInsets.only(bottom: Spacing.sm),
                        child: UrgentActionCard(
                          title: action['title'] ?? 'Action Required',
                          description: action['description'] ?? '',
                          icon: _getActionIcon(action['type']),
                          urgencyLevel: _getUrgencyLevel(action['priority']),
                        ),
                      )),
                    const SizedBox(height: Spacing.lg),

                    // Quick Actions
                    Text(
                      'Quick Actions',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: Spacing.md),
                    Row(
                      children: [
                        Expanded(
                          child: _QuickActionButton(
                            icon: Icons.add_task,
                            label: 'New FBO\nInspection',
                            color: AppColors.primary,
                            onTap: () {},
                          ),
                        ),
                        const SizedBox(width: Spacing.md),
                        Expanded(
                          child: _QuickActionButton(
                            icon: Icons.business,
                            label: 'Institutional\nAssessment',
                            color: AppColors.success,
                            onTap: () {},
                          ),
                        ),
                        const SizedBox(width: Spacing.md),
                        Expanded(
                          child: _QuickActionButton(
                            icon: Icons.qr_code_scanner,
                            label: 'Scan\nQR Code',
                            color: AppColors.warning,
                            onTap: () {},
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
      ),
    );
  }

  IconData _getActionIcon(String? type) {
    switch (type) {
      case 'sample': return Icons.science;
      case 'hearing': return Icons.gavel;
      case 'inspection': return Icons.assignment_late_outlined;
      case 'complaint': return Icons.report_problem;
      default: return Icons.warning_amber_rounded;
    }
  }

  UrgencyLevel _getUrgencyLevel(String? priority) {
    switch (priority) {
      case 'critical': return UrgencyLevel.critical;
      case 'high': return UrgencyLevel.high;
      case 'medium': return UrgencyLevel.medium;
      default: return UrgencyLevel.low;
    }
  }
}

class _QuickActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _QuickActionButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: Spacing.md),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.3)),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 28),
            const SizedBox(height: Spacing.xs),
            Text(
              label,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: color,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
