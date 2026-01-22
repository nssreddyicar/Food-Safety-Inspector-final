/// Court Case model for prosecution management.

class CourtCase {
  final String id;
  final String caseNumber;
  final String status;
  final String? fboName;
  final String? fboAddress;
  final String? courtName;
  final String? chargeSection;
  final String? description;
  final DateTime? filingDate;
  final DateTime? nextHearingDate;
  final String? outcome;
  final String? officerId;
  final DateTime createdAt;
  final DateTime? updatedAt;

  CourtCase({
    required this.id,
    required this.caseNumber,
    required this.status,
    this.fboName,
    this.fboAddress,
    this.courtName,
    this.chargeSection,
    this.description,
    this.filingDate,
    this.nextHearingDate,
    this.outcome,
    this.officerId,
    required this.createdAt,
    this.updatedAt,
  });

  factory CourtCase.fromJson(Map<String, dynamic> json) {
    return CourtCase(
      id: json['id'] ?? '',
      caseNumber: json['caseNumber'] ?? '',
      status: json['status'] ?? 'pending',
      fboName: json['fboName'],
      fboAddress: json['fboAddress'],
      courtName: json['courtName'],
      chargeSection: json['chargeSection'],
      description: json['description'],
      filingDate: json['filingDate'] != null ? DateTime.parse(json['filingDate']) : null,
      nextHearingDate: json['nextHearingDate'] != null ? DateTime.parse(json['nextHearingDate']) : null,
      outcome: json['outcome'],
      officerId: json['officerId'],
      createdAt: DateTime.parse(json['createdAt'] ?? DateTime.now().toIso8601String()),
      updatedAt: json['updatedAt'] != null ? DateTime.parse(json['updatedAt']) : null,
    );
  }

  String get statusDisplay {
    switch (status) {
      case 'pending': return 'Pending';
      case 'filed': return 'Filed';
      case 'hearing': return 'In Hearing';
      case 'judgment': return 'Judgment';
      case 'closed': return 'Closed';
      case 'appealed': return 'Appealed';
      default: return status;
    }
  }
}
