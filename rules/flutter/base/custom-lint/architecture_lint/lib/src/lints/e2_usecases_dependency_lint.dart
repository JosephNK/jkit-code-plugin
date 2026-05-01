import 'package:analyzer/error/listener.dart';
import "package:analyzer/error/error.dart" show ErrorSeverity;
import 'package:custom_lint_builder/custom_lint_builder.dart';
import '../classification.dart';

/// E2: `entities/`/`ports/`/`exceptions/`만 import 허용 — adapters/presentation 금지.
///
/// 비즈니스 로직을 인프라/UI에서 분리해 UseCase 단독 단위 테스트 가능 유지.
/// 인프라 의존은 `ports/`로 추상화하고 DI로 `adapters/`를 주입한다.
/// stack-specific 추가 차단(예: bloc)은 별도 패키지가 자체 룰로 강제.
class E2UsecasesDependencyLint extends DartLintRule {
  const E2UsecasesDependencyLint() : super(code: _code);

  // common_services 레이어는 forbidden에서 제외 — value-object/config/state/exception
  // 등 공용 서비스의 보조 타입은 usecase에서 자유롭게 import 가능.
  // (common/services 의 adapter 구현체는 별도 'adapters' 레이어로 분류되어 차단됨)
  static const _forbidden = <String>{'adapters', 'presentation'};

  static const _code = LintCode(
    name: 'e2_usecases_dependency',
    problemMessage:
        'usecases/ must not import adapters/ or presentation/. '
        'Only entities/, ports/, and exceptions/ are allowed.',
    correctionMessage:
        'Inject dependencies through ports/ and use DI to wire adapters.',
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
      if (classifyLayer(filePath) != 'usecases') return;

      final importUri = node.uri.stringValue;
      if (importUri == null) return;

      // External packages are checked by E4, skip here
      final packageName = getProjectPackageName(node);
      final targetLayer = getImportTargetLayer(importUri, filePath, packageName);
      if (targetLayer == null) return;

      if (_forbidden.contains(targetLayer)) {
        reporter.atNode(node.uri, code);
      }
    });
  }
}
