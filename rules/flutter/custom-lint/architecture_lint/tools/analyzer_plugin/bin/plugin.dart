import 'dart:isolate';

import 'package:architecture_lint/architecture_lint.dart';
import 'package:candies_analyzer_plugin/candies_analyzer_plugin.dart';

CandiesAnalyzerPlugin get plugin => ArchitectureLintPlugin();

void main(List<String> args, SendPort sendPort) {
  CandiesAnalyzerPluginStarter.start(args, sendPort, plugin: plugin);
}
