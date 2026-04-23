#!/usr/bin/env node
// =============================================================================
// flutter_leaf_kit의 git ref 버전을 업데이트하는 스크립트.
//
// 프로젝트 내 모든 pubspec.yaml을 순회하며 flutter_leaf_kit 의 git ref 를
// 새 값으로 교체한다.
//
// Usage:
//   update-leaf-kit-ref.mjs <ref> --project-dir <dir> [--dry-run]
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const HELP = `Usage: update-leaf-kit-ref.mjs <ref> --project-dir <dir> [--dry-run]

모든 pubspec.yaml에서 flutter_leaf_kit의 git ref를 업데이트합니다.

Arguments:
  <ref>              새로운 git ref 값 (예: v3.0.0, v3.0.0-dev, main)

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
  const args = { ref: '', projectDir: '', dryRun: false };
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

  if (positional.length === 0) {
    process.stderr.write('Error: <ref> is required\n');
    usage();
  }
  if (positional.length > 1) {
    process.stderr.write(`Error: unexpected extra arguments: ${positional.slice(1).join(' ')}\n`);
    usage();
  }
  args.ref = positional[0];

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

const LEAF_KIT_RE =
  /(flutter_leaf_kit:\s*\n\s*git:\s*\n\s*url:[^\n]+\n\s*ref:\s*)['"]?([^'"\n]+)['"]?/;

function updateLeafKitRef(pubspecPath, newRef, dryRun) {
  const content = fs.readFileSync(pubspecPath, 'utf-8');
  const match = content.match(LEAF_KIT_RE);
  if (!match) return false;

  const oldRef = match[2];
  if (oldRef === newRef) {
    process.stdout.write(`  ⏭️  ${pubspecPath}: 이미 동일한 ref (${oldRef})\n`);
    return false;
  }

  const newContent = content.replace(LEAF_KIT_RE, `$1'${newRef}'`);

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

  const ref = normalizeRef(args.ref);
  const projectRoot = path.resolve(args.projectDir);

  process.stdout.write(`프로젝트 루트: ${projectRoot}\n`);
  process.stdout.write(`새 ref: ${ref}\n`);
  if (args.dryRun) process.stdout.write('(dry-run 모드)\n');
  process.stdout.write('\n');

  const pubspecFiles = findPubspecFiles(projectRoot);
  process.stdout.write(`발견된 pubspec.yaml: ${pubspecFiles.length}개\n\n`);

  let updatedCount = 0;
  for (const pubspec of pubspecFiles) {
    if (updateLeafKitRef(pubspec, ref, args.dryRun)) {
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
