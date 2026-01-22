import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../services/api_client.dart';
import '../services/camera_service.dart';

class ScannedNotesScreen extends StatefulWidget {
  const ScannedNotesScreen({super.key});

  @override
  State<ScannedNotesScreen> createState() => _ScannedNotesScreenState();
}

class _ScannedNotesScreenState extends State<ScannedNotesScreen> {
  final ApiClient _api = ApiClient();
  final CameraService _cameraService = CameraService();
  List<Map<String, dynamic>> _notes = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadNotes();
  }

  Future<void> _loadNotes() async {
    try {
      final response = await _api.get('/api/scanned-notes');
      if (response.statusCode == 200) {
        setState(() {
          _notes = List<Map<String, dynamic>>.from(response.data ?? []);
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _scanNote() async {
    final photo = await _cameraService.capturePhoto(addWatermark: false);
    if (photo != null) {
      final title = await showDialog<String>(
        context: context,
        builder: (context) {
          final controller = TextEditingController();
          return AlertDialog(
            title: const Text('Add Note Title'),
            content: TextField(
              controller: controller,
              decoration: const InputDecoration(hintText: 'Enter title...'),
              autofocus: true,
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
              ElevatedButton(
                onPressed: () => Navigator.pop(context, controller.text),
                child: const Text('Save'),
              ),
            ],
          );
        },
      );

      if (title != null && title.isNotEmpty) {
        try {
          await _api.post('/api/scanned-notes', data: {
            'title': title,
            'imagePath': photo.path,
            'scannedAt': DateTime.now().toIso8601String(),
          });
          _loadNotes();
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Note saved')),
            );
          }
        } catch (e) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Failed to save: $e')),
            );
          }
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Scanned Notes')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _notes.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.note_outlined, size: 64, color: AppColors.textSecondary),
                      const SizedBox(height: Spacing.md),
                      Text('No scanned notes yet', style: TextStyle(color: AppColors.textSecondary)),
                      const SizedBox(height: Spacing.md),
                      ElevatedButton.icon(
                        onPressed: _scanNote,
                        icon: const Icon(Icons.camera_alt),
                        label: const Text('Scan a Note'),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadNotes,
                  child: GridView.builder(
                    padding: const EdgeInsets.all(Spacing.md),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      crossAxisSpacing: Spacing.md,
                      mainAxisSpacing: Spacing.md,
                      childAspectRatio: 0.8,
                    ),
                    itemCount: _notes.length,
                    itemBuilder: (context, index) {
                      final note = _notes[index];
                      return _NoteCard(
                        note: note,
                        onTap: () => _viewNote(note),
                      );
                    },
                  ),
                ),
      floatingActionButton: FloatingActionButton(
        onPressed: _scanNote,
        child: const Icon(Icons.camera_alt),
      ),
    );
  }

  void _viewNote(Map<String, dynamic> note) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => NoteDetailScreen(note: note),
      ),
    );
  }
}

class _NoteCard extends StatelessWidget {
  final Map<String, dynamic> note;
  final VoidCallback onTap;

  const _NoteCard({required this.note, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Container(
                width: double.infinity,
                color: AppColors.background,
                child: note['imageUrl'] != null
                    ? Image.network(note['imageUrl'], fit: BoxFit.cover)
                    : const Center(child: Icon(Icons.image, size: 48, color: Colors.grey)),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(Spacing.sm),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    note['title'] ?? 'Untitled',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (note['scannedAt'] != null)
                    Text(
                      _formatDate(DateTime.parse(note['scannedAt'])),
                      style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.day}/${date.month}/${date.year}';
  }
}

class NoteDetailScreen extends StatelessWidget {
  final Map<String, dynamic> note;

  const NoteDetailScreen({super.key, required this.note});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(note['title'] ?? 'Note'),
        actions: [
          IconButton(
            icon: const Icon(Icons.share),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Share feature coming soon')),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.delete),
            onPressed: () async {
              final confirm = await showDialog<bool>(
                context: context,
                builder: (context) => AlertDialog(
                  title: const Text('Delete Note'),
                  content: const Text('Are you sure you want to delete this note?'),
                  actions: [
                    TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
                    TextButton(
                      onPressed: () => Navigator.pop(context, true),
                      child: const Text('Delete', style: TextStyle(color: Colors.red)),
                    ),
                  ],
                ),
              );
              if (confirm == true && context.mounted) {
                Navigator.pop(context, true);
              }
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (note['imageUrl'] != null)
              Image.network(
                note['imageUrl'],
                width: double.infinity,
                fit: BoxFit.contain,
              )
            else
              Container(
                height: 300,
                color: AppColors.background,
                child: const Center(child: Icon(Icons.image, size: 64, color: Colors.grey)),
              ),
            Padding(
              padding: const EdgeInsets.all(Spacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(note['title'] ?? 'Untitled', style: Theme.of(context).textTheme.headlineSmall),
                  const SizedBox(height: Spacing.sm),
                  if (note['scannedAt'] != null)
                    Text(
                      'Scanned: ${DateTime.parse(note['scannedAt']).toString().split('.')[0]}',
                      style: TextStyle(color: AppColors.textSecondary),
                    ),
                  if (note['notes'] != null) ...[
                    const SizedBox(height: Spacing.lg),
                    const Text('Notes', style: TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: Spacing.sm),
                    Text(note['notes']),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
