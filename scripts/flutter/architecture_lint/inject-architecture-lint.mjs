#!/usr/bin/env node
// =============================================================================
// Inject architecture_lint into pubspec.yaml and analysis_options.yaml.
//
// Uses the `yaml` package (Document API) for round-trip YAML editing —
// preserves comments, formatting, and existing structure.
//
// architecture_lint is injected as a git dependency so the generated
// pubspec.yaml is portable across developer machines and CI.
//
// Usage:
//   inject-architecture-lint.mjs \
//     --pubspec app/pubspec.yaml \
//     --analysis-options app/analysis_options.yaml \
//     --git-url https://github.com/JosephNK/jkit-code-plugin.git \
//     --git-path rules/flutter/base/custom-lint/architecture_lint \
//     --git-ref v0.1.28
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import YAML from 'yaml';

const PACKAGE_NAME = 'architecture_lint';

const HELP = `Usage: inject-architecture-lint.mjs --pubspec <path> --analysis-options <path> --git-url <url> --git-path <path> --git-ref <ref>

Inject architecture_lint into Flutter project config.

Options:
  --pubspec <path>          Path to pubspec.yaml (required)
  --analysis-options <path> Path to analysis_options.yaml (required)
  --git-url <url>           Git repository URL (required)
  --git-path <path>         Path to package within the repo (required)
  --git-ref <ref>           Git ref, tag recommended (required, e.g. v0.1.28)
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
    gitPath: '',
    gitRef: '',
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
      case '--git-path':
        if (!rest.length) {
          process.stderr.write('--git-path requires a value\n');
          usage();
        }
        args.gitPath = rest.shift();
        break;
      case '--git-ref':
        if (!rest.length) {
          process.stderr.write('--git-ref requires a value\n');
          usage();
        }
        args.gitRef = rest.shift();
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
    ['--git-path', args.gitPath],
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

// ─── pubspec.yaml ───

function injectPubspec(pubspecPath, gitUrl, gitPath, gitRef) {
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

  const devDeps = doc.get('dev_dependencies');
  const current = YAML.isMap(devDeps) ? nodeToJs(devDeps.get(PACKAGE_NAME)) : null;

  if (
    current &&
    typeof current === 'object' &&
    current.git &&
    typeof current.git === 'object' &&
    current.git.url === gitUrl &&
    current.git.path === gitPath &&
    current.git.ref === gitRef
  ) {
    process.stdout.write(
      `  ${PACKAGE_NAME} already pinned to ${gitRef} in ${pubspecPath}\n`,
    );
    return true;
  }

  // If dev_dependencies exists but isn't a map (e.g. empty `dev_dependencies:`),
  // drop it so setIn can recreate a proper map.
  if (devDeps != null && !YAML.isMap(devDeps)) {
    doc.delete('dev_dependencies');
  }

  doc.setIn(
    ['dev_dependencies', PACKAGE_NAME],
    buildGitDep(gitUrl, gitPath, gitRef),
  );

  writeDoc(pubspecPath, doc);
  process.stdout.write(
    `  Injected ${PACKAGE_NAME} (git ref ${gitRef}) into ${pubspecPath}\n`,
  );
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
    doc.setIn(['analyzer', 'plugins'], [PACKAGE_NAME]);
  } else if (YAML.isSeq(plugins)) {
    const items = plugins.toJSON();
    if (items.includes(PACKAGE_NAME)) {
      pluginsChanged = false;
    } else {
      plugins.add(PACKAGE_NAME);
    }
  } else {
    const plain = YAML.isScalar(plugins) ? plugins.value : plugins;
    if (String(plain) === PACKAGE_NAME) {
      pluginsChanged = false;
    } else {
      doc.setIn(['analyzer', 'plugins'], [plain, PACKAGE_NAME]);
    }
  }

  if (!pluginsChanged) {
    process.stdout.write(
      `  ${PACKAGE_NAME} already configured in ${analysisPath}, skipping\n`,
    );
    return true;
  }

  writeDoc(analysisPath, doc);
  process.stdout.write(`  Injected ${PACKAGE_NAME} into ${analysisPath}\n`);
  return true;
}

// ─── Main ───

function main() {
  const args = parseArgs(process.argv);

  process.stdout.write(`Injecting ${PACKAGE_NAME}...\n`);

  let ok = true;
  ok =
    injectPubspec(
      path.resolve(args.pubspec),
      args.gitUrl,
      args.gitPath,
      args.gitRef,
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
