#!/usr/bin/env node
// =============================================================================
// Registers architecture_lint (and optional stack lint packages) as analyzer
// plugins in analysis_options.yaml via the new top-level `plugins:` section
// (analysis_server_plugin, Dart 3.10+).
//
// Each lint package is registered with a git dependency directly under
// `plugins:` — no umbrella custom_lint package needed. Also strips legacy
// custom_lint dev dependency and `analyzer.plugins:` registration if present.
//
// Delegates the YAML edits to `custom_lint/inject-custom-lint.mjs`, which uses
// the `yaml` package for round-trip YAML editing (preserves comments &
// formatting).
//
// Usage:
//   gen-custom-lint.mjs flutter -p <project-dir> [-entry <dir>] [--ref <git-ref>]
// =============================================================================

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import YAML from 'yaml';

import { ensureFlutterRoot, normalizePath } from '../common.mjs';

/**
 * Detect whether projectDir is a Dart pub workspace root that includes the
 * given entry as a member. analysis_server_plugin only honors `plugins:` at
 * the workspace root, so the entry's analysis_options.yaml is the wrong place.
 */
function isWorkspaceMember(projectDir, entry) {
  const rootPubspec = path.join(projectDir, 'pubspec.yaml');
  if (!fs.existsSync(rootPubspec) || !fs.statSync(rootPubspec).isFile()) {
    return false;
  }
  let doc;
  try {
    doc = YAML.parseDocument(fs.readFileSync(rootPubspec, 'utf-8'));
  } catch {
    return false;
  }
  const ws = doc.get('workspace');
  if (!YAML.isSeq(ws)) return false;
  const entries = ws.toJSON().map((s) => String(s).replace(/\/+$/, ''));
  return entries.includes(entry.replace(/\/+$/, ''));
}

const GIT_URL = 'https://github.com/JosephNK/jkit-code-plugin.git';

const HELP = `Usage: gen-custom-lint.mjs flutter -p <project-dir> [-entry <dir>] [--ref <git-ref>] [--stacks <stacks>]

Registers architecture_lint (base) + optional stack lint packages (e.g.
leaf_kit_lint when --stacks includes leaf-kit) as analyzer plugins in
analysis_options.yaml via the new top-level \`plugins:\` section. Each lint
package is pinned to a git ref. The Dart analysis server resolves them in a
synthetic package, independent of the host project's pubspec.

Requires: Dart 3.10+ (Flutter 3.38+) and plugin's node_modules installed
(\`npm install\` in plugin root).

Arguments:
  flutter         Framework name (currently flutter only)

Options:
  -p <dir>        Project root directory (required)
  -entry <dir>    Flutter entry directory (default: app)
  --ref <ref>     Git ref to pin (default: v<plugin-version> from plugin.json)
  --stacks <s>    Comma-separated convention stacks (default: none)
                  e.g. leaf-kit,go-router — installs matching stack lint package
  -h, --help      Show this help

Examples:
  ./scripts/flutter/gen-custom-lint.mjs flutter -p .
  ./scripts/flutter/gen-custom-lint.mjs flutter -p . -entry app
  ./scripts/flutter/gen-custom-lint.mjs flutter -p . --ref v0.2.30
  ./scripts/flutter/gen-custom-lint.mjs flutter -p . --stacks leaf-kit
`;

function usage(code = 1) {
  (code === 0 ? process.stdout : process.stderr).write(HELP);
  process.exit(code);
}

function parseArgs(argv) {
  const args = {
    framework: '',
    projectDir: '',
    entry: 'app',
    ref: '',
    stacks: '',
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
      case '--stacks':
        if (!rest.length) {
          process.stderr.write('--stacks requires a value\n');
          usage();
        }
        args.stacks = rest.shift();
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
    'custom_lint',
    'inject-custom-lint.mjs',
  );

  // analysis_server_plugin requires `plugins:` to live at the workspace root
  // when the entry is a workspace member; otherwise the analyzer raises
  // `plugins_in_inner_options`. Fall back to entry's analysis_options.yaml
  // for non-workspace projects.
  const inWorkspace = isWorkspaceMember(projectDir, args.entry);
  const analysisOptionsPath = inWorkspace
    ? 'analysis_options.yaml'
    : path.join(args.entry, 'analysis_options.yaml');
  const stalePath = inWorkspace
    ? path.join(args.entry, 'analysis_options.yaml')
    : null;

  if (inWorkspace) {
    process.stdout.write(
      `  Detected pub workspace — writing plugins: to ${analysisOptionsPath} (root)\n`,
    );
  }

  const injectArgs = [
    injectScript,
    '--pubspec',
    path.join(args.entry, 'pubspec.yaml'),
    '--analysis-options',
    analysisOptionsPath,
    '--git-url',
    GIT_URL,
    '--git-ref',
    ref,
  ];
  if (stalePath) {
    injectArgs.push('--strip-stale-from', stalePath);
  }
  if (args.stacks) {
    injectArgs.push('--stacks', args.stacks);
  }

  const result = spawnSync(process.execPath, injectArgs, {
    cwd: projectDir,
    // Preserve bash-style logical cwd semantics (matches `(cd && pwd)`).
    env: { ...process.env, PWD: projectDir },
    stdio: 'inherit',
  });

  if (result.error) {
    process.stderr.write(
      `Error running inject-custom-lint.mjs: ${result.error.message}\n`,
    );
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  // Invalidate Dart analyzer plugin caches.
  // The new analysis_server_plugin system creates a synthetic package per
  // plugin set and caches the resolved sources. Restart of the analysis server
  // is required after plugin changes (per Dart docs); clearing both legacy and
  // new cache directories also helps surface fresh sources on next analyze.
  for (const cacheDir of [
    path.join(os.homedir(), '.dartServer', '.plugin_manager'),
    path.join(os.homedir(), '.dartServer', '.analysis_server_plugin'),
  ]) {
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true });
      process.stdout.write(`  Cleared ${cacheDir}\n`);
    }
  }
  process.stdout.write(
    '  Note: restart the Dart Analysis Server (or your IDE) to apply changes.\n',
  );
}

main();
