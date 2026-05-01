#!/usr/bin/env node
// =============================================================================
// architecture_lint(및 leaf_kit_lint, freezed_lint) 의 git ref 버전을
// `analysis_options.yaml` 의 top-level `plugins:` 섹션에서 업데이트한다.
//
// analysis_server_plugin 마이그레이션 이후, 이 lint 패키지들은 `pubspec.yaml`
// 의 dev_dependencies 가 아닌 `analysis_options.yaml` 의 `plugins:` 섹션에
// 등록된다.
//
// Usage:
//   update-architecture-lint-ref.mjs <ref> --project-dir <dir> [--dry-run]
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import YAML from 'yaml';

const LINT_PACKAGE_NAMES = ['architecture_lint', 'leaf_kit_lint', 'freezed_lint'];

const HELP = `Usage: update-architecture-lint-ref.mjs [<ref>] --project-dir <dir> [--dry-run]

모든 analysis_options.yaml 의 plugins: 섹션에서 architecture_lint /
leaf_kit_lint / freezed_lint 의 git ref 를 업데이트합니다.

Arguments:
  <ref>              선택. 새로운 git ref 값 (예: v0.3.1, 0.3.1, main).
                     생략 시 .claude-plugin/plugin.json 의 version 을 사용.

Options:
  --project-dir <dir>  프로젝트 루트 디렉토리 (required)
  --dry-run            실제 변경 없이 변경될 내용만 출력
  -h, --help           Show this help
`;

function usage(code = 1) {
  (code === 0 ? process.stdout : process.stderr).write(HELP);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { ref: null, projectDir: '', dryRun: false };
  const positional = [];
  const rest = argv.slice(2);

  while (rest.length > 0) {
    const a = rest.shift();
    switch (a) {
      case '--project-dir':
        if (!rest.length) {
          process.stderr.write('--project-dir requires a value\n');
          usage();
        }
        args.projectDir = rest.shift();
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      case '-h':
      case '--help':
        usage(0);
        break;
      default:
        if (a.startsWith('-')) {
          process.stderr.write(`Unknown option: ${a}\n`);
          usage();
        }
        positional.push(a);
    }
  }

  if (positional.length > 1) {
    process.stderr.write(`Error: unexpected extra arguments: ${positional.slice(1).join(' ')}\n`);
    usage();
  }
  if (positional.length === 1) {
    args.ref = positional[0];
  }

  if (!args.projectDir) {
    process.stderr.write('Error: --project-dir is required\n');
    usage();
  }

  return args;
}

function normalizeRef(ref) {
  if (ref.startsWith('v') || !/^[0-9]/.test(ref[0])) {
    return ref;
  }
  return `v${ref}`;
}

function resolvePluginVersion() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const pluginRoot = path.resolve(scriptDir, '..', '..', '..');
  const pluginJson = path.join(pluginRoot, '.claude-plugin', 'plugin.json');

  if (!fs.existsSync(pluginJson) || !fs.statSync(pluginJson).isFile()) {
    process.stderr.write(`plugin.json을 찾을 수 없습니다: ${pluginJson}\n`);
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(pluginJson, 'utf-8'));
  } catch (exc) {
    process.stderr.write(`plugin.json 파싱 실패: ${exc.message}\n`);
    process.exit(1);
  }

  const version = data.version;
  if (typeof version !== 'string' || !version) {
    process.stderr.write('plugin.json의 version 필드가 비어 있습니다.\n');
    process.exit(1);
  }
  return normalizeRef(version);
}

function findAnalysisOptionsFiles(projectRoot) {
  const results = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'build' || entry.name === 'node_modules') {
        continue;
      }
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name === 'analysis_options.yaml') {
        results.push(full);
      }
    }
  };
  walk(projectRoot);
  return results.sort();
}

function updateLintPluginRefs(analysisPath, newRef, dryRun) {
  const raw = fs.readFileSync(analysisPath, 'utf-8');
  const doc = YAML.parseDocument(raw);
  if (doc.contents === null) return 0;

  const plugins = doc.get('plugins');
  if (!YAML.isMap(plugins)) return 0;

  let updated = 0;

  for (const pkgName of LINT_PACKAGE_NAMES) {
    const pluginEntry = plugins.get(pkgName);
    if (!YAML.isMap(pluginEntry)) continue;

    const gitNode = pluginEntry.get('git');
    if (!YAML.isMap(gitNode)) continue;

    const refNode = gitNode.get('ref', true);
    const oldRef = YAML.isScalar(refNode) ? String(refNode.value) : null;
    if (oldRef === newRef) {
      process.stdout.write(`  ⏭️  ${analysisPath} [${pkgName}]: 이미 동일한 ref (${oldRef})\n`);
      continue;
    }

    if (YAML.isScalar(refNode)) {
      refNode.value = newRef;
    } else {
      gitNode.set('ref', newRef);
    }

    if (dryRun) {
      process.stdout.write(
        `  🔍 ${analysisPath} [${pkgName}]: ${oldRef ?? '(없음)'} → ${newRef} (dry-run)\n`,
      );
    } else {
      process.stdout.write(
        `  ✅ ${analysisPath} [${pkgName}]: ${oldRef ?? '(없음)'} → ${newRef}\n`,
      );
    }
    updated += 1;
  }

  if (updated > 0 && !dryRun) {
    fs.writeFileSync(analysisPath, String(doc));
  }
  return updated;
}

function main() {
  const args = parseArgs(process.argv);

  let ref;
  let refSource;
  if (args.ref === null) {
    ref = resolvePluginVersion();
    refSource = 'plugin.json 자동 감지';
  } else {
    ref = normalizeRef(args.ref);
    refSource = 'CLI 인자';
  }
  const projectRoot = path.resolve(args.projectDir);

  process.stdout.write(`프로젝트 루트: ${projectRoot}\n`);
  process.stdout.write(`새 ref: ${ref} (${refSource})\n`);
  if (args.dryRun) process.stdout.write('(dry-run 모드)\n');
  process.stdout.write('\n');

  const files = findAnalysisOptionsFiles(projectRoot);
  process.stdout.write(`발견된 analysis_options.yaml: ${files.length}개\n\n`);

  let updatedCount = 0;
  for (const file of files) {
    updatedCount += updateLintPluginRefs(file, ref, args.dryRun);
  }

  process.stdout.write('\n');
  if (updatedCount === 0) {
    process.stdout.write('변경된 항목이 없습니다.\n');
  } else {
    const action = args.dryRun ? '변경 예정' : '업데이트 완료';
    process.stdout.write(`${updatedCount}개 항목 ${action}\n`);
  }
}

main();
