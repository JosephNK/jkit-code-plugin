#!/usr/bin/env node
// =============================================================================
// Inject architecture_lint (base) + stack-specific lint packages into
// pubspec.yaml and analysis_options.yaml.
//
// Uses the `yaml` package (Document API) for round-trip YAML editing —
// preserves comments, formatting, and existing structure.
//
// architecture_lint (base) is always injected as a git dependency.
// Stack-specific lint packages (e.g. leaf_kit_lint when leaf-kit convention is
// selected) are injected as additional git dependencies. custom_lint (umbrella
// plugin) is also added to dev_dependencies and registered as the analyzer
// plugin. custom_lint then auto-discovers all installed lint packages.
//
// Usage:
//   inject-architecture-lint.mjs \
//     --pubspec app/pubspec.yaml \
//     --analysis-options app/analysis_options.yaml \
//     --git-url https://github.com/JosephNK/jkit-code-plugin.git \
//     --git-ref v0.2.30 \
//     [--stacks leaf-kit,go-router]
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import YAML from 'yaml';

const ANALYZER_PLUGIN_NAME = 'custom_lint';
const CUSTOM_LINT_VERSION = '^0.8.0';

// Base package — always injected.
const BASE_PACKAGE = {
  name: 'architecture_lint',
  gitPath: 'rules/flutter/base/custom-lint/architecture_lint',
};

// Stack → package mapping. Selecting a stack installs the corresponding lint
// package as an additional custom_lint plugin.
const STACK_PACKAGES = {
  'leaf-kit': {
    name: 'leaf_kit_lint',
    gitPath: 'rules/flutter/leaf-kit/custom-lint/leaf_kit_lint',
  },
};

const HELP = `Usage: inject-architecture-lint.mjs --pubspec <path> --analysis-options <path> --git-url <url> --git-ref <ref> [--stacks <stacks>]

Inject architecture_lint (base) + optional stack lint packages into Flutter project config.

Options:
  --pubspec <path>          Path to pubspec.yaml (required)
  --analysis-options <path> Path to analysis_options.yaml (required)
  --git-url <url>           Git repository URL (required)
  --git-ref <ref>           Git ref, tag recommended (required, e.g. v0.2.30)
  --stacks <stacks>         Comma-separated convention stacks (optional)
                            Known stacks with lint packages: ${Object.keys(STACK_PACKAGES).join(', ')}
  -h, --help                Show this help
`;

function usage(code = 1) {
  (code === 0 ? process.stdout : process.stderr).write(HELP);
  process.exit(code);
}

function parseArgs(argv) {
  const args = {
    pubspec: '',
    analysisOptions: '',
    gitUrl: '',
    gitRef: '',
    stacks: [],
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
      case '--git-url':
        if (!rest.length) {
          process.stderr.write('--git-url requires a value\n');
          usage();
        }
        args.gitUrl = rest.shift();
        break;
      case '--git-ref':
        if (!rest.length) {
          process.stderr.write('--git-ref requires a value\n');
          usage();
        }
        args.gitRef = rest.shift();
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
    ['--git-url', args.gitUrl],
    ['--git-ref', args.gitRef],
  ]) {
    if (!value) {
      process.stderr.write(`Error: ${name} is required\n`);
      usage();
    }
  }

  return args;
}

