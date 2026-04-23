#!/usr/bin/env node
// Flutter main.dart 템플릿 생성 스크립트

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

function generateMain(appNameIn, packageNameIn = '') {
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

  return `import 'dart:async';

import 'package:${packageName}/app.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_leaf_kit/flutter_leaf_kit.dart';

void main() {
  runZonedGuarded(
    () async {
      WidgetsFlutterBinding.ensureInitialized();

      await EasyLocalization.ensureInitialized();

      Bloc.observer = LeafBlocObserver();

      // FlutterError.onError ( to catch all unhandled-flutter-framework-errors )
      FlutterError.onError = (FlutterErrorDetails details) {
        LeafLogging.e(':: Interceptor FlutterError onError: \${details}');
        FlutterError.dumpErrorToConsole(details);
      };
      PlatformDispatcher.instance.onError = (error, stack) {
        LeafLogging.e(':: Interceptor Platform Error: \${error}');
        return true;
      };

      runApp(
        EasyLocalization(
          supportedLocales: const [
            Locale('en', 'US'),
            Locale('ja', 'JP'),
            Locale('ko', 'KR'),
          ],
          path: 'assets/langs',
          fallbackLocale: const Locale('ko', 'KR'),
          child: const ${className}(),
        ),
      );
    },
    (error, stackTrace) {
      // Zone ( to catch all unhandled-asynchronous-errors )
      LeafLogging.e(':: Interceptor Zone Error : \${error}, StackTrace : \${stackTrace}');
    },
  );
}
`;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 1) {
    process.stderr.write('Usage: flutter-main-template.mjs <AppName> [package_name]\n');
    process.stderr.write('Example: flutter-main-template.mjs MyApp\n');
    process.stderr.write('Example: flutter-main-template.mjs MyApp my_app\n');
    process.exit(1);
  }

  const appName = argv[0];
  const packageName = argv[1] ?? '';
  console.log(generateMain(appName, packageName));
}

main();
