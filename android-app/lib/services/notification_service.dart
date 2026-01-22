/// =============================================================================
/// FILE: android-app/lib/services/notification_service.dart
/// PURPOSE: Push notification handling for mobile app
/// =============================================================================
///
/// Handles:
/// - Local notifications for reminders and alerts
/// - Push notification token management
/// - Notification permissions
/// - Notification channels (Android)
/// =============================================================================

import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'network_service.dart';

/// Notification types for the app
enum NotificationType {
  inspectionReminder,
  sampleDeadline,
  hearingAlert,
  complaintUpdate,
  systemAlert,
}

/// Notification payload
class AppNotification {
  final String id;
  final String title;
  final String body;
  final NotificationType type;
  final Map<String, dynamic>? data;
  final DateTime timestamp;
  final bool isRead;

  AppNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.type,
    this.data,
    DateTime? timestamp,
    this.isRead = false,
  }) : timestamp = timestamp ?? DateTime.now();

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'body': body,
    'type': type.name,
    'data': data,
    'timestamp': timestamp.toIso8601String(),
    'isRead': isRead,
  };
}

/// Notification state
class NotificationState {
  final bool isEnabled;
  final String? deviceToken;
  final List<AppNotification> notifications;
  final int unreadCount;

  const NotificationState({
    this.isEnabled = false,
    this.deviceToken,
    this.notifications = const [],
    this.unreadCount = 0,
  });

  NotificationState copyWith({
    bool? isEnabled,
    String? deviceToken,
    List<AppNotification>? notifications,
    int? unreadCount,
  }) {
    return NotificationState(
      isEnabled: isEnabled ?? this.isEnabled,
      deviceToken: deviceToken ?? this.deviceToken,
      notifications: notifications ?? this.notifications,
      unreadCount: unreadCount ?? this.unreadCount,
    );
  }
}

/// Notification service provider
final notificationServiceProvider = StateNotifierProvider<NotificationService, NotificationState>(
  (ref) => NotificationService(),
);

/// Notification service
class NotificationService extends StateNotifier<NotificationState> {
  final FlutterLocalNotificationsPlugin _localNotifications = FlutterLocalNotificationsPlugin();
  final _storage = const FlutterSecureStorage();
  final _networkService = NetworkService();
  
  static const String _notificationsEnabledKey = 'notifications_enabled';
  static const String _deviceTokenKey = 'device_token';

  NotificationService() : super(const NotificationState()) {
    _initialize();
  }

