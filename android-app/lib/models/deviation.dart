class Deviation {
  final String id;
  final String? inspectionId;
  final String? categoryId;
  final String? categoryName;
  final String description;
  final String severity;
  final String? legalReference;
  final String? correctiveAction;
  final DateTime? deadline;
  final String status;
  final DateTime createdAt;

  const Deviation({
    required this.id,
    this.inspectionId,
    this.categoryId,
    this.categoryName,
    required this.description,
    required this.severity,
    this.legalReference,
    this.correctiveAction,
    this.deadline,
    required this.status,
    required this.createdAt,
  });

  factory Deviation.fromJson(Map<String, dynamic> json) {
    return Deviation(
      id: json['id'] ?? '',
      inspectionId: json['inspectionId'],
      categoryId: json['categoryId'],
      categoryName: json['category']?['name'] ?? json['categoryName'],
      description: json['description'] ?? '',
      severity: json['severity'] ?? 'minor',
      legalReference: json['legalReference'],
      correctiveAction: json['correctiveAction'],
      deadline: json['deadline'] != null ? DateTime.parse(json['deadline']) : null,
      status: json['status'] ?? 'open',
      createdAt: DateTime.parse(json['createdAt'] ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'inspectionId': inspectionId,
    'categoryId': categoryId,
    'description': description,
    'severity': severity,
    'legalReference': legalReference,
    'correctiveAction': correctiveAction,
    'deadline': deadline?.toIso8601String(),
    'status': status,
  };

  String get severityDisplay {
    switch (severity) {
      case 'critical': return 'Critical';
      case 'major': return 'Major';
      case 'minor': return 'Minor';
      case 'observation': return 'Observation';
      default: return severity;
    }
  }

  String get statusDisplay {
    switch (status) {
      case 'open': return 'Open';
      case 'in_progress': return 'In Progress';
      case 'resolved': return 'Resolved';
      case 'verified': return 'Verified';
      default: return status;
    }
  }
}
