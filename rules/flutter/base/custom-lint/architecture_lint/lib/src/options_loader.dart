import 'dart:io';

import 'package:yaml/yaml.dart';

/// `analysis_options.yaml`의 `architecture_lint.stacks` 항목을 `Set<String>`으로 파싱.
///
/// 형식:
/// ```yaml
/// architecture_lint:
///   stacks:
///     - bloc
/// ```
///
/// 파일 없음/키 없음/타입 mismatch/파싱 실패는 모두 [defaultStacks]로 fall back.
/// 마이그레이션 안전성 우선 — 옵션을 명시하지 않은 프로젝트는 기존 동작 유지.
/// analyzer_plugin과 CLI(bin/lint.dart)가 공유하는 단일 진입점.
Set<String> loadStacks(
  String? optionsPath, {
  Set<String> defaultStacks = const {'bloc'},
}) {
  if (optionsPath == null) return defaultStacks;
  final file = File(optionsPath);
  if (!file.existsSync()) return defaultStacks;

  try {
    final yaml = loadYaml(file.readAsStringSync());
    if (yaml is! YamlMap) return defaultStacks;

    final section = yaml['architecture_lint'];
    if (section is! YamlMap) return defaultStacks;

    final stacks = section['stacks'];
    if (stacks is! YamlList) return defaultStacks;

    return stacks.whereType<String>().toSet();
  } on YamlException {
    return defaultStacks;
  } on FileSystemException {
    return defaultStacks;
  }
}
