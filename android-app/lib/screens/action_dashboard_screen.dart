/// Action Dashboard - Urgent actions and follow-ups.

import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../services/api_client.dart';

class ActionDashboardScreen extends StatefulWidget {
  const ActionDashboardScreen({super.key});

  @override
  State<ActionDashboardScreen> createState() => _ActionDashboardScreenState();
}

class _ActionDashboardScreenState extends State<ActionDashboardScreen> {
  final ApiClient _api = ApiClient();
  bool _isLoading = true;
  List<dynamic> _categories = [];
  List<dynamic> _upcomingHearings = [];

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    try {
      final response = await _api.get('/api/action-dashboard');
      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        setState(() {
          _categories = data['categories'] ?? [];
          _isLoading = false;
        });
      }
      
      // Load upcoming hearings
      final hearingsResponse = await _api.get('/api/upcoming-hearings');
      if (hearingsResponse.statusCode == 200) {
        setState(() {
          _upcomingHearings = hearingsResponse.data as List<dynamic>;
        });
      }
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  Color _getPriorityColor(String priority) {
    switch (priority.toLowerCase()) {
      case 'critical': return AppColors.urgent;
      case 'high': return Colors.orange;
      case 'medium': return AppColors.warning;
      case 'low': return AppColors.success;
      default: return AppColors.textSecondary;
    }
  }

  IconData _getCategoryIcon(String categoryName) {
    final name = categoryName.toLowerCase();
    if (name.contains('sample')) return Icons.science;
    if (name.contains('hearing') || name.contains('court')) return Icons.gavel;
    if (name.contains('inspection')) return Icons.assignment;
    if (name.contains('complaint')) return Icons.report_problem;
    if (name.contains('license')) return Icons.verified;
    return Icons.task;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Action Dashboard'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadData,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(Spacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Urgent Actions Summary
                    Card(
                      color: AppColors.urgent,
                      child: Padding(
                        padding: const EdgeInsets.all(Spacing.md),
                        child: Row(
                          children: [
                            const Icon(Icons.warning_amber, color: Colors.white, size: 32),
                            const SizedBox(width: Spacing.md),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'Urgent Actions',
                                    style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                                  ),
                                  Text(
                                    '${_getTotalUrgentCount()} items require immediate attention',
                                    style: const TextStyle(color: Colors.white70),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: Spacing.lg),

                    // Upcoming Hearings
                    if (_upcomingHearings.isNotEmpty) ...[
                      const Text(
                        'Upcoming Court Hearings',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: Spacing.sm),
                      ..._upcomingHearings.take(3).map((h) => Card(
                        margin: const EdgeInsets.only(bottom: Spacing.sm),
                        child: ListTile(
                          leading: Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: AppColors.warning.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Icon(Icons.gavel, color: AppColors.warning),
                          ),
                          title: Text(h['caseNumber'] ?? 'Case'),
                          subtitle: Text(h['courtName'] ?? 'Court'),
                          trailing: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                _formatDate(DateTime.parse(h['hearingDate'])),
                                style: const TextStyle(fontWeight: FontWeight.bold),
                              ),
                              Text(
                                _getDaysUntil(DateTime.parse(h['hearingDate'])),
                                style: TextStyle(
                                  color: _isUrgent(DateTime.parse(h['hearingDate'])) 
                                      ? AppColors.urgent 
                                      : AppColors.textSecondary,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                      )),
                      const SizedBox(height: Spacing.lg),
                    ],

                    // Action Categories
                    const Text(
                      'Action Items by Category',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: Spacing.sm),

                    ..._categories.map((category) {
                      final items = category['items'] as List<dynamic>? ?? [];
                      if (items.isEmpty) return const SizedBox.shrink();
                      
                      return Card(
                        margin: const EdgeInsets.only(bottom: Spacing.sm),
                        child: ExpansionTile(
                          leading: Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Icon(
                              _getCategoryIcon(category['name'] ?? ''),
                              color: AppColors.primary,
                            ),
                          ),
                          title: Text(category['name'] ?? 'Category'),
                          trailing: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.urgent.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              '${items.length}',
                              style: TextStyle(
                                color: AppColors.urgent,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          children: items.map<Widget>((item) => Container(
                            padding: const EdgeInsets.symmetric(horizontal: Spacing.md, vertical: Spacing.sm),
                            decoration: BoxDecoration(
                              border: Border(top: BorderSide(color: AppColors.border)),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 8,
                                  height: 8,
                                  decoration: BoxDecoration(
                                    color: _getPriorityColor(item['priority'] ?? 'medium'),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                ),
                                const SizedBox(width: Spacing.sm),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        item['title'] ?? 'Action Item',
                                        style: const TextStyle(fontWeight: FontWeight.w500),
                                      ),
                                      if (item['description'] != null)
                                        Text(
                                          item['description'],
                                          style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                    ],
                                  ),
                                ),
                                if (item['dueDate'] != null)
                                  Text(
                                    _formatDate(DateTime.parse(item['dueDate'])),
                                    style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                                  ),
                              ],
                            ),
                          )).toList(),
                        ),
                      );
                    }),
                  ],
                ),
              ),
            ),
    );
  }

  int _getTotalUrgentCount() {
    int count = 0;
    for (var category in _categories) {
      final items = category['items'] as List<dynamic>? ?? [];
      count += items.where((i) => 
        i['priority'] == 'critical' || i['priority'] == 'high'
      ).length;
    }
    return count;
  }

  String _formatDate(DateTime date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${date.day} ${months[date.month - 1]}';
  }

  String _getDaysUntil(DateTime date) {
    final days = date.difference(DateTime.now()).inDays;
    if (days == 0) return 'Today';
    if (days == 1) return 'Tomorrow';
    if (days < 0) return '${-days} days ago';
    return 'In $days days';
  }

  bool _isUrgent(DateTime date) {
    return date.difference(DateTime.now()).inDays <= 3;
  }
}