function buildGitDep(url, gitPath, ref) {
  return { git: { url, path: gitPath, ref } };
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

// Resolve which lint packages should be installed based on selected stacks.
function resolvePackages(stacks) {
  const packages = [BASE_PACKAGE];
  for (const stack of stacks) {
    const pkg = STACK_PACKAGES[stack];
    if (pkg) packages.push(pkg);
  }
  return packages;
}

// ─── pubspec.yaml ───

function injectPubspec(pubspecPath, gitUrl, gitRef, packages) {
  if (!fs.existsSync(pubspecPath) || !fs.statSync(pubspecPath).isFile()) {
    process.stderr.write(`Error: ${pubspecPath} not found\n`);
    return false;
  }

  const raw = fs.readFileSync(pubspecPath, 'utf-8');
  const doc = YAML.parseDocument(raw);

  if (doc.contents === null) {
    process.stderr.write(`Error: ${pubspecPath} is empty\n`);
    return false;
  }

  // If dev_dependencies exists but isn't a map (e.g. empty `dev_dependencies:`),
  // drop it so setIn can recreate a proper map.
  const devDeps = doc.get('dev_dependencies');
  if (devDeps != null && !YAML.isMap(devDeps)) {
    doc.delete('dev_dependencies');
  }

  let changed = false;

  // Inject each lint package as a git dependency (idempotent).
  for (const pkg of packages) {
    const devDepsMap = doc.get('dev_dependencies');
    const current = YAML.isMap(devDepsMap) ? nodeToJs(devDepsMap.get(pkg.name)) : null;
    const alreadyPinned =
      current &&
      typeof current === 'object' &&
      current.git &&
      typeof current.git === 'object' &&
      current.git.url === gitUrl &&
      current.git.path === pkg.gitPath &&
      current.git.ref === gitRef;

    if (alreadyPinned) {
      process.stdout.write(
        `  ${pkg.name} already pinned to ${gitRef} in ${pubspecPath}\n`,
      );
      continue;
    }

    doc.setIn(
      ['dev_dependencies', pkg.name],
      buildGitDep(gitUrl, pkg.gitPath, gitRef),
    );
    process.stdout.write(
      `  Injected ${pkg.name} (git ref ${gitRef}) into ${pubspecPath}\n`,
    );
    changed = true;
  }

  // Inject custom_lint (umbrella) — pinned to fixed version.
  const devDepsMap = doc.get('dev_dependencies');
  const currentCustom = YAML.isMap(devDepsMap)
    ? nodeToJs(devDepsMap.get(ANALYZER_PLUGIN_NAME))
    : null;
  if (currentCustom !== CUSTOM_LINT_VERSION) {
    doc.setIn(['dev_dependencies', ANALYZER_PLUGIN_NAME], CUSTOM_LINT_VERSION);
    process.stdout.write(
      `  Injected ${ANALYZER_PLUGIN_NAME} (${CUSTOM_LINT_VERSION}) into ${pubspecPath}\n`,
    );
    changed = true;
  } else {
    process.stdout.write(
      `  ${ANALYZER_PLUGIN_NAME} already pinned to ${CUSTOM_LINT_VERSION} in ${pubspecPath}\n`,
    );
  }

  if (changed) writeDoc(pubspecPath, doc);
  return true;
}

// ─── analysis_options.yaml ───

function injectAnalysisOptions(analysisPath) {
  const doc = loadOrCreateDoc(analysisPath);

  const analyzer = doc.get('analyzer');
  const plugins = YAML.isMap(analyzer) ? analyzer.get('plugins') : null;

  let pluginsChanged = true;

  if (plugins == null) {
    // analyzer either missing, null, or without a plugins key.
    // Drop any non-map analyzer so setIn can auto-create a proper map.
    if (analyzer != null && !YAML.isMap(analyzer)) {
      doc.delete('analyzer');
    }
    doc.setIn(['analyzer', 'plugins'], [ANALYZER_PLUGIN_NAME]);
  } else if (YAML.isSeq(plugins)) {
    // Drop any legacy 'architecture_lint' entry — only custom_lint should remain
    // since Dart analyzer only allows one plugin per context.
    const items = plugins.toJSON();
    const filtered = items.filter(
      (i) => i !== 'architecture_lint' && i !== ANALYZER_PLUGIN_NAME,
    );
    const target = [...filtered, ANALYZER_PLUGIN_NAME];
    const same =
      items.length === target.length &&
      items.every((v, i) => v === target[i]);
    if (same) {
      pluginsChanged = false;
    } else {
      doc.setIn(['analyzer', 'plugins'], target);
    }
  } else {
    const plain = YAML.isScalar(plugins) ? plugins.value : plugins;
    if (String(plain) === ANALYZER_PLUGIN_NAME) {
      pluginsChanged = false;
    } else {
      doc.setIn(['analyzer', 'plugins'], [ANALYZER_PLUGIN_NAME]);
    }
  }

  if (!pluginsChanged) {
    process.stdout.write(
      `  ${ANALYZER_PLUGIN_NAME} already configured in ${analysisPath}, skipping\n`,
    );
    return true;
  }

  writeDoc(analysisPath, doc);
  process.stdout.write(
    `  Set analyzer.plugins to [${ANALYZER_PLUGIN_NAME}] in ${analysisPath}\n`,
  );
  return true;
}

// ─── Main ───

function main() {
  const args = parseArgs(process.argv);
  const packages = resolvePackages(args.stacks);

  const stackList = args.stacks.length ? args.stacks.join(', ') : '(none)';
  process.stdout.write(
    `Injecting lint packages via ${ANALYZER_PLUGIN_NAME} (stacks: ${stackList})...\n`,
  );

  let ok = true;
  ok =
    injectPubspec(
      path.resolve(args.pubspec),
      args.gitUrl,
      args.gitRef,
      packages,
    ) && ok;
  ok =
    injectAnalysisOptions(path.resolve(args.analysisOptions)) && ok;

  if (ok) {
    process.stdout.write('Done.\n');
  } else {
    process.stderr.write('Completed with errors.\n');
  }

  process.exit(ok ? 0 : 1);
}

main();
