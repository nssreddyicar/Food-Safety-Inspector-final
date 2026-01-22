/// =============================================================================
/// FILE: android-app/lib/widgets/admin_quick_links.dart
/// PURPOSE: Quick action links for admin panel access
/// =============================================================================

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../config/env.dart';

/// Quick link item data
class QuickLink {
  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final String route;
  final bool isExternal;

  const QuickLink({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.route,
    this.isExternal = false,
  });
}

/// Admin quick links widget - displays action cards for common admin tasks
class AdminQuickLinks extends StatelessWidget {
  final Function(String route)? onNavigate;

  const AdminQuickLinks({
    super.key,
    this.onNavigate,
  });

  static const List<QuickLink> _links = [
    QuickLink(
      title: 'Officer Management',
      subtitle: 'Add, edit, or remove officers',
      icon: Icons.people,
      color: Colors.blue,
      route: '/admin/officers',
      isExternal: true,
    ),
    QuickLink(
      title: 'District Configuration',
      subtitle: 'Manage districts and zones',
      icon: Icons.location_city,
      color: Colors.green,
      route: '/admin/districts',
      isExternal: true,
    ),
    QuickLink(
      title: 'Form Configuration',
      subtitle: 'Customize inspection forms',
      icon: Icons.dynamic_form,
      color: Colors.orange,
      route: '/admin/forms',
      isExternal: true,
    ),
    QuickLink(
      title: 'Sample Code Bank',
      subtitle: 'Manage sample codes',
      icon: Icons.qr_code,
      color: Colors.purple,
      route: '/admin/sample-codes',
      isExternal: true,
    ),
    QuickLink(
      title: 'Audit Logs',
      subtitle: 'View system activity logs',
      icon: Icons.history,
      color: Colors.teal,
      route: '/admin/audit-logs',
      isExternal: true,
    ),
    QuickLink(
      title: 'System Settings',
      subtitle: 'Configure system parameters',
      icon: Icons.settings,
      color: Colors.grey,
      route: '/admin/settings',
      isExternal: true,
    ),
    QuickLink(
      title: 'Data Export',
      subtitle: 'Export reports and data',
      icon: Icons.download,
      color: Colors.indigo,
      route: '/admin/export',
      isExternal: true,
    ),
    QuickLink(
      title: 'Analytics',
      subtitle: 'View performance metrics',
      icon: Icons.analytics,
      color: Colors.red,
      route: 'analytics',
      isExternal: false,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Admin Quick Links',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
              TextButton.icon(
                icon: const Icon(Icons.open_in_new, size: 16),
                label: const Text('Open Admin Panel'),
                onPressed: () => _openAdminPanel(context),
              ),
            ],
          ),
        ),
        SizedBox(
          height: 140,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: _links.length,
            itemBuilder: (context, index) => _buildLinkCard(context, _links[index]),
          ),
        ),
      ],
    );
  }

  Widget _buildLinkCard(BuildContext context, QuickLink link) {
    return Container(
      width: 140,
      margin: const EdgeInsets.symmetric(horizontal: 4),
      child: Card(
        elevation: 2,
        child: InkWell(
          onTap: () => _handleTap(context, link),
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: link.color.withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(link.icon, color: link.color, size: 24),
                ),
                const SizedBox(height: 8),
                Text(
                  link.title,
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  link.subtitle,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 10,
                    color: Colors.grey[600],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _handleTap(BuildContext context, QuickLink link) {
    if (link.isExternal) {
      _openExternalLink(context, link.route);
    } else {
      onNavigate?.call(link.route);
    }
  }

  Future<void> _openExternalLink(BuildContext context, String route) async {
    final adminUrl = '${Env.apiBaseUrl}$route';
    final uri = Uri.parse(adminUrl);
    
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        _showSnackBar(context, 'Could not open admin panel');
      }
    } catch (e) {
      _showSnackBar(context, 'Error opening link: $e');
    }
  }

  Future<void> _openAdminPanel(BuildContext context) async {
    final adminUrl = '${Env.apiBaseUrl}/admin';
    final uri = Uri.parse(adminUrl);
    
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        _showSnackBar(context, 'Could not open admin panel');
      }
    } catch (e) {
      _showSnackBar(context, 'Error opening admin panel: $e');
    }
  }

  void _showSnackBar(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }
}

/// Compact version for dashboard
class AdminQuickLinksCompact extends StatelessWidget {
  const AdminQuickLinksCompact({super.key});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.all(16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.admin_panel_settings, color: Colors.blue[700]),
                const SizedBox(width: 8),
                Text(
                  'Admin Controls',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _buildCompactChip(context, 'Officers', Icons.people, '/admin/officers'),
                _buildCompactChip(context, 'Districts', Icons.location_city, '/admin/districts'),
                _buildCompactChip(context, 'Forms', Icons.dynamic_form, '/admin/forms'),
                _buildCompactChip(context, 'Audit Logs', Icons.history, '/admin/audit-logs'),
                _buildCompactChip(context, 'Export', Icons.download, '/admin/export'),
                _buildCompactChip(context, 'Settings', Icons.settings, '/admin/settings'),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCompactChip(BuildContext context, String label, IconData icon, String route) {
    return ActionChip(
      avatar: Icon(icon, size: 16),
      label: Text(label, style: const TextStyle(fontSize: 12)),
      onPressed: () async {
        final adminUrl = '${Env.apiBaseUrl}$route';
        final uri = Uri.parse(adminUrl);
        try {
          if (await canLaunchUrl(uri)) {
            await launchUrl(uri, mode: LaunchMode.externalApplication);
          }
        } catch (e) {
          // Handle error silently
        }
      },
    );
  }
}
