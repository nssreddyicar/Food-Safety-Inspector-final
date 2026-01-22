import 'dart:io';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:path_provider/path_provider.dart';
import 'package:printing/printing.dart';
import 'package:open_file/open_file.dart';
import 'package:share_plus/share_plus.dart';

class PdfService {
  static final PdfService _instance = PdfService._internal();
  factory PdfService() => _instance;
  PdfService._internal();

  Future<File> generateInspectionReport({
    required String inspectionCode,
    required String fboName,
    required String fboAddress,
    required String officerName,
    required DateTime inspectionDate,
    required String status,
    String? findings,
    String? actionsTaken,
    List<Map<String, dynamic>>? deviations,
  }) async {
    final pdf = pw.Document();

    pdf.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(40),
        header: (context) => _buildHeader('FBO Inspection Report'),
        footer: (context) => _buildFooter(context),
        build: (context) => [
          _buildSection('Inspection Details', [
            _buildRow('Inspection Code', inspectionCode),
            _buildRow('Date', '${inspectionDate.day}/${inspectionDate.month}/${inspectionDate.year}'),
            _buildRow('Status', status),
            _buildRow('Officer', officerName),
          ]),
          pw.SizedBox(height: 20),
          _buildSection('FBO Details', [
            _buildRow('Name', fboName),
            _buildRow('Address', fboAddress),
          ]),
          if (findings != null) ...[
            pw.SizedBox(height: 20),
            _buildSection('Findings', [
              pw.Text(findings, style: const pw.TextStyle(fontSize: 11)),
            ]),
          ],
          if (deviations != null && deviations.isNotEmpty) ...[
            pw.SizedBox(height: 20),
            _buildSection('Deviations', deviations.map((d) => 
              pw.Container(
                margin: const pw.EdgeInsets.only(bottom: 8),
                child: pw.Text('- ${d['description']}', style: const pw.TextStyle(fontSize: 11)),
              )
            ).toList()),
          ],
          if (actionsTaken != null) ...[
            pw.SizedBox(height: 20),
            _buildSection('Actions Taken', [
              pw.Text(actionsTaken, style: const pw.TextStyle(fontSize: 11)),
            ]),
          ],
        ],
      ),
    );

    return await _savePdf(pdf, 'inspection_$inspectionCode');
  }

  Future<File> generateSampleReport({
    required String sampleCode,
    required String productName,
    required String collectedFrom,
    required DateTime collectionDate,
    required String status,
    String? labName,
    String? testResult,
    String? remarks,
  }) async {
    final pdf = pw.Document();

    pdf.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(40),
        header: (context) => _buildHeader('Sample Analysis Report'),
        footer: (context) => _buildFooter(context),
        build: (context) => [
          _buildSection('Sample Details', [
            _buildRow('Sample Code', sampleCode),
            _buildRow('Product Name', productName),
            _buildRow('Collected From', collectedFrom),
            _buildRow('Collection Date', '${collectionDate.day}/${collectionDate.month}/${collectionDate.year}'),
            _buildRow('Status', status),
          ]),
          if (labName != null) ...[
            pw.SizedBox(height: 20),
            _buildSection('Lab Details', [
              _buildRow('Laboratory', labName),
              if (testResult != null) _buildRow('Result', testResult.toUpperCase()),
            ]),
          ],
          if (remarks != null) ...[
            pw.SizedBox(height: 20),
            _buildSection('Remarks', [
              pw.Text(remarks, style: const pw.TextStyle(fontSize: 11)),
            ]),
          ],
        ],
      ),
    );

    return await _savePdf(pdf, 'sample_$sampleCode');
  }

  pw.Widget _buildHeader(String title) {
    return pw.Container(
      margin: const pw.EdgeInsets.only(bottom: 20),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text('FSSAI', style: pw.TextStyle(fontSize: 24, fontWeight: pw.FontWeight.bold, color: PdfColors.blue800)),
          pw.Text('Food Safety and Standards Authority of India', style: const pw.TextStyle(fontSize: 10, color: PdfColors.grey700)),
          pw.SizedBox(height: 10),
          pw.Divider(color: PdfColors.blue800, thickness: 2),
          pw.SizedBox(height: 10),
          pw.Text(title, style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold)),
        ],
      ),
    );
  }

  pw.Widget _buildFooter(pw.Context context) {
    return pw.Container(
      margin: const pw.EdgeInsets.only(top: 10),
      child: pw.Column(
        children: [
          pw.Divider(color: PdfColors.grey400),
          pw.SizedBox(height: 5),
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Text('Generated: ${DateTime.now().toString().split('.')[0]}', style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey600)),
              pw.Text('Page ${context.pageNumber} of ${context.pagesCount}', style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey600)),
            ],
          ),
        ],
      ),
    );
  }

  pw.Widget _buildSection(String title, List<pw.Widget> children) {
    return pw.Container(
      padding: const pw.EdgeInsets.all(10),
      decoration: pw.BoxDecoration(
        border: pw.Border.all(color: PdfColors.grey300),
        borderRadius: const pw.BorderRadius.all(pw.Radius.circular(4)),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text(title, style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold, color: PdfColors.blue800)),
          pw.SizedBox(height: 10),
          ...children,
        ],
      ),
    );
  }

  pw.Widget _buildRow(String label, String value) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(vertical: 4),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.SizedBox(width: 120, child: pw.Text('$label:', style: pw.TextStyle(fontSize: 11, fontWeight: pw.FontWeight.bold))),
          pw.Expanded(child: pw.Text(value, style: const pw.TextStyle(fontSize: 11))),
        ],
      ),
    );
  }

  Future<File> _savePdf(pw.Document pdf, String filename) async {
    final directory = await getApplicationDocumentsDirectory();
    final file = File('${directory.path}/$filename.pdf');
    await file.writeAsBytes(await pdf.save());
    return file;
  }

  Future<void> openPdf(File file) async {
    await OpenFile.open(file.path);
  }

  Future<void> sharePdf(File file) async {
    await Share.shareXFiles([XFile(file.path)], text: 'FSSAI Report');
  }

  Future<void> printPdf(File file) async {
    await Printing.layoutPdf(onLayout: (_) => file.readAsBytes());
  }
}
