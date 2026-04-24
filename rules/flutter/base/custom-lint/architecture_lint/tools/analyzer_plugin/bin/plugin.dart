import 'dart:isolate';

import 'package:analyzer/file_system/physical_file_system.dart';
import 'package:analyzer_plugin/starter.dart';
import 'package:architecture_lint/architecture_lint.dart';

void main(List<String> args, SendPort sendPort) {
  ServerPluginStarter(
    ArchitectureLintPlugin(
      resourceProvider: PhysicalResourceProvider.INSTANCE,
    ),
  ).start(sendPort);
}
