import 'dart:io';
import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../services/api_client.dart';
import '../services/location_service.dart';
import '../services/camera_service.dart';

class SubmitComplaintScreen extends StatefulWidget {
  const SubmitComplaintScreen({super.key});

  @override
  State<SubmitComplaintScreen> createState() => _SubmitComplaintScreenState();
}

class _SubmitComplaintScreenState extends State<SubmitComplaintScreen> {
  final ApiClient _api = ApiClient();
  final LocationService _locationService = LocationService();
  final CameraService _cameraService = CameraService();
  final _formKey = GlobalKey<FormState>();
  bool _isSubmitting = false;
  bool _isLoadingLocation = false;

  final _complainantNameController = TextEditingController();
  final _complainantPhoneController = TextEditingController();
  final _complainantEmailController = TextEditingController();
  final _fboNameController = TextEditingController();
  final _fboAddressController = TextEditingController();
  final _descriptionController = TextEditingController();

  Map<String, dynamic>? _location;
  List<File> _evidencePhotos = [];

  @override
  void dispose() {
    _complainantNameController.dispose();
    _complainantPhoneController.dispose();
    _complainantEmailController.dispose();
    _fboNameController.dispose();
    _fboAddressController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _captureLocation() async {
    setState(() => _isLoadingLocation = true);
    try {
      final location = await _locationService.getCurrentLocationWithAddress();
      if (location != null) {
        setState(() {
          _location = location;
          if (_fboAddressController.text.isEmpty && location['address'] != null) {
            _fboAddressController.text = location['address'];
          }
        });
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Could not get location. Please enable GPS.')),
          );
        }
      }
    } finally {
      setState(() => _isLoadingLocation = false);
    }
  }

  Future<void> _capturePhoto() async {
    final photo = await _cameraService.capturePhoto(addWatermark: true);
    if (photo != null) {
      setState(() => _evidencePhotos.add(photo));
    }
  }

  Future<void> _pickPhotos() async {
    final photos = await _cameraService.pickMultipleImages();
    if (photos.isNotEmpty) {
      setState(() => _evidencePhotos.addAll(photos));
    }
  }

  void _removePhoto(int index) {
    setState(() => _evidencePhotos.removeAt(index));
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);

    try {
      final response = await _api.post('/api/complaints/submit', data: {
        'complainantName': _complainantNameController.text,
        'complainantPhone': _complainantPhoneController.text,
        'complainantEmail': _complainantEmailController.text.isNotEmpty 
            ? _complainantEmailController.text : null,
        'fboName': _fboNameController.text,
        'fboAddress': _fboAddressController.text,
        'description': _descriptionController.text,
        'latitude': _location?['latitude'],
        'longitude': _location?['longitude'],
        'gpsAddress': _location?['address'],
      });

      if (response.statusCode == 201 && mounted) {
        final data = response.data as Map<String, dynamic>;
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (context) => AlertDialog(
            title: const Text('Complaint Submitted'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Your complaint has been registered successfully.'),
                const SizedBox(height: 16),
                Text('Tracking Code:', style: TextStyle(color: AppColors.textSecondary)),
                Text(
                  data['trackingCode'] ?? 'N/A',
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                const Text('Save this code to track your complaint status.'),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.pop(context);
                  Navigator.pop(context, true);
                },
                child: const Text('OK'),
              ),
            ],
          ),
        );
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Submit Complaint')),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(Spacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Complainant Details
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(Spacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Your Details', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      const SizedBox(height: Spacing.md),
                      TextFormField(
                        controller: _complainantNameController,
                        decoration: const InputDecoration(labelText: 'Your Name *'),
                        validator: (v) => v?.isEmpty == true ? 'Required' : null,
                      ),
                      const SizedBox(height: Spacing.md),
                      TextFormField(
                        controller: _complainantPhoneController,
                        decoration: const InputDecoration(labelText: 'Phone Number *'),
                        keyboardType: TextInputType.phone,
                        validator: (v) => v?.isEmpty == true ? 'Required' : null,
                      ),
                      const SizedBox(height: Spacing.md),
                      TextFormField(
                        controller: _complainantEmailController,
                        decoration: const InputDecoration(labelText: 'Email (Optional)'),
                        keyboardType: TextInputType.emailAddress,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: Spacing.md),

              // FBO Details
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(Spacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Establishment Details', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      const SizedBox(height: Spacing.md),
                      TextFormField(
                        controller: _fboNameController,
                        decoration: const InputDecoration(labelText: 'Establishment Name *'),
                        validator: (v) => v?.isEmpty == true ? 'Required' : null,
                      ),
                      const SizedBox(height: Spacing.md),
                      TextFormField(
                        controller: _fboAddressController,
                        decoration: const InputDecoration(labelText: 'Address *'),
                        maxLines: 2,
                        validator: (v) => v?.isEmpty == true ? 'Required' : null,
                      ),
                      const SizedBox(height: Spacing.md),
                      ElevatedButton.icon(
                        onPressed: _isLoadingLocation ? null : _captureLocation,
                        icon: _isLoadingLocation 
                            ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                            : const Icon(Icons.my_location),
                        label: Text(_location != null ? 'Location Captured' : 'Capture GPS Location'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _location != null ? AppColors.success : null,
                        ),
                      ),
                      if (_location != null)
                        Padding(
                          padding: const EdgeInsets.only(top: Spacing.sm),
                          child: Text(
                            'GPS: ${_location!['latitude']?.toStringAsFixed(6)}, ${_location!['longitude']?.toStringAsFixed(6)}',
                            style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: Spacing.md),

              // Complaint Description
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(Spacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Complaint Details', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      const SizedBox(height: Spacing.md),
                      TextFormField(
                        controller: _descriptionController,
                        decoration: const InputDecoration(
                          labelText: 'Description *',
                          hintText: 'Describe the food safety issue...',
                        ),
                        maxLines: 5,
                        validator: (v) => v?.isEmpty == true ? 'Required' : null,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: Spacing.md),

              // Evidence Photos
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(Spacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Evidence Photos', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      const SizedBox(height: Spacing.md),
                      Row(
                        children: [
                          ElevatedButton.icon(
                            onPressed: _capturePhoto,
                            icon: const Icon(Icons.camera_alt),
                            label: const Text('Camera'),
                          ),
                          const SizedBox(width: Spacing.md),
                          OutlinedButton.icon(
                            onPressed: _pickPhotos,
                            icon: const Icon(Icons.photo_library),
                            label: const Text('Gallery'),
                          ),
                        ],
                      ),
                      if (_evidencePhotos.isNotEmpty) ...[
                        const SizedBox(height: Spacing.md),
                        SizedBox(
                          height: 100,
                          child: ListView.builder(
                            scrollDirection: Axis.horizontal,
                            itemCount: _evidencePhotos.length,
                            itemBuilder: (context, index) {
                              return Stack(
                                children: [
                                  Container(
                                    margin: const EdgeInsets.only(right: Spacing.sm),
                                    child: ClipRRect(
                                      borderRadius: BorderRadius.circular(8),
                                      child: Image.file(
                                        _evidencePhotos[index],
                                        width: 100,
                                        height: 100,
                                        fit: BoxFit.cover,
                                      ),
                                    ),
                                  ),
                                  Positioned(
                                    top: 4,
                                    right: 12,
                                    child: GestureDetector(
                                      onTap: () => _removePhoto(index),
                                      child: Container(
                                        padding: const EdgeInsets.all(4),
                                        decoration: const BoxDecoration(
                                          color: Colors.red,
                                          shape: BoxShape.circle,
                                        ),
                                        child: const Icon(Icons.close, size: 16, color: Colors.white),
                                      ),
                                    ),
                                  ),
                                ],
                              );
                            },
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: Spacing.xl),

              // Submit Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _submit,
                  child: _isSubmitting
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Submit Complaint'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
