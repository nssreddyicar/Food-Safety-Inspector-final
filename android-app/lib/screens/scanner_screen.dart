/// =============================================================================
/// FILE: android-app/lib/screens/scanner_screen.dart
/// PURPOSE: QR/Barcode scanner screen
/// =============================================================================

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/theme.dart';

class ScannerScreen extends ConsumerStatefulWidget {
  const ScannerScreen({super.key});

  @override
  ConsumerState<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends ConsumerState<ScannerScreen> {
  bool _isFlashOn = false;
  String? _lastScannedCode;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Scanner'),
        actions: [
          IconButton(
            icon: Icon(_isFlashOn ? Icons.flash_on : Icons.flash_off),
            onPressed: () {
              setState(() {
                _isFlashOn = !_isFlashOn;
              });
              // TODO: Toggle flash on camera
            },
          ),
          IconButton(
            icon: const Icon(Icons.history),
            onPressed: () {
              // TODO: Navigate to scanned notes
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Camera preview placeholder
          Expanded(
            flex: 3,
            child: Container(
              margin: const EdgeInsets.all(Spacing.md),
              decoration: BoxDecoration(
                color: Colors.black,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // TODO: Replace with actual camera preview
                  // MobileScanner widget from mobile_scanner package
                  const Center(
                    child: Text(
                      'Camera Preview\n(Enable camera permission)',
                      style: TextStyle(color: Colors.white),
                      textAlign: TextAlign.center,
                    ),
                  ),
                  // Scan frame overlay
                  CustomPaint(
                    size: const Size(250, 250),
                    painter: _ScanFramePainter(),
                  ),
                ],
              ),
            ),
          ),
          
          // Instructions and result
          Expanded(
            flex: 2,
            child: Container(
              padding: const EdgeInsets.all(Spacing.lg),
              child: Column(
                children: [
                  Text(
                    'Point camera at QR code or barcode',
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: Spacing.lg),
                  
                  if (_lastScannedCode != null) ...[
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(Spacing.md),
                      decoration: BoxDecoration(
                        color: AppColors.success.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.success),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(Icons.check_circle, color: AppColors.success),
                              const SizedBox(width: Spacing.sm),
                              Text(
                                'Code Scanned',
                                style: TextStyle(
                                  color: AppColors.success,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: Spacing.sm),
                          Text(
                            _lastScannedCode!,
                            style: const TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: Spacing.md),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () {
                              // TODO: Copy to clipboard
                            },
                            icon: const Icon(Icons.copy),
                            label: const Text('Copy'),
                          ),
                        ),
                        const SizedBox(width: Spacing.md),
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: () {
                              // TODO: Save note
                            },
                            icon: const Icon(Icons.save),
                            label: const Text('Save'),
                          ),
                        ),
                      ],
                    ),
                  ] else ...[
                    // Quick actions
                    Wrap(
                      spacing: Spacing.md,
                      runSpacing: Spacing.md,
                      alignment: WrapAlignment.center,
                      children: [
                        _QuickActionChip(
                          icon: Icons.qr_code,
                          label: 'QR Code',
                          isSelected: true,
                        ),
                        _QuickActionChip(
                          icon: Icons.document_scanner,
                          label: 'Barcode',
                          isSelected: true,
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ScanFramePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.primary
      ..strokeWidth = 4
      ..style = PaintingStyle.stroke;

    const cornerLength = 30.0;
    final rect = Rect.fromLTWH(0, 0, size.width, size.height);

    // Top left corner
    canvas.drawLine(rect.topLeft, Offset(cornerLength, 0), paint);
    canvas.drawLine(rect.topLeft, Offset(0, cornerLength), paint);

    // Top right corner
    canvas.drawLine(rect.topRight, Offset(size.width - cornerLength, 0), paint);
    canvas.drawLine(rect.topRight, Offset(size.width, cornerLength), paint);

    // Bottom left corner
    canvas.drawLine(rect.bottomLeft, Offset(cornerLength, size.height), paint);
    canvas.drawLine(rect.bottomLeft, Offset(0, size.height - cornerLength), paint);

    // Bottom right corner
    canvas.drawLine(rect.bottomRight, Offset(size.width - cornerLength, size.height), paint);
    canvas.drawLine(rect.bottomRight, Offset(size.width, size.height - cornerLength), paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _QuickActionChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isSelected;

  const _QuickActionChip({
    required this.icon,
    required this.label,
    required this.isSelected,
  });

  @override
  Widget build(BuildContext context) {
    return Chip(
      avatar: Icon(
        icon,
        size: 18,
        color: isSelected ? AppColors.primary : AppColors.textSecondary,
      ),
      label: Text(label),
      backgroundColor: isSelected
          ? AppColors.primary.withOpacity(0.1)
          : Colors.grey.shade200,
    );
  }
}
