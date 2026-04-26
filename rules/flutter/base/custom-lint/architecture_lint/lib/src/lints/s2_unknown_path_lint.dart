import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/syntactic_entity.dart';
import 'package:analyzer_plugin/protocol/protocol_common.dart'
    show AnalysisErrorSeverity;

import '../classification.dart';
import '../dart_lint.dart';

/// S2: `app/lib/` 안에서 boundary 외 경로 금지 — 구조 일관성 강제.
///
/// `projectBoundaryElements` 패턴에 매칭되지 않는 파일은 `'other'`로 분류되며,
/// `unknownPathIgnores`(부트스트랩/DI/라우터)에도 안 걸리면 위반으로 보고.
/// NestJS `boundaries/no-unknown-files`에 대응. `packages/`, `test/` 등
/// `app/lib/` 외부는 검사 대상이 아니다.
class S2UnknownPathLint extends DartLint {
  @override
  String get code => 's2_unknown_path';

  @override
  String get message =>
      'File is outside any defined architecture boundary. '
      'Move it under a known layer (see lint-rules-structure-reference.md), '
      'or add a new BoundaryElement to boundary_element.dart.';

  @override
  AnalysisErrorSeverity get severity => AnalysisErrorSeverity.ERROR;

  @override
  String? get correction =>
      'Place the file under a boundary-mapped path (e.g. '
      'features/<feature>/{domain,infrastructure,presentation}/, '
      'common/{services,exceptions,env,events,extensions,theme,widgets}/), '
      'or extend projectBoundaryElements / unknownPathIgnores.';

  @override
  SyntacticEntity? matchLint(AstNode node) {
    if (node is! CompilationUnit) return null;

    final filePath = getFilePath(node);
    if (filePath == null) return null;

    if (!isInAppLib(filePath)) return null;
    if (matchesUnknownPathIgnore(filePath)) return null;

    if (classifyLayer(filePath) != 'other') return null;

    return node.beginToken;
  }
}
