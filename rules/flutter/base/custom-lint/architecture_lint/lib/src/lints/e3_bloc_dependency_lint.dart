import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/syntactic_entity.dart';
import 'package:analyzer_plugin/protocol/protocol_common.dart'
    show AnalysisErrorSeverity;
import '../classification.dart';
import '../constants.dart';
import '../dart_lint.dart';

/// E3: bloc/은 `usecases`/`entities`/`exceptions`만 import — 외부는 `blocAllowedPackages`만 허용.
///
/// Bloc은 얇은 상태 계층 — 데이터 접근은 UseCase에 위임.
/// 외부 패키지는 `blocAllowedPackages` 화이트리스트(`freezed_annotation`,
/// `flutter_leaf_kit/flutter_leaf_kit_state.dart`)에 매칭되는 import만 허용,
/// 그 외(`flutter_bloc` 직접 import, leaf_kit 다른 entry 등)는 모두 위반.
class E3BlocDependencyLint extends DartLint {
  static const _forbidden = <String>{'adapters', 'ports', 'common_services'};

  @override
  String get code => 'e3_bloc_dependency';

  @override
  String get message =>
      'bloc/ may not import adapters/ or ports/ directly, and external '
      'packages must match an entry in blocAllowedPackages.';

  @override
  AnalysisErrorSeverity get severity => AnalysisErrorSeverity.ERROR;

  @override
  String? get correction =>
      'Access data through usecases/ instead of importing adapters/ or '
      'ports/. For external dependencies, use the allowed entry-points '
      '(see blocAllowedPackages).';

  @override
  SyntacticEntity? matchLint(AstNode node) {
    if (node is! ImportDirective) return null;

    final filePath = getFilePath(node);
    if (filePath == null) return null;

    final layer = classifyLayer(filePath);
    if (layer != 'bloc') return null;

    final importUri = node.uri.stringValue;
    if (importUri == null) return null;

    if (isDartImport(importUri)) return null;

    // Check external packages
    final importPkg = extractImportPackageName(importUri);
    final projectPkg = getProjectPackageName(node);

    if (importPkg != null && importPkg != projectPkg) {
      if (matchesPackageEntry(importUri, blocAllowedPackages)) return null;
      return node.uri;
    }

    // Internal import — check layer
    final targetLayer = getImportTargetLayer(importUri, filePath, projectPkg);
    if (targetLayer == null) return null;

    if (_forbidden.contains(targetLayer)) {
      return node.uri;
    }

    return null;
  }
}
