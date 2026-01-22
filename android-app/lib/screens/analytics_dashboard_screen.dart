/// =============================================================================
/// FILE: android-app/lib/screens/analytics_dashboard_screen.dart
/// PURPOSE: Advanced analytics dashboard with charts and metrics
/// =============================================================================

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/network_service.dart';

class AnalyticsDashboardScreen extends ConsumerStatefulWidget {
  const AnalyticsDashboardScreen({super.key});

  @override
  ConsumerState<AnalyticsDashboardScreen> createState() => _AnalyticsDashboardScreenState();
}

class _AnalyticsDashboardScreenState extends ConsumerState<AnalyticsDashboardScreen> {
  bool _isLoading = true;
  Map<String, dynamic>? _metrics;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadAnalytics();
  }

  Future<void> _loadAnalytics() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final response = await NetworkService().get<Map<String, dynamic>>(
        '/api/analytics/dashboard',
      );
      
      if (response.statusCode == 200 && response.data != null) {
        setState(() {
          _metrics = response.data;
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Failed to load analytics';
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Analytics Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadAnalytics,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!, style: TextStyle(color: theme.colorScheme.error)))
              : RefreshIndicator(
                  onRefresh: _loadAnalytics,
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildSummarySection(theme),
                        const SizedBox(height: 24),
                        _buildTrendsSection(theme),
                        const SizedBox(height: 24),
                        _buildQuickActionsSection(theme),
                        const SizedBox(height: 24),
                        _buildRecentActivitySection(theme),
                      ],
                    ),
                  ),
                ),
    );
  }

  Widget _buildSummarySection(ThemeData theme) {
    final summary = _metrics?['summary'] ?? {};
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Summary',
          style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 16),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 1.5,
          children: [
            _buildMetricCard(
              'Inspections',
              '${summary['totalInspections'] ?? 0}',
              Icons.assignment,
              Colors.blue,
            ),
            _buildMetricCard(
              'Samples',
              '${summary['totalSamples'] ?? 0}',
              Icons.science,
              Colors.green,
            ),
            _buildMetricCard(
              'Complaints',
              '${summary['totalComplaints'] ?? 0}',
              Icons.report_problem,
              Colors.orange,
            ),
            _buildMetricCard(
              'Court Cases',
              '${summary['totalCourtCases'] ?? 0}',
              Icons.gavel,
              Colors.red,
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildMetricCard(String title, String value, IconData icon, Color color) {
    return Card(
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 32, color: color),
            const SizedBox(height: 8),
            Text(
              value,
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
            Text(
              title,
              style: const TextStyle(
                fontSize: 12,
                color: Colors.grey,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTrendsSection(ThemeData theme) {
    final trends = _metrics?['trends'] ?? {};
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Trends (Last 30 Days)',
          style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                _buildTrendRow('Inspections', trends['inspectionsTrend'] ?? 0),
                const Divider(),
                _buildTrendRow('Samples', trends['samplesTrend'] ?? 0),
                const Divider(),
                _buildTrendRow('Complaints', trends['complaintsTrend'] ?? 0),
                const Divider(),
                _buildTrendRow('Resolution Rate', trends['resolutionRate'] ?? 0, isPercentage: true),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTrendRow(String label, num value, {bool isPercentage = false}) {
    final isPositive = value >= 0;
    final color = isPercentage 
        ? (value >= 80 ? Colors.green : value >= 50 ? Colors.orange : Colors.red)
        : (isPositive ? Colors.green : Colors.red);
    
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label),
          Row(
            children: [
              if (!isPercentage)
                Icon(
                  isPositive ? Icons.trending_up : Icons.trending_down,
                  color: color,
                  size: 20,
                ),
              const SizedBox(width: 4),
              Text(
                isPercentage 
                    ? '${value.toStringAsFixed(1)}%'
                    : '${isPositive ? '+' : ''}${value.toStringAsFixed(1)}%',
                style: TextStyle(
                  color: color,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActionsSection(ThemeData theme) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Quick Actions',
          style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 16),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            _buildQuickActionChip('Export Inspections', Icons.download, () => _exportData('inspections')),
            _buildQuickActionChip('Export Samples', Icons.download, () => _exportData('samples')),
            _buildQuickActionChip('Export Complaints', Icons.download, () => _exportData('complaints')),
            _buildQuickActionChip('Full Report', Icons.assessment, () => _exportData('full')),
          ],
        ),
      ],
    );
  }

  Widget _buildQuickActionChip(String label, IconData icon, VoidCallback onTap) {
    return ActionChip(
      avatar: Icon(icon, size: 18),
      label: Text(label),
      onPressed: onTap,
    );
  }

  Future<void> _exportData(String type) async {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Exporting $type data...')),
    );
    
    try {
      final response = await NetworkService().get<Map<String, dynamic>>(
        '/api/export/$type?format=csv',
      );
      
      if (response.statusCode == 200) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Export completed successfully')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Export failed: $e')),
      );
    }
  }

  Widget _buildRecentActivitySection(ThemeData theme) {
    final activity = _metrics?['recentActivity'] as List<dynamic>? ?? [];
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Recent Activity',
          style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 16),
        Card(
          child: ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: activity.length.clamp(0, 5),
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (context, index) {
              final item = activity[index] as Map<String, dynamic>;
              return ListTile(
                leading: _getActivityIcon(item['type'] ?? ''),
                title: Text(item['description'] ?? ''),
                subtitle: Text(
                  _formatTimestamp(item['timestamp'] ?? ''),
                  style: const TextStyle(fontSize: 12),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _getActivityIcon(String type) {
    IconData icon;
    Color color;
    
    switch (type.toLowerCase()) {
      case 'inspections':
        icon = Icons.assignment;
        color = Colors.blue;
        break;
      case 'samples':
        icon = Icons.science;
        color = Colors.green;
        break;
      case 'complaints':
        icon = Icons.report_problem;
        color = Colors.orange;
        break;
      case 'court_cases':
        icon = Icons.gavel;
        color = Colors.red;
        break;
      default:
        icon = Icons.info;
        color = Colors.grey;
    }
    
    return CircleAvatar(
      backgroundColor: color.withOpacity(0.1),
      child: Icon(icon, color: color, size: 20),
    );
  }

  String _formatTimestamp(String timestamp) {
    try {
      final date = DateTime.parse(timestamp);
      final now = DateTime.now();
      final diff = now.difference(date);
      
      if (diff.inMinutes < 60) {
        return '${diff.inMinutes}m ago';
      } else if (diff.inHours < 24) {
        return '${diff.inHours}h ago';
      } else {
        return '${diff.inDays}d ago';
      }
    } catch (e) {
      return timestamp;
    }
  }
}
