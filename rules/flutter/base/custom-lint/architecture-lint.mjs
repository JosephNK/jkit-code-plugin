#!/usr/bin/env node
// =============================================================================
// Flutter hexagonal architecture linter.
//
// Scans Dart source files and validates import rules based on
// Hexagonal Architecture layer boundaries.
//
// Sources:
//   - rules/flutter/base/architecture.md
//   - rules/flutter/base/conventions.md
//   - rules/flutter/base/custom-lint/architecture/arch_rules_test.dart
//
// Rules:
//   E1  entities/ must only import codegen annotations (freezed_annotation, etc.)
//   E2  usecases/ must not import adapters/, bloc/, or presentation/
//   E3  bloc/ must not import adapters/ or ports/ directly
//   E4  No external SDK (dio, http, etc.) in domain layers
//   E5  ports/ must not import framework packages (dio, flutter, etc.)
//   E6  No cross-feature imports of internal layers (ports, adapters, usecases, bloc)
//       - Exception: entities/ imports are always allowed across features
//       - Exception: presentation/bloc may import other feature's domain/
//   E7  No bare catch -- must use 'on ExceptionType catch (e)'
//   N1  Abstract classes in ports/ must end with 'Port'
//   N2  Concrete classes in adapters/ must end with 'Adapter'
//   N3  Classes in usecases/ must end with 'UseCase' or 'Params'
//   S1  Files must not exceed 800 lines
//
// Usage:
//   architecture-lint.mjs [entry_dir]
//   architecture-lint.mjs app
//   architecture-lint.mjs client
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// ─── Constants ───

const GENERATED_SUFFIXES = [
  '.g.dart',
  '.freezed.dart',
  '.gen.dart',
  '.chopper.dart',
];

const IMPORT_RE = /^\s*import\s+['"](.+?)['"]/;
const BARE_CATCH_RE = /\bcatch\s*\(/;
const TYPED_CATCH_RE = /\bon\s+\w+.*\bcatch\s*\(/;
const LINE_COMMENT_RE = /\/\//;
const CLASS_DECL_RE = /^\s*(?:abstract\s+)?class\s+(\w+)/;

const MAX_FILE_LINES = 800;

// Codegen-only packages allowed in domain layers
const CODEGEN_PACKAGES = new Set([
  'freezed_annotation',
  'json_annotation',
  'meta',
  'collection',
]);

// Packages allowed in bloc layer (state management + codegen)
const BLOC_ALLOWED_PACKAGES = new Set([
  ...CODEGEN_PACKAGES,
  'flutter_bloc',
  'bloc',
  'equatable',
]);

// Infrastructure packages forbidden in domain layers
const INFRA_PACKAGES = new Set([
  // Remote API
  'dio',
  'http',
  'retrofit',
  'chopper',
  // Local DB
  'drift',
  'sqflite',
  'isar',
  'hive',
  'hive_flutter',
  'floor',
  'objectbox',
  // Storage
  'flutter_secure_storage',
  'shared_preferences',
  // Firebase
  'firebase_core',
  'firebase_auth',
  'firebase_messaging',
  'cloud_firestore',
]);

// Framework packages forbidden in ports
const FRAMEWORK_PACKAGES = new Set([...INFRA_PACKAGES, 'flutter']);

// Layers that are part of the domain (no external SDK allowed)
const DOMAIN_LAYERS = new Set(['entities', 'ports', 'usecases', 'exceptions']);

// Internal layers forbidden for cross-feature imports
const CROSS_FEATURE_FORBIDDEN = new Set([
  'ports',
  'adapters',
  'usecases',
  'bloc',
]);

// Layer directory markers (ordered; first match wins)
const LAYER_MARKERS = [
  ['/entities/', 'entities'],
  ['/ports/', 'ports'],
  ['/usecases/', 'usecases'],
  ['/adapters/', 'adapters'],
  ['/bloc/', 'bloc'],
  ['/exceptions/', 'exceptions'],
  ['/pages/', 'presentation'],
  ['/views/', 'presentation'],
  ['/widgets/', 'presentation'],
];

// ─── Text Helpers ───

// Mimics Python's str.splitlines(): drops a trailing empty line when the
// text ends with a newline. Handles \r\n, \r, and \n.
function splitLines(text) {
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
}

function readTextSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

// ─── Classification ───

function classifyLayer(relPath) {
  const padded = `/${relPath}/`;
  // 교차 feature 서비스 분류:
  //   - *_port.dart       → ports
  //   - *_adapter.dart    → adapters
  //   - internal/** 하위  → common_services
  //   - 그 외 직속 파일   → fall-through → 'other' (S2 위반 트리거)
  if (padded.includes('/common/services/')) {
    if (relPath.endsWith('_port.dart')) return 'ports';
    if (relPath.endsWith('_adapter.dart')) return 'adapters';
    if (padded.includes('/internal/')) return 'common_services';
    return 'other';
  }
  for (const [marker, layer] of LAYER_MARKERS) {
    if (padded.includes(marker)) return layer;
  }
  return 'other';
}

function extractFeature(relPath) {
  const parts = relPath.split(/[/\\]/).filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === 'features' && i + 1 < parts.length) {
      return parts[i + 1];
    }
  }
  return null;
}

function getPackageName(entryDir) {
  const pubspec = path.join(entryDir, 'pubspec.yaml');
  try {
    const stat = fs.statSync(pubspec);
    if (!stat.isFile()) return null;
  } catch {
    return null;
  }
  const text = readTextSafe(pubspec);
  if (text == null) return null;
  for (const rawLine of splitLines(text)) {
    const line = rawLine.trim();
    if (line.startsWith('name:')) {
      return line.slice('name:'.length).trim();
    }
  }
  return null;
}

// ─── Import Parsing ───

function parseImports(filePath) {
  const results = [];
  const text = readTextSafe(filePath);
  if (text == null) return results;
  const lines = splitLines(text);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(IMPORT_RE);
    if (m) results.push([i + 1, m[1]]);
  }
  return results;
}

