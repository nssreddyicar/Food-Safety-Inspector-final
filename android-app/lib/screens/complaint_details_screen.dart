/// Complaint details screen with status updates and evidence.

import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../models/complaint.dart';
import '../services/api_client.dart';

class ComplaintDetailsScreen extends StatefulWidget {
  final String complaintId;

  const ComplaintDetailsScreen({super.key, required this.complaintId});

  @override
  State<ComplaintDetailsScreen> createState() => _ComplaintDetailsScreenState();
}

class _ComplaintDetailsScreenState extends State<ComplaintDetailsScreen> {
  final ApiClient _api = ApiClient();
  Complaint? _complaint;
  bool _isLoading = true;
  List<dynamic> _evidence = [];

  @override
  void initState() {
    super.initState();
    _loadComplaint();
  }

  Future<void> _loadComplaint() async {
    try {
      final response = await _api.get('/api/complaints/${widget.complaintId}');
      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        setState(() {
          _complaint = Complaint.fromJson(data);
          _evidence = data['evidence'] ?? [];
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load complaint: $e')),
        );
      }
    }
  }

  Future<void> _updateStatus(String newStatus) async {
    try {
      await _api.put('/api/complaints/${widget.complaintId}/status', data: {'status': newStatus});
      _loadComplaint();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Status updated to $newStatus')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to update status: $e')),
        );
      }
    }
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'new': return AppColors.urgent;
      case 'assigned': return AppColors.primary;
      case 'investigating': return AppColors.warning;
      case 'resolved': return AppColors.success;
      case 'closed': return AppColors.textSecondary;
      default: return AppColors.textSecondary;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('Complaint Details')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    if (_complaint == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Complaint Details')),
        body: const Center(child: Text('Complaint not found')),
      );
    }

    final complaint = _complaint!;
    final statusColor = _getStatusColor(complaint.status);

    return Scaffold(
      appBar: AppBar(
        title: Text(complaint.complaintCode),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert),
            onSelected: _updateStatus,
            itemBuilder: (context) => [
              const PopupMenuItem(value: 'assigned', child: Text('Mark as Assigned')),
              const PopupMenuItem(value: 'investigating', child: Text('Mark as Investigating')),
              const PopupMenuItem(value: 'resolved', child: Text('Mark as Resolved')),
              const PopupMenuItem(value: 'closed', child: Text('Close Complaint')),
            ],
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadComplaint,
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
                              complaint.statusDisplay,
                              style: TextStyle(color: statusColor, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text('Filed On', style: TextStyle(color: AppColors.textSecondary)),
                          const SizedBox(height: 4),
                          Text(
                            _formatDate(complaint.createdAt),
                            style: const TextStyle(fontWeight: FontWeight.w500),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: Spacing.md),

              // Complainant Info
              _buildSection('Complainant Information', [
                _buildInfoRow('Name', complaint.complainantName ?? 'N/A'),
                _buildInfoRow('Phone', complaint.complainantPhone ?? 'N/A'),
                _buildInfoRow('Email', complaint.complainantEmail ?? 'N/A'),
              ]),
              const SizedBox(height: Spacing.md),

              // Establishment Info
              _buildSection('Establishment Details', [
                _buildInfoRow('Name', complaint.establishmentName ?? 'N/A'),
                _buildInfoRow('Address', complaint.establishmentAddress ?? 'N/A'),
                _buildInfoRow('Type', complaint.establishmentType ?? 'N/A'),
              ]),
              const SizedBox(height: Spacing.md),

              // Complaint Details
              _buildSection('Complaint Details', [
                _buildInfoRow('Type', complaint.complaintType ?? 'N/A'),
                _buildInfoRow('Nature', complaint.complaintNature ?? 'N/A'),
                if (complaint.description != null)
                  Padding(
                    padding: const EdgeInsets.only(top: Spacing.sm),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Description', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                        const SizedBox(height: 4),
                        Text(complaint.description!),
                      ],
                    ),
                  ),
              ]),
              const SizedBox(height: Spacing.md),

              // Location
              if (complaint.latitude != null && complaint.longitude != null)
                _buildSection('Location', [
                  _buildInfoRow('Latitude', complaint.latitude.toString()),
                  _buildInfoRow('Longitude', complaint.longitude.toString()),
                ]),
              const SizedBox(height: Spacing.md),

              // Evidence
              if (_evidence.isNotEmpty)
                _buildSection('Evidence', [
                  GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      crossAxisSpacing: Spacing.sm,
                      mainAxisSpacing: Spacing.sm,
                    ),
                    itemCount: _evidence.length,
                    itemBuilder: (context, index) {
                      final evidence = _evidence[index];
                      return ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          color: AppColors.border,
                          child: Center(
                            child: Icon(Icons.image, color: AppColors.textSecondary),
                          ),
                        ),
                      );
                    },
                  ),
                ]),

              // Officer Assignment
              if (complaint.assignedOfficerName != null)
                _buildSection('Assignment', [
                  _buildInfoRow('Assigned Officer', complaint.assignedOfficerName!),
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
            Text(
              title,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
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
