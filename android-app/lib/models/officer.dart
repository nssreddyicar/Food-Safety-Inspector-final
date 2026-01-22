/// =============================================================================
/// FILE: android-app/lib/models/officer.dart
/// PURPOSE: Officer data model
/// =============================================================================

class Officer {
  final String id;
  final String name;
  final String email;
  final String role;
  final String? designation;
  final String? phone;
  final List<JurisdictionAssignment> jurisdictions;
  final JurisdictionAssignment? primaryJurisdiction;

  const Officer({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.designation,
    this.phone,
    required this.jurisdictions,
    this.primaryJurisdiction,
  });

  factory Officer.fromJson(Map<String, dynamic> json) {
    final jurisdictions = (json['jurisdictions'] as List<dynamic>?)
        ?.map((j) => JurisdictionAssignment.fromJson(j))
        .toList() ?? [];
    
    JurisdictionAssignment? primaryJurisdiction;
    if (json['primaryJurisdiction'] != null) {
      primaryJurisdiction = JurisdictionAssignment.fromJson(
        json['primaryJurisdiction'],
      );
    }

    return Officer(
      id: json['id'],
      name: json['name'],
      email: json['email'],
      role: json['role'],
      designation: json['designation'],
      phone: json['phone'],
      jurisdictions: jurisdictions,
      primaryJurisdiction: primaryJurisdiction,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'role': role,
      'designation': designation,
      'phone': phone,
      'jurisdictions': jurisdictions.map((j) => j.toJson()).toList(),
      'primaryJurisdiction': primaryJurisdiction?.toJson(),
    };
  }
}

class JurisdictionAssignment {
  final String jurisdictionId;
  final String jurisdictionName;
  final String roleId;
  final String capacityId;
  final bool isPrimary;

  const JurisdictionAssignment({
    required this.jurisdictionId,
    required this.jurisdictionName,
    required this.roleId,
    required this.capacityId,
    required this.isPrimary,
  });

  factory JurisdictionAssignment.fromJson(Map<String, dynamic> json) {
    return JurisdictionAssignment(
      jurisdictionId: json['jurisdictionId'],
      jurisdictionName: json['jurisdictionName'],
      roleId: json['roleId'],
      capacityId: json['capacityId'],
      isPrimary: json['isPrimary'] ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'jurisdictionId': jurisdictionId,
      'jurisdictionName': jurisdictionName,
      'roleId': roleId,
      'capacityId': capacityId,
      'isPrimary': isPrimary,
    };
  }
}
