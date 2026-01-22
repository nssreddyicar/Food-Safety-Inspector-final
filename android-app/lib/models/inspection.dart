/// =============================================================================
/// FILE: android-app/lib/models/inspection.dart
/// PURPOSE: Inspection data model
/// =============================================================================

class Inspection {
  final String id;
  final String? inspectionCode;
  final String? jurisdictionId;
  final String? officerId;
  final String? officerName;
  final String type;
  final String status;
  final String? fboName;
  final String? fboAddress;
  final String? fboLicenseNumber;
  final String? fboLicense;
  final String? findings;
  final String? deviations;
  final String? actionsTaken;
  final DateTime createdAt;
  final DateTime inspectionDate;
  final DateTime? updatedAt;
  final DateTime? closedAt;

  const Inspection({
    required this.id,
    this.inspectionCode,
    this.jurisdictionId,
    this.officerId,
    this.officerName,
    required this.type,
    required this.status,
    this.fboName,
    this.fboAddress,
    this.fboLicenseNumber,
    this.fboLicense,
    this.findings,
    this.deviations,
    this.actionsTaken,
    required this.createdAt,
    required this.inspectionDate,
    this.updatedAt,
    this.closedAt,
  });

  factory Inspection.fromJson(Map<String, dynamic> json) {
    return Inspection(
      id: json['id'] ?? '',
      inspectionCode: json['inspectionCode'],
      jurisdictionId: json['jurisdictionId'],
      officerId: json['officerId'],
      officerName: json['officer']?['name'],
      type: json['type'] ?? json['inspectionType']?['name'] ?? 'Routine',
      status: json['status'] ?? 'draft',
      fboName: json['fboName'],
      fboAddress: json['fboAddress'],
      fboLicenseNumber: json['fboLicenseNumber'],
      fboLicense: json['fboLicenseNumber'] ?? json['fboLicense'],
      findings: json['findings'],
      deviations: json['deviations'],
      actionsTaken: json['actionsTaken'],
      createdAt: DateTime.parse(json['createdAt'] ?? DateTime.now().toIso8601String()),
      inspectionDate: DateTime.parse(json['inspectionDate'] ?? json['createdAt'] ?? DateTime.now().toIso8601String()),
      updatedAt: json['updatedAt'] != null ? DateTime.parse(json['updatedAt']) : null,
      closedAt: json['closedAt'] != null ? DateTime.parse(json['closedAt']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'inspectionCode': inspectionCode,
      'jurisdictionId': jurisdictionId,
      'officerId': officerId,
      'type': type,
      'status': status,
      'fboName': fboName,
      'fboAddress': fboAddress,
      'fboLicenseNumber': fboLicenseNumber,
      'findings': findings,
      'deviations': deviations,
      'actionsTaken': actionsTaken,
      'createdAt': createdAt.toIso8601String(),
      'inspectionDate': inspectionDate.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
      'closedAt': closedAt?.toIso8601String(),
    };
  }

  String get statusDisplay {
    switch (status) {
      case 'draft': return 'Draft';
      case 'scheduled': return 'Scheduled';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      case 'requires_followup': return 'Follow-up';
      case 'closed': return 'Closed';
      default: return status;
    }
  }

  bool get isImmutable => status == 'closed';
  bool get isClosed => status == 'closed';
  bool get canEdit => !isImmutable;
}
