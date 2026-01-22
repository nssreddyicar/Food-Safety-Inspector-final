import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../services/api_client.dart';

class TemplatesScreen extends StatefulWidget {
  const TemplatesScreen({super.key});

  @override
  State<TemplatesScreen> createState() => _TemplatesScreenState();
}

class _TemplatesScreenState extends State<TemplatesScreen> {
  final ApiClient _api = ApiClient();
  List<Map<String, dynamic>> _templates = [];
  bool _isLoading = true;
  String _selectedCategory = 'all';

  @override
  void initState() {
    super.initState();
    _loadTemplates();
  }

  Future<void> _loadTemplates() async {
    try {
      final response = await _api.get('/api/templates');
      if (response.statusCode == 200) {
        setState(() {
          _templates = List<Map<String, dynamic>>.from(response.data ?? []);
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
        _templates = _getDefaultTemplates();
      });
    }
  }

  List<Map<String, dynamic>> _getDefaultTemplates() {
    return [
      {'id': '1', 'name': 'FBO Inspection Report', 'category': 'inspection', 'description': 'Standard inspection report template'},
      {'id': '2', 'name': 'Sample Collection Form', 'category': 'sample', 'description': 'Form for sample collection details'},
      {'id': '3', 'name': 'Notice of Improvement', 'category': 'notice', 'description': 'Template for improvement notices'},
      {'id': '4', 'name': 'Prohibition Order', 'category': 'notice', 'description': 'Emergency prohibition order template'},
      {'id': '5', 'name': 'Complaint Acknowledgement', 'category': 'complaint', 'description': 'Acknowledgement receipt for complaints'},
      {'id': '6', 'name': 'Court Case Filing', 'category': 'legal', 'description': 'Template for court case documentation'},
    ];
  }

  List<Map<String, dynamic>> get _filteredTemplates {
    if (_selectedCategory == 'all') return _templates;
    return _templates.where((t) => t['category'] == _selectedCategory).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Templates'),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.filter_list),
            onSelected: (value) => setState(() => _selectedCategory = value),
            itemBuilder: (context) => [
              const PopupMenuItem(value: 'all', child: Text('All Templates')),
              const PopupMenuItem(value: 'inspection', child: Text('Inspection')),
              const PopupMenuItem(value: 'sample', child: Text('Sample')),
              const PopupMenuItem(value: 'notice', child: Text('Notice')),
              const PopupMenuItem(value: 'complaint', child: Text('Complaint')),
              const PopupMenuItem(value: 'legal', child: Text('Legal')),
            ],
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _filteredTemplates.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.description_outlined, size: 64, color: AppColors.textSecondary),
                      const SizedBox(height: Spacing.md),
                      Text('No templates found', style: TextStyle(color: AppColors.textSecondary)),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadTemplates,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(Spacing.md),
                    itemCount: _filteredTemplates.length,
                    itemBuilder: (context, index) {
                      final template = _filteredTemplates[index];
                      return _TemplateCard(
                        template: template,
                        onTap: () => _useTemplate(template),
                      );
                    },
                  ),
                ),
    );
  }

  void _useTemplate(Map<String, dynamic> template) {
    showModalBottomSheet(
      context: context,
      builder: (context) => Container(
        padding: const EdgeInsets.all(Spacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(template['name'], style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: Spacing.sm),
            Text(template['description'] ?? '', style: TextStyle(color: AppColors.textSecondary)),
            const SizedBox(height: Spacing.lg),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () {
                      Navigator.pop(context);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Template preview coming soon')),
                      );
                    },
                    icon: const Icon(Icons.visibility),
                    label: const Text('Preview'),
                  ),
                ),
                const SizedBox(width: Spacing.md),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () {
                      Navigator.pop(context);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Template applied')),
                      );
                    },
                    icon: const Icon(Icons.check),
                    label: const Text('Use'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _TemplateCard extends StatelessWidget {
  final Map<String, dynamic> template;
  final VoidCallback onTap;

  const _TemplateCard({required this.template, required this.onTap});

  IconData get _categoryIcon {
    switch (template['category']) {
      case 'inspection': return Icons.assignment;
      case 'sample': return Icons.science;
      case 'notice': return Icons.warning;
      case 'complaint': return Icons.report_problem;
      case 'legal': return Icons.gavel;
      default: return Icons.description;
    }
  }

  Color get _categoryColor {
    switch (template['category']) {
      case 'inspection': return AppColors.primary;
      case 'sample': return AppColors.warning;
      case 'notice': return AppColors.urgent;
      case 'complaint': return Colors.orange;
      case 'legal': return Colors.purple;
      default: return AppColors.textSecondary;
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
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _categoryColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(_categoryIcon, color: _categoryColor),
              ),
              const SizedBox(width: Spacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(template['name'], style: const TextStyle(fontWeight: FontWeight.bold)),
                    if (template['description'] != null)
                      Text(
                        template['description'],
                        style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: AppColors.textSecondary),
            ],
          ),
        ),
      ),
    );
  }
}
