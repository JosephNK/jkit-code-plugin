import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/syntactic_entity.dart';
import 'package:analyzer_plugin/protocol/protocol_common.dart'
    show AnalysisErrorSeverity;
import '../classification.dart';
import '../dart_lint.dart';

/// E2: `entities/`/`ports/`/`exceptions/`만 import 허용 — adapters/bloc/presentation 금지.
///
/// 비즈니스 로직을 인프라/UI에서 분리해 UseCase 단독 단위 테스트 가능 유지.
/// 인프라 의존은 `ports/`로 추상화하고 DI로 `adapters/`를 주입한다.
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
