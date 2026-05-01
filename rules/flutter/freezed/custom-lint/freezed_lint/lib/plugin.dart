import 'package:analysis_server_plugin/plugin.dart';
import 'package:analysis_server_plugin/registry.dart';

import 'src/lints/fz_e1_entities_freezed_lint.dart';
import 'src/lints/fz_e2_bloc_event_state_freezed_lint.dart';
import 'src/lints/fz_e3_usecase_params_freezed_lint.dart';

final class FreezedLintPlugin extends Plugin {
  @override
  String get name => 'freezed_lint';

  @override
  void register(PluginRegistry registry) {
    registry
      ..registerWarningRule(FzE1EntitiesFreezedLint())
      ..registerWarningRule(FzE2BlocEventStateFreezedLint())
      ..registerWarningRule(FzE3UsecaseParamsFreezedLint());
  }
}
