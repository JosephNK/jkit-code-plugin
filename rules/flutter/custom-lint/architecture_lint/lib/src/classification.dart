import 'package:analyzer/dart/ast/ast.dart';
import 'package:path/path.dart' as p;

/// Directory name to architectural layer mapping.
const _layerMarkers = <String, String>{
  'entities': 'entities',
  'ports': 'ports',
  'usecases': 'usecases',
  'adapters': 'adapters',
  'bloc': 'bloc',
  'exceptions': 'exceptions',
  'pages': 'presentation',
  'views': 'presentation',
  'widgets': 'presentation',
};

/// Classify a file's architectural layer from its path.
String classifyLayer(String filePath) {
  final normalized = '/${filePath.replaceAll('\\', '/')}/';

  for (final entry in _layerMarkers.entries) {
    if (normalized.contains('/${entry.key}/')) {
      return entry.value;
    }
  }

  if (normalized.contains('/common/services/')) {
    return 'common_services';
  }

  return 'other';
}

/// Extract feature name from path like `features/<name>/...`.
String? extractFeature(String filePath) {
  final normalized = filePath.replaceAll('\\', '/');
  final parts = normalized.split('/');

  for (var i = 0; i < parts.length - 1; i++) {
    if (parts[i] == 'features') {
      return parts[i + 1];
    }
  }
  return null;
}

/// Get the absolute file path from an AST node via its CompilationUnit.
String? getFilePath(AstNode node) {
  final unit = node.root;
  if (unit is CompilationUnit) {
    return unit.declaredElement?.source.fullName;
  }
  return null;
}

/// Get the current project's package name from a CompilationUnit.
String? getProjectPackageName(AstNode node) {
  final unit = node.root;
  if (unit is CompilationUnit) {
    final uri = unit.declaredElement?.source.uri;
    if (uri != null && uri.scheme == 'package') {
      return uri.pathSegments.first;
    }
    // Fallback: try from library
    final libraryUri = unit.declaredElement?.library.source.uri;
    if (libraryUri != null && libraryUri.scheme == 'package') {
      return libraryUri.pathSegments.first;
    }
  }
  return null;
}

/// Extract package name from an import URI like `package:dio/dio.dart`.
String? extractImportPackageName(String importUri) {
  if (importUri.startsWith('package:')) {
    return importUri.substring(8).split('/').first;
  }
  return null;
}

/// Check if an import is a Dart SDK import (`dart:core`, etc.).
bool isDartImport(String importUri) {
  return importUri.startsWith('dart:');
}

/// Get the layer of an import that targets the same project.
///
/// For `package:my_app/features/auth/domain/ports/auth_port.dart`,
/// extracts the path after the package prefix and classifies the layer.
String? getImportLayerFromPackageUri(String importUri, String? packageName) {
  if (packageName == null) return null;

  final pkg = extractImportPackageName(importUri);
  if (pkg != packageName) return null;

  final inner = importUri.substring('package:$packageName/'.length);
  return classifyLayer(inner);
}

/// Get the feature of an import that targets the same project.
String? getImportFeatureFromPackageUri(String importUri, String? packageName) {
  if (packageName == null) return null;

  final pkg = extractImportPackageName(importUri);
  if (pkg != packageName) return null;

  final inner = importUri.substring('package:$packageName/'.length);
  return extractFeature(inner);
}

/// Resolve a relative import's layer based on the current file path.
String? resolveRelativeImportLayer(String importUri, String currentFilePath) {
  if (importUri.startsWith('package:') || importUri.startsWith('dart:')) {
    return null;
  }
  final currentDir = p.dirname(currentFilePath);
  final resolved = p.normalize(p.join(currentDir, importUri));
  return classifyLayer(resolved);
}

/// Resolve a relative import's feature based on the current file path.
String? resolveRelativeImportFeature(String importUri, String currentFilePath) {
  if (importUri.startsWith('package:') || importUri.startsWith('dart:')) {
    return null;
  }
  final currentDir = p.dirname(currentFilePath);
  final resolved = p.normalize(p.join(currentDir, importUri));
  if (resolved.startsWith('..')) return null;
  return extractFeature(resolved);
}

/// Get the target layer of an import (handles both package and relative).
String? getImportTargetLayer(
  String importUri,
  String currentFilePath,
  String? packageName,
) {
  final layer = resolveRelativeImportLayer(importUri, currentFilePath);
  if (layer != null) return layer;
  return getImportLayerFromPackageUri(importUri, packageName);
}

/// Get the target feature of an import (handles both package and relative).
String? getImportTargetFeature(
  String importUri,
  String currentFilePath,
  String? packageName,
) {
  final feature = resolveRelativeImportFeature(importUri, currentFilePath);
  if (feature != null) return feature;
  return getImportFeatureFromPackageUri(importUri, packageName);
}

/// Check if a resolved import path contains `/domain/`.
bool isImportFromDomain(
  String importUri,
  String currentFilePath,
  String? packageName,
) {
  if (!importUri.startsWith('package:') && !importUri.startsWith('dart:')) {
    final currentDir = p.dirname(currentFilePath);
    final resolved = p.normalize(p.join(currentDir, importUri));
    return '/$resolved/'.contains('/domain/');
  }
  if (packageName != null) {
    final pkg = extractImportPackageName(importUri);
    if (pkg == packageName) {
      final inner = importUri.substring('package:$packageName/'.length);
      return '/$inner/'.contains('/domain/');
    }
  }
  return false;
}
