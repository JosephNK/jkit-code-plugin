/// Codegen-only packages allowed in entities layer.
const codegenPackages = <String>{
  'freezed_annotation',
  'json_annotation',
  'meta',
  'collection',
};

/// Packages allowed in bloc layer (state management + codegen).
const blocAllowedPackages = <String>{
  ...codegenPackages,
  'flutter_bloc',
  'bloc',
  'equatable',
};

/// Infrastructure packages forbidden in domain layers.
const infraPackages = <String>{
  // Remote API
  'dio',
  'http',
  'retrofit',
  'chopper',
  // Local DB
  'drift',
  'sqflite',
  'isar',
  'hive',
  'hive_flutter',
  'floor',
  'objectbox',
  // Storage
  'flutter_secure_storage',
  'shared_preferences',
  // Firebase
  'firebase_core',
  'firebase_auth',
  'firebase_messaging',
  'cloud_firestore',
};

/// Framework packages forbidden in ports.
const frameworkPackages = <String>{...infraPackages, 'flutter'};

/// Domain layers where no external SDK is allowed.
const domainLayers = <String>{'entities', 'ports', 'usecases', 'exceptions'};

/// Internal layers forbidden for cross-feature imports.
const crossFeatureForbidden = <String>{'ports', 'adapters', 'usecases', 'bloc'};

/// Maximum file line count.
const maxFileLines = 800;
