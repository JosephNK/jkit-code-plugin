#!/usr/bin/env node
// =============================================================================
// Flutter AppRouter 파일 생성 및 저장 스크립트.
//
// Usage:
//   flutter-route-setup.mjs [-entry <dir>]
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_ROUTER_PATH = 'lib/router/router.dart';

const HELP = `Usage: flutter-route-setup.mjs [-entry <dir>]

AppRouter 템플릿 코드를 생성하여 router.dart 파일로 저장합니다.

Options:
  -entry <dir>   엔트리 디렉토리 (예: app). 생략 시 lib/router/router.dart
  -h, --help     Show this help
`;

function usage(code = 1) {
  (code === 0 ? process.stdout : process.stderr).write(HELP);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { entry: '' };
  const rest = argv.slice(2);

  while (rest.length > 0) {
    const a = rest.shift();
    switch (a) {
      case '-entry':
        if (!rest.length) {
          process.stderr.write('-entry requires a value\n');
          usage();
        }
        args.entry = rest.shift();
        break;
      case '-h':
      case '--help':
        usage(0);
        break;
      default:
        process.stderr.write(`Unknown option: ${a}\n`);
        usage();
    }
  }

  return args;
}

function generateRouter() {
  return `import 'package:flutter/material.dart';
import 'package:flutter_leaf_kit/flutter_leaf_kit_state.dart';
import 'package:go_router/go_router.dart';

class AppRouter {
  AppRouter._();

  static final GoRouter router = GoRouter(
    routes: <RouteBase>[

    ],
  );
}
`;
}

function setupRouter(outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, generateRouter(), 'utf-8');
  return outputPath;
}

function main() {
  const args = parseArgs(process.argv);

  const outputPath = args.entry
    ? `${args.entry}/${DEFAULT_ROUTER_PATH}`
    : DEFAULT_ROUTER_PATH;

  const created = setupRouter(outputPath);
  process.stdout.write(`${created}\n`);
}

main();
