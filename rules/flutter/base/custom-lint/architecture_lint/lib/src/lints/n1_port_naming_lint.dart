import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/syntactic_entity.dart';
import 'package:analyzer_plugin/protocol/protocol_common.dart'
    show AnalysisErrorSeverity;
import '../classification.dart';
import '../dart_lint.dart';

/// N1: ports/ 레이어의 클래스는 이름이 `Port`로 끝나야 한다.
///
/// ## 이유
/// 아키텍처 레이어의 역할을 클래스 이름만 봐도 파악할 수 있게 하여,
/// 검색/IDE 탐색/코드 리뷰 효율을 높인다. 예: `AuthPort`, `UserRepositoryPort`.
///
/// 네이밍 일관성은 자동화된 DI 설정(예: 이름 기반 바인딩) 및 대규모 리팩토링에도 유리.
///
/// ## 심각도
/// WARNING — 아키텍처 실패는 아니지만 컨벤션 위반으로 경고.
class N1PortNamingLint extends DartLint {
  @override
  String get code => 'n1_port_naming';

  @override
  String get message => "Port classes must end with 'Port'.";

  @override
  AnalysisErrorSeverity get severity => AnalysisErrorSeverity.WARNING;

  @override
  String? get correction =>
      "Rename the class to end with 'Port' "
      "(e.g., AuthPort, UserRepositoryPort).";

  @override
  SyntacticEntity? matchLint(AstNode node) {
    if (node is! ClassDeclaration) return null;

    final filePath = getFilePath(node);
    if (filePath == null) return null;

    final layer = classifyLayer(filePath);
    if (layer != 'ports') return null;

    final name = node.namePart.typeName;
    if (!name.lexeme.endsWith('Port')) {
      return name;
    }

    return null;
  }
}
