import 'package:analyzer/error/listener.dart';
import 'package:analyzer/error/error.dart' show ErrorSeverity;
import 'package:custom_lint_builder/custom_lint_builder.dart';

import '../constants.dart';
import '../helpers.dart';

/// LK_E3: bloc/은 `blocAllowedPackages` + `leafKitBlocAllowed` entrypoint만 허용 — `adapters/`/`ports/` 직접 import 차단.
///
/// bloc은 상태 관리 + 이벤트 처리만 담당 — 인프라(`adapters/`)/추상 인터페이스
/// (`ports/`) 직접 의존 시 책임 분리 위반. 데이터 접근은 UseCase 경유.
class LkE3BlocDependencyLint extends DartLintRule {
  const LkE3BlocDependencyLint() : super(code: _code);

  static const _forbidden = <String>{'adapters', 'ports'};

  static const _code = LintCode(
    name: 'lk_e3_bloc_dependency',
    problemMessage:
        'bloc/ may only import flutter, flutter_bloc, bloc, equatable, meta, '
        'collection, or flutter_leaf_kit_state.dart / flutter_leaf_kit_core.dart. '
        'adapters/ and ports/ direct imports are not allowed.',
    correctionMessage:
        'Inject UseCase via constructor and call it from bloc — '
        'never reach for adapters/ or ports/ directly.',
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
      if (!isBlocFile(filePath)) return;

      final importUri = node.uri.stringValue;
      if (importUri == null) return;
      if (isDartImport(importUri)) return;

      final importPkg = extractImportPackageName(importUri);
      final projectPkg = getProjectPackageName(node);

      // External package — must match whitelist or leaf_kit allowed entry.
      if (importPkg != null && importPkg != projectPkg) {
        if (matchesPackageEntry(importUri, leafKitBlocAllowed)) return;
        if (blocAllowedPackages.contains(importPkg)) return;
        reporter.atNode(node.uri, code);
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
