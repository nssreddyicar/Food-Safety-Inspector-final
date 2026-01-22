class InspectionAction {
  final String id;
  final String? inspectionId;
  final String? typeId;
  final String? typeName;
  final String description;
  final String? legalBasis;
  final DateTime actionDate;
  final DateTime? followUpDate;
  final String status;
  final String? remarks;
  final DateTime createdAt;

  const InspectionAction({
    required this.id,
    this.inspectionId,
    this.typeId,
    this.typeName,
    required this.description,
    this.legalBasis,
    required this.actionDate,
    this.followUpDate,
    required this.status,
    this.remarks,
    required this.createdAt,
  });

  factory InspectionAction.fromJson(Map<String, dynamic> json) {
    return InspectionAction(
      id: json['id'] ?? '',
      inspectionId: json['inspectionId'],
      typeId: json['typeId'],
      typeName: json['actionType']?['name'] ?? json['typeName'],
      description: json['description'] ?? '',
      legalBasis: json['legalBasis'],
      actionDate: DateTime.parse(json['actionDate'] ?? DateTime.now().toIso8601String()),
      followUpDate: json['followUpDate'] != null ? DateTime.parse(json['followUpDate']) : null,
      status: json['status'] ?? 'pending',
      remarks: json['remarks'],
      createdAt: DateTime.parse(json['createdAt'] ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'inspectionId': inspectionId,
    'typeId': typeId,
    'description': description,
    'legalBasis': legalBasis,
    'actionDate': actionDate.toIso8601String(),
    'followUpDate': followUpDate?.toIso8601String(),
    'status': status,
    'remarks': remarks,
  };

  String get statusDisplay {
    switch (status) {
      case 'pending': return 'Pending';
      case 'issued': return 'Issued';
      case 'acknowledged': return 'Acknowledged';
      case 'complied': return 'Complied';
      case 'escalated': return 'Escalated';
      default: return status;
    }
  }
}
