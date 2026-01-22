/// FBO Inspection details screen.

import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../models/inspection.dart';
import '../services/api_client.dart';

class InspectionDetailsScreen extends StatefulWidget {
  final String inspectionId;

  const InspectionDetailsScreen({super.key, required this.inspectionId});

  @override
  State<InspectionDetailsScreen> createState() => _InspectionDetailsScreenState();
}

class _InspectionDetailsScreenState extends State<InspectionDetailsScreen> {
  final ApiClient _api = ApiClient();
  Inspection? _inspection;
  bool _isLoading = true;
  List<dynamic> _deviations = [];
  List<dynamic> _samples = [];

  @override
  void initState() {
    super.initState();
    _loadInspection();
  }

  Future<void> _loadInspection() async {
    try {
      final response = await _api.get('/api/inspections/${widget.inspectionId}');
      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        setState(() {
          _inspection = Inspection.fromJson(data);
          _deviations = data['deviations'] ?? [];
          _samples = data['samples'] ?? [];
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load inspection: $e')),
        );
      }
    }
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'scheduled': return AppColors.warning;
      case 'in_progress': return AppColors.primaryLight;
      case 'completed': return AppColors.success;
      case 'closed': return AppColors.textSecondary;
      default: return AppColors.textSecondary;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Inspection Details')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (_inspection == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Inspection Details')),
        body: const Center(child: Text('Inspection not found')),
      );
    }

    final inspection = _inspection!;
    final statusColor = _getStatusColor(inspection.status);

    return Scaffold(
      appBar: AppBar(
        title: Text(inspection.inspectionCode),
        actions: [
          if (!inspection.isClosed)
            PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert),
              onSelected: (value) {
                // Handle actions
              },
              itemBuilder: (context) => [
                const PopupMenuItem(value: 'complete', child: Text('Mark Complete')),
                const PopupMenuItem(value: 'close', child: Text('Close Inspection')),
              ],
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadInspection,
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
                              inspection.statusDisplay,
                              style: TextStyle(color: statusColor, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text('Type', style: TextStyle(color: AppColors.textSecondary)),
                          const SizedBox(height: 4),
                          Text(
                            inspection.type ?? 'Routine',
                            style: const TextStyle(fontWeight: FontWeight.w500),
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
                _buildInfoRow('Name', inspection.fboName ?? 'N/A'),
                _buildInfoRow('License No', inspection.fboLicense ?? 'N/A'),
                _buildInfoRow('Address', inspection.fboAddress ?? 'N/A'),
              ]),
              const SizedBox(height: Spacing.md),

              // Inspection Details
              _buildSection('Inspection Details', [
                _buildInfoRow('Date', _formatDate(inspection.inspectionDate)),
                _buildInfoRow('Officer', inspection.officerName ?? 'N/A'),
                if (inspection.findings != null)
                  Padding(
                    padding: const EdgeInsets.only(top: Spacing.sm),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Findings', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                        const SizedBox(height: 4),
                        Text(inspection.findings!),
                      ],
                    ),
                  ),
              ]),
              const SizedBox(height: Spacing.md),

              // Deviations
              if (_deviations.isNotEmpty)
                _buildSection('Deviations (${_deviations.length})', [
                  ..._deviations.map((d) => Container(
                    margin: const EdgeInsets.only(bottom: Spacing.sm),
                    padding: const EdgeInsets.all(Spacing.sm),
                    decoration: BoxDecoration(
                      color: AppColors.urgent.withOpacity(0.05),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.urgent.withOpacity(0.2)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppColors.urgent.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                d['severity']?.toUpperCase() ?? 'DEVIATION',
                                style: TextStyle(color: AppColors.urgent, fontSize: 10, fontWeight: FontWeight.bold),
                              ),
                            ),
                            const SizedBox(width: Spacing.sm),
                            Expanded(
                              child: Text(
                                d['category'] ?? 'Unknown',
                                style: const TextStyle(fontWeight: FontWeight.w500),
                              ),
                            ),
                          ],
                        ),
                        if (d['description'] != null) ...[
                          const SizedBox(height: 4),
                          Text(d['description'], style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                        ],
                      ],
                    ),
                  )),
                ]),

              // Samples
              if (_samples.isNotEmpty)
                _buildSection('Samples Collected (${_samples.length})', [
                  ..._samples.map((s) => Container(
                    margin: const EdgeInsets.only(bottom: Spacing.sm),
                    padding: const EdgeInsets.all(Spacing.sm),
                    decoration: BoxDecoration(
                      color: AppColors.background,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.science, color: AppColors.primary, size: 20),
                        const SizedBox(width: Spacing.sm),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(s['sampleCode'] ?? 'Sample', style: const TextStyle(fontWeight: FontWeight.w500)),
                              Text(s['productName'] ?? 'Unknown', style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            s['status']?.toUpperCase() ?? 'PENDING',
                            style: TextStyle(color: AppColors.primary, fontSize: 10, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ),
                  )),
                ]),

              // Actions Taken
              if (inspection.actionsTaken != null)
                _buildSection('Actions Taken', [
                  Text(inspection.actionsTaken!),
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
}
