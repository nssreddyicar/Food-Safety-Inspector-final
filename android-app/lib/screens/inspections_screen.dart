/// =============================================================================
/// FILE: android-app/lib/screens/inspections_screen.dart
/// PURPOSE: FBO Inspection list and management screen
/// =============================================================================

import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../models/inspection.dart';
import '../services/api_client.dart';
import 'inspection_details_screen.dart';
import 'new_inspection_screen.dart';

class InspectionsScreen extends StatefulWidget {
  const InspectionsScreen({super.key});

  @override
  State<InspectionsScreen> createState() => _InspectionsScreenState();
}

class _InspectionsScreenState extends State<InspectionsScreen>
    with SingleTickerProviderStateMixin {
  final ApiClient _api = ApiClient();
  late TabController _tabController;
  List<Inspection> _inspections = [];
  bool _isLoading = true;
  
  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _loadInspections();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadInspections() async {
    try {
      final response = await _api.get('/api/inspections');
      if (response.statusCode == 200) {
        final list = response.data as List<dynamic>;
        setState(() {
          _inspections = list.map((i) => Inspection.fromJson(i)).toList();
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  List<Inspection> _getFilteredInspections(String status) {
    if (status == 'all') return _inspections;
    return _inspections.where((i) => i.status == status).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('FBO Inspections'),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          tabs: [
            Tab(text: 'All (${_inspections.length})'),
            Tab(text: 'In Progress (${_getFilteredInspections('in_progress').length})'),
            Tab(text: 'Completed (${_getFilteredInspections('completed').length})'),
            Tab(text: 'Follow-up (${_getFilteredInspections('requires_followup').length})'),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: () {
              // Show filter options
            },
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                _buildInspectionList(_getFilteredInspections('all')),
                _buildInspectionList(_getFilteredInspections('in_progress')),
                _buildInspectionList(_getFilteredInspections('completed')),
                _buildInspectionList(_getFilteredInspections('requires_followup')),
              ],
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const NewInspectionScreen()),
          ).then((_) => _loadInspections());
        },
        icon: const Icon(Icons.add),
        label: const Text('New'),
        backgroundColor: AppColors.primary,
      ),
    );
  }

  Widget _buildInspectionList(List<Inspection> inspections) {
    if (inspections.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.assignment_outlined, size: 64, color: AppColors.textSecondary),
            const SizedBox(height: Spacing.md),
            Text('No inspections found', style: TextStyle(color: AppColors.textSecondary)),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadInspections,
      child: ListView.builder(
        padding: const EdgeInsets.all(Spacing.md),
        itemCount: inspections.length,
        itemBuilder: (context, index) {
          final inspection = inspections[index];
          return _InspectionCard(
            inspection: inspection,
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => InspectionDetailsScreen(inspectionId: inspection.id),
                ),
              ).then((_) => _loadInspections());
            },
          );
        },
      ),
    );
  }
}

class _InspectionCard extends StatelessWidget {
  final Inspection inspection;
  final VoidCallback onTap;

  const _InspectionCard({
    required this.inspection,
    required this.onTap,
  });

  Color get _statusColor {
    switch (inspection.status) {
      case 'draft': return Colors.grey;
      case 'in_progress': return AppColors.primary;
      case 'completed': return AppColors.success;
      case 'requires_followup': return AppColors.warning;
      case 'closed': return Colors.grey.shade700;
      default: return AppColors.primary;
    }
  }

  @override
  Widget build(BuildContext context) {
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
                  Expanded(
                    child: Text(
                      inspection.fboName ?? 'Unknown FBO',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: Spacing.sm, vertical: Spacing.xs),
                    decoration: BoxDecoration(
                      color: _statusColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      inspection.statusDisplay,
                      style: TextStyle(color: _statusColor, fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: Spacing.sm),
              if (inspection.fboAddress != null)
                Row(
                  children: [
                    Icon(Icons.location_on_outlined, size: 16, color: AppColors.textSecondary),
                    const SizedBox(width: Spacing.xs),
                    Expanded(
                      child: Text(
                        inspection.fboAddress!,
                        style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
                      ),
                    ),
                  ],
                ),
              const SizedBox(height: Spacing.xs),
              Row(
                children: [
                  Icon(Icons.calendar_today_outlined, size: 16, color: AppColors.textSecondary),
                  const SizedBox(width: Spacing.xs),
                  Text(
                    '${inspection.inspectionDate.day}/${inspection.inspectionDate.month}/${inspection.inspectionDate.year}',
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
                  ),
                  const SizedBox(width: Spacing.md),
                  if (inspection.type != null) ...[
                    Icon(Icons.category_outlined, size: 16, color: AppColors.textSecondary),
                    const SizedBox(width: Spacing.xs),
                    Text(
                      inspection.type!,
                      style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
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
}