function findBareCatches(filePath) {
  const results = [];
  const text = readTextSafe(filePath);
  if (text == null) return results;

  let inBlockComment = false;
  const lines = splitLines(text);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const stripped = line.trim();

    // Track block comments
    if (stripped.includes('/*')) inBlockComment = true;
    if (stripped.includes('*/')) {
      inBlockComment = false;
      continue;
    }
    if (inBlockComment) continue;

    // Skip line comments
    const commentMatch = line.match(LINE_COMMENT_RE);
    const codePart =
      commentMatch != null ? line.slice(0, commentMatch.index) : line;

    if (BARE_CATCH_RE.test(codePart) && !TYPED_CATCH_RE.test(codePart)) {
      results.push([i + 1, stripped]);
    }
  }
  return results;
}

// ─── Import Helpers ───

function extractPackage(importPath) {
  if (importPath.startsWith('package:')) {
    const rest = importPath.slice('package:'.length);
    const parts = rest.split('/');
    return parts.length > 0 ? parts[0] : null;
  }
  return null;
}

function resolveImportLayer(importPath, filePath) {
  if (importPath.startsWith('package:')) return null;
  const fileDir = path.dirname(filePath);
  const resolved = path.normalize(path.join(fileDir, importPath));
  return classifyLayer(resolved);
}

function resolveImportFeature(importPath, filePath) {
  if (importPath.startsWith('package:')) return null;
  const fileDir = path.dirname(filePath);
  const resolved = path.normalize(path.join(fileDir, importPath));
  if (resolved.startsWith('..')) return null;
  return extractFeature(resolved);
}

function getImportLayerFromPackage(importPath, packageName) {
  if (!packageName) return null;
  const pkg = extractPackage(importPath);
  if (pkg !== packageName) return null;
  const inner = importPath.slice(`package:${packageName}/`.length);
  return classifyLayer(inner);
}

function getImportFeatureFromPackage(importPath, packageName) {
  if (!packageName) return null;
  const pkg = extractPackage(importPath);
  if (pkg !== packageName) return null;
  const inner = importPath.slice(`package:${packageName}/`.length);
  return extractFeature(inner);
}

// ─── Rules ───

function checkE1EntitiesImport(layer, importPath, packageName) {
  if (layer !== 'entities') return null;
  const pkg = extractPackage(importPath);
  if (pkg === null) return null;
  if (pkg === packageName) return null;
  if (CODEGEN_PACKAGES.has(pkg)) return null;
  if (pkg === 'dart' || importPath.startsWith('dart:')) return null;
  return `entities/ must not import external package '${pkg}' -- only codegen annotations allowed`;
}

function checkE2UsecasesDependency(layer, importPath, fileRel, packageName) {
  if (layer !== 'usecases') return null;

  let targetLayer = resolveImportLayer(importPath, fileRel);
  if (targetLayer === null) {
    targetLayer = getImportLayerFromPackage(importPath, packageName);
  }
  if (targetLayer === null) return null;

  // common_services 레이어는 forbidden에서 제외 — value-object/config/state/exception
  // 등 공용 서비스의 보조 타입은 usecase에서 자유롭게 import 가능.
  // (common/services 의 adapter 구현체는 별도 'adapters' 레이어로 분류되어 차단됨)
  const forbidden = new Set(['adapters', 'bloc', 'presentation']);
  if (forbidden.has(targetLayer)) {
    return `usecases/ must not import from ${targetLayer}/ -- only entities/ and ports/ allowed`;
  }
  return null;
}

