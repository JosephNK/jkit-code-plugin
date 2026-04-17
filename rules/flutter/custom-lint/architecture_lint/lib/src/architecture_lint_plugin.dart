import 'package:analyzer/dart/analysis/analysis_context.dart';
import 'package:analyzer/dart/analysis/results.dart';
import 'package:analyzer/dart/ast/ast.dart';
import 'package:analyzer/dart/ast/visitor.dart';
import 'package:analyzer/source/line_info.dart';
import 'package:analyzer_plugin/plugin/plugin.dart';
import 'package:analyzer_plugin/protocol/protocol_common.dart' as plugin;
import 'package:analyzer_plugin/protocol/protocol_generated.dart' as plugin;

import 'dart_lint.dart';
import 'lints/e1_entities_import_lint.dart';
import 'lints/e2_usecases_dependency_lint.dart';
import 'lints/e3_bloc_dependency_lint.dart';
import 'lints/e4_domain_no_sdk_lint.dart';
import 'lints/e5_ports_no_framework_lint.dart';
import 'lints/e6_cross_feature_lint.dart';
import 'lints/e7_no_bare_catch_lint.dart';
import 'lints/n1_port_naming_lint.dart';
import 'lints/n2_adapter_naming_lint.dart';
import 'lints/n3_usecase_naming_lint.dart';
import 'lints/s1_file_size_lint.dart';

/// 아키텍처 검증용 analyzer_plugin `ServerPlugin` 구현.
///
/// 11개 `DartLint` 규칙(E1~E7, N1~N3, S1)을 각 Dart 파일의 AST에 적용하고,
/// 위반 사항을 `AnalysisError`로 변환해 analysis server에 전달한다.
class ArchitectureLintPlugin extends ServerPlugin {
  ArchitectureLintPlugin({required super.resourceProvider});

  @override
  List<String> get fileGlobsToAnalyze => const <String>['**/*.dart'];

  @override
  String get name => 'architecture_lint';

  @override
  String get version => '1.0.0';

  /// 적용할 린트 규칙 목록.
  List<DartLint> get dartLints => <DartLint>[
    // Architecture rules (E1-E7)
    E1EntitiesImportLint(),
    E2UsecasesDependencyLint(),
    E3BlocDependencyLint(),
    E4DomainNoSdkLint(),
    E5PortsNoFrameworkLint(),
    E6CrossFeatureLint(),
    E7NoBareCatchLint(),
    // Naming rules (N1-N3)
    N1PortNamingLint(),
    N2AdapterNamingLint(),
    N3UseCaseNamingLint(),
    // Size rules (S1)
    S1FileSizeLint(),
  ];

  @override
  Future<void> analyzeFile({
    required AnalysisContext analysisContext,
    required String path,
  }) async {
    if (!path.endsWith('.dart')) return;

    final session = analysisContext.currentSession;
    final unitResult = await session.getResolvedUnit(path);
    if (unitResult is! ResolvedUnitResult) return;

    final errors = <plugin.AnalysisError>[];
    final visitor = _LintVisitor(
      lints: dartLints,
      filePath: path,
      lineInfo: unitResult.lineInfo,
      errors: errors,
    );
    unitResult.unit.accept(visitor);

    channel.sendNotification(
      plugin.AnalysisErrorsParams(path, errors).toNotification(),
    );
  }

  @override
  Future<plugin.AnalysisHandleWatchEventsResult>
  handleAnalysisHandleWatchEvents(
    plugin.AnalysisHandleWatchEventsParams parameters,
  ) async {
    final changed = <String>[];
    for (final event in parameters.events) {
      switch (event.type) {
        case plugin.WatchEventType.ADD:
        case plugin.WatchEventType.MODIFY:
          changed.add(event.path);
        case plugin.WatchEventType.REMOVE:
          // 삭제 파일의 누적 진단을 비운다.
          channel.sendNotification(
            plugin.AnalysisErrorsParams(
              event.path,
              const <plugin.AnalysisError>[],
            ).toNotification(),
          );
      }
    }
    if (changed.isNotEmpty) {
      await contentChanged(changed);
    }
    return plugin.AnalysisHandleWatchEventsResult();
  }
}

/// 각 AST 노드에 대해 모든 `DartLint`의 `matchLint`를 실행하고
/// 반환된 `SyntacticEntity`를 `AnalysisError`로 변환해 수집한다.
class _LintVisitor extends RecursiveAstVisitor<void> {
  _LintVisitor({
    required this.lints,
    required this.filePath,
    required this.lineInfo,
    required this.errors,
  });

  final List<DartLint> lints;
  final String filePath;
  final LineInfo lineInfo;
  final List<plugin.AnalysisError> errors;

  void _runLints(AstNode node) {
    for (final lint in lints) {
      final entity = lint.matchLint(node);
      if (entity == null) continue;

      final offset = entity.offset;
      final length = entity.length;
      final startLoc = lineInfo.getLocation(offset);
      final endLoc = lineInfo.getLocation(offset + length);

      errors.add(
        plugin.AnalysisError(
          lint.severity,
          plugin.AnalysisErrorType.LINT,
          plugin.Location(
            filePath,
            offset,
            length,
            startLoc.lineNumber,
            startLoc.columnNumber,
            endLine: endLoc.lineNumber,
            endColumn: endLoc.columnNumber,
          ),
          lint.message,
          lint.code,
          correction: lint.correction,
        ),
      );
    }
  }

  @override
  void visitCompilationUnit(CompilationUnit node) {
    _runLints(node);
    super.visitCompilationUnit(node);
  }

  @override
  void visitImportDirective(ImportDirective node) {
    _runLints(node);
    super.visitImportDirective(node);
  }

  @override
  void visitClassDeclaration(ClassDeclaration node) {
    _runLints(node);
    super.visitClassDeclaration(node);
  }

  @override
  void visitCatchClause(CatchClause node) {
    _runLints(node);
    super.visitCatchClause(node);
  }
}
