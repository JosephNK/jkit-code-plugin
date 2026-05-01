import 'package:analyzer/error/listener.dart';
import "package:analyzer/error/error.dart" show ErrorSeverity;
import 'package:custom_lint_builder/custom_lint_builder.dart';
import '../classification.dart';
import '../constants.dart';

/// E8: presentation/은 `adapters`/`ports` 직접 import 및 인프라 SDK import 금지.
///
/// UI(pages/views/widgets)는 인프라 SDK(`infraPackages`: dio·sqflite·firebase 등)를
/// 직접 다루지 않는다. 허용은 entities/·exceptions/·common/·di/·router/ 및 그 외 외부 UI 라이브러리.
/// stack-specific 추가 차단(예: bloc 경유 강제)은 별도 패키지가 자체 룰로 강제.
class E8PresentationDependencyLint extends DartLintRule {
  const E8PresentationDependencyLint() : super(code: _code);

  static const _forbidden = <String>{'adapters', 'ports'};

  static const _code = LintCode(
    name: 'e8_presentation_dependency',
    problemMessage:
        'presentation/ must not import adapters/, ports/, or '
        'infrastructure SDK packages.',
    correctionMessage:
        'Access data through a state/controller layer that calls a UseCase. '
        'Keep presentation/ thin — only widgets, UI state subscription, and '
        'event dispatch.',
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
      if (classifyLayer(filePath) != 'presentation') return;

      final importUri = node.uri.stringValue;
      if (importUri == null) return;

      if (isDartImport(importUri)) return;

      final importPkg = extractImportPackageName(importUri);
      final projectPkg = getProjectPackageName(node);

      // External package — block only infrastructure SDKs.
      if (importPkg != null && importPkg != projectPkg) {
        if (infraPackages.contains(importPkg)) {
          reporter.atNode(node.uri, code);
        }
        return;
      }

      // Internal import — block forbidden layers.
      final targetLayer = getImportTargetLayer(importUri, filePath, projectPkg);
      if (targetLayer == null) return;

      if (_forbidden.contains(targetLayer)) {
        reporter.atNode(node.uri, code);
      }
    });
  }
}
