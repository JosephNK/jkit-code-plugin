import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/syntactic_entity.dart';
import 'package:analyzer_plugin/protocol/protocol_common.dart'
    show AnalysisErrorSeverity;
import '../classification.dart';
import '../dart_lint.dart';

/// E2: usecases/ 는 entities/, ports/, exceptions/ 만 import 가능.
///
/// ## 이유
/// UseCase는 비즈니스 로직의 중심이며 구체 구현에 의존하지 않아야 한다.
/// - adapters/ : 구체 구현체를 직접 부르면 DI가 깨진다 (ports를 통해 주입받아야 함)
/// - bloc/ : 역방향 의존 (상위 레이어가 상태 관리자를 알면 안 됨)
/// - presentation/ : UI 의존 금지 (UseCase는 headless)
/// - common_services/ : 전역 서비스 직접 접근 금지 (Port로 추상화)
///
/// UI/인프라 없이도 UseCase가 단독 단위 테스트 가능해야 한다는 게 핵심 원칙.
class E2UsecasesDependencyLint extends DartLint {
  static const _forbidden = <String>{
    'adapters',
    'bloc',
    'presentation',
    'common_services',
  };

  @override
  String get code => 'e2_usecases_dependency';

  @override
  String get message =>
      'usecases/ must not import adapters/, bloc/, or presentation/. '
      'Only entities/, ports/, and exceptions/ are allowed.';

  @override
  AnalysisErrorSeverity get severity => AnalysisErrorSeverity.ERROR;

  @override
  String? get correction =>
      'Inject dependencies through ports/ and use DI to wire adapters.';

  @override
  SyntacticEntity? matchLint(AstNode node) {
    if (node is! ImportDirective) return null;

    final filePath = getFilePath(node);
    if (filePath == null) return null;

    final layer = classifyLayer(filePath);
    if (layer != 'usecases') return null;

    final importUri = node.uri.stringValue;
    if (importUri == null) return null;

    // External packages are checked by E4, skip here
    final packageName = getProjectPackageName(node);
    final targetLayer = getImportTargetLayer(importUri, filePath, packageName);
    if (targetLayer == null) return null;

    if (_forbidden.contains(targetLayer)) {
      return node.uri;
    }

    return null;
  }
}
