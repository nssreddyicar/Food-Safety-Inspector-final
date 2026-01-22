import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../config/theme.dart';
import '../services/api_client.dart';

class SampleCodeBankScreen extends StatefulWidget {
  const SampleCodeBankScreen({super.key});

  @override
  State<SampleCodeBankScreen> createState() => _SampleCodeBankScreenState();
}

class _SampleCodeBankScreenState extends State<SampleCodeBankScreen> {
  final ApiClient _api = ApiClient();
  List<Map<String, dynamic>> _codes = [];
  bool _isLoading = true;
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _loadCodes();
  }

  Future<void> _loadCodes() async {
    try {
      final response = await _api.get('/api/sample-codes');
      if (response.statusCode == 200) {
        setState(() {
          _codes = List<Map<String, dynamic>>.from(response.data ?? []);
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
        _codes = _getDefaultCodes();
      });
    }
  }

  List<Map<String, dynamic>> _getDefaultCodes() {
    return [
      {'code': 'FSSAI-01', 'category': 'Milk & Dairy', 'description': 'Milk and milk products', 'testParameters': 'Fat, SNF, Adulterants'},
      {'code': 'FSSAI-02', 'category': 'Fats & Oils', 'description': 'Edible oils and fats', 'testParameters': 'FFA, Peroxide value, Adulterants'},
      {'code': 'FSSAI-03', 'category': 'Cereals', 'description': 'Cereals and cereal products', 'testParameters': 'Moisture, Aflatoxin, Pesticides'},
      {'code': 'FSSAI-04', 'category': 'Spices', 'description': 'Spices and condiments', 'testParameters': 'Lead, Aflatoxin, Color additives'},
      {'code': 'FSSAI-05', 'category': 'Beverages', 'description': 'Non-alcoholic beverages', 'testParameters': 'Preservatives, Sweeteners, pH'},
      {'code': 'FSSAI-06', 'category': 'Sweets', 'description': 'Sweets and confectionery', 'testParameters': 'Colors, Heavy metals, Microbiological'},
      {'code': 'FSSAI-07', 'category': 'Meat', 'description': 'Meat and meat products', 'testParameters': 'Species ID, Antibiotics, Microbiological'},
      {'code': 'FSSAI-08', 'category': 'Fish', 'description': 'Fish and fishery products', 'testParameters': 'Formalin, Heavy metals, Histamine'},
      {'code': 'FSSAI-09', 'category': 'Water', 'description': 'Packaged drinking water', 'testParameters': 'TDS, pH, Microbiological, Heavy metals'},
      {'code': 'FSSAI-10', 'category': 'Fruits & Vegetables', 'description': 'Fresh and processed', 'testParameters': 'Pesticide residues, Heavy metals'},
    ];
  }

  List<Map<String, dynamic>> get _filteredCodes {
    if (_searchQuery.isEmpty) return _codes;
    final query = _searchQuery.toLowerCase();
    return _codes.where((c) =>
      c['code'].toString().toLowerCase().contains(query) ||
      c['category'].toString().toLowerCase().contains(query) ||
      c['description'].toString().toLowerCase().contains(query)
    ).toList();
  }

  void _copyCode(String code) {
    Clipboard.setData(ClipboardData(text: code));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Code "$code" copied to clipboard')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Sample Code Bank'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(Spacing.md),
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Search codes...',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
              ),
              onChanged: (value) => setState(() => _searchQuery = value),
            ),
          ),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _filteredCodes.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.search_off, size: 64, color: AppColors.textSecondary),
                            const SizedBox(height: Spacing.md),
                            Text('No codes found', style: TextStyle(color: AppColors.textSecondary)),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _loadCodes,
                        child: ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: Spacing.md),
                          itemCount: _filteredCodes.length,
                          itemBuilder: (context, index) {
                            final code = _filteredCodes[index];
                            return _CodeCard(
                              code: code,
                              onCopy: () => _copyCode(code['code']),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}

class _CodeCard extends StatelessWidget {
  final Map<String, dynamic> code;
  final VoidCallback onCopy;

  const _CodeCard({required this.code, required this.onCopy});

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
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: Spacing.sm, vertical: Spacing.xs),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    code['code'],
                    style: TextStyle(
                      color: AppColors.primary,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'monospace',
                    ),
                  ),
                ),
                const SizedBox(width: Spacing.sm),
                Expanded(
                  child: Text(
                    code['category'],
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.copy, size: 20),
                  onPressed: onCopy,
                  tooltip: 'Copy code',
                ),
              ],
            ),
            const SizedBox(height: Spacing.sm),
            Text(
              code['description'],
              style: TextStyle(color: AppColors.textSecondary),
            ),
            if (code['testParameters'] != null) ...[
              const SizedBox(height: Spacing.sm),
              Row(
                children: [
                  Icon(Icons.science, size: 14, color: AppColors.textSecondary),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      code['testParameters'],
                      style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
