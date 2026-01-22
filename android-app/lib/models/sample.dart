/// =============================================================================
/// FILE: android-app/lib/models/sample.dart
/// PURPOSE: Sample data model
/// =============================================================================

class Sample {
  final String id;
  final String sampleCode;
  final String? jurisdictionId;
  final String? officerId;
  final String? officerName;
  final String? inspectionId;
  final String? sampleType;
  final String status;
  final String? productName;
  final String? productBrand;
  final String? brand;
  final String? batchNumber;
  final String? quantity;
  final DateTime? manufacturingDate;
  final DateTime? expiryDate;
  final DateTime collectionDate;
  final DateTime? dispatchDate;
  final DateTime? deadlineDate;
  final String? labName;
  final DateTime? labReceiptDate;
  final String? testReportNumber;
  final String? testResult;
  final String? testRemarks;
  final String? collectedFrom;
  final String? collectionLocation;
  final DateTime createdAt;
  final DateTime? updatedAt;

  const Sample({
    required this.id,
    required this.sampleCode,
    this.jurisdictionId,
    this.officerId,
    this.officerName,
    this.inspectionId,
    this.sampleType,
    required this.status,
    this.productName,
    this.productBrand,
    this.brand,
    this.batchNumber,
    this.quantity,
    this.manufacturingDate,
    this.expiryDate,
    required this.collectionDate,
    this.dispatchDate,
    this.deadlineDate,
    this.labName,
    this.labReceiptDate,
    this.testReportNumber,
    this.testResult,
    this.testRemarks,
    this.collectedFrom,
    this.collectionLocation,
    required this.createdAt,
    this.updatedAt,
  });

  factory Sample.fromJson(Map<String, dynamic> json) {
    return Sample(
      id: json['id'] ?? '',
      sampleCode: json['sampleCode'] ?? json['code'] ?? '',
      jurisdictionId: json['jurisdictionId'],
      officerId: json['officerId'],
      officerName: json['officer']?['name'],
      inspectionId: json['inspectionId'],
      sampleType: json['sampleType'],
      status: json['status'] ?? 'collected',
      productName: json['productName'],
      productBrand: json['productBrand'],
      brand: json['productBrand'] ?? json['brand'],
      batchNumber: json['batchNumber'],
      quantity: json['quantity'],
      manufacturingDate: json['manufacturingDate'] != null 
          ? DateTime.parse(json['manufacturingDate']) 
          : null,
      expiryDate: json['expiryDate'] != null 
          ? DateTime.parse(json['expiryDate']) 
          : null,
      collectionDate: DateTime.parse(json['collectionDate'] ?? json['liftedDate'] ?? json['createdAt'] ?? DateTime.now().toIso8601String()),
      dispatchDate: json['dispatchDate'] != null 
          ? DateTime.parse(json['dispatchDate']) 
          : null,
      deadlineDate: json['deadlineDate'] != null 
          ? DateTime.parse(json['deadlineDate']) 
          : (json['dispatchDate'] != null 
              ? DateTime.parse(json['dispatchDate']).add(const Duration(days: 14))
              : null),
      labName: json['labName'],
      labReceiptDate: json['labReceiptDate'] != null
          ? DateTime.parse(json['labReceiptDate'])
          : null,
      testReportNumber: json['testReportNumber'],
      testResult: json['testResult'] ?? json['labResult'],
      testRemarks: json['testRemarks'],
      collectedFrom: json['collectedFrom'],
      collectionLocation: json['collectionLocation'],
      createdAt: DateTime.parse(json['createdAt'] ?? DateTime.now().toIso8601String()),
      updatedAt: json['updatedAt'] != null ? DateTime.parse(json['updatedAt']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'sampleCode': sampleCode,
      'jurisdictionId': jurisdictionId,
      'officerId': officerId,
      'inspectionId': inspectionId,
      'sampleType': sampleType,
      'status': status,
      'productName': productName,
      'productBrand': productBrand,
      'batchNumber': batchNumber,
      'quantity': quantity,
      'manufacturingDate': manufacturingDate?.toIso8601String(),
      'expiryDate': expiryDate?.toIso8601String(),
      'collectionDate': collectionDate.toIso8601String(),
      'dispatchDate': dispatchDate?.toIso8601String(),
      'labName': labName,
      'testResult': testResult,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt?.toIso8601String(),
    };
  }

  String get statusDisplay {
    switch (status) {
      case 'collected': return 'Collected';
      case 'dispatched': return 'Dispatched';
      case 'received': return 'At Lab';
      case 'testing': return 'Testing';
      case 'result_received': return 'Results';
      case 'closed': return 'Closed';
      default: return status;
    }
  }

  static const _immutableStatuses = ['dispatched', 'received', 'testing', 'result_received', 'closed'];
  
  bool get isImmutable => _immutableStatuses.contains(status);
  bool get isDispatched => status == 'dispatched' || _immutableStatuses.contains(status);
  bool get canEdit => !isImmutable;

  int? get daysUntilDeadline {
    if (deadlineDate == null) return null;
    return deadlineDate!.difference(DateTime.now()).inDays;
  }

  bool get isOverdue {
    final days = daysUntilDeadline;
    return days != null && days < 0;
  }
}
