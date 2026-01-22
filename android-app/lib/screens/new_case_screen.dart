/// New Court Case screen.

import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../services/api_client.dart';

class NewCaseScreen extends StatefulWidget {
  const NewCaseScreen({super.key});

  @override
  State<NewCaseScreen> createState() => _NewCaseScreenState();
}

class _NewCaseScreenState extends State<NewCaseScreen> {
  final ApiClient _api = ApiClient();
  final _formKey = GlobalKey<FormState>();
  bool _isSubmitting = false;

  final _fboNameController = TextEditingController();
  final _fboAddressController = TextEditingController();
  final _courtNameController = TextEditingController();
  final _chargeSectionController = TextEditingController();
  final _descriptionController = TextEditingController();
  DateTime? _filingDate;

  @override
  void dispose() {
    _fboNameController.dispose();
    _fboAddressController.dispose();
    _courtNameController.dispose();
    _chargeSectionController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _selectDate() async {
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (date != null) {
      setState(() => _filingDate = date);
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);

    try {
      final response = await _api.post('/api/court-cases', data: {
        'fboName': _fboNameController.text,
        'fboAddress': _fboAddressController.text,
        'courtName': _courtNameController.text,
        'chargeSection': _chargeSectionController.text,
        'description': _descriptionController.text,
        'filingDate': _filingDate?.toIso8601String(),
        'status': 'pending',
      });

      if (response.statusCode == 201 && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Case created successfully')),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to create case: $e')),
        );
      }
    } finally {
      setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('New Court Case'),
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(Spacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
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
                        controller: _fboAddressController,
                        decoration: const InputDecoration(labelText: 'FBO Address'),
                        maxLines: 2,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: Spacing.md),

              // Case Details
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(Spacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Case Details',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: Spacing.md),
                      TextFormField(
                        controller: _courtNameController,
                        decoration: const InputDecoration(labelText: 'Court Name *'),
                        validator: (v) => v?.isEmpty == true ? 'Required' : null,
                      ),
                      const SizedBox(height: Spacing.md),
                      TextFormField(
                        controller: _chargeSectionController,
                        decoration: const InputDecoration(
                          labelText: 'Charge Section *',
                          hintText: 'e.g., FSSA 2006 Section 59',
                        ),
                        validator: (v) => v?.isEmpty == true ? 'Required' : null,
                      ),
                      const SizedBox(height: Spacing.md),
                      InkWell(
                        onTap: _selectDate,
                        child: InputDecorator(
                          decoration: const InputDecoration(
                            labelText: 'Filing Date',
                            suffixIcon: Icon(Icons.calendar_today),
                          ),
                          child: Text(
                            _filingDate != null
                                ? '${_filingDate!.day}/${_filingDate!.month}/${_filingDate!.year}'
                                : 'Select date',
                            style: TextStyle(
                              color: _filingDate != null ? null : AppColors.textSecondary,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: Spacing.md),
                      TextFormField(
                        controller: _descriptionController,
                        decoration: const InputDecoration(labelText: 'Description'),
                        maxLines: 4,
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
                      : const Text('Create Case'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
