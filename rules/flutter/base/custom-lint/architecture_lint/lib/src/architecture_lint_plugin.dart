import 'package:analyzer/dart/analysis/analysis_context.dart';
import 'package:analyzer/dart/analysis/results.dart';
import 'package:analyzer_plugin/plugin/plugin.dart';
import 'package:analyzer_plugin/protocol/protocol_common.dart' as plugin;
import 'package:analyzer_plugin/protocol/protocol_generated.dart' as plugin;

import 'dart_lint.dart';
import 'runner.dart';

/// 아키텍처 검증용 analyzer_plugin `ServerPlugin` 구현.
///
/// base 룰 12개(E1·E2·E4·E5·E6·E7·E8·N1·N2·N3·S1·S2)를 Dart 파일 AST에
/// 적용하고, 위반 사항을 `AnalysisError`로 변환해 analysis server에 전달한다.
/// stack-specific 룰(예: bloc)은 별도 패키지가 담당.
class ArchitectureLintPlugin extends ServerPlugin {
  ArchitectureLintPlugin({required super.resourceProvider});

  @override
  List<String> get fileGlobsToAnalyze => const <String>['**/*.dart'];

  @override
  String get name => 'architecture_lint';

  @override
  String get version => '1.0.0';

  late final List<DartLint> _lints = createArchitectureLints();

  @override
  Future<void> analyzeFile({
    required AnalysisContext analysisContext,
    required String path,
  }) async {
    if (!path.endsWith('.dart')) return;

    final session = analysisContext.currentSession;
    final unitResult = await session.getResolvedUnit(path);
    if (unitResult is! ResolvedUnitResult) return;

    final lineInfo = unitResult.lineInfo;
    final errors = <plugin.AnalysisError>[];
    final runner = LintRunner(
      lints: _lints,
      onMatch: (lint, entity) {
        final offset = entity.offset;
        final length = entity.length;
        final start = lineInfo.getLocation(offset);
        final end = lineInfo.getLocation(offset + length);
        errors.add(
          plugin.AnalysisError(
            lint.severity,
            plugin.AnalysisErrorType.LINT,
            plugin.Location(
              path,
              offset,
              length,
              start.lineNumber,
              start.columnNumber,
              endLine: end.lineNumber,
              endColumn: end.columnNumber,
            ),
            lint.message,
            lint.code,
            correction: lint.correction,
          ),
        );
      },
    );
    unitResult.unit.accept(runner);

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
