import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../services/api_client.dart';
import '../services/location_service.dart';

class TourDiaryScreen extends StatefulWidget {
  const TourDiaryScreen({super.key});

  @override
  State<TourDiaryScreen> createState() => _TourDiaryScreenState();
}

class _TourDiaryScreenState extends State<TourDiaryScreen> {
  final ApiClient _api = ApiClient();
  final LocationService _locationService = LocationService();
  List<Map<String, dynamic>> _entries = [];
  bool _isLoading = true;
  DateTime _selectedDate = DateTime.now();

  @override
  void initState() {
    super.initState();
    _loadEntries();
  }

  Future<void> _loadEntries() async {
    try {
      final response = await _api.get('/api/tour-diary', queryParameters: {
        'date': _selectedDate.toIso8601String().split('T')[0],
      });
      if (response.statusCode == 200) {
        setState(() {
          _entries = List<Map<String, dynamic>>.from(response.data ?? []);
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _addEntry() async {
    final location = await _locationService.getCurrentLocationWithAddress();

    final entry = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (context) => _AddEntryDialog(location: location),
    );

    if (entry != null) {
      try {
        await _api.post('/api/tour-diary', data: {
          ...entry,
          'latitude': location?['latitude'],
          'longitude': location?['longitude'],
          'address': location?['address'],
          'date': _selectedDate.toIso8601String(),
        });
        _loadEntries();
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed to add entry: $e')),
          );
        }
      }
    }
  }

  Future<void> _selectDate() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now(),
    );
    if (date != null) {
      setState(() {
        _selectedDate = date;
        _isLoading = true;
      });
      _loadEntries();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tour Diary'),
        actions: [
          TextButton.icon(
            onPressed: _selectDate,
            icon: const Icon(Icons.calendar_today),
            label: Text('${_selectedDate.day}/${_selectedDate.month}/${_selectedDate.year}'),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _entries.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.book_outlined, size: 64, color: AppColors.textSecondary),
                      const SizedBox(height: Spacing.md),
                      Text('No entries for this date', style: TextStyle(color: AppColors.textSecondary)),
                      const SizedBox(height: Spacing.md),
                      ElevatedButton.icon(
                        onPressed: _addEntry,
                        icon: const Icon(Icons.add),
                        label: const Text('Add Entry'),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadEntries,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(Spacing.md),
                    itemCount: _entries.length,
                    itemBuilder: (context, index) {
                      final entry = _entries[index];
                      return _EntryCard(entry: entry);
                    },
                  ),
                ),
      floatingActionButton: FloatingActionButton(
        onPressed: _addEntry,
        child: const Icon(Icons.add),
      ),
    );
  }
}

class _EntryCard extends StatelessWidget {
  final Map<String, dynamic> entry;

  const _EntryCard({required this.entry});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: Spacing.md),
      child: Padding(
        padding: const EdgeInsets.all(Spacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(_getActivityIcon(entry['activityType']), color: AppColors.primary),
                const SizedBox(width: Spacing.sm),
                Expanded(
                  child: Text(
                    entry['activityType'] ?? 'Activity',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
                Text(
                  entry['time'] ?? '',
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                ),
              ],
            ),
            const SizedBox(height: Spacing.sm),
            if (entry['location'] != null)
              Row(
                children: [
                  Icon(Icons.location_on, size: 14, color: AppColors.textSecondary),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      entry['location'],
                      style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                    ),
                  ),
                ],
              ),
            if (entry['notes'] != null) ...[
              const SizedBox(height: Spacing.sm),
              Text(entry['notes'], style: const TextStyle(fontSize: 14)),
            ],
          ],
        ),
      ),
    );
  }

  IconData _getActivityIcon(String? type) {
    switch (type) {
      case 'inspection': return Icons.assignment;
      case 'sample_collection': return Icons.science;
      case 'court_hearing': return Icons.gavel;
      case 'office_work': return Icons.work;
      case 'travel': return Icons.directions_car;
      case 'meeting': return Icons.groups;
      default: return Icons.event;
    }
  }
}

class _AddEntryDialog extends StatefulWidget {
  final Map<String, dynamic>? location;

  const _AddEntryDialog({this.location});

  @override
  State<_AddEntryDialog> createState() => _AddEntryDialogState();
}

class _AddEntryDialogState extends State<_AddEntryDialog> {
  String _activityType = 'inspection';
  final _locationController = TextEditingController();
  final _notesController = TextEditingController();
  TimeOfDay _time = TimeOfDay.now();

  @override
  void initState() {
    super.initState();
    if (widget.location?['address'] != null) {
      _locationController.text = widget.location!['address'];
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Add Diary Entry'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            DropdownButtonFormField<String>(
              value: _activityType,
              decoration: const InputDecoration(labelText: 'Activity Type'),
              items: const [
                DropdownMenuItem(value: 'inspection', child: Text('Inspection')),
                DropdownMenuItem(value: 'sample_collection', child: Text('Sample Collection')),
                DropdownMenuItem(value: 'court_hearing', child: Text('Court Hearing')),
                DropdownMenuItem(value: 'office_work', child: Text('Office Work')),
                DropdownMenuItem(value: 'travel', child: Text('Travel')),
                DropdownMenuItem(value: 'meeting', child: Text('Meeting')),
              ],
              onChanged: (v) => setState(() => _activityType = v!),
            ),
            const SizedBox(height: 16),
            ListTile(
              title: Text('Time: ${_time.format(context)}'),
              trailing: const Icon(Icons.access_time),
              onTap: () async {
                final time = await showTimePicker(context: context, initialTime: _time);
                if (time != null) setState(() => _time = time);
              },
            ),
            TextField(
              controller: _locationController,
              decoration: const InputDecoration(labelText: 'Location'),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _notesController,
              decoration: const InputDecoration(labelText: 'Notes'),
              maxLines: 3,
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: () {
            Navigator.pop(context, {
              'activityType': _activityType,
              'time': '${_time.hour}:${_time.minute.toString().padLeft(2, '0')}',
              'location': _locationController.text,
              'notes': _notesController.text,
            });
          },
          child: const Text('Add'),
        ),
      ],
    );
  }
}
