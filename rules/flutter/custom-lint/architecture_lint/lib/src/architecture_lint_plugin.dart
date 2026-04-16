import 'package:candies_analyzer_plugin/candies_analyzer_plugin.dart';

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

class ArchitectureLintPlugin extends CandiesAnalyzerPlugin {
  @override
  String get name => 'architecture_lint';

  @override
  List<String> get fileGlobsToAnalyze => const <String>['**/*.dart'];

  @override
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
}
