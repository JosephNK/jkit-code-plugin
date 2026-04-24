import 'dart:io';

import 'package:analyzer/dart/analysis/analysis_context_collection.dart';
import 'package:analyzer/dart/analysis/results.dart';
import 'package:architecture_lint/architecture_lint.dart';

Future<int> main(List<String> args) async {
  final roots = args.isEmpty ? <String>['.'] : args;
  final lints = createArchitectureLints();

  final absRoots = roots.map((r) => Directory(r).absolute.path).toList();
  final collection = AnalysisContextCollection(includedPaths: absRoots);

  var violations = 0;
  for (final ctx in collection.contexts) {
    for (final path in ctx.contextRoot.analyzedFiles()) {
      if (!path.endsWith('.dart')) continue;
      // 생성 파일 스킵 (freezed, drift, json_serializable, mockito 등)
      if (path.endsWith('.g.dart') ||
          path.endsWith('.freezed.dart') ||
          path.endsWith('.gen.dart') ||
          path.endsWith('.mocks.dart')) {
        continue;
      }

      final result = await ctx.currentSession.getResolvedUnit(path);
      if (result is! ResolvedUnitResult) continue;

      final lineInfo = result.lineInfo;
      final runner = LintRunner(
        lints: lints,
        onMatch: (lint, entity) {
          final loc = lineInfo.getLocation(entity.offset);
          stdout.writeln(
            '$path:${loc.lineNumber}:${loc.columnNumber} '
            '[${lint.code}] ${lint.message}',
          );
          final correction = lint.correction;
          if (correction != null && correction.isNotEmpty) {
            stdout.writeln('  → $correction');
          }
          violations++;
        },
      );
      result.unit.accept(runner);
    }
  }

  if (violations == 0) {
    stdout.writeln('No architecture violations found.');
  } else {
    stdout.writeln('\n$violations violation(s) found.');
  }
  exit(violations > 0 ? 1 : 0);
}
