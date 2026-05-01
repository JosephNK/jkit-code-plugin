#!/usr/bin/env node
// =============================================================================
// Inject architecture_lint (base) + stack-specific lint packages into
// `analysis_options.yaml` via the top-level `plugins:` section
// (analysis_server_plugin, Dart 3.10+).
//
// Dependency form: absolute `path:` to the local jkit-code-plugin checkout.
// The `git:` form in plugins: is parsed by analyzer but not actually wired up
// for fetch until Dart 3.13 Beta 1+ (dart-lang/sdk#61794), which causes
// silent plugin load failure on Dart 3.10–3.12. Using `path:` against the
// already-installed plugin sources works on all supported Dart versions.
//
// Caveat: the written path is per-machine absolute. analysis_options.yaml
// committed to git becomes machine-specific — each developer / CI must run
// `/flutter-sync` (or this script) once to regenerate with their own path.
//
// TODO(jkit): switch back to `git:` deps once Dart 3.13 is stable and widely
// adopted, restoring portability of analysis_options.yaml across machines.
//
// Workspace handling: in a Dart pub workspace, the `plugins:` section is only
// honored at the **workspace root**'s analysis_options.yaml. Pass
// --strip-stale-from to remove a misplaced `plugins:` section from a
// workspace member's analysis_options.yaml.
//
// Also strips the legacy `custom_lint` dev dependency and `analyzer.plugins:
// [custom_lint]` registration if found, to clean up post-migration.
//
// Uses the `yaml` package (Document API) for round-trip YAML editing —
// preserves comments, formatting, and existing structure.
//
// Usage:
//   inject-custom-lint.mjs \
//     --pubspec app/pubspec.yaml \
//     --analysis-options analysis_options.yaml \
//     --plugin-root /abs/path/to/jkit-code-plugin \
//     [--stacks leaf-kit,freezed] \
//     [--strip-stale-from app/analysis_options.yaml]
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import YAML from 'yaml';

// Legacy umbrella plugin name — stripped from pubspec/analysis_options on injection.
const LEGACY_CUSTOM_LINT = 'custom_lint';

// Base package — always injected. `subPath` is relative to --plugin-root
// (the local jkit-code-plugin checkout).
const BASE_PACKAGE = {
  name: 'architecture_lint',
  subPath: 'rules/flutter/base/custom-lint/architecture_lint',
};

// Stack → package mapping. Selecting a stack installs the corresponding lint
// package as an additional analyzer plugin.
const STACK_PACKAGES = {
  'leaf-kit': {
    name: 'leaf_kit_lint',
    subPath: 'rules/flutter/leaf-kit/custom-lint/leaf_kit_lint',
  },
  freezed: {
    name: 'freezed_lint',
    subPath: 'rules/flutter/freezed/custom-lint/freezed_lint',
  },
};

const ALL_LINT_PACKAGE_NAMES = new Set([
  BASE_PACKAGE.name,
  ...Object.values(STACK_PACKAGES).map((p) => p.name),
]);

const HELP = `Usage: inject-custom-lint.mjs --pubspec <path> --analysis-options <path> --plugin-root <abs-dir> [--stacks <stacks>] [--strip-stale-from <path>]

Inject architecture_lint (base) + optional stack lint packages into Flutter project's analysis_options.yaml via the analysis_server_plugin top-level plugins: section, using path: deps that point to --plugin-root.

Options:
  --pubspec <path>           Path to pubspec.yaml (used to strip legacy custom_lint dev dep)
  --analysis-options <path>  Path to analysis_options.yaml (required)
  --plugin-root <abs-dir>    Absolute path to the local jkit-code-plugin checkout (required)
  --stacks <stacks>          Comma-separated convention stacks (optional)
                             Known stacks with lint packages: ${Object.keys(STACK_PACKAGES).join(', ')}
  --strip-stale-from <path>  analysis_options.yaml to strip misplaced plugins:/legacy analyzer.plugins: from
  -h, --help                 Show this help
`;

function usage(code = 1) {
  (code === 0 ? process.stdout : process.stderr).write(HELP);
  process.exit(code);
}

