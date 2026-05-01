import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/syntactic_entity.dart';
import 'package:analyzer_plugin/protocol/protocol_common.dart'
    show AnalysisErrorSeverity;
import '../classification.dart';
import '../constants.dart';
import '../dart_lint.dart';

/// E8: presentation/은 `adapters`/`ports` 직접 import 및 인프라 SDK import 금지.
///
/// UI(pages/views/widgets)는 인프라 SDK(`infraPackages`: dio·sqflite·firebase 등)를
/// 직접 다루지 않는다. 허용은 entities/·exceptions/·common/·di/·router/ 및 그 외 외부 UI 라이브러리.
/// stack-specific 추가 차단(예: bloc 경유 강제)은 별도 패키지가 자체 룰로 강제.
class E8PresentationDependencyLint extends DartLint {
  static const _forbidden = <String>{'adapters', 'ports'};

  @override
  String get code => 'e8_presentation_dependency';

  @override
  String get message =>
      'presentation/ must not import adapters/, ports/, or '
      'infrastructure SDK packages.';

  @override
  AnalysisErrorSeverity get severity => AnalysisErrorSeverity.ERROR;

  @override
  String? get correction =>
      'Access data through a state/controller layer that calls a UseCase. '
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
