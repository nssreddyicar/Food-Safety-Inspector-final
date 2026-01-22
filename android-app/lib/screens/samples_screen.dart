/// =============================================================================
/// FILE: android-app/lib/screens/samples_screen.dart
/// PURPOSE: Sample tracking and management screen
/// =============================================================================

import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../models/sample.dart';
import '../services/api_client.dart';
import 'sample_details_screen.dart';

class SamplesScreen extends StatefulWidget {
  const SamplesScreen({super.key});

  @override
  State<SamplesScreen> createState() => _SamplesScreenState();
}

class _SamplesScreenState extends State<SamplesScreen>
    with SingleTickerProviderStateMixin {
  final ApiClient _api = ApiClient();
  late TabController _tabController;
  List<Sample> _samples = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _loadSamples();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadSamples() async {
    try {
      final response = await _api.get('/api/samples');
      if (response.statusCode == 200) {
        final list = response.data as List<dynamic>;
        setState(() {
          _samples = list.map((s) => Sample.fromJson(s)).toList();
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  List<Sample> _getFilteredSamples(String? status) {
    if (status == null) return _samples;
    return _samples.where((s) => s.status == status).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Samples'),
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          tabs: [
            Tab(text: 'All (${_samples.length})'),
            Tab(text: 'Collected (${_getFilteredSamples('collected').length})'),
            Tab(text: 'At Lab (${_getFilteredSamples('testing').length})'),
            Tab(text: 'Results (${_getFilteredSamples('result_received').length})'),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: () {},
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                _buildSampleList(_getFilteredSamples(null)),
                _buildSampleList(_getFilteredSamples('collected')),
                _buildSampleList(_getFilteredSamples('testing')),
                _buildSampleList(_getFilteredSamples('result_received')),
              ],
            ),
    );
  }

  Widget _buildSampleList(List<Sample> samples) {
    if (samples.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.science_outlined, size: 64, color: AppColors.textSecondary),
            const SizedBox(height: Spacing.md),
            Text('No samples found', style: TextStyle(color: AppColors.textSecondary)),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadSamples,
      child: ListView.builder(
        padding: const EdgeInsets.all(Spacing.md),
        itemCount: samples.length,
        itemBuilder: (context, index) {
          final sample = samples[index];
          return _SampleCard(
            sample: sample,
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => SampleDetailsScreen(sampleId: sample.id),
                ),
              ).then((_) => _loadSamples());
            },
          );
        },
      ),
    );
  }
}

class _SampleCard extends StatelessWidget {
  final Sample sample;
  final VoidCallback onTap;

  const _SampleCard({
    required this.sample,
    required this.onTap,
  });

  Color get _urgencyColor {
    if (sample.deadlineDate == null) return AppColors.textSecondary;
    final daysRemaining = sample.deadlineDate!.difference(DateTime.now()).inDays;
    if (daysRemaining < 0) return AppColors.urgent;
    if (daysRemaining <= 3) return AppColors.urgent;
    if (daysRemaining <= 7) return AppColors.warning;
    return AppColors.success;
  }

  @override
  Widget build(BuildContext context) {
    final daysRemaining = sample.deadlineDate?.difference(DateTime.now()).inDays;

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
                  Container(
                    width: 4,
                    height: 40,
                    decoration: BoxDecoration(
                      color: _urgencyColor,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(width: Spacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          sample.sampleCode,
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: Spacing.xs),
                        Text(
                          sample.productName ?? 'Unknown Product',
                          style: TextStyle(color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: Spacing.sm, vertical: Spacing.xs),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          sample.statusDisplay,
                          style: TextStyle(color: AppColors.primary, fontSize: 10, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              if (daysRemaining != null && sample.status != 'result_received' && sample.status != 'closed') ...[
                const SizedBox(height: Spacing.md),
                Container(
                  padding: const EdgeInsets.all(Spacing.sm),
                  decoration: BoxDecoration(
                    color: _urgencyColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.timer_outlined, size: 16, color: _urgencyColor),
                      const SizedBox(width: Spacing.sm),
                      Text(
                        daysRemaining < 0
                            ? 'Overdue by ${-daysRemaining} days'
                            : '$daysRemaining days until deadline',
                        style: TextStyle(
                          color: _urgencyColor,
                          fontWeight: FontWeight.w600,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              if (sample.testResult != null) ...[
                const SizedBox(height: Spacing.sm),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: Spacing.sm, vertical: Spacing.xs),
                  decoration: BoxDecoration(
                    color: sample.testResult == 'pass' 
                        ? AppColors.success.withOpacity(0.1)
                        : AppColors.urgent.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    sample.testResult == 'pass' ? 'PASSED' : 'FAILED',
                    style: TextStyle(
                      color: sample.testResult == 'pass' ? AppColors.success : AppColors.urgent,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
