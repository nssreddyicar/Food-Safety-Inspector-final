/// =============================================================================
/// FILE: android-app/lib/services/connectivity_service.dart
/// PURPOSE: Connectivity monitoring with user-facing widgets
/// =============================================================================

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

/// Connectivity state for UI
enum ConnectivityState {
  connected,
  disconnected,
  syncing,
}

/// Connectivity notifier for Riverpod state management
class ConnectivityNotifier extends StateNotifier<ConnectivityState> {
  final Connectivity _connectivity = Connectivity();
  StreamSubscription<List<ConnectivityResult>>? _subscription;
  int _pendingSyncCount = 0;

  ConnectivityNotifier() : super(ConnectivityState.connected) {
    _initialize();
  }

  void _initialize() {
    _connectivity.checkConnectivity().then(_handleConnectivityChange);
    _subscription = _connectivity.onConnectivityChanged.listen(_handleConnectivityChange);
  }

  void _handleConnectivityChange(List<ConnectivityResult> results) {
    final result = results.isNotEmpty ? results.first : ConnectivityResult.none;
    if (result == ConnectivityResult.none) {
      state = ConnectivityState.disconnected;
    } else if (_pendingSyncCount > 0) {
      state = ConnectivityState.syncing;
    } else {
      state = ConnectivityState.connected;
    }
  }

  void setSyncing(int pendingCount) {
    _pendingSyncCount = pendingCount;
    if (_pendingSyncCount > 0 && state != ConnectivityState.disconnected) {
      state = ConnectivityState.syncing;
    } else if (_pendingSyncCount == 0 && state == ConnectivityState.syncing) {
      state = ConnectivityState.connected;
    }
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }
}

/// Provider for connectivity state
final connectivityProvider = StateNotifierProvider<ConnectivityNotifier, ConnectivityState>(
  (ref) => ConnectivityNotifier(),
);

/// Offline banner widget - shows when device is offline
class OfflineBanner extends ConsumerWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final connectivityState = ref.watch(connectivityProvider);
    
    if (connectivityState == ConnectivityState.connected) {
      return const SizedBox.shrink();
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
      color: connectivityState == ConnectivityState.disconnected
          ? Colors.red.shade700
          : Colors.orange.shade700,
      child: SafeArea(
        bottom: false,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              connectivityState == ConnectivityState.disconnected
                  ? Icons.cloud_off
                  : Icons.sync,
              color: Colors.white,
              size: 18,
            ),
            const SizedBox(width: 8),
            Text(
              connectivityState == ConnectivityState.disconnected
                  ? 'No internet connection'
                  : 'Syncing pending changes...',
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Wrapper widget that shows offline banner at top of screen
class ConnectivityWrapper extends StatelessWidget {
  final Widget child;

  const ConnectivityWrapper({
    super.key,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const OfflineBanner(),
        Expanded(child: child),
      ],
    );
  }
}

/// Network-aware button that shows sync status
class NetworkAwareButton extends ConsumerWidget {
  final VoidCallback? onPressed;
  final Widget child;
  final ButtonStyle? style;

  const NetworkAwareButton({
    super.key,
    required this.onPressed,
    required this.child,
    this.style,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final connectivityState = ref.watch(connectivityProvider);
    final isOffline = connectivityState == ConnectivityState.disconnected;

    return ElevatedButton(
      onPressed: onPressed,
      style: style?.copyWith(
        backgroundColor: isOffline 
            ? WidgetStateProperty.all(Colors.grey.shade400)
            : null,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          child,
          if (isOffline) ...[
            const SizedBox(width: 8),
            const Icon(Icons.cloud_off, size: 16),
          ],
        ],
      ),
    );
  }
}