function parseArgs(argv) {
  const args = {
    pubspec: '',
    analysisOptions: '',
    pluginRoot: '',
    stacks: [],
    stripStaleFrom: '',
  };
  const rest = argv.slice(2);

  while (rest.length > 0) {
    const a = rest.shift();
    switch (a) {
      case '--pubspec':
        if (!rest.length) {
          process.stderr.write('--pubspec requires a value\n');
          usage();
        }
        args.pubspec = rest.shift();
        break;
      case '--analysis-options':
        if (!rest.length) {
          process.stderr.write('--analysis-options requires a value\n');
          usage();
        }
        args.analysisOptions = rest.shift();
        break;
      case '--plugin-root':
        if (!rest.length) {
          process.stderr.write('--plugin-root requires a value\n');
          usage();
        }
        args.pluginRoot = rest.shift();
        break;
      case '--stacks':
        if (!rest.length) {
          process.stderr.write('--stacks requires a value\n');
          usage();
        }
        args.stacks = rest
          .shift()
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case '--strip-stale-from':
        if (!rest.length) {
          process.stderr.write('--strip-stale-from requires a value\n');
          usage();
        }
        args.stripStaleFrom = rest.shift();
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

  for (const [name, value] of [
    ['--pubspec', args.pubspec],
    ['--analysis-options', args.analysisOptions],
    ['--plugin-root', args.pluginRoot],
  ]) {
    if (!value) {
      process.stderr.write(`Error: ${name} is required\n`);
      usage();
    }
  }

  if (!path.isAbsolute(args.pluginRoot)) {
    process.stderr.write('Error: --plugin-root must be an absolute path\n');
    usage();
  }

  return args;
}

function buildPathDep(absPath) {
  return { path: absPath };
}

function nodeToJs(node) {
  if (node == null) return null;
  if (typeof node.toJSON === 'function') return node.toJSON();
  return node;
}

function loadOrCreateDoc(filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    const empty = YAML.parseDocument('');
    empty.contents = empty.createNode({});
    return empty;
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  const doc = YAML.parseDocument(raw);
  if (doc.contents === null) {
    doc.contents = doc.createNode({});
  }
  return doc;
}

function writeDoc(filePath, doc) {
  fs.writeFileSync(filePath, String(doc));
}

function resolvePackages(stacks) {
  const packages = [BASE_PACKAGE];
  for (const stack of stacks) {
    const pkg = STACK_PACKAGES[stack];
    if (pkg) packages.push(pkg);
  }
  return packages;
}

// ─── pubspec.yaml — strip legacy lint deps ───
//
// analysis_server_plugin loads plugins from a synthetic package, so the user's
// pubspec.yaml does NOT need any of the lint packages or the legacy custom_lint
// umbrella. Strip them on injection.
function cleanPubspec(pubspecPath) {
  if (!fs.existsSync(pubspecPath) || !fs.statSync(pubspecPath).isFile()) {
    return true;
  }

  const raw = fs.readFileSync(pubspecPath, 'utf-8');
  const doc = YAML.parseDocument(raw);
  if (doc.contents === null) return true;

  let changed = false;

  for (const section of ['dependencies', 'dev_dependencies']) {
    const sectionMap = doc.get(section);
    if (!YAML.isMap(sectionMap)) continue;

    if (sectionMap.has(LEGACY_CUSTOM_LINT)) {
      sectionMap.delete(LEGACY_CUSTOM_LINT);
      process.stdout.write(
        `  Removed legacy ${LEGACY_CUSTOM_LINT} from ${section} in ${pubspecPath}\n`,
      );
      changed = true;
    }
    for (const name of ALL_LINT_PACKAGE_NAMES) {
      if (sectionMap.has(name)) {
        sectionMap.delete(name);
        process.stdout.write(
          `  Removed ${name} from ${section} in ${pubspecPath} (now in analysis_options.yaml plugins:)\n`,
        );
        changed = true;
      }
    }
    // Drop the section entirely if it became empty after stripping.
    if (sectionMap.items.length === 0 && changed) {
      doc.delete(section);
    }
  }

  if (changed) writeDoc(pubspecPath, doc);
  return true;
}

// ─── analysis_options.yaml — register plugins under top-level `plugins:` ───
function injectAnalysisOptions(analysisPath, pluginRoot, packages) {
  const doc = loadOrCreateDoc(analysisPath);

  // 1. Strip legacy `analyzer.plugins: [custom_lint]` registration.
  const analyzer = doc.get('analyzer');
  if (YAML.isMap(analyzer)) {
    const legacyPlugins = analyzer.get('plugins');
    if (legacyPlugins != null) {
      analyzer.delete('plugins');
      process.stdout.write(
        `  Removed legacy analyzer.plugins from ${analysisPath}\n`,
      );
    }
    if (analyzer.items.length === 0) {
      doc.delete('analyzer');
    }
  }

  // 2. Build/update top-level `plugins:` section with `path:` deps.
  let pluginsMap = doc.get('plugins');
  if (pluginsMap != null && !YAML.isMap(pluginsMap)) {
    doc.delete('plugins');
    pluginsMap = null;
  }

  let changed = false;

  for (const pkg of packages) {
    const absPath = path.join(pluginRoot, pkg.subPath);
    if (!fs.existsSync(absPath) || !fs.statSync(absPath).isDirectory()) {
      process.stderr.write(
        `Error: plugin source not found: ${absPath}\n`,
      );
      return false;
    }

    const current = YAML.isMap(pluginsMap) ? nodeToJs(pluginsMap.get(pkg.name)) : null;
    const desired = buildPathDep(absPath);
    const alreadyPinned =
      current &&
      typeof current === 'object' &&
      typeof current.path === 'string' &&
      current.path === desired.path &&
      current.git === undefined;

    if (alreadyPinned) {
      process.stdout.write(
        `  ${pkg.name} already pinned to ${absPath} in ${analysisPath}\n`,
      );
      continue;
    }

    doc.setIn(['plugins', pkg.name], desired);
    process.stdout.write(
      `  Registered ${pkg.name} (path: ${absPath}) in ${analysisPath} plugins:\n`,
    );
    changed = true;
  }

  if (changed || doc.get('analyzer')?.get?.('plugins') === undefined) {
    writeDoc(analysisPath, doc);
  }
  return true;
}

// ─── analysis_options.yaml — strip plugins from misplaced location ───
//
// In a Dart pub workspace, `plugins:` only takes effect at the workspace
// root. If a previous run wrote it to a workspace member's
// analysis_options.yaml, the analyzer raises `plugins_in_inner_options`.
// Strip the entire `plugins:` block (or just our managed entries) to clear it.
function stripStalePluginsFrom(staleAnalysisPath) {
  if (
    !staleAnalysisPath ||
    !fs.existsSync(staleAnalysisPath) ||
    !fs.statSync(staleAnalysisPath).isFile()
  ) {
    return true;
  }

  const raw = fs.readFileSync(staleAnalysisPath, 'utf-8');
  const doc = YAML.parseDocument(raw);
  if (doc.contents === null) return true;

  let changed = false;

  const plugins = doc.get('plugins');
  if (YAML.isMap(plugins)) {
    for (const name of ALL_LINT_PACKAGE_NAMES) {
      if (plugins.has(name)) {
        plugins.delete(name);
        process.stdout.write(
          `  Stripped misplaced ${name} from ${staleAnalysisPath} plugins:\n`,
        );
        changed = true;
      }
    }
    if (plugins.items.length === 0 && changed) {
      doc.delete('plugins');
    }
  }

  // Legacy: also strip `analyzer.plugins: [custom_lint]` if present.
  const analyzer = doc.get('analyzer');
  if (YAML.isMap(analyzer)) {
    const legacyPlugins = analyzer.get('plugins');
    if (legacyPlugins != null) {
      analyzer.delete('plugins');
      process.stdout.write(
        `  Stripped legacy analyzer.plugins from ${staleAnalysisPath}\n`,
      );
      changed = true;
    }
    if (analyzer.items.length === 0) {
      doc.delete('analyzer');
    }
  }

  if (changed) writeDoc(staleAnalysisPath, doc);
  return true;
}

// ─── Main ───

function main() {
  const args = parseArgs(process.argv);
  const packages = resolvePackages(args.stacks);

  const stackList = args.stacks.length ? args.stacks.join(', ') : '(none)';
  process.stdout.write(
    `Registering analysis_server_plugin lint packages (stacks: ${stackList})...\n`,
  );

  let ok = true;
  ok = cleanPubspec(path.resolve(args.pubspec)) && ok;
  if (args.stripStaleFrom) {
    ok = stripStalePluginsFrom(path.resolve(args.stripStaleFrom)) && ok;
  }
  ok =
    injectAnalysisOptions(
      path.resolve(args.analysisOptions),
      args.pluginRoot,
      packages,
    ) && ok;

  if (ok) {
    process.stdout.write('Done.\n');
  } else {
    process.stderr.write('Completed with errors.\n');
  }

  process.exit(ok ? 0 : 1);
}

main();