function checkE3BlocDependency(layer, importPath, fileRel, packageName) {
  if (layer !== 'bloc') return null;

  const pkg = extractPackage(importPath);
  if (pkg !== null && BLOC_ALLOWED_PACKAGES.has(pkg)) return null;
  if (pkg === 'dart' || importPath.startsWith('dart:')) return null;
  if (pkg === packageName || pkg === null) {
    let targetLayer = resolveImportLayer(importPath, fileRel);
    if (targetLayer === null) {
      targetLayer = getImportLayerFromPackage(importPath, packageName);
    }
    if (targetLayer === null) return null;
    const forbidden = new Set(['adapters', 'ports', 'common_services']);
    if (forbidden.has(targetLayer)) {
      return `bloc/ must not import from ${targetLayer}/ -- only usecases/ allowed`;
    }
    return null;
  }
  // External package not in allowed list -- skip (not architecture rule)
  return null;
}

function checkE4DomainNoSdk(layer, importPath, packageName) {
  if (!DOMAIN_LAYERS.has(layer)) return null;
  const pkg = extractPackage(importPath);
  if (pkg === null) return null;
  if (pkg === packageName) return null;
  if (INFRA_PACKAGES.has(pkg)) {
    return `'${pkg}' must not be imported in ${layer}/ -- no external SDK in domain layers`;
  }
  return null;
}

function checkE5PortsNoFramework(layer, importPath, packageName) {
  if (layer !== 'ports') return null;
  const pkg = extractPackage(importPath);
  if (pkg === null) return null;
  if (pkg === packageName) return null;
  if (FRAMEWORK_PACKAGES.has(pkg)) {
    return `ports/ must not import framework package '${pkg}' -- use domain types only`;
  }
  return null;
}

function checkE6CrossFeature(layer, feature, importPath, fileRel, packageName) {
  if (feature === null) return null;

  let targetFeature = resolveImportFeature(importPath, fileRel);
  if (targetFeature === null) {
    targetFeature = getImportFeatureFromPackage(importPath, packageName);
  }
  if (targetFeature === null || targetFeature === feature) return null;

  // Check target layer
  let targetLayer = resolveImportLayer(importPath, fileRel);
  if (targetLayer === null) {
    targetLayer = getImportLayerFromPackage(importPath, packageName);
  }

  // entities/ imports are always allowed across features
  if (targetLayer === 'entities') return null;

  // presentation/bloc may import other feature's domain/
  // (Presentation-only feature pattern -- usecases injected via DI)
  if (layer === 'presentation' || layer === 'bloc') {
    let resolvedPath = '';
    if (!importPath.startsWith('package:')) {
      const fileDir = path.dirname(fileRel);
      resolvedPath = path.normalize(path.join(fileDir, importPath));
    } else {
      const pkg = extractPackage(importPath);
      if (pkg === packageName) {
        resolvedPath = importPath.slice(`package:${packageName}/`.length);
      }
    }
    if (`/${resolvedPath}/`.includes('/domain/')) {
      return null;
    }
  }

  if (CROSS_FEATURE_FORBIDDEN.has(targetLayer)) {
    return `Cross-feature import: '${feature}' must not import '${targetFeature}'s ${targetLayer}/ -- use DI or event bus`;
  }
  return null;
}

// ─── Naming & Size Rules ───

function findClassDeclarations(filePath) {
  const results = [];
  const text = readTextSafe(filePath);
  if (text == null) return results;
  const lines = splitLines(text);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(CLASS_DECL_RE);
    if (m) {
      // Offset of capture group 1 within the line
      const nameStart = m.index + m[0].indexOf(m[1]);
      const isAbstract = line.slice(0, nameStart).includes('abstract');
      results.push([i + 1, m[1], isAbstract]);
    }
  }
  return results;
}

function countLines(filePath) {
  const text = readTextSafe(filePath);
  if (text == null) return 0;
  return splitLines(text).length;
}

function checkN1PortNaming(layer, _lineNo, className, _isAbstract) {
  if (layer !== 'ports') return null;
  if (!className.endsWith('Port')) {
    return `Port class '${className}' must end with 'Port'`;
  }
  return null;
}

function checkN2AdapterNaming(layer, _lineNo, className, _isAbstract) {
  if (layer !== 'adapters') return null;
  if (!className.endsWith('Adapter')) {
    return `Adapter class '${className}' must end with 'Adapter'`;
  }
  return null;
}

function checkN3UsecaseNaming(layer, _lineNo, className, _isAbstract) {
  if (layer !== 'usecases') return null;
  if (!(className.endsWith('UseCase') || className.endsWith('Params'))) {
    return `UseCase class '${className}' must end with 'UseCase' or 'Params'`;
  }
  return null;
}

// ─── Scanner ───

function walkDartFiles(root) {
  const results = [];
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.dart')) {
        results.push(full);
      }
    }
  }
  walk(root);
  results.sort();
  return results;
}

