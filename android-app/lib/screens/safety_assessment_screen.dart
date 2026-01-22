/// Safety Assessment Screen - 35 FSSAI indicators across 7 pillars.

import 'package:flutter/material.dart';
import 'dart:convert';
import '../config/theme.dart';
import '../models/institutional_inspection.dart';
import '../services/api_client.dart';

class SafetyAssessmentScreen extends StatefulWidget {
  final String? inspectionId;

  const SafetyAssessmentScreen({super.key, this.inspectionId});

  @override
  State<SafetyAssessmentScreen> createState() => _SafetyAssessmentScreenState();
}

class _SafetyAssessmentScreenState extends State<SafetyAssessmentScreen> {
  final ApiClient _api = ApiClient();
  
  bool _isLoading = true;
  bool _isSubmitting = false;
  bool _isViewMode = false;
  
  List<Pillar> _pillars = [];
  List<InstitutionType> _institutionTypes = [];
  Map<String, String> _responses = {}; // indicatorId -> 'yes'|'no'|'na'
  
  // Form fields
  String? _selectedInstitutionTypeId;
  final _institutionNameController = TextEditingController();
  final _institutionAddressController = TextEditingController();
  
  int _totalScore = 0;
  String _riskClassification = '';
  String? _inspectionId;
  Set<int> _expandedPillars = {0}; // First pillar expanded by default

  @override
  void initState() {
    super.initState();
    _isViewMode = widget.inspectionId != null;
    _loadFormConfig();
    if (widget.inspectionId != null) {
      _loadExistingInspection();
    }
  }

  @override
  void dispose() {
    _institutionNameController.dispose();
    _institutionAddressController.dispose();
    super.dispose();
  }

  Future<void> _loadFormConfig() async {
    try {
      final response = await _api.get('/api/institutional-inspections/form-config');
      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        setState(() {
          _pillars = ((data['pillars'] as List?) ?? [])
              .map((p) => Pillar.fromJson(p))
              .toList();
          _institutionTypes = ((data['institutionTypes'] as List?) ?? [])
              .map((t) => InstitutionType.fromJson(t))
              .toList();
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load form config: $e')),
        );
      }
    }
  }

  Future<void> _loadExistingInspection() async {
    try {
      final response = await _api.get('/api/institutional-inspections/${widget.inspectionId}');
      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        setState(() {
          _institutionNameController.text = data['institutionName'] ?? '';
          _institutionAddressController.text = data['institutionAddress'] ?? '';
          _selectedInstitutionTypeId = data['institutionTypeId'];
          _totalScore = data['totalScore'] ?? 0;
          _riskClassification = data['riskClassification'] ?? '';
          
          // Load responses
          final responses = data['responses'] as List<dynamic>? ?? [];
          for (var r in responses) {
            _responses[r['indicatorId']] = r['value'];
          }
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to load inspection: $e')),
        );
      }
    }
  }

