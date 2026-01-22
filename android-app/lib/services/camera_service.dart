import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:intl/intl.dart';
import 'location_service.dart';

class CameraService {
  static final CameraService _instance = CameraService._internal();
  factory CameraService() => _instance;
  CameraService._internal();

  final ImagePicker _picker = ImagePicker();
  final LocationService _locationService = LocationService();

  Future<File?> capturePhoto({bool addWatermark = true}) async {
    try {
      final XFile? photo = await _picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 85,
        maxWidth: 1920,
        maxHeight: 1080,
      );

      if (photo == null) return null;

      if (addWatermark) {
        return await _addWatermark(File(photo.path));
      }

      return File(photo.path);
    } catch (e) {
      return null;
    }
  }

  Future<File?> pickFromGallery() async {
    try {
      final XFile? image = await _picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 85,
      );
      if (image == null) return null;
      return File(image.path);
    } catch (e) {
      return null;
    }
  }

  Future<List<File>> pickMultipleImages() async {
    try {
      final List<XFile> images = await _picker.pickMultiImage(
        imageQuality: 85,
      );
      return images.map((x) => File(x.path)).toList();
    } catch (e) {
      return [];
    }
  }

  Future<File?> _addWatermark(File imageFile) async {
    try {
      final location = await _locationService.getCurrentLocationWithAddress();
      final timestamp = DateFormat('dd-MM-yyyy HH:mm:ss').format(DateTime.now());

      final watermarkText = [
        'FSSAI Inspection',
        timestamp,
        if (location != null) 'GPS: ${location['latitude']?.toStringAsFixed(6)}, ${location['longitude']?.toStringAsFixed(6)}',
        if (location?['address'] != null) location!['address'],
      ].join('\n');

      final bytes = await imageFile.readAsBytes();
      final codec = await ui.instantiateImageCodec(bytes);
      final frame = await codec.getNextFrame();
      final originalImage = frame.image;

      final recorder = ui.PictureRecorder();
      final canvas = Canvas(recorder);
      final size = Size(originalImage.width.toDouble(), originalImage.height.toDouble());

      canvas.drawImage(originalImage, Offset.zero, Paint());

      final watermarkHeight = size.height * 0.15;
      final watermarkRect = Rect.fromLTWH(0, size.height - watermarkHeight, size.width, watermarkHeight);

      canvas.drawRect(
        watermarkRect,
        Paint()..color = Colors.black.withOpacity(0.6),
      );

      final textPainter = TextPainter(
        text: TextSpan(
          text: watermarkText,
          style: TextStyle(
            color: Colors.white,
            fontSize: watermarkHeight * 0.15,
            fontWeight: FontWeight.w500,
          ),
        ),
        textDirection: TextDirection.ltr,
        maxLines: 5,
      );
      textPainter.layout(maxWidth: size.width - 20);
      textPainter.paint(
        canvas,
        Offset(10, size.height - watermarkHeight + 10),
      );

      final picture = recorder.endRecording();
      final img = await picture.toImage(size.width.toInt(), size.height.toInt());
      final byteData = await img.toByteData(format: ui.ImageByteFormat.png);

      if (byteData == null) return imageFile;

      final directory = await getTemporaryDirectory();
      final filePath = '${directory.path}/watermarked_${DateTime.now().millisecondsSinceEpoch}.png';
      final file = File(filePath);
      await file.writeAsBytes(byteData.buffer.asUint8List());

      return file;
    } catch (e) {
      return imageFile;
    }
  }

  Future<String> saveToAppDirectory(File file, String category) async {
    final directory = await getApplicationDocumentsDirectory();
    final categoryDir = Directory('${directory.path}/$category');
    if (!await categoryDir.exists()) {
      await categoryDir.create(recursive: true);
    }

    final fileName = '${DateTime.now().millisecondsSinceEpoch}_${file.path.split('/').last}';
    final newPath = '${categoryDir.path}/$fileName';
    final savedFile = await file.copy(newPath);
    return savedFile.path;
  }
}
