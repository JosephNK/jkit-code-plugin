import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/syntactic_entity.dart';
import 'package:analyzer_plugin/protocol/protocol_common.dart'
    show AnalysisErrorSeverity;
import '../classification.dart';
import '../constants.dart';
import '../dart_lint.dart';

/// E4: 도메인 레이어에서 외부 인프라 SDK import 금지.
///
/// ## 이유
/// 도메인 레이어는 네트워크/DB/저장소/Firebase 같은 외부 세계와 독립적으로
/// 존재해야 한다. SDK가 도메인에 유입되면:
///   - 단위 테스트가 어려워짐 (mock 대상이 무한정 늘어남)
///   - 패키지 교체 시 도메인까지 수정해야 함
///   - 플랫폼 종속성이 핵심 로직에 침투
///
/// ## 적용 대상 레이어
/// entities/, ports/, usecases/, exceptions/ (domainLayers 상수)
///
/// ## 금지 패키지
/// infraPackages 상수 참조 (dio, http, drift, sqflite, flutter_secure_storage,
/// firebase_*, ...)
/// 인프라 접근은 반드시 adapters/ 레이어에서만 수행하고, 도메인은 ports/ 인터페이스로만
/// 접근한다.
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
