#!/usr/bin/env node
// =============================================================================
// Generates .pre-commit-config.yaml for a Flutter project.
//
// Usage:
//   gen-precommit.mjs flutter -p <output-dir> [-entry <dir>]
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { ensureFlutterRoot, normalizePath } from '../common.mjs';

const HELP = `Usage: gen-precommit.mjs flutter -p <output-dir> [-entry <dir>]

Generates .pre-commit-config.yaml for a Flutter project.

Arguments:
  flutter        Framework name (currently flutter only)

Options:
  -p <dir>       Output directory (required)
  -entry <dir>   Entry directory (default: app)
  -h, --help     Show this help

Examples:
  ./scripts/flutter/gen-precommit.mjs flutter -p .
  ./scripts/flutter/gen-precommit.mjs flutter -p . -entry app
  ./scripts/flutter/gen-precommit.mjs flutter -p . -entry client
`;

function usage(code = 1) {
  (code === 0 ? process.stdout : process.stderr).write(HELP);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { framework: '', outputDir: '', entry: 'app' };
  const rest = argv.slice(2);

  if (rest.length >= 1 && !rest[0].startsWith('-')) {
    args.framework = rest.shift();
  }

  while (rest.length > 0) {
    const a = rest.shift();
    switch (a) {
      case '-p':
        if (!rest.length) {
          process.stderr.write('-p requires a directory\n');
          usage();
        }
        args.outputDir = rest.shift();
        break;
      case '-entry':
        if (!rest.length) {
          process.stderr.write('-entry requires a directory\n');
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

  if (!args.framework) {
    process.stderr.write('Error: framework is required\n');
    usage();
  }
  if (!args.outputDir) {
    process.stderr.write('Error: -p <output-dir> is required\n');
    usage();
  }

  return args;
}

function renderConfig(entry) {
  return `repos:
  # 공통 검사 (trailing whitespace, EOF, YAML)
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v6.0.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml

  # Dart format & Flutter analyze + test (local hooks)
  - repo: local
    hooks:
      - id: dart-format
        name: dart format
        entry: dart format
        language: system
        types: [file]
        files: \\.dart$

      - id: flutter-analyze
        name: flutter analyze
        entry: bash -c 'cd ${entry} && flutter analyze --fatal-infos'
        language: system
        pass_filenames: false
        types: [file]
        files: \\.dart$

      - id: architecture-lint
        name: architecture lint
        entry: bash -c 'cd ${entry} && dart run architecture_lint:lint "$(pwd)"'
        language: system
        pass_filenames: false
        types: [file]
        files: \\.dart$

      - id: flutter-test
        name: flutter test (related only)
        entry: bash -c 'cd ${entry} && tf=$(git diff --cached --name-only --diff-filter=ACMR | grep "^${entry}/.*\\.dart$" | sed "s|^${entry}/||" | while read f; do if [[ $f == test/*_test.dart ]]; then echo $f; elif [[ $f == lib/* ]]; then t=test/\${f#lib/}; t=\${t%.dart}_test.dart; [ -f "$t" ] && echo $t; fi; done | sort -u) && if [ -n "$tf" ]; then flutter test $tf; else echo "No related tests found, skipping"; fi'
        language: system
        pass_filenames: false
        types: [file]
        files: \\.dart$

  # Conventional commit 검증
  - repo: https://github.com/compilerla/conventional-pre-commit
    rev: v4.3.0
    hooks:
      - id: conventional-pre-commit
        stages: [commit-msg]
        args: [feat, fix, refactor, docs, test, chore, perf, ci]
`;
}

function main() {
  const args = parseArgs(process.argv);

  try {
    ensureFlutterRoot(args.outputDir, args.entry);
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  }

  let outputDir;
  try {
    outputDir = normalizePath(args.outputDir);
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  }

  const dest = path.join(outputDir, '.pre-commit-config.yaml');
  fs.writeFileSync(dest, renderConfig(args.entry));

  process.stdout.write(`Generated: ${dest} (entry: ${args.entry})\n`);
}

main();
