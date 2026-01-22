/// Institutional Inspection model for FSSAI safety assessments.

class InstitutionalInspection {
  final String id;
  final String inspectionCode;
  final String institutionName;
  final String? institutionAddress;
  final String? institutionTypeId;
  final String? institutionTypeName;
  final String status;
  final int? totalScore;
  final String? riskClassification;
  final DateTime inspectionDate;
  final String? officerId;
  final String? districtId;
  final DateTime createdAt;
  final DateTime? submittedAt;

  InstitutionalInspection({
    required this.id,
    required this.inspectionCode,
    required this.institutionName,
    this.institutionAddress,
    this.institutionTypeId,
    this.institutionTypeName,
    required this.status,
    this.totalScore,
    this.riskClassification,
    required this.inspectionDate,
    this.officerId,
    this.districtId,
    required this.createdAt,
    this.submittedAt,
  });

  factory InstitutionalInspection.fromJson(Map<String, dynamic> json) {
    return InstitutionalInspection(
      id: json['id'] ?? '',
      inspectionCode: json['inspectionCode'] ?? '',
      institutionName: json['institutionName'] ?? '',
      institutionAddress: json['institutionAddress'],
      institutionTypeId: json['institutionTypeId'],
      institutionTypeName: json['institutionType']?['name'],
      status: json['status'] ?? 'draft',
      totalScore: json['totalScore'],
      riskClassification: json['riskClassification'],
      inspectionDate: DateTime.parse(json['inspectionDate'] ?? DateTime.now().toIso8601String()),
      officerId: json['officerId'],
      districtId: json['districtId'],
      createdAt: DateTime.parse(json['createdAt'] ?? DateTime.now().toIso8601String()),
      submittedAt: json['submittedAt'] != null ? DateTime.parse(json['submittedAt']) : null,
    );
  }

  String get statusDisplay {
    switch (status) {
      case 'draft': return 'Draft';
      case 'submitted': return 'Submitted';
      default: return status;
    }
  }

  bool get isSubmitted => status == 'submitted';
}

class Pillar {
  final String id;
  final String name;
  final String? description;
  final int displayOrder;
  final List<Indicator> indicators;

  Pillar({
    required this.id,
    required this.name,
    this.description,
    required this.displayOrder,
    this.indicators = const [],
  });

  factory Pillar.fromJson(Map<String, dynamic> json) {
    return Pillar(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      description: json['description'],
      displayOrder: json['displayOrder'] ?? 0,
      indicators: (json['indicators'] as List<dynamic>?)
          ?.map((i) => Indicator.fromJson(i))
          .toList() ?? [],
    );
  }
}

class Indicator {
  final String id;
  final String pillarId;
  final String name;
  final String? description;
  final int weight;
  final int displayOrder;

  Indicator({
    required this.id,
    required this.pillarId,
    required this.name,
    this.description,
    required this.weight,
    required this.displayOrder,
  });

  factory Indicator.fromJson(Map<String, dynamic> json) {
    return Indicator(
      id: json['id'] ?? '',
      pillarId: json['pillarId'] ?? '',
      name: json['name'] ?? '',
      description: json['description'],
      weight: json['weight'] ?? 1,
      displayOrder: json['displayOrder'] ?? 0,
    );
  }
}

class InstitutionType {
  final String id;
  final String name;
  final String? description;

  InstitutionType({
    required this.id,
    required this.name,
    this.description,
  });

  factory InstitutionType.fromJson(Map<String, dynamic> json) {
    return InstitutionType(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      description: json['description'],
    );
  }
}
