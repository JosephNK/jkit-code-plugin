import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/syntactic_entity.dart';
import 'package:analyzer_plugin/protocol/protocol_common.dart'
    show AnalysisErrorSeverity;
import '../classification.dart';
import '../constants.dart';
import '../dart_lint.dart';

/// E6: feature 간 cross-import는 `entities/`와 다른 feature `domain/`만 허용.
///
/// feature 모듈 독립성 보장 — 결합은 entities 수준으로만.
/// 금지 타깃은 `crossFeatureForbidden` (ports·adapters·usecases·bloc 직접 import).
/// 예외: `presentation/`·`bloc/`이 다른 feature `domain/` 접근 허용 (DI/이벤트 버스 권장).
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