function scan(libRoot, entryDir) {
  const violations = [];
  const packageName = getPackageName(entryDir);

  for (const dartFile of walkDartFiles(libRoot)) {
    // Skip generated files
    const baseName = path.basename(dartFile);
    if (GENERATED_SUFFIXES.some((s) => baseName.endsWith(s))) continue;

    const relPath = path.relative(libRoot, dartFile);
    const layer = classifyLayer(relPath);
    const feature = extractFeature(relPath);

    if (layer === 'other') continue;

    // Check imports
    for (const [lineNo, importPath] of parseImports(dartFile)) {
      const checks = [
        ['E1', () => checkE1EntitiesImport(layer, importPath, packageName)],
        [
          'E2',
          () =>
            checkE2UsecasesDependency(layer, importPath, relPath, packageName),
        ],
        [
          'E3',
          () => checkE3BlocDependency(layer, importPath, relPath, packageName),
        ],
        ['E4', () => checkE4DomainNoSdk(layer, importPath, packageName)],
        ['E5', () => checkE5PortsNoFramework(layer, importPath, packageName)],
        [
          'E6',
          () =>
            checkE6CrossFeature(
              layer,
              feature,
              importPath,
              relPath,
              packageName,
            ),
        ],
      ];
      for (const [ruleId, fn] of checks) {
        const msg = fn();
        if (msg) {
          violations.push({
            file: dartFile,
            line: lineNo,
            rule: ruleId,
            message: msg,
          });
        }
      }
    }

    // Check bare catches (E7)
    for (const [lineNo] of findBareCatches(dartFile)) {
      violations.push({
        file: dartFile,
        line: lineNo,
        rule: 'E7',
        message: "Bare catch is not allowed -- use 'on ExceptionType catch (e)'",
      });
    }

    // Check naming conventions (N1, N2, N3)
    for (const [lineNo, className, isAbstract] of findClassDeclarations(
      dartFile,
    )) {
      const checks = [
        ['N1', checkN1PortNaming],
        ['N2', checkN2AdapterNaming],
        ['N3', checkN3UsecaseNaming],
      ];
      for (const [ruleId, fn] of checks) {
        const msg = fn(layer, lineNo, className, isAbstract);
        if (msg) {
          violations.push({
            file: dartFile,
            line: lineNo,
            rule: ruleId,
            message: msg,
          });
        }
      }
    }

    // Check file size (S1)
    const lineCount = countLines(dartFile);
    if (lineCount > MAX_FILE_LINES) {
      violations.push({
        file: dartFile,
        line: 1,
        rule: 'S1',
        message: `File has ${lineCount} lines (max ${MAX_FILE_LINES})`,
      });
    }
  }

  return violations;
}

// ─── Reporter ───

function report(violations) {
  violations.sort((a, b) => {
    if (a.file !== b.file) return a.file < b.file ? -1 : 1;
    return a.line - b.line;
  });
  for (const v of violations) {
    process.stdout.write(`${v.file}:${v.line}: [${v.rule}] ${v.message}\n`);
  }
  process.stdout.write('\n');
  if (violations.length > 0) {
    process.stdout.write(
      `Found ${violations.length} architecture violation(s).\n`,
    );
  } else {
    process.stdout.write('No architecture violations found.\n');
  }
}

// ─── Main ───

const HELP = `Usage: architecture-lint.mjs [entry_dir]

Flutter hexagonal architecture linter.

Arguments:
  entry_dir    Entry directory (default: app)

Options:
  -h, --help   Show this help
`;

function usage(code = 1) {
  (code === 0 ? process.stdout : process.stderr).write(HELP);
  process.exit(code);
}

function parseArgs(argv) {
  const rest = argv.slice(2);
  const positional = [];
  while (rest.length > 0) {
    const a = rest.shift();
    if (a === '-h' || a === '--help') usage(0);
    if (a.startsWith('-')) {
      process.stderr.write(`Unknown option: ${a}\n`);
      usage();
    }
    positional.push(a);
  }
  if (positional.length > 1) {
    process.stderr.write(
      `Error: unexpected extra arguments: ${positional.slice(1).join(' ')}\n`,
    );
    usage();
  }
  return { entry: positional[0] ?? 'app' };
}

function main() {
  const args = parseArgs(process.argv);
  const entryDir = args.entry;
  const libRoot = path.join(entryDir, 'lib');

  let stat;
  try {
    stat = fs.statSync(libRoot);
  } catch {
    process.stderr.write(`Error: ${libRoot} is not a directory\n`);
    process.exit(2);
  }
  if (!stat.isDirectory()) {
    process.stderr.write(`Error: ${libRoot} is not a directory\n`);
    process.exit(2);
  }

  const violations = scan(libRoot, entryDir);
  report(violations);
  process.exit(violations.length > 0 ? 1 : 0);
}

main();
