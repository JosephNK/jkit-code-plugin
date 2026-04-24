#!/usr/bin/env node
// =============================================================================
// architecture_lint의 git ref 버전을 업데이트하는 스크립트.
//
// architecture_lint의 git 블록은 url/path/ref 조합이며, 필드 순서는
// url → path → ref 가 일반적이지만 url → ref → path 케이스도 허용한다.
//
// Usage:
//   update-architecture-lint-ref.mjs <ref> --project-dir <dir> [--dry-run]
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const HELP = `Usage: update-architecture-lint-ref.mjs [<ref>] --project-dir <dir> [--dry-run]

모든 pubspec.yaml에서 architecture_lint의 git ref를 업데이트합니다.

Arguments:
  <ref>              선택. 새로운 git ref 값 (예: v0.1.32, 0.1.32, main).
                     생략 시 .claude-plugin/plugin.json의 version을 사용.

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

function findPubspecFiles(projectRoot) {
  const results = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'build') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name === 'pubspec.yaml') {
        results.push(full);
      }
    }
  };
  walk(projectRoot);
  return results.sort();
}

// 공통 헤더: architecture_lint: \n  git: \n    url: ...
const HEADER = /(architecture_lint:\s*\n\s*git:\s*\n\s*url:[^\n]+\n)/;

// Case 1: url → path → ref
const PATH_FIRST_RE =
  /(architecture_lint:\s*\n\s*git:\s*\n\s*url:[^\n]+\n)(\s*path:[^\n]+\n)(\s*ref:\s*)['"]?([^'"\n]+)['"]?/;

// Case 2: url → ref (path 없음 또는 ref 가 먼저)
const REF_ONLY_RE =
  /(architecture_lint:\s*\n\s*git:\s*\n\s*url:[^\n]+\n)(\s*ref:\s*)['"]?([^'"\n]+)['"]?/;

function updateArchitectureLintRef(pubspecPath, newRef, dryRun) {
  const content = fs.readFileSync(pubspecPath, 'utf-8');

  let match = content.match(PATH_FIRST_RE);
  let newContent;
  let oldRef;

  if (match) {
    oldRef = match[4];
    if (oldRef === newRef) {
      process.stdout.write(`  ⏭️  ${pubspecPath}: 이미 동일한 ref (${oldRef})\n`);
      return false;
    }
    newContent = content.replace(PATH_FIRST_RE, `$1$2$3'${newRef}'`);
  } else {
    match = content.match(REF_ONLY_RE);
    if (!match) return false;
    oldRef = match[3];
    if (oldRef === newRef) {
      process.stdout.write(`  ⏭️  ${pubspecPath}: 이미 동일한 ref (${oldRef})\n`);
      return false;
    }
    newContent = content.replace(REF_ONLY_RE, `$1$2'${newRef}'`);
  }

  if (dryRun) {
    process.stdout.write(`  🔍 ${pubspecPath}: ${oldRef} → ${newRef} (dry-run)\n`);
  } else {
    fs.writeFileSync(pubspecPath, newContent);
    process.stdout.write(`  ✅ ${pubspecPath}: ${oldRef} → ${newRef}\n`);
  }
  return true;
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

  const pubspecFiles = findPubspecFiles(projectRoot);
  process.stdout.write(`발견된 pubspec.yaml: ${pubspecFiles.length}개\n\n`);

  let updatedCount = 0;
  for (const pubspec of pubspecFiles) {
    if (updateArchitectureLintRef(pubspec, ref, args.dryRun)) {
      updatedCount += 1;
    }
  }

  process.stdout.write('\n');
  if (updatedCount === 0) {
    process.stdout.write('변경된 파일이 없습니다.\n');
  } else {
    const action = args.dryRun ? '변경 예정' : '업데이트 완료';
    process.stdout.write(`${updatedCount}개 파일 ${action}\n`);
  }
}

main();