  Future<void> _calculateScore() async {
    try {
      final response = await _api.post(
        '/api/institutional-inspections/calculate-score',
        data: {'responses': _responses},
      );
      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        setState(() {
          _totalScore = data['totalScore'] ?? 0;
          _riskClassification = data['riskClassification'] ?? '';
        });
      }
    } catch (e) {
      // Silently fail score calculation
    }
  }

  void _setResponse(String indicatorId, String value) {
    setState(() {
      _responses[indicatorId] = value;
    });
    _calculateScore();
  }

  Future<void> _saveAndSubmit() async {
    if (_institutionNameController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter institution name')),
      );
      return;
    }

    if (_selectedInstitutionTypeId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select institution type')),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      // Create inspection if new
      if (_inspectionId == null) {
        final createResponse = await _api.post(
          '/api/institutional-inspections',
          data: {
            'institutionName': _institutionNameController.text,
            'institutionAddress': _institutionAddressController.text,
            'institutionTypeId': _selectedInstitutionTypeId,
          },
        );
        
        if (createResponse.statusCode == 201) {
          _inspectionId = createResponse.data['id'];
        } else {
          throw Exception('Failed to create inspection');
        }
      }

      // Save responses
      final responsesData = _responses.entries.map((e) => {
        'indicatorId': e.key,
        'value': e.value,
      }).toList();

      await _api.post(
        '/api/institutional-inspections/$_inspectionId/responses',
        data: {'responses': responsesData},
      );

      // Submit inspection
      await _api.post('/api/institutional-inspections/$_inspectionId/submit');

      if (mounted) {
        _showSuccessDialog();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to submit: $e')),
        );
      }
    } finally {
      setState(() => _isSubmitting = false);
    }
  }

  void _showSuccessDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: Row(
          children: [
            Icon(Icons.check_circle, color: AppColors.success, size: 32),
            const SizedBox(width: Spacing.sm),
            const Text('Inspection Submitted'),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Total Score: $_totalScore'),
            Text('Risk Classification: $_riskClassification'),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () async {
              // Download PDF
              Navigator.pop(context);
              Navigator.pop(context);
            },
            child: const Text('Download PDF Report'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              Navigator.pop(context);
            },
            child: const Text('Done'),
          ),
        ],
      ),
    );
  }

  Color _getRiskColor() {
    final r = _riskClassification.toLowerCase();
    if (r.contains('high')) return AppColors.urgent;
    if (r.contains('medium')) return AppColors.warning;
    if (r.contains('low')) return AppColors.success;
    return AppColors.textSecondary;
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: Text(_isViewMode ? 'Inspection Details' : 'New Assessment')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(_isViewMode ? 'Inspection Details' : 'Safety Assessment'),
        actions: [
          if (!_isViewMode)
            TextButton(
              onPressed: _isSubmitting ? null : _saveAndSubmit,
              child: _isSubmitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Submit', style: TextStyle(color: Colors.white)),
            ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(Spacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Score Card
            Card(
              color: AppColors.primary,
              child: Padding(
                padding: const EdgeInsets.all(Spacing.md),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Total Score', style: TextStyle(color: Colors.white70)),
                        Text(
                          '$_totalScore',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 32,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    if (_riskClassification.isNotEmpty)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          _riskClassification.toUpperCase(),
                          style: TextStyle(
                            color: _getRiskColor(),
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: Spacing.md),

            // Institution Details
            if (!_isViewMode) ...[
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(Spacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Institution Details',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: Spacing.md),
                      DropdownButtonFormField<String>(
                        value: _selectedInstitutionTypeId,
                        decoration: const InputDecoration(labelText: 'Institution Type *'),
                        items: _institutionTypes.map((t) => DropdownMenuItem(
                          value: t.id,
                          child: Text(t.name),
                        )).toList(),
                        onChanged: (value) => setState(() => _selectedInstitutionTypeId = value),
                      ),
                      const SizedBox(height: Spacing.md),
                      TextField(
                        controller: _institutionNameController,
                        decoration: const InputDecoration(labelText: 'Institution Name *'),
                      ),
                      const SizedBox(height: Spacing.md),
                      TextField(
                        controller: _institutionAddressController,
                        decoration: const InputDecoration(labelText: 'Address'),
                        maxLines: 2,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: Spacing.md),
            ],

            // Pillars and Indicators
            const Text(
              '7 Pillars with 35 FSSAI-Aligned Indicators',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: Spacing.sm),

            ..._pillars.asMap().entries.map((entry) {
              final index = entry.key;
              final pillar = entry.value;
              final isExpanded = _expandedPillars.contains(index);
              
              return Card(
                margin: const EdgeInsets.only(bottom: Spacing.sm),
                child: Column(
                  children: [
                    InkWell(
                      onTap: () {
                        setState(() {
                          if (isExpanded) {
                            _expandedPillars.remove(index);
                          } else {
                            _expandedPillars.add(index);
                          }
                        });
                      },
                      child: Padding(
                        padding: const EdgeInsets.all(Spacing.md),
                        child: Row(
                          children: [
                            Container(
                              width: 32,
                              height: 32,
                              decoration: BoxDecoration(
                                color: AppColors.primary,
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: Center(
                                child: Text(
                                  '${index + 1}',
                                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                                ),
                              ),
                            ),
                            const SizedBox(width: Spacing.md),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    pillar.name,
                                    style: const TextStyle(fontWeight: FontWeight.bold),
                                  ),
                                  Text(
                                    '${pillar.indicators.length} indicators',
                                    style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                                  ),
                                ],
                              ),
                            ),
                            Icon(
                              isExpanded ? Icons.expand_less : Icons.expand_more,
                              color: AppColors.textSecondary,
                            ),
                          ],
                        ),
                      ),
                    ),
                    if (isExpanded)
                      ...pillar.indicators.map((indicator) => _buildIndicatorRow(indicator)),
                  ],
                ),
              );
            }),
          ],
        ),
      ),
    );
  }

  Widget _buildIndicatorRow(Indicator indicator) {
    final response = _responses[indicator.id];
    
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: Spacing.md, vertical: Spacing.sm),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          // Risk indicator
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              color: response == 'yes' ? AppColors.success 
                   : response == 'no' ? AppColors.urgent
                   : AppColors.textSecondary,
              borderRadius: BorderRadius.circular(4),
            ),
          ),
          const SizedBox(width: Spacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(indicator.name, style: const TextStyle(fontSize: 14)),
                if (indicator.description != null)
                  Text(
                    indicator.description!,
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
          if (!_isViewMode) ...[
            _buildResponseButton('Y', 'yes', indicator.id, response),
            const SizedBox(width: 4),
            _buildResponseButton('N', 'no', indicator.id, response),
            const SizedBox(width: 4),
            _buildResponseButton('NA', 'na', indicator.id, response),
          ] else if (response != null) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: response == 'yes' ? AppColors.success.withOpacity(0.1)
                     : response == 'no' ? AppColors.urgent.withOpacity(0.1)
                     : AppColors.textSecondary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                response.toUpperCase(),
                style: TextStyle(
                  color: response == 'yes' ? AppColors.success
                       : response == 'no' ? AppColors.urgent
                       : AppColors.textSecondary,
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildResponseButton(String label, String value, String indicatorId, String? currentResponse) {
    final isSelected = currentResponse == value;
    Color bgColor;
    Color textColor;
    
    if (isSelected) {
      switch (value) {
        case 'yes':
          bgColor = AppColors.success;
          textColor = Colors.white;
          break;
        case 'no':
          bgColor = AppColors.urgent;
          textColor = Colors.white;
          break;
        default:
          bgColor = AppColors.textSecondary;
          textColor = Colors.white;
      }
    } else {
      bgColor = AppColors.background;
      textColor = AppColors.textSecondary;
    }
    
    return InkWell(
      onTap: () => _setResponse(indicatorId, value),
      child: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: isSelected ? bgColor : AppColors.border),
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              color: textColor,
              fontWeight: FontWeight.bold,
              fontSize: 11,
            ),
          ),
        ),
      ),
    );
  }
}
