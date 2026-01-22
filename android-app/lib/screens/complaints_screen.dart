/// Complaints list screen with filtering and search.

import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../models/complaint.dart';
import '../services/api_client.dart';
import 'complaint_details_screen.dart';

class ComplaintsScreen extends StatefulWidget {
  const ComplaintsScreen({super.key});

  @override
  State<ComplaintsScreen> createState() => _ComplaintsScreenState();
}

class _ComplaintsScreenState extends State<ComplaintsScreen> with SingleTickerProviderStateMixin {
  final ApiClient _api = ApiClient();
  List<Complaint> _complaints = [];
  List<Complaint> _filteredComplaints = [];
  bool _isLoading = true;
  String _searchQuery = '';
  late TabController _tabController;
  
  final List<String> _statusTabs = ['All', 'New', 'Assigned', 'Investigating', 'Resolved', 'Closed'];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _statusTabs.length, vsync: this);
    _tabController.addListener(_filterComplaints);
    _loadComplaints();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadComplaints() async {
    try {
      final response = await _api.get('/api/complaints');
      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        final list = (data['complaints'] as List<dynamic>?) ?? [];
        setState(() {
          _complaints = list.map((c) => Complaint.fromJson(c)).toList();
          _filterComplaints();
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load complaints: $e')),
        );
      }
    }
  }

  void _filterComplaints() {
    final statusFilter = _statusTabs[_tabController.index].toLowerCase();
    setState(() {
      _filteredComplaints = _complaints.where((c) {
        final matchesSearch = _searchQuery.isEmpty ||
            c.complaintCode.toLowerCase().contains(_searchQuery.toLowerCase()) ||
            (c.establishmentName?.toLowerCase().contains(_searchQuery.toLowerCase()) ?? false) ||
            (c.complainantName?.toLowerCase().contains(_searchQuery.toLowerCase()) ?? false);
        
        final matchesStatus = statusFilter == 'all' || c.status == statusFilter;
        
        return matchesSearch && matchesStatus;
      }).toList();
    });
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

  int _getStatusCount(String status) {
    if (status.toLowerCase() == 'all') return _complaints.length;
    return _complaints.where((c) => c.status == status.toLowerCase()).length;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Complaints'),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          tabs: _statusTabs.map((status) => Tab(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(status),
                const SizedBox(width: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.white24,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    '${_getStatusCount(status)}',
                    style: const TextStyle(fontSize: 12),
                  ),
                ),
              ],
            ),
          )).toList(),
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(Spacing.md),
            child: TextField(
              onChanged: (value) {
                _searchQuery = value;
                _filterComplaints();
              },
              decoration: InputDecoration(
                hintText: 'Search complaints...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          setState(() => _searchQuery = '');
                          _filterComplaints();
                        },
                      )
                    : null,
              ),
            ),
          ),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _filteredComplaints.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.inbox_outlined, size: 64, color: AppColors.textSecondary),
                            const SizedBox(height: Spacing.md),
                            Text(
                              'No complaints found',
                              style: TextStyle(color: AppColors.textSecondary, fontSize: 16),
                            ),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _loadComplaints,
                        child: ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: Spacing.md),
                          itemCount: _filteredComplaints.length,
                          itemBuilder: (context, index) {
                            final complaint = _filteredComplaints[index];
                            return _ComplaintCard(
                              complaint: complaint,
                              statusColor: _getStatusColor(complaint.status),
                              onTap: () => Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => ComplaintDetailsScreen(complaintId: complaint.id),
                                ),
                              ).then((_) => _loadComplaints()),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}

class _ComplaintCard extends StatelessWidget {
  final Complaint complaint;
  final Color statusColor;
  final VoidCallback onTap;

  const _ComplaintCard({
    required this.complaint,
    required this.statusColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: Spacing.sm),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(Spacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Icon(Icons.file_copy_outlined, size: 16, color: AppColors.primary),
                      const SizedBox(width: 4),
                      Text(
                        complaint.complaintCode,
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: statusColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      complaint.statusDisplay,
                      style: TextStyle(
                        color: statusColor,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: Spacing.sm),
              if (complaint.establishmentName != null)
                Text(
                  complaint.establishmentName!,
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
                ),
              if (complaint.complaintType != null)
                Text(
                  complaint.complaintType!,
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
                ),
              const SizedBox(height: Spacing.xs),
              Row(
                children: [
                  Icon(Icons.calendar_today, size: 14, color: AppColors.textSecondary),
                  const SizedBox(width: 4),
                  Text(
                    _formatDate(complaint.createdAt),
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                  ),
                  if (complaint.assignedOfficerName != null) ...[
                    const SizedBox(width: Spacing.md),
                    Icon(Icons.person, size: 14, color: AppColors.textSecondary),
                    const SizedBox(width: 4),
                    Text(
                      complaint.assignedOfficerName!,
                      style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                    ),
                  ],
                ],
              ),
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
