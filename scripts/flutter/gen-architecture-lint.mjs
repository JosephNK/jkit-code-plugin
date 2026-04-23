#!/usr/bin/env node
// =============================================================================
// Injects architecture_lint (as a git dependency) into pubspec.yaml and
// registers it as an analyzer plugin in analysis_options.yaml.
//
// Delegates the YAML edits to the Node script
// `architecture_lint/inject-architecture-lint.mjs`, which uses the `yaml`
// package for round-trip YAML editing (preserves comments & formatting).
//
// Usage:
//   gen-architecture-lint.mjs flutter -p <project-dir> [-entry <dir>] [--ref <git-ref>]
// =============================================================================

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { ensureFlutterRoot, normalizePath } from '../common.mjs';

const GIT_URL = 'https://github.com/JosephNK/jkit-code-plugin.git';
const GIT_PATH = 'rules/flutter/custom-lint/architecture_lint';

const HELP = `Usage: gen-architecture-lint.mjs flutter -p <project-dir> [-entry <dir>] [--ref <git-ref>]

Injects architecture_lint (as a git dependency) into pubspec.yaml and
registers it as an analyzer plugin in analysis_options.yaml.

Requires: plugin's node_modules installed (\`npm install\` in plugin root).

Arguments:
  flutter        Framework name (currently flutter only)

Options:
  -p <dir>       Project root directory (required)
  -entry <dir>   Flutter entry directory (default: app)
  --ref <ref>    Git ref to pin (default: v<plugin-version> from plugin.json)
  -h, --help     Show this help

Examples:
  ./scripts/flutter/gen-architecture-lint.mjs flutter -p .
  ./scripts/flutter/gen-architecture-lint.mjs flutter -p . -entry app
  ./scripts/flutter/gen-architecture-lint.mjs flutter -p . --ref v0.1.28
`;

function usage(code = 1) {
  (code === 0 ? process.stdout : process.stderr).write(HELP);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { framework: '', projectDir: '', entry: 'app', ref: '' };
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
        args.projectDir = rest.shift();
        break;
      case '-entry':
        if (!rest.length) {
          process.stderr.write('-entry requires a directory\n');
          usage();
        }
        args.entry = rest.shift();
        break;
      case '--ref':
        if (!rest.length) {
          process.stderr.write('--ref requires a value\n');
          usage();
        }
        args.ref = rest.shift();
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
  if (!args.projectDir) {
    process.stderr.write('Error: -p <project-dir> is required\n');
    usage();
  }

  return args;
}

function main() {
  const args = parseArgs(process.argv);

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const pluginRoot = path.resolve(scriptDir, '..', '..');

  // Resolve ref from plugin.json if not provided.
  let ref = args.ref;
  if (!ref) {
    const pluginJson = path.join(pluginRoot, '.claude-plugin', 'plugin.json');
    if (!fs.existsSync(pluginJson)) {
      process.stderr.write(`Error: ${pluginJson} not found\n`);
      process.exit(1);
    }
    try {
      const meta = JSON.parse(fs.readFileSync(pluginJson, 'utf8'));
      if (!meta.version) {
        process.stderr.write(`Error: version missing in ${pluginJson}\n`);
        process.exit(1);
      }
      ref = `v${meta.version}`;
    } catch (err) {
      process.stderr.write(`Error: failed to parse ${pluginJson}: ${err.message}\n`);
      process.exit(1);
    }
  }

  try {
    ensureFlutterRoot(args.projectDir, args.entry);
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  }

  let projectDir;
  try {
    projectDir = normalizePath(args.projectDir);
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  }

  const injectScript = path.join(
    scriptDir,
    'architecture_lint',
    'inject-architecture-lint.mjs',
  );

  const result = spawnSync(
    process.execPath,
    [
      injectScript,
      '--pubspec',
      path.join(args.entry, 'pubspec.yaml'),
      '--analysis-options',
      path.join(args.entry, 'analysis_options.yaml'),
      '--git-url',
      GIT_URL,
      '--git-path',
      GIT_PATH,
      '--git-ref',
      ref,
    ],
    {
      cwd: projectDir,
      // Preserve bash-style logical cwd semantics (matches `(cd && pwd)`).
      env: { ...process.env, PWD: projectDir },
      stdio: 'inherit',
    },
  );

  if (result.error) {
    process.stderr.write(
      `Error running inject-architecture-lint.mjs: ${result.error.message}\n`,
    );
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  // Invalidate Dart analyzer plugin cache.
  // Dart analyzer copies tools/analyzer_plugin/ into ~/.dartServer/.plugin_manager/
  // on first load and keys it by content hash. When the git ref changes or the
  // bootstrap pubspec changes, the stale copy can linger and break resolution.
  // Dropping the cache forces Dart to re-copy from the patched source on next analyze.
  const pluginManagerCache = path.join(
    os.homedir(),
    '.dartServer',
    '.plugin_manager',
  );
  if (fs.existsSync(pluginManagerCache)) {
    fs.rmSync(pluginManagerCache, { recursive: true, force: true });
    process.stdout.write(`  Cleared ${pluginManagerCache}\n`);
  }
}

main();
