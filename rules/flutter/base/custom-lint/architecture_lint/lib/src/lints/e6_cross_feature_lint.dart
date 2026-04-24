import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/syntactic_entity.dart';
import 'package:analyzer_plugin/protocol/protocol_common.dart'
    show AnalysisErrorSeverity;
import '../classification.dart';
import '../constants.dart';
import '../dart_lint.dart';

/// E6: feature 간 내부 레이어 cross-import 금지.
///
/// ## 이유
/// `features/<name>/` 구조에서 각 feature는 독립된 모듈이어야 한다. 다른 feature의
/// 내부 구현(ports/adapters/usecases/bloc)에 직접 의존하면:
///   - feature를 제거/이동하기 어려워짐
///   - 순환 의존 위험 증가
///   - 팀 분할 작업 시 충돌 급증
///
/// 기능 간 통신은 DI(의존성 주입) 또는 event bus를 통해 간접적으로.
///
/// ## 금지 타깃 레이어 (다른 feature)
/// crossFeatureForbidden 상수: ports, adapters, usecases, bloc
///
/// ## 예외 (허용)
/// - `entities/` : 공용 도메인 타입은 feature 간 공유 OK
/// - `presentation/` 또는 `bloc/`에서 다른 feature의 `domain/` 레이어 import 허용
///   (사용자 조회 등 읽기 전용 공용 도메인 접근 유연화)
class E6CrossFeatureLint extends DartLint {
  @override
  String get code => 'e6_cross_feature';

  @override
  String get message =>
      'Cross-feature imports of internal layers (ports/, adapters/, '
      'usecases/, bloc/) are not allowed. '
      'Use DI or event bus for cross-feature communication.';

  @override
  AnalysisErrorSeverity get severity => AnalysisErrorSeverity.ERROR;

  @override
  String? get correction =>
      'Share types via entities/, inject dependencies through DI, '
      'or use an event bus for cross-feature communication.';

  @override
  SyntacticEntity? matchLint(AstNode node) {
    if (node is! ImportDirective) return null;

    final filePath = getFilePath(node);
    if (filePath == null) return null;

    final currentFeature = extractFeature(filePath);
    if (currentFeature == null) return null;

    final importUri = node.uri.stringValue;
    if (importUri == null) return null;

    final projectPkg = getProjectPackageName(node);

    final targetFeature = getImportTargetFeature(
      importUri,
      filePath,
      projectPkg,
    );
    if (targetFeature == null || targetFeature == currentFeature) return null;

    final targetLayer = getImportTargetLayer(importUri, filePath, projectPkg);

    // entities/ imports are always allowed across features
    if (targetLayer == 'entities') return null;

    // presentation/bloc may import other features' domain/
    final currentLayer = classifyLayer(filePath);
    if (currentLayer == 'presentation' || currentLayer == 'bloc') {
      if (isImportFromDomain(importUri, filePath, projectPkg)) {
        return null;
      }
    }

    if (targetLayer != null && crossFeatureForbidden.contains(targetLayer)) {
      return node.uri;
    }

    return null;
  }
}
