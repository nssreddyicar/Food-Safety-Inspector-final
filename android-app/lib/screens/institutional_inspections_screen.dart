/// Institutional Inspections list screen with status tabs and search.

import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../models/institutional_inspection.dart';
import '../services/api_client.dart';
import 'safety_assessment_screen.dart';

class InstitutionalInspectionsScreen extends StatefulWidget {
  const InstitutionalInspectionsScreen({super.key});

  @override
  State<InstitutionalInspectionsScreen> createState() => _InstitutionalInspectionsScreenState();
}

class _InstitutionalInspectionsScreenState extends State<InstitutionalInspectionsScreen> {
  final ApiClient _api = ApiClient();
  List<InstitutionalInspection> _inspections = [];
  List<InstitutionalInspection> _filteredInspections = [];
  bool _isLoading = true;
  String _searchQuery = '';
  String _activeTab = 'all';

  @override
  void initState() {
    super.initState();
    _loadInspections();
  }

  Future<void> _loadInspections() async {
    try {
      final response = await _api.get('/api/institutional-inspections');
      if (response.statusCode == 200) {
        final list = response.data as List<dynamic>;
        setState(() {
          _inspections = list.map((i) => InstitutionalInspection.fromJson(i)).toList();
          _filterInspections();
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load inspections: $e')),
        );
      }
    }
  }

  void _filterInspections() {
    setState(() {
      _filteredInspections = _inspections.where((i) {
        final matchesSearch = _searchQuery.isEmpty ||
            i.institutionName.toLowerCase().contains(_searchQuery.toLowerCase()) ||
            i.inspectionCode.toLowerCase().contains(_searchQuery.toLowerCase());

        final matchesTab = _activeTab == 'all' ||
            (_activeTab == 'draft' && i.status == 'draft') ||
            (_activeTab == 'submitted' && i.status == 'submitted');

        return matchesSearch && matchesTab;
      }).toList();
    });
  }

  int _getCount(String tab) {
    if (tab == 'all') return _inspections.length;
    return _inspections.where((i) => i.status == tab).length;
  }

  Color _getRiskColor(String? risk) {
    if (risk == null) return AppColors.textSecondary;
    final r = risk.toLowerCase();
    if (r.contains('high')) return AppColors.urgent;
    if (r.contains('medium')) return AppColors.warning;
    if (r.contains('low')) return AppColors.success;
    return AppColors.textSecondary;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Institutional Inspections'),
      ),
      body: Column(
        children: [
          // Search Bar
          Padding(
            padding: const EdgeInsets.all(Spacing.md),
            child: TextField(
              onChanged: (value) {
                _searchQuery = value;
                _filterInspections();
              },
              decoration: InputDecoration(
                hintText: 'Search by name or code...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          setState(() => _searchQuery = '');
                          _filterInspections();
                        },
                      )
                    : null,
              ),
            ),
          ),

          // Status Tabs
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: Spacing.md),
            child: Row(
              children: [
                _buildTabButton('All', 'all'),
                const SizedBox(width: Spacing.sm),
                _buildTabButton('Draft', 'draft'),
                const SizedBox(width: Spacing.sm),
                _buildTabButton('Submitted', 'submitted'),
              ],
            ),
          ),
          const SizedBox(height: Spacing.md),

          // List
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _filteredInspections.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.assignment_outlined, size: 64, color: AppColors.textSecondary),
                            const SizedBox(height: Spacing.md),
                            Text(
                              'No inspections found',
                              style: TextStyle(color: AppColors.textSecondary, fontSize: 16),
                            ),
                            const SizedBox(height: Spacing.sm),
                            Text(
                              'Tap + to create a new assessment',
                              style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
                            ),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _loadInspections,
                        child: ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: Spacing.md),
                          itemCount: _filteredInspections.length,
                          itemBuilder: (context, index) {
                            final inspection = _filteredInspections[index];
                            return _InspectionCard(
                              inspection: inspection,
                              riskColor: _getRiskColor(inspection.riskClassification),
                              onTap: () {
                                if (inspection.isSubmitted) {
                                  // View details
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => SafetyAssessmentScreen(inspectionId: inspection.id),
                                    ),
                                  );
                                }
                              },
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const SafetyAssessmentScreen()),
          ).then((_) => _loadInspections());
        },
        backgroundColor: AppColors.primary,
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }

  Widget _buildTabButton(String label, String tab) {
    final isActive = _activeTab == tab;
    final count = _getCount(tab);
    
    return Expanded(
      child: InkWell(
        onTap: () {
          setState(() => _activeTab = tab);
          _filterInspections();
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: Spacing.sm),
          decoration: BoxDecoration(
            color: isActive ? AppColors.primary : Colors.transparent,
            border: Border.all(color: isActive ? AppColors.primary : AppColors.border),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                label,
                style: TextStyle(
                  color: isActive ? Colors.white : AppColors.textPrimary,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(width: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: isActive ? Colors.white24 : AppColors.background,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '$count',
                  style: TextStyle(
                    fontSize: 12,
                    color: isActive ? Colors.white : AppColors.textSecondary,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _InspectionCard extends StatelessWidget {
  final InstitutionalInspection inspection;
  final Color riskColor;
  final VoidCallback onTap;

  const _InspectionCard({
    required this.inspection,
    required this.riskColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: Spacing.sm),
      child: InkWell(
        onTap: inspection.isSubmitted ? onTap : null,
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
                      Text(
                        inspection.inspectionCode,
                        style: TextStyle(color: AppColors.textSecondary, fontWeight: FontWeight.w600, fontSize: 12),
                      ),
                      const SizedBox(width: Spacing.sm),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: inspection.isSubmitted 
                              ? AppColors.primary.withOpacity(0.1)
                              : AppColors.textSecondary.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          inspection.statusDisplay.toUpperCase(),
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: inspection.isSubmitted ? AppColors.primary : AppColors.textSecondary,
                          ),
                        ),
                      ),
                    ],
                  ),
                  Text(
                    _formatDate(inspection.inspectionDate),
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                  ),
                ],
              ),
              const SizedBox(height: Spacing.xs),
              Text(
                inspection.institutionName,
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              if (inspection.institutionAddress != null)
                Text(
                  inspection.institutionAddress!,
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              if (inspection.isSubmitted && inspection.totalScore != null) ...[
                const SizedBox(height: Spacing.sm),
                Container(
                  padding: const EdgeInsets.only(top: Spacing.sm),
                  decoration: BoxDecoration(
                    border: Border(top: BorderSide(color: AppColors.border)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Text('Score: ', style: TextStyle(color: AppColors.textSecondary, fontSize: 14)),
                          Text(
                            '${inspection.totalScore}',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: AppColors.primary,
                            ),
                          ),
                        ],
                      ),
                      if (inspection.riskClassification != null)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: riskColor.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            inspection.riskClassification!.toUpperCase(),
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: riskColor,
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
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${date.day} ${months[date.month - 1]} ${date.year}';
  }
}
