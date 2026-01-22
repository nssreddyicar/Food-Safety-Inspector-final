import 'dart:io';
import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../services/pdf_service.dart';

class GenerateReportScreen extends StatefulWidget {
  final String? inspectionId;
  final String? sampleId;

  const GenerateReportScreen({super.key, this.inspectionId, this.sampleId});

  @override
  State<GenerateReportScreen> createState() => _GenerateReportScreenState();
}

class _GenerateReportScreenState extends State<GenerateReportScreen> {
  final PdfService _pdfService = PdfService();
  bool _isGenerating = false;
  File? _generatedFile;
  String _reportType = 'inspection';

  Future<void> _generateReport() async {
    setState(() => _isGenerating = true);

    try {
      File file;
      if (_reportType == 'inspection') {
        file = await _pdfService.generateInspectionReport(
          inspectionCode: 'INS-${DateTime.now().millisecondsSinceEpoch}',
          fboName: 'Sample FBO Name',
          fboAddress: '123 Sample Street, City',
          officerName: 'Officer Name',
          inspectionDate: DateTime.now(),
          status: 'Completed',
          findings: 'Sample findings from inspection',
          actionsTaken: 'Actions taken during inspection',
        );
      } else {
        file = await _pdfService.generateSampleReport(
          sampleCode: 'SMP-${DateTime.now().millisecondsSinceEpoch}',
          productName: 'Sample Product',
          collectedFrom: 'Sample FBO',
          collectionDate: DateTime.now(),
          status: 'Result Received',
          labName: 'Central Food Laboratory',
          testResult: 'pass',
          remarks: 'All parameters within acceptable limits',
        );
      }

      setState(() => _generatedFile = file);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Report generated successfully')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to generate report: $e')),
        );
      }
    } finally {
      setState(() => _isGenerating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Generate Report')),
      body: Padding(
        padding: const EdgeInsets.all(Spacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Report Type',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: Spacing.md),
            
            _ReportTypeCard(
              title: 'Inspection Report',
              description: 'Generate PDF report for FBO inspection',
              icon: Icons.assignment,
              isSelected: _reportType == 'inspection',
              onTap: () => setState(() => _reportType = 'inspection'),
            ),
            const SizedBox(height: Spacing.md),
            
            _ReportTypeCard(
              title: 'Sample Report',
              description: 'Generate PDF report for sample analysis',
              icon: Icons.science,
              isSelected: _reportType == 'sample',
              onTap: () => setState(() => _reportType = 'sample'),
            ),
            
            const Spacer(),
            
            if (_generatedFile != null) ...[
              Card(
                color: AppColors.success.withOpacity(0.1),
                child: Padding(
                  padding: const EdgeInsets.all(Spacing.md),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          Icon(Icons.check_circle, color: AppColors.success),
                          const SizedBox(width: Spacing.sm),
                          const Expanded(child: Text('Report Generated Successfully')),
                        ],
                      ),
                      const SizedBox(height: Spacing.md),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () => _pdfService.openPdf(_generatedFile!),
                              icon: const Icon(Icons.open_in_new),
                              label: const Text('Open'),
                            ),
                          ),
                          const SizedBox(width: Spacing.md),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () => _pdfService.sharePdf(_generatedFile!),
                              icon: const Icon(Icons.share),
                              label: const Text('Share'),
                            ),
                          ),
                          const SizedBox(width: Spacing.md),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () => _pdfService.printPdf(_generatedFile!),
                              icon: const Icon(Icons.print),
                              label: const Text('Print'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: Spacing.md),
            ],
            
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _isGenerating ? null : _generateReport,
                icon: _isGenerating
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.picture_as_pdf),
                label: Text(_isGenerating ? 'Generating...' : 'Generate Report'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReportTypeCard extends StatelessWidget {
  final String title;
  final String description;
  final IconData icon;
  final bool isSelected;
  final VoidCallback onTap;

  const _ReportTypeCard({
    required this.title,
    required this.description,
    required this.icon,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(Spacing.md),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.border,
            width: isSelected ? 2 : 1,
          ),
          color: isSelected ? AppColors.primary.withOpacity(0.05) : null,
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isSelected ? AppColors.primary.withOpacity(0.1) : AppColors.background,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, color: isSelected ? AppColors.primary : AppColors.textSecondary),
            ),
            const SizedBox(width: Spacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
                  Text(description, style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                ],
              ),
            ),
            if (isSelected) Icon(Icons.check_circle, color: AppColors.primary),
          ],
        ),
      ),
    );
  }
}
