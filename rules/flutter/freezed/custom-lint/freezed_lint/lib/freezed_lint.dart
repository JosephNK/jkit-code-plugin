/// JKit Flutter — Freezed Lint Package (freezed convention enforcement)
///
/// `freezed` 컨벤션 스택을 선택한 프로젝트의 추가 룰. `architecture_lint` (base)와
/// 함께 `custom_lint` umbrella 하에서 동작 — 두 패키지가 자동 발견·합성.
///
/// ## 룰 요약 (3종) — ERROR
///
/// - **FZ_E1** `fz_e1_entities_freezed`         : entities/ 클래스는 `@freezed` 필수
/// - **FZ_E2** `fz_e2_bloc_event_state_freezed` : bloc/의 `*Event`/`*State` 클래스는 `@freezed` 필수
/// - **FZ_E3** `fz_e3_usecase_params_freezed`   : usecases/의 `*Params` 클래스는 `@freezed` 필수
library freezed_lint;

import 'package:custom_lint_builder/custom_lint_builder.dart';

import 'src/lints/fz_e1_entities_freezed_lint.dart';
import 'src/lints/fz_e2_bloc_event_state_freezed_lint.dart';
import 'src/lints/fz_e3_usecase_params_freezed_lint.dart';

/// custom_lint entrypoint — freezed 3개 룰 등록.
PluginBase createPlugin() => _FreezedLintPlugin();

class _FreezedLintPlugin extends PluginBase {
  @override
  List<LintRule> getLintRules(CustomLintConfigs configs) => const [
    FzE1EntitiesFreezedLint(),
    FzE2BlocEventStateFreezedLint(),
    FzE3UsecaseParamsFreezedLint(),
  ];
}
