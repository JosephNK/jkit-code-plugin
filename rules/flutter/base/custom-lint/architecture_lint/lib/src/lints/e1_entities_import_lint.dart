import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/syntactic_entity.dart';
import 'package:analyzer_plugin/protocol/protocol_common.dart'
    show AnalysisErrorSeverity;
import '../classification.dart';
import '../constants.dart';
import '../dart_lint.dart';

/// E1: `entities/`는 codegen annotation 패키지만 import 허용.
///
/// 도메인 순수성 유지 — 외부 런타임 의존성 차단.
/// 허용 목록: `codegenPackages` (constants.dart).
class E1EntitiesImportLint extends DartLint {
  @override
  String get code => 'e1_entities_import';

  @override
  String get message =>
      'entities/ must only import codegen annotations '
      '(freezed_annotation, json_annotation, meta, collection).';

  @override
  AnalysisErrorSeverity get severity => AnalysisErrorSeverity.ERROR;

  @override
  String? get correction =>
      'Remove the import or move this code to the adapters/ layer.';

  @override
  SyntacticEntity? matchLint(AstNode node) {
    if (node is! ImportDirective) return null;

    final filePath = getFilePath(node);
    if (filePath == null) return null;

    final layer = classifyLayer(filePath);
    if (layer != 'entities') return null;

    final importUri = node.uri.stringValue;
    if (importUri == null) return null;

    // dart: imports are always allowed
    if (isDartImport(importUri)) return null;

    // Relative imports (project-internal) are OK
    if (!importUri.startsWith('package:')) return null;

    final packageName = extractImportPackageName(importUri);
    if (packageName == null) return null;

    // Same project imports are allowed
    final projectPackage = getProjectPackageName(node);
    if (packageName == projectPackage) return null;

    // Only codegen packages allowed
    if (codegenPackages.contains(packageName)) return null;

    return node.uri;
  }
}
