import 'package:analyzer/error/listener.dart';
import "package:analyzer/error/error.dart" show ErrorSeverity;
import 'package:custom_lint_builder/custom_lint_builder.dart';
import '../classification.dart';
import '../constants.dart';

/// AL_E6: feature 간 cross-import는 `entities/`와 다른 feature `domain/`만 허용.
///
/// feature 모듈 독립성 보장 — 결합은 entities 수준으로만.
/// 금지 타깃은 `crossFeatureForbidden` (ports·adapters·usecases).
/// 예외: `presentation/`이 다른 feature `domain/` 접근 허용 (DI/이벤트 버스 권장).
/// stack-specific 추가 차단(예: bloc)은 별도 패키지가 자체 룰로 강제.
class AlE6CrossFeatureLint extends DartLintRule {
  const AlE6CrossFeatureLint() : super(code: _code);

  static const _code = LintCode(
    name: 'al_e6_cross_feature',
    problemMessage:
        'Cross-feature imports of internal layers (ports/, adapters/, '
        'usecases/) are not allowed. '
        'Use DI or event bus for cross-feature communication.',
    correctionMessage:
        'Share types via entities/, inject dependencies through DI, '
        'or use an event bus for cross-feature communication.',
    errorSeverity: ErrorSeverity.ERROR,
  );

  @override
  void run(
    CustomLintResolver resolver,
    ErrorReporter reporter,
    CustomLintContext context,
  ) {
    context.registry.addImportDirective((node) {
      final filePath = resolver.path;
      final currentFeature = extractFeature(filePath);
      if (currentFeature == null) return;

      final importUri = node.uri.stringValue;
      if (importUri == null) return;

      final projectPkg = getProjectPackageName(node);

      final targetFeature = getImportTargetFeature(
        importUri,
        filePath,
        projectPkg,
      );
      if (targetFeature == null || targetFeature == currentFeature) return;

      final targetLayer = getImportTargetLayer(importUri, filePath, projectPkg);

      // entities/ imports are always allowed across features
      if (targetLayer == 'entities') return;

      // presentation may import other features' domain/
      final currentLayer = classifyLayer(filePath);
      if (currentLayer == 'presentation') {
        if (isImportFromDomain(importUri, filePath, projectPkg)) {
          return;
        }
      }

      if (targetLayer != null && crossFeatureForbidden.contains(targetLayer)) {
        reporter.atNode(node.uri, code);
      }
    });
  }
}
