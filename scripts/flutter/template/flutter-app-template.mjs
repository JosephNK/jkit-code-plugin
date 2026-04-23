#!/usr/bin/env node
// Flutter App 위젯 템플릿 생성 스크립트

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

function generateApp(appNameIn, packageNameIn = '') {
  let appName = appNameIn;
  let className;
  if (!appName.endsWith('App')) {
    className = `${appName}App`;
  } else {
    className = appName;
    appName = appName.slice(0, -3);
  }

  let packageName = packageNameIn;
  if (!packageName) {
    packageName = `${toSnakeCase(appName)}_app`;
  }

  return `import 'package:flutter/material.dart';
import 'package:flutter_leaf_kit/flutter_leaf_kit.dart';
import 'router/router.dart';

class ${className} extends StatefulWidget {
  const ${className}({super.key});

  @override
  State<${className}> createState() => _${className}State();
}

class _${className}State extends State<${className}> {
  @override
  Widget build(BuildContext context) {
    return LeafTheme(
      data: LeafThemeData.light(),
      child: MaterialApp.router(
        title: '${className}',
        theme: LeafThemeData.light().toThemeData(brightness: Brightness.light),
        darkTheme: LeafThemeData.dark().toThemeData(brightness: Brightness.dark),
        routerConfig: AppRouter.router,
        localizationsDelegates: context.localizationDelegates,
        supportedLocales: context.supportedLocales,
        locale: context.locale,
      ),
    );
  }
}
`;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 1) {
    process.stderr.write('Usage: flutter-app-template.mjs <AppName> [package_name]\n');
    process.stderr.write('Example: flutter-app-template.mjs MyApp\n');
    process.stderr.write('Example: flutter-app-template.mjs MyApp my_app\n');
    process.exit(1);
  }

  const appName = argv[0];
  const packageName = argv[1] ?? '';
  console.log(generateApp(appName, packageName));
}

main();
