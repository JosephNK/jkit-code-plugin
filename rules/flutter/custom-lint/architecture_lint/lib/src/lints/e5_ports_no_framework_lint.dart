import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/syntactic_entity.dart';
import 'package:analyzer_plugin/protocol/protocol_common.dart'
    show AnalysisErrorSeverity;
import '../classification.dart';
import '../constants.dart';
import '../dart_lint.dart';

/// E5: ports/ 레이어는 프레임워크 패키지 import 금지.
///
/// ## 이유
/// Port는 도메인과 어댑터 사이의 "계약" 인터페이스다. 계약 자체가 특정 프레임워크
/// 타입(예: flutter의 BuildContext, dio의 Response)에 의존하면:
///   - 다른 구현체(예: Mock, 다른 HTTP 클라이언트)로 교체가 불가능해짐
///   - 도메인이 간접적으로 프레임워크를 알게 됨 (캡슐화 깨짐)
///
/// ## 금지 패키지
/// frameworkPackages 상수 = infraPackages + flutter
/// (E4보다 더 엄격하게 flutter 자체도 차단)
///
/// ## 허용
/// - dart: 기본 라이브러리
/// - 같은 프로젝트 내 imports (entities, exceptions 참조 가능)
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
