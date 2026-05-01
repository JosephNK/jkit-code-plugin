import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/syntactic_entity.dart';
import 'package:analyzer_plugin/protocol/protocol_common.dart'
    show AnalysisErrorSeverity;
import '../classification.dart';
import '../constants.dart';
import '../dart_lint.dart';

/// E8: presentation/은 `adapters`/`ports` 직접 import 및 인프라 SDK import 금지 (bloc stack 활성 시 `usecases`도 차단 → bloc 경유 강제).
///
/// UI(pages/views/widgets)는 인프라 SDK(`infraPackages`: dio·sqflite·firebase 등)를
/// 직접 다루지 않는다. bloc stack 활성 시 추가로 `usecases/` 직접 import도 차단되어
/// bloc을 통해서만 도메인 동작을 호출하도록 강제.
/// 허용은 entities/·exceptions/·bloc/(stack 활성 시)·common/·di/·router/ 및 그 외 외부 UI 라이브러리.
class E8PresentationDependencyLint extends DartLint {
  E8PresentationDependencyLint({Set<String> stacks = const {}})
    : _forbidden = {
        'adapters',
        'ports',
        if (stacks.contains('bloc')) 'usecases',
      };

  final Set<String> _forbidden;

  @override
  String get code => 'e8_presentation_dependency';

  @override
  String get message =>
      'presentation/ must not import adapters/, ports/, usecases/, or '
      'infrastructure SDK packages. Go through bloc/ for domain access.';

  @override
  AnalysisErrorSeverity get severity => AnalysisErrorSeverity.ERROR;

  @override
  String? get correction =>
      'Move data access into a bloc/ event handler that calls a UseCase. '
      'Keep presentation/ thin — only widgets, UI state subscription, and '
      'event dispatch.';

  @override
  SyntacticEntity? matchLint(AstNode node) {
    if (node is! ImportDirective) return null;

    final filePath = getFilePath(node);
    if (filePath == null) return null;

    final layer = classifyLayer(filePath);
    if (layer != 'presentation') return null;

    final importUri = node.uri.stringValue;
    if (importUri == null) return null;

    if (isDartImport(importUri)) return null;

    final importPkg = extractImportPackageName(importUri);
    final projectPkg = getProjectPackageName(node);

    // External package — block only infrastructure SDKs.
    if (importPkg != null && importPkg != projectPkg) {
      if (infraPackages.contains(importPkg)) {
        return node.uri;
      }
      return null;
    }

    // Internal import — block forbidden layers.
    final targetLayer = getImportTargetLayer(importUri, filePath, projectPkg);
    if (targetLayer == null) return null;

    if (_forbidden.contains(targetLayer)) {
      return node.uri;
    }

    return null;
  }
}
