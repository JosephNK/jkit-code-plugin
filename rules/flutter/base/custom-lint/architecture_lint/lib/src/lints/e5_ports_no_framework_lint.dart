import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/syntactic_entity.dart';
import 'package:analyzer_plugin/protocol/protocol_common.dart'
    show AnalysisErrorSeverity;
import '../classification.dart';
import '../constants.dart';
import '../dart_lint.dart';

/// E5: framework 패키지(flutter/dio 등) import 금지 — 시그니처에 framework 타입 노출 차단.
///
/// Port는 추상 인터페이스이므로 도메인 타입만 사용해 구현 교체·테스트 용이성 유지.
/// 금지 목록은 `frameworkPackages` (= `infraPackages` + flutter; BuildContext·dio Response 등 누출 방지).
class E5PortsNoFrameworkLint extends DartLint {
  @override
  String get code => 'e5_ports_no_framework';

  @override
  String get message =>
      'ports/ must not import framework packages (dio, flutter, etc.). '
      'Use domain types only.';

  @override
  AnalysisErrorSeverity get severity => AnalysisErrorSeverity.ERROR;

  @override
  String? get correction =>
      'Define port interfaces using only domain types (entities, '
      'exceptions). Framework types belong in adapters/.';

  @override
  SyntacticEntity? matchLint(AstNode node) {
    if (node is! ImportDirective) return null;

    final filePath = getFilePath(node);
    if (filePath == null) return null;

    final layer = classifyLayer(filePath);
    if (layer != 'ports') return null;

    final importUri = node.uri.stringValue;
    if (importUri == null) return null;

    final packageName = extractImportPackageName(importUri);
    if (packageName == null) return null;

    // Same project imports are fine
    final projectPkg = getProjectPackageName(node);
    if (packageName == projectPkg) return null;

    if (frameworkPackages.contains(packageName)) {
      return node.uri;
    }

    return null;
  }
}
