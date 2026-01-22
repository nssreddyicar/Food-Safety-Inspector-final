/// =============================================================================
/// FILE: android-app/lib/screens/court_cases_screen.dart
/// PURPOSE: Court Cases list and management screen
/// =============================================================================

import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../models/court_case.dart';
import '../services/api_client.dart';
import 'case_details_screen.dart';
import 'new_case_screen.dart';

class CourtCasesScreen extends StatefulWidget {
  const CourtCasesScreen({super.key});

  @override
  State<CourtCasesScreen> createState() => _CourtCasesScreenState();
}

class _CourtCasesScreenState extends State<CourtCasesScreen> {
  final ApiClient _api = ApiClient();
  List<CourtCase> _cases = [];
  bool _isLoading = true;
  String _statusFilter = 'all';

  @override
  void initState() {
    super.initState();
    _loadCases();
  }

  Future<void> _loadCases() async {
    try {
      final response = await _api.get('/api/court-cases');
      if (response.statusCode == 200) {
        final list = response.data as List<dynamic>;
        setState(() {
          _cases = list.map((c) => CourtCase.fromJson(c)).toList();
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  List<CourtCase> get _filteredCases {
    if (_statusFilter == 'all') return _cases;
    return _cases.where((c) => c.status == _statusFilter).toList();
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'pending': return AppColors.warning;
      case 'filed': return AppColors.primary;
      case 'hearing': return AppColors.primaryLight;
      case 'judgment': return AppColors.success;
      case 'closed': return AppColors.textSecondary;
      case 'appealed': return AppColors.urgent;
      default: return AppColors.textSecondary;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Court Cases'),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.filter_list),
            onSelected: (value) => setState(() => _statusFilter = value),
            itemBuilder: (context) => [
              const PopupMenuItem(value: 'all', child: Text('All Cases')),
              const PopupMenuItem(value: 'pending', child: Text('Pending')),
              const PopupMenuItem(value: 'filed', child: Text('Filed')),
              const PopupMenuItem(value: 'hearing', child: Text('In Hearing')),
              const PopupMenuItem(value: 'judgment', child: Text('Judgment')),
              const PopupMenuItem(value: 'closed', child: Text('Closed')),
            ],
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _filteredCases.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.gavel_outlined, size: 64, color: AppColors.textSecondary),
                      const SizedBox(height: Spacing.md),
                      Text('No court cases found', style: TextStyle(color: AppColors.textSecondary)),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadCases,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(Spacing.md),
                    itemCount: _filteredCases.length,
                    itemBuilder: (context, index) {
                      final courtCase = _filteredCases[index];
                      return _CaseCard(
                        courtCase: courtCase,
                        statusColor: _getStatusColor(courtCase.status),
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => CaseDetailsScreen(caseId: courtCase.id),
                            ),
                          ).then((_) => _loadCases());
                        },
                      );
                    },
                  ),
                ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const NewCaseScreen()),
          ).then((_) => _loadCases());
        },
        icon: const Icon(Icons.add),
        label: const Text('New Case'),
        backgroundColor: AppColors.primary,
      ),
    );
  }
}

class _CaseCard extends StatelessWidget {
  final CourtCase courtCase;
  final Color statusColor;
  final VoidCallback onTap;

  const _CaseCard({
    required this.courtCase,
    required this.statusColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final hasUpcomingHearing = courtCase.nextHearingDate != null &&
        courtCase.nextHearingDate!.difference(DateTime.now()).inDays <= 7 &&
        courtCase.nextHearingDate!.isAfter(DateTime.now());

    return Card(
      margin: const EdgeInsets.only(bottom: Spacing.md),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(Spacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.gavel, color: AppColors.primary),
                  const SizedBox(width: Spacing.sm),
                  Expanded(
                    child: Text(
                      courtCase.caseNumber,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: Spacing.sm, vertical: Spacing.xs),
                    decoration: BoxDecoration(
                      color: statusColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      courtCase.statusDisplay,
                      style: TextStyle(color: statusColor, fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: Spacing.sm),
              if (courtCase.fboName != null)
                Text(courtCase.fboName!, style: TextStyle(color: AppColors.textSecondary)),
              if (courtCase.nextHearingDate != null) ...[
                const SizedBox(height: Spacing.sm),
                Container(
                  padding: const EdgeInsets.all(Spacing.sm),
                  decoration: BoxDecoration(
                    color: hasUpcomingHearing ? AppColors.urgent.withOpacity(0.1) : AppColors.background,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.event,
                        size: 16,
                        color: hasUpcomingHearing ? AppColors.urgent : AppColors.textSecondary,
                      ),
                      const SizedBox(width: Spacing.sm),
                      Expanded(
                        child: Text(
                          'Next: ${_formatDate(courtCase.nextHearingDate!)}',
                          style: TextStyle(
                            color: hasUpcomingHearing ? AppColors.urgent : AppColors.textSecondary,
                            fontWeight: hasUpcomingHearing ? FontWeight.w600 : FontWeight.normal,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.day}/${date.month}/${date.year}';
  }
}
