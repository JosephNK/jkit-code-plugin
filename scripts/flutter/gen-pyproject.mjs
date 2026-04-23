#!/usr/bin/env node
// =============================================================================
// Generates pyproject.toml for a Flutter project.
//
// Usage:
//   gen-pyproject.mjs flutter -p <output-dir> -n <name> \
//     [-entry <dir>] [-d <description>] [-a <author>]
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { ensureFlutterRoot, normalizePath } from '../common.mjs';

const HELP = `Usage: gen-pyproject.mjs flutter -p <output-dir> -n <name> [-entry <dir>] [-d <description>] [-a <author>]

Generates pyproject.toml for a Flutter project.

Arguments:
  flutter          Framework name (currently flutter only)

Options:
  -p <dir>         Output directory (required, must be the Flutter project root)
  -n <name>        Project name (required, e.g. my-app)
  -entry <dir>     Flutter entry directory (default: app). Used only for project-root validation.
  -d <description> Project description (default: "Flutter project scripts")
  -a <author>      Author (default: empty, e.g. "Name <email>")
  -h, --help       Show this help

Examples:
  ./scripts/flutter/gen-pyproject.mjs flutter -p . -n my-app
  ./scripts/flutter/gen-pyproject.mjs flutter -p . -n my-app -entry client
  ./scripts/flutter/gen-pyproject.mjs flutter -p . -n my-app -d "My App scripts" -a "John <john@example.com>"
`;

function usage(code = 1) {
  (code === 0 ? process.stdout : process.stderr).write(HELP);
  process.exit(code);
}

function parseArgs(argv) {
  const args = {
    framework: '',
    outputDir: '',
    name: '',
    entry: 'app',
    description: 'Flutter project scripts',
    author: '',
  };
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
      case '-n':
        if (!rest.length) {
          process.stderr.write('-n requires a name\n');
          usage();
        }
        args.name = rest.shift();
        break;
      case '-entry':
        if (!rest.length) {
          process.stderr.write('-entry requires a directory\n');
          usage();
        }
        args.entry = rest.shift();
        break;
      case '-d':
        if (!rest.length) {
          process.stderr.write('-d requires a description\n');
          usage();
        }
        args.description = rest.shift();
        break;
      case '-a':
        if (!rest.length) {
          process.stderr.write('-a requires an author\n');
          usage();
        }
        args.author = rest.shift();
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
  if (!args.name) {
    process.stderr.write('Error: -n <name> is required\n');
    usage();
  }

  return args;
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

  const authorsLine = args.author
    ? `authors = ["${args.author}"]`
    : 'authors = []';

  const dest = path.join(outputDir, 'pyproject.toml');
  const content = `[tool.poetry]
name = "${args.name}"
version = "0.1.0"
description = "${args.description}"
${authorsLine}
package-mode = false

[tool.poetry.dependencies]
python = "^3.11"
ruamel-yaml = "^0.19.1"

[tool.poetry.group.dev.dependencies]
pre-commit = "^4.5.1"
pytest = "^8.3.5"

[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"
`;

  fs.writeFileSync(dest, content);
  process.stdout.write(`Generated: ${dest}\n`);
}

main();
