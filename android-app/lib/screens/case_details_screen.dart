/// Court Case details screen.

import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../models/court_case.dart';
import '../services/api_client.dart';

class CaseDetailsScreen extends StatefulWidget {
  final String caseId;

  const CaseDetailsScreen({super.key, required this.caseId});

  @override
  State<CaseDetailsScreen> createState() => _CaseDetailsScreenState();
}

class _CaseDetailsScreenState extends State<CaseDetailsScreen> {
  final ApiClient _api = ApiClient();
  CourtCase? _courtCase;
  bool _isLoading = true;
  List<dynamic> _hearings = [];

  @override
  void initState() {
    super.initState();
    _loadCase();
  }

  Future<void> _loadCase() async {
    try {
      final response = await _api.get('/api/court-cases/${widget.caseId}');
      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        setState(() {
          _courtCase = CourtCase.fromJson(data);
          _hearings = data['hearings'] ?? [];
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load case: $e')),
        );
      }
    }
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
    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Case Details')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (_courtCase == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Case Details')),
        body: const Center(child: Text('Case not found')),
      );
    }

    final courtCase = _courtCase!;
    final statusColor = _getStatusColor(courtCase.status);

    return Scaffold(
      appBar: AppBar(
        title: Text(courtCase.caseNumber),
      ),
      body: RefreshIndicator(
        onRefresh: _loadCase,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(Spacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Status Card
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(Spacing.md),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Status', style: TextStyle(color: AppColors.textSecondary)),
                          const SizedBox(height: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: statusColor.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              courtCase.statusDisplay,
                              style: TextStyle(color: statusColor, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
                      ),
                      if (courtCase.nextHearingDate != null)
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text('Next Hearing', style: TextStyle(color: AppColors.textSecondary)),
                            const SizedBox(height: 4),
                            Text(
                              _formatDate(courtCase.nextHearingDate!),
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: _isUpcoming(courtCase.nextHearingDate!) ? AppColors.urgent : null,
                              ),
                            ),
                          ],
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: Spacing.md),

              // FBO Details
              _buildSection('FBO Details', [
                _buildInfoRow('Name', courtCase.fboName ?? 'N/A'),
                _buildInfoRow('Address', courtCase.fboAddress ?? 'N/A'),
              ]),
              const SizedBox(height: Spacing.md),

              // Case Details
              _buildSection('Case Details', [
                _buildInfoRow('Court', courtCase.courtName ?? 'N/A'),
                _buildInfoRow('Charge Section', courtCase.chargeSection ?? 'N/A'),
                if (courtCase.filingDate != null)
                  _buildInfoRow('Filing Date', _formatDate(courtCase.filingDate!)),
                if (courtCase.description != null)
                  Padding(
                    padding: const EdgeInsets.only(top: Spacing.sm),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Description', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                        const SizedBox(height: 4),
                        Text(courtCase.description!),
                      ],
                    ),
                  ),
              ]),
              const SizedBox(height: Spacing.md),

              // Hearing History
              if (_hearings.isNotEmpty)
                _buildSection('Hearing History', [
                  ..._hearings.map((h) => Container(
                    margin: const EdgeInsets.only(bottom: Spacing.sm),
                    padding: const EdgeInsets.all(Spacing.sm),
                    decoration: BoxDecoration(
                      color: AppColors.background,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              _formatDate(DateTime.parse(h['date'])),
                              style: const TextStyle(fontWeight: FontWeight.bold),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppColors.primary.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                h['type'] ?? 'Hearing',
                                style: TextStyle(color: AppColors.primary, fontSize: 12),
                              ),
                            ),
                          ],
                        ),
                        if (h['notes'] != null) ...[
                          const SizedBox(height: 4),
                          Text(h['notes'], style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                        ],
                      ],
                    ),
                  )),
                ]),

              // Outcome
              if (courtCase.outcome != null)
                _buildSection('Outcome', [
                  Text(courtCase.outcome!),
                ]),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSection(String title, List<Widget> children) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(Spacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: Spacing.sm),
            ...children,
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(label, style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
          ),
          Expanded(child: Text(value, style: const TextStyle(fontSize: 14))),
        ],
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.day}/${date.month}/${date.year}';
  }

  bool _isUpcoming(DateTime date) {
    final now = DateTime.now();
    final diff = date.difference(now).inDays;
    return diff >= 0 && diff <= 7;
  }
}
