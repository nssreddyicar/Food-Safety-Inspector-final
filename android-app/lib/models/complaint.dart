/// Complaint model for the Food Safety Inspector app.

class Complaint {
  final String id;
  final String complaintCode;
  final String status;
  final String? complaintType;
  final String? complaintNature;
  final String? description;
  final String? complainantName;
  final String? complainantPhone;
  final String? complainantEmail;
  final String? establishmentName;
  final String? establishmentAddress;
  final String? establishmentType;
  final double? latitude;
  final double? longitude;
  final String? assignedOfficerId;
  final String? assignedOfficerName;
  final String? jurisdictionId;
  final DateTime createdAt;
  final DateTime? updatedAt;

  Complaint({
    required this.id,
    required this.complaintCode,
    required this.status,
    this.complaintType,
    this.complaintNature,
    this.description,
    this.complainantName,
    this.complainantPhone,
    this.complainantEmail,
    this.establishmentName,
    this.establishmentAddress,
    this.establishmentType,
    this.latitude,
    this.longitude,
    this.assignedOfficerId,
    this.assignedOfficerName,
    this.jurisdictionId,
    required this.createdAt,
    this.updatedAt,
  });

  factory Complaint.fromJson(Map<String, dynamic> json) {
    return Complaint(
      id: json['id'] ?? '',
      complaintCode: json['complaintCode'] ?? '',
      status: json['status'] ?? 'new',
      complaintType: json['complaintType'],
      complaintNature: json['complaintNature'],
      description: json['description'],
      complainantName: json['complainantName'],
      complainantPhone: json['complainantPhone'],
      complainantEmail: json['complainantEmail'],
      establishmentName: json['establishmentName'],
      establishmentAddress: json['establishmentAddress'],
      establishmentType: json['establishmentType'],
      latitude: json['latitude']?.toDouble(),
      longitude: json['longitude']?.toDouble(),
      assignedOfficerId: json['assignedOfficerId'],
      assignedOfficerName: json['assignedOfficer']?['name'],
      jurisdictionId: json['jurisdictionId'],
      createdAt: DateTime.parse(json['createdAt'] ?? DateTime.now().toIso8601String()),
      updatedAt: json['updatedAt'] != null ? DateTime.parse(json['updatedAt']) : null,
    );
  }

  String get statusDisplay {
    switch (status) {
      case 'new': return 'New';
      case 'assigned': return 'Assigned';
      case 'investigating': return 'Investigating';
      case 'resolved': return 'Resolved';
      case 'closed': return 'Closed';
      default: return status;
    }
  }
}
