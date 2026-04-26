import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/syntactic_entity.dart';
import 'package:analyzer_plugin/protocol/protocol_common.dart'
    show AnalysisErrorSeverity;
import '../classification.dart';
import '../constants.dart';
import '../dart_lint.dart';

/// E4: 도메인 레이어(entities/ports/usecases/exceptions)는 인프라 SDK import 금지.
///
/// 테스트 가능성·이식성 보장 — 인프라 접근은 `adapters/`에서만.
/// 금지 목록은 `infraPackages` (dio·http·drift·sqflite·firebase 계열 등).
class E4DomainNoSdkLint extends DartLint {
  @override
  String get code => 'e4_domain_no_sdk';

  @override
  String get message =>
      'External SDK packages must not be imported in domain layers '
      '(entities/, ports/, usecases/, exceptions/).';

  @override
  AnalysisErrorSeverity get severity => AnalysisErrorSeverity.ERROR;

  @override
  String? get correction =>
      'Move infrastructure dependencies to adapters/ and define '
      'abstractions in ports/.';

  @override
  SyntacticEntity? matchLint(AstNode node) {
    if (node is! ImportDirective) return null;

    final filePath = getFilePath(node);
    if (filePath == null) return null;

    final layer = classifyLayer(filePath);
    if (!domainLayers.contains(layer)) return null;

    final importUri = node.uri.stringValue;
    if (importUri == null) return null;

    final packageName = extractImportPackageName(importUri);
    if (packageName == null) return null;

    // Same project imports are fine
    final projectPkg = getProjectPackageName(node);
    if (packageName == projectPkg) return null;

    if (infraPackages.contains(packageName)) {
      return node.uri;
    }

    return null;
  }
}
