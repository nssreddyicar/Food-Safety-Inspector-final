class Evidence {
  final String id;
  final String? complaintId;
  final String? inspectionId;
  final String type;
  final String filename;
  final String? originalName;
  final String? url;
  final String? mimeType;
  final int? size;
  final String? description;
  final double? latitude;
  final double? longitude;
  final String? address;
  final DateTime? capturedAt;
  final DateTime createdAt;

  const Evidence({
    required this.id,
    this.complaintId,
    this.inspectionId,
    required this.type,
    required this.filename,
    this.originalName,
    this.url,
    this.mimeType,
    this.size,
    this.description,
    this.latitude,
    this.longitude,
    this.address,
    this.capturedAt,
    required this.createdAt,
  });

  factory Evidence.fromJson(Map<String, dynamic> json) {
    return Evidence(
      id: json['id'] ?? '',
      complaintId: json['complaintId'],
      inspectionId: json['inspectionId'],
      type: json['type'] ?? 'photo',
      filename: json['filename'] ?? '',
      originalName: json['originalName'],
      url: json['url'],
      mimeType: json['mimeType'],
      size: json['size'],
      description: json['description'],
      latitude: json['latitude']?.toDouble(),
      longitude: json['longitude']?.toDouble(),
      address: json['address'],
      capturedAt: json['capturedAt'] != null ? DateTime.parse(json['capturedAt']) : null,
      createdAt: DateTime.parse(json['createdAt'] ?? DateTime.now().toIso8601String()),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'complaintId': complaintId,
    'inspectionId': inspectionId,
    'type': type,
    'filename': filename,
    'originalName': originalName,
    'url': url,
    'mimeType': mimeType,
    'size': size,
    'description': description,
    'latitude': latitude,
    'longitude': longitude,
    'address': address,
    'capturedAt': capturedAt?.toIso8601String(),
  };

  bool get isImage => mimeType?.startsWith('image/') ?? type == 'photo';
  bool get isPdf => mimeType == 'application/pdf' || type == 'document';
  bool get hasLocation => latitude != null && longitude != null;

  String get typeDisplay {
    switch (type) {
      case 'photo': return 'Photo';
      case 'document': return 'Document';
      case 'video': return 'Video';
      case 'audio': return 'Audio';
      default: return type;
    }
  }

  String get sizeDisplay {
    if (size == null) return '';
    if (size! < 1024) return '$size B';
    if (size! < 1024 * 1024) return '${(size! / 1024).toStringAsFixed(1)} KB';
    return '${(size! / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
}
