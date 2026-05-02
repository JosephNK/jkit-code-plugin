#!/usr/bin/env node
// Flutter Screen 템플릿 생성 스크립트

import process from 'node:process';

function toSnakeCase(name) {
  let out = '';
  for (let i = 0; i < name.length; i++) {
    const ch = name[i];
    if (ch >= 'A' && ch <= 'Z' && i > 0) {
      out += '_';
    }
    out += ch.toLowerCase();
  }
  return out;
}

function generateScreen(screenNameIn, options = {}) {
  let screenName = screenNameIn;
  if (!screenName.endsWith('Screen')) {
    screenName = `${screenName}Screen`;
  }

  const blocName = screenName.slice(0, -6);
  const blocSnake = toSnakeCase(blocName);

  const { pkg, featureDir } = options;
  const useAbs = Boolean(pkg && featureDir);
  const blocImport = useAbs
    ? `package:${pkg}/features/${featureDir}/presentation/bloc/${blocSnake}_bloc.dart`
    : `../bloc/${blocSnake}_bloc.dart`;
  const appBarImport = useAbs
    ? `package:${pkg}/features/${featureDir}/presentation/views/${blocSnake}_app_bar.dart`
    : `../views/${blocSnake}_app_bar.dart`;
  const bodyImport = useAbs
    ? `package:${pkg}/features/${featureDir}/presentation/views/${blocSnake}_body_view.dart`
    : `../views/${blocSnake}_body_view.dart`;

  return `import 'package:flutter/material.dart';
import 'package:flutter_leaf_kit/flutter_leaf_kit.dart';

import '${blocImport}';
import '${appBarImport}';
import '${bodyImport}';

class ${screenName} extends LeafScreenStatefulWidget {
  const ${screenName}({super.key});

  @override
  State<${screenName}> createState() => _${screenName}State();
}

class _${screenName}State extends LeafScreenState<${screenName}> {
  @override
  Color? get backgroundColor => null;

  @override
  Widget? buildScreen(BuildContext context) {
    return BlocScreenConsumer<${blocName}Bloc, ${blocName}State>(
      builder: buildScaffold,
      successListener: (context, state) {},
    );
  }

  @override
  PreferredSizeWidget? buildAppBar(BuildContext context, Object? state) {
    return const ${blocName}AppBar();
  }

  @override
  Widget buildBody(BuildContext context, Object? state) {
    return const ${blocName}BodyView();
  }
}
`;
}

function parseArgs(argv) {
  const opts = { screenName: '', pkg: '', featureDir: '' };
  const rest = [...argv];
  while (rest.length > 0) {
    const a = rest.shift();
    if (a === '--package' || a === '-p') {
      opts.pkg = rest.shift() ?? '';
    } else if (a === '--feature-dir' || a === '-f') {
      opts.featureDir = rest.shift() ?? '';
    } else if (a === '-h' || a === '--help') {
      printUsage();
      process.exit(0);
    } else if (a.startsWith('-')) {
      process.stderr.write(`Unknown option: ${a}\n`);
      process.exit(2);
    } else if (!opts.screenName) {
      opts.screenName = a;
    } else {
      process.stderr.write(`Unexpected argument: ${a}\n`);
      process.exit(2);
    }
  }
  return opts;
}

function printUsage() {
  process.stderr.write('Usage: flutter-screen-template.mjs <ScreenName> [--package <pkg>] [--feature-dir <dir>]\n');
  process.stderr.write('Example: flutter-screen-template.mjs Login --package vocabit_app --feature-dir login\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.screenName) {
    printUsage();
    process.exit(1);
  }
  console.log(generateScreen(opts.screenName, { pkg: opts.pkg, featureDir: opts.featureDir }));
}

main();
