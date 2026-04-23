#!/usr/bin/env node
// =============================================================================
// Generates wrapper shell scripts in <output-dir>/scripts/ that invoke the
// plugin's Python utilities via `poetry run`.
//
// Each wrapper is intentionally a .sh file — it is what the Flutter project
// user runs directly.
//
// Usage:
//   gen-scripts.mjs -p <output-dir> [-entry <dir>]
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { ensureFlutterRoot, normalizePath } from '../common.mjs';

const HELP = `Usage: gen-scripts.mjs -p <output-dir> [-entry <dir>]

Generates wrapper shell scripts for Flutter project utilities.

Options:
  -p <dir>         Output directory (required, Flutter project root)
  -entry <dir>     Flutter entry directory (default: app). Used only for project-root validation.
  -h, --help       Show this help

Examples:
  ./scripts/flutter/gen-scripts.mjs -p .
  ./scripts/flutter/gen-scripts.mjs -p /path/to/my-flutter-project
  ./scripts/flutter/gen-scripts.mjs -p . -entry client
`;

function usage(code = 1) {
  (code === 0 ? process.stdout : process.stderr).write(HELP);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { outputDir: '', entry: 'app' };
  const rest = argv.slice(2);

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

  if (!args.outputDir) {
    process.stderr.write('Error: -p <output-dir> is required\n');
    usage();
  }

  return args;
}

const PLUGIN_ROOT_SNIPPET = `PLUGIN_ROOT=$(ls -d ~/.claude/plugins/cache/jkit/jkit/*/ 2>/dev/null | sort -V | tail -1)
if [ -z "$PLUGIN_ROOT" ]; then
  echo "Error: jkit plugin not found in ~/.claude/plugins/cache/" >&2
  exit 1
fi`;

function renderWrapper(pythonPath) {
  return `#!/bin/bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
${PLUGIN_ROOT_SNIPPET}
cd "$PLUGIN_ROOT" && poetry run python scripts/flutter/${pythonPath} "$@" --project-dir "$PROJECT_DIR"
`;
}

const WRAPPERS = [
  { name: 'flutter-build-deploy.sh', python: 'build/flutter_build_deploy.py' },
  { name: 'update-dependencies.sh', python: 'dependencies/update_dependencies.py' },
  { name: 'update-leaf-kit-ref.sh', python: 'dependencies/update_leaf_kit_ref.py' },
  {
    name: 'android-show-info-keystore.sh',
    python: 'keystore/android_show_info_keystore.py',
  },
  {
    name: 'android-signing-report.sh',
    python: 'keystore/android_signing_report_keystore.py',
  },
  {
    name: 'android-signing-verify-apk.sh',
    python: 'keystore/android_signing_verify_apk.py',
  },
];

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

  const scriptsDir = path.join(outputDir, 'scripts');
  fs.mkdirSync(scriptsDir, { recursive: true });

  for (const w of WRAPPERS) {
    const dest = path.join(scriptsDir, w.name);
    fs.writeFileSync(dest, renderWrapper(w.python));
    fs.chmodSync(dest, 0o755);
    process.stdout.write(`Generated: ${dest}\n`);
  }

  process.stdout.write('\n');
  process.stdout.write(`Done! Generated ${WRAPPERS.length} scripts in ${scriptsDir}/\n`);
}

main();
