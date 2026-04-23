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

function generateScreen(screenNameIn) {
  let screenName = screenNameIn;
  if (!screenName.endsWith('Screen')) {
    screenName = `${screenName}Screen`;
  }

  const blocName = screenName.slice(0, -6);
  const blocSnake = toSnakeCase(blocName);

  return `import 'package:flutter/material.dart';
import 'package:flutter_leaf_kit/flutter_leaf_kit.dart';

import '../bloc/${blocSnake}_bloc.dart';
import '../widgets/${blocSnake}_app_bar.dart';
import '../widgets/${blocSnake}_body_view.dart';

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
      builder: (context, state) {
        return buildScaffold(context, state);
      },
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

function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 1) {
    process.stderr.write('Usage: screen_template.py <ScreenName>\n');
    process.stderr.write('Example: screen_template.py Login\n');
    process.exit(1);
  }

  const screenName = argv[0];
  console.log(generateScreen(screenName));
}

main();
