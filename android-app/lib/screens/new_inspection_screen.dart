/// New FBO Inspection screen.

import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../services/api_client.dart';

class NewInspectionScreen extends StatefulWidget {
  const NewInspectionScreen({super.key});

  @override
  State<NewInspectionScreen> createState() => _NewInspectionScreenState();
}

class _NewInspectionScreenState extends State<NewInspectionScreen> {
  final ApiClient _api = ApiClient();
  final _formKey = GlobalKey<FormState>();
  bool _isSubmitting = false;
  bool _isLoading = true;

  List<dynamic> _inspectionTypes = [];
  String? _selectedTypeId;

  final _fboNameController = TextEditingController();
  final _fboLicenseController = TextEditingController();
  final _fboAddressController = TextEditingController();
  final _findingsController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadInspectionTypes();
  }

  @override
  void dispose() {
    _fboNameController.dispose();
    _fboLicenseController.dispose();
    _fboAddressController.dispose();
    _findingsController.dispose();
    super.dispose();
  }

  Future<void> _loadInspectionTypes() async {
    try {
      final response = await _api.get('/api/admin/fbo-inspection/types');
      if (response.statusCode == 200) {
        setState(() {
          _inspectionTypes = response.data as List<dynamic>;
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);

    try {
      final response = await _api.post('/api/inspections', data: {
        'fboName': _fboNameController.text,
        'fboLicense': _fboLicenseController.text,
        'fboAddress': _fboAddressController.text,
        'typeId': _selectedTypeId,
        'findings': _findingsController.text,
        'status': 'draft',
      });

      if (response.statusCode == 201 && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Inspection created')),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to create inspection: $e')),
        );
      }
    } finally {
      setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        appBar: AppBar(title: const Text('New Inspection')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('New Inspection'),
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(Spacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Inspection Type
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(Spacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Inspection Type',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: Spacing.md),
                      DropdownButtonFormField<String>(
                        value: _selectedTypeId,
                        decoration: const InputDecoration(labelText: 'Type *'),
                        items: _inspectionTypes.map((t) => DropdownMenuItem(
                          value: t['id'] as String,
                          child: Text(t['name'] as String),
                        )).toList(),
                        onChanged: (value) => setState(() => _selectedTypeId = value),
                        validator: (v) => v == null ? 'Required' : null,
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
                      const Text(
                        'FBO Details',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: Spacing.md),
                      TextFormField(
                        controller: _fboNameController,
                        decoration: const InputDecoration(labelText: 'FBO Name *'),
                        validator: (v) => v?.isEmpty == true ? 'Required' : null,
                      ),
                      const SizedBox(height: Spacing.md),
                      TextFormField(
                        controller: _fboLicenseController,
                        decoration: const InputDecoration(labelText: 'License Number'),
                      ),
                      const SizedBox(height: Spacing.md),
                      TextFormField(
                        controller: _fboAddressController,
                        decoration: const InputDecoration(labelText: 'Address *'),
                        maxLines: 2,
                        validator: (v) => v?.isEmpty == true ? 'Required' : null,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: Spacing.md),

              // Findings
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(Spacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Initial Findings',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: Spacing.md),
                      TextFormField(
                        controller: _findingsController,
                        decoration: const InputDecoration(
                          labelText: 'Observations',
                          hintText: 'Enter initial observations...',
                        ),
                        maxLines: 5,
                      ),
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
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Create Inspection'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
