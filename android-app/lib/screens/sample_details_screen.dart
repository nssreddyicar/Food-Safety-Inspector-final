/// Sample details screen with full chain-of-custody tracking.

import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../models/sample.dart';
import '../services/api_client.dart';

class SampleDetailsScreen extends StatefulWidget {
  final String sampleId;

  const SampleDetailsScreen({super.key, required this.sampleId});

  @override
  State<SampleDetailsScreen> createState() => _SampleDetailsScreenState();
}

class _SampleDetailsScreenState extends State<SampleDetailsScreen> {
  final ApiClient _api = ApiClient();
  Sample? _sample;
  bool _isLoading = true;
  List<dynamic> _timeline = [];

  @override
  void initState() {
    super.initState();
    _loadSample();
  }

  Future<void> _loadSample() async {
    try {
      final response = await _api.get('/api/samples/${widget.sampleId}');
      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        setState(() {
          _sample = Sample.fromJson(data);
          _timeline = data['timeline'] ?? [];
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load sample: $e')),
        );
      }
    }
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'collected': return AppColors.warning;
      case 'dispatched': return AppColors.primary;
      case 'received': return AppColors.primaryLight;
      case 'testing': return AppColors.warning;
      case 'result_received': return AppColors.success;
      case 'closed': return AppColors.textSecondary;
      default: return AppColors.textSecondary;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Sample Details')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (_sample == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Sample Details')),
        body: const Center(child: Text('Sample not found')),
      );
    }

    final sample = _sample!;
    final statusColor = _getStatusColor(sample.status);
    final daysRemaining = sample.deadlineDate?.difference(DateTime.now()).inDays;

    return Scaffold(
      appBar: AppBar(
        title: Text(sample.sampleCode),
        actions: [
          if (!sample.isDispatched)
            IconButton(
              icon: const Icon(Icons.edit),
              onPressed: () {
                // Edit sample
              },
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadSample,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(Spacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Status & Deadline Card
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(Spacing.md),
                  child: Column(
                    children: [
                      Row(
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
                                  sample.statusDisplay,
                                  style: TextStyle(color: statusColor, fontWeight: FontWeight.bold),
                                ),
                              ),
                            ],
                          ),
                          if (daysRemaining != null)
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text('Deadline', style: TextStyle(color: AppColors.textSecondary)),
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    Icon(
                                      Icons.schedule,
                                      size: 16,
                                      color: daysRemaining <= 3 ? AppColors.urgent : AppColors.textSecondary,
                                    ),
                                    const SizedBox(width: 4),
                                    Text(
                                      daysRemaining <= 0 ? 'Overdue' : '$daysRemaining days',
                                      style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        color: daysRemaining <= 3 ? AppColors.urgent : null,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                        ],
                      ),
                      if (sample.isDispatched) ...[
                        const SizedBox(height: Spacing.sm),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(Spacing.sm),
                          decoration: BoxDecoration(
                            color: AppColors.warning.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            children: [
                              Icon(Icons.lock, size: 16, color: AppColors.warning),
                              const SizedBox(width: Spacing.xs),
                              Expanded(
                                child: Text(
                                  'This sample is dispatched and cannot be modified (chain-of-custody)',
                                  style: TextStyle(color: AppColors.warning, fontSize: 12),
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
              const SizedBox(height: Spacing.md),

              // Product Details
              _buildSection('Product Details', [
                _buildInfoRow('Product Name', sample.productName ?? 'N/A'),
                _buildInfoRow('Brand', sample.brand ?? 'N/A'),
                _buildInfoRow('Batch/Lot', sample.batchNumber ?? 'N/A'),
                _buildInfoRow('Quantity', sample.quantity ?? 'N/A'),
                if (sample.manufacturingDate != null)
                  _buildInfoRow('Mfg Date', _formatDate(sample.manufacturingDate!)),
                if (sample.expiryDate != null)
                  _buildInfoRow('Expiry Date', _formatDate(sample.expiryDate!)),
              ]),
              const SizedBox(height: Spacing.md),

              // Collection Details
              _buildSection('Collection Details', [
                _buildInfoRow('Collected From', sample.collectedFrom ?? 'N/A'),
                _buildInfoRow('Collection Date', _formatDate(sample.collectionDate)),
                _buildInfoRow('Officer', sample.officerName ?? 'N/A'),
                if (sample.collectionLocation != null)
                  _buildInfoRow('Location', sample.collectionLocation!),
              ]),
              const SizedBox(height: Spacing.md),

              // Lab Details
              _buildSection('Laboratory', [
                _buildInfoRow('Lab Name', sample.labName ?? 'Not assigned'),
                if (sample.labReceiptDate != null)
                  _buildInfoRow('Received At Lab', _formatDate(sample.labReceiptDate!)),
                if (sample.testReportNumber != null)
                  _buildInfoRow('Report No', sample.testReportNumber!),
              ]),
              const SizedBox(height: Spacing.md),

              // Test Results
              if (sample.testResult != null)
                _buildSection('Test Results', [
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(Spacing.md),
                    decoration: BoxDecoration(
                      color: sample.testResult == 'pass' 
                          ? AppColors.success.withOpacity(0.1)
                          : AppColors.urgent.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Column(
                      children: [
                        Icon(
                          sample.testResult == 'pass' ? Icons.check_circle : Icons.cancel,
                          size: 48,
                          color: sample.testResult == 'pass' ? AppColors.success : AppColors.urgent,
                        ),
                        const SizedBox(height: Spacing.sm),
                        Text(
                          sample.testResult == 'pass' ? 'PASSED' : 'FAILED',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: sample.testResult == 'pass' ? AppColors.success : AppColors.urgent,
                          ),
                        ),
                        if (sample.testRemarks != null) ...[
                          const SizedBox(height: Spacing.sm),
                          Text(sample.testRemarks!, textAlign: TextAlign.center),
                        ],
                      ],
                    ),
                  ),
                ]),
              const SizedBox(height: Spacing.md),

              // Timeline
              if (_timeline.isNotEmpty)
                _buildSection('Chain of Custody Timeline', [
                  ..._timeline.asMap().entries.map((entry) {
                    final index = entry.key;
                    final event = entry.value;
                    final isLast = index == _timeline.length - 1;
                    
                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Column(
                          children: [
                            Container(
                              width: 12,
                              height: 12,
                              decoration: BoxDecoration(
                                color: AppColors.primary,
                                borderRadius: BorderRadius.circular(6),
                              ),
                            ),
                            if (!isLast)
                              Container(
                                width: 2,
                                height: 50,
                                color: AppColors.border,
                              ),
                          ],
                        ),
                        const SizedBox(width: Spacing.md),
                        Expanded(
                          child: Container(
                            margin: const EdgeInsets.only(bottom: Spacing.md),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  event['action'] ?? 'Event',
                                  style: const TextStyle(fontWeight: FontWeight.w500),
                                ),
                                Text(
                                  '${_formatDateTime(DateTime.parse(event['timestamp']))} by ${event['by'] ?? 'System'}',
                                  style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                                ),
                                if (event['notes'] != null)
                                  Text(event['notes'], style: TextStyle(fontSize: 13)),
                              ],
                            ),
                          ),
                        ),
                      ],
                    );
                  }),
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
            width: 110,
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

  String _formatDateTime(DateTime date) {
    return '${date.day}/${date.month}/${date.year} ${date.hour}:${date.minute.toString().padLeft(2, '0')}';
  }
}