  Future<void> _initialize() async {
    // Initialize local notifications
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );
    
    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _localNotifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: _onNotificationTapped,
    );

    // Create notification channels for Android
    await _createNotificationChannels();

    // Load saved state
    final isEnabled = await _storage.read(key: _notificationsEnabledKey) == 'true';
    final deviceToken = await _storage.read(key: _deviceTokenKey);

    state = state.copyWith(
      isEnabled: isEnabled,
      deviceToken: deviceToken,
    );
  }

  Future<void> _createNotificationChannels() async {
    const channels = [
      AndroidNotificationChannel(
        'inspection_reminders',
        'Inspection Reminders',
        description: 'Reminders for upcoming inspections',
        importance: Importance.high,
      ),
      AndroidNotificationChannel(
        'sample_deadlines',
        'Sample Deadlines',
        description: 'Alerts for sample collection deadlines',
        importance: Importance.high,
      ),
      AndroidNotificationChannel(
        'hearing_alerts',
        'Court Hearing Alerts',
        description: 'Reminders for court hearings',
        importance: Importance.max,
      ),
      AndroidNotificationChannel(
        'general',
        'General Notifications',
        description: 'General app notifications',
        importance: Importance.defaultImportance,
      ),
    ];

    final androidPlugin = _localNotifications
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    
    if (androidPlugin != null) {
      for (final channel in channels) {
        await androidPlugin.createNotificationChannel(channel);
      }
    }
  }

  void _onNotificationTapped(NotificationResponse response) {
    debugPrint('Notification tapped: ${response.payload}');
    // Handle navigation based on payload
  }

  /// Request notification permissions
  Future<bool> requestPermission() async {
    final androidPlugin = _localNotifications
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    
    if (androidPlugin != null) {
      final granted = await androidPlugin.requestNotificationsPermission();
      return granted ?? false;
    }

    final iosPlugin = _localNotifications
        .resolvePlatformSpecificImplementation<IOSFlutterLocalNotificationsPlugin>();
    
    if (iosPlugin != null) {
      final granted = await iosPlugin.requestPermissions(
        alert: true,
        badge: true,
        sound: true,
      );
      return granted ?? false;
    }

    return false;
  }

  /// Enable push notifications
  Future<bool> enableNotifications() async {
    final granted = await requestPermission();
    if (!granted) return false;

    await _storage.write(key: _notificationsEnabledKey, value: 'true');
    state = state.copyWith(isEnabled: true);

    // Register device token with backend
    await _registerDeviceToken();

    return true;
  }

  /// Disable push notifications
  Future<void> disableNotifications() async {
    await _storage.write(key: _notificationsEnabledKey, value: 'false');
    state = state.copyWith(isEnabled: false);

    // Unregister device token
    await _unregisterDeviceToken();
  }

  /// Register device token with backend
  Future<void> _registerDeviceToken() async {
    // In production, get token from Firebase Messaging
    // For now, generate a placeholder token
    final token = 'device_${DateTime.now().millisecondsSinceEpoch}';
    
    try {
      await _networkService.post('/api/notifications/register', data: {
        'token': token,
        'platform': defaultTargetPlatform.name,
      });
      
      await _storage.write(key: _deviceTokenKey, value: token);
      state = state.copyWith(deviceToken: token);
    } catch (e) {
      debugPrint('Failed to register device token: $e');
    }
  }

  /// Unregister device token
  Future<void> _unregisterDeviceToken() async {
    final token = state.deviceToken;
    if (token == null) return;

    try {
      await _networkService.post('/api/notifications/unregister', data: {
        'token': token,
      });
      
      await _storage.delete(key: _deviceTokenKey);
      state = state.copyWith(deviceToken: null);
    } catch (e) {
      debugPrint('Failed to unregister device token: $e');
    }
  }

  /// Show local notification
  Future<void> showNotification({
    required String title,
    required String body,
    NotificationType type = NotificationType.systemAlert,
    Map<String, dynamic>? data,
  }) async {
    if (!state.isEnabled) return;

    final channelId = _getChannelId(type);
    
    final androidDetails = AndroidNotificationDetails(
      channelId,
      channelId,
      importance: Importance.high,
      priority: Priority.high,
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    final details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    final id = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    
    await _localNotifications.show(
      id,
      title,
      body,
      details,
      payload: data?.toString(),
    );

    // Add to notifications list
    final notification = AppNotification(
      id: id.toString(),
      title: title,
      body: body,
      type: type,
      data: data,
    );

    state = state.copyWith(
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    );
  }

  /// Schedule a notification
  Future<void> scheduleNotification({
    required String title,
    required String body,
    required DateTime scheduledTime,
    NotificationType type = NotificationType.systemAlert,
    Map<String, dynamic>? data,
  }) async {
    if (!state.isEnabled) return;

    final channelId = _getChannelId(type);
    
    final androidDetails = AndroidNotificationDetails(
      channelId,
      channelId,
      importance: Importance.high,
      priority: Priority.high,
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    final details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    final id = DateTime.now().millisecondsSinceEpoch ~/ 1000;

    await _localNotifications.zonedSchedule(
      id,
      title,
      body,
      _convertToTZDateTime(scheduledTime),
      details,
      androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
      uiLocalNotificationDateInterpretation:
          UILocalNotificationDateInterpretation.absoluteTime,
      payload: data?.toString(),
    );
  }

  /// Mark notification as read
  void markAsRead(String notificationId) {
    final updated = state.notifications.map((n) {
      if (n.id == notificationId && !n.isRead) {
        return AppNotification(
          id: n.id,
          title: n.title,
          body: n.body,
          type: n.type,
          data: n.data,
          timestamp: n.timestamp,
          isRead: true,
        );
      }
      return n;
    }).toList();

    final unreadCount = updated.where((n) => !n.isRead).length;
    state = state.copyWith(notifications: updated, unreadCount: unreadCount);
  }

  /// Mark all as read
  void markAllAsRead() {
    final updated = state.notifications.map((n) => AppNotification(
      id: n.id,
      title: n.title,
      body: n.body,
      type: n.type,
      data: n.data,
      timestamp: n.timestamp,
      isRead: true,
    )).toList();

    state = state.copyWith(notifications: updated, unreadCount: 0);
  }

  /// Clear all notifications
  Future<void> clearAll() async {
    await _localNotifications.cancelAll();
    state = state.copyWith(notifications: [], unreadCount: 0);
  }

  String _getChannelId(NotificationType type) {
    switch (type) {
      case NotificationType.inspectionReminder:
        return 'inspection_reminders';
      case NotificationType.sampleDeadline:
        return 'sample_deadlines';
      case NotificationType.hearingAlert:
        return 'hearing_alerts';
      default:
        return 'general';
    }
  }

  TZDateTime _convertToTZDateTime(DateTime dateTime) {
    // Simplified - in production use timezone package
    return TZDateTime.from(dateTime, local);
  }
}

/// Simplified TZDateTime for local notifications
class TZDateTime {
  final DateTime dateTime;
  TZDateTime.from(this.dateTime, Location location);
}

/// Simplified Location
final local = Location();

class Location {}
