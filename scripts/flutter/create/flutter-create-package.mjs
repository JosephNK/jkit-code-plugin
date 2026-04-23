#!/usr/bin/env node
// =============================================================================
// Flutter 모노레포에서 새 패키지를 생성하고 workspace에 통합하는 스크립트.
//
// 멱등성(idempotent) 보장: 이미 존재하는 패키지에 대해 실행해도
// 누락된 설정만 추가하고, 모두 완료 상태이면 안전하게 종료합니다.
//
// YAML 쓰기는 텍스트 기반 삽입을 사용하여 기존 포맷(주석, 들여쓰기, 빈 줄)을
// 보존합니다.
//
// Usage:
//   flutter-create-package.mjs <package_name> [-entry <dir>]
//                              [--with-leaf-kit] [--leaf-kit-ref <ref>]
//                              [--no-app-dep] [--dry-run]
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const PACKAGE_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

const DART_RESERVED_WORDS = new Set([
  'abstract', 'as', 'assert', 'async', 'await', 'break', 'case', 'catch',
  'class', 'const', 'continue', 'covariant', 'default', 'deferred', 'do',
  'dynamic', 'else', 'enum', 'export', 'extends', 'extension', 'external',
  'factory', 'false', 'final', 'finally', 'for', 'function', 'get', 'hide',
  'if', 'implements', 'import', 'in', 'interface', 'is', 'late', 'library',
  'mixin', 'new', 'null', 'on', 'operator', 'part', 'required', 'rethrow',
  'return', 'set', 'show', 'static', 'super', 'switch', 'sync', 'this',
  'throw', 'true', 'try', 'typedef', 'var', 'void', 'while', 'with', 'yield',
]);

const LEAF_KIT_GIT_URL = 'https://github.com/JosephNK/flutter_leaf_kit.git';
const LEAF_KIT_GIT_PATH = './packages/leaf';

const LEAF_KIT_REF_PATTERN =
  /flutter_leaf_kit:\s*\n\s*git:\s*\n\s*url:[^\n]+\n\s*ref:\s*['"]?([^'"\n]+)['"]?/;

// ──────────────────────────────────────────────
// CLI
// ──────────────────────────────────────────────

const HELP = `Usage: flutter-create-package.mjs <package_name> [options]

Flutter 모노레포에서 새 패키지를 생성하고 workspace에 통합합니다.

Arguments:
  <package_name>         패키지 이름 (snake_case, 예: myapp_network)

Options:
  -entry <dir>           엔트리 디렉토리 (기본값: app)
  --no-app-dep           엔트리 pubspec.yaml에 의존성을 추가하지 않음
  --with-leaf-kit        flutter_leaf_kit git 의존성을 패키지에 추가
  --leaf-kit-ref <ref>   flutter_leaf_kit git ref (생략 시 엔트리에서 자동 추출)
  --dry-run              실제 변경 없이 변경 내용만 출력
  -h, --help             Show this help
`;

function usage(code = 1) {
  (code === 0 ? process.stdout : process.stderr).write(HELP);
  process.exit(code);
}

function parseArgs(argv) {
  const args = {
    packageName: '',
    entry: 'app',
    noAppDep: false,
    withLeafKit: false,
    leafKitRef: null,
    dryRun: false,
  };
  const positional = [];
  const rest = argv.slice(2);

  while (rest.length > 0) {
    const a = rest.shift();
    switch (a) {
      case '-entry':
        if (!rest.length) {
          process.stderr.write('-entry requires a value\n');
          usage();
        }
        args.entry = rest.shift();
        break;
      case '--no-app-dep':
        args.noAppDep = true;
        break;
      case '--with-leaf-kit':
        args.withLeafKit = true;
        break;
      case '--leaf-kit-ref':
        if (!rest.length) {
          process.stderr.write('--leaf-kit-ref requires a value\n');
          usage();
        }
        args.leafKitRef = rest.shift();
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
    process.stderr.write('Error: <package_name> is required\n');
    usage();
  }
  if (positional.length > 1) {
    process.stderr.write(
      `Error: unexpected extra arguments: ${positional.slice(1).join(' ')}\n`,
    );
    usage();
  }
  args.packageName = positional[0];

  return args;
}

// ──────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────

function validatePackageName(name) {
  if (!PACKAGE_NAME_PATTERN.test(name)) {
    process.stderr.write(
      `❌ 유효하지 않은 패키지명: '${name}'\n` +
        '   → snake_case (소문자 + 숫자 + 언더스코어, 소문자로 시작)\n',
    );
    process.exit(1);
  }

  if (DART_RESERVED_WORDS.has(name)) {
    process.stderr.write(
      `❌ Dart 예약어는 패키지명으로 사용할 수 없습니다: '${name}'\n`,
    );
    process.exit(1);
  }
}

// ──────────────────────────────────────────────
// Ref helpers
// ──────────────────────────────────────────────

function normalizeRef(ref) {
  if (ref.startsWith('v') || !/^[0-9]$/.test(ref[0])) {
    return ref;
  }
  return `v${ref}`;
}

function extractLeafKitRef(projectRoot, entry) {
  const entryPubspec = path.join(projectRoot, entry, 'pubspec.yaml');

  if (!fs.existsSync(entryPubspec)) {
    process.stderr.write(
      `❌ ${entry}/pubspec.yaml을 찾을 수 없어 leaf-kit ref를 추출할 수 없습니다.\n`,
    );
    process.exit(1);
  }

  const content = fs.readFileSync(entryPubspec, 'utf-8');
  const match = content.match(LEAF_KIT_REF_PATTERN);

  if (!match) {
    process.stderr.write(
      `❌ ${entry}/pubspec.yaml에서 flutter_leaf_kit git ref를 찾을 수 없습니다.\n`,
    );
    process.exit(1);
  }

  return match[1];
}

// ──────────────────────────────────────────────
// Text-based YAML insertion helpers
// ──────────────────────────────────────────────

function insertLineAfter(content, anchorPattern, newLine) {
  const lines = content.split('\n');
  let insertIdx = -1;

  for (let i = 0; i < lines.length; i += 1) {
    if (anchorPattern.test(lines[i])) {
      insertIdx = i;
    }
  }

  if (insertIdx === -1) {
    throw new Error(`앵커 패턴을 찾을 수 없습니다: ${anchorPattern}`);
  }

  lines.splice(insertIdx + 1, 0, newLine);
  return lines.join('\n');
}

function findLastWorkspaceEntry(content) {
  const lines = content.split('\n');
  let inWorkspace = false;
  let lastEntryIdx = -1;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^workspace:/.test(line)) {
      inWorkspace = true;
      continue;
    }
    if (inWorkspace) {
      if (/^ {2}- /.test(line)) {
        lastEntryIdx = i;
      } else if (line.trim() && !line.startsWith(' ')) {
        break;
      }
    }
  }

  return lastEntryIdx;
}

function findLastDependencyEntry(content) {
  const lines = content.split('\n');
  let inDeps = false;
  let lastEntryIdx = -1;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^dependencies:/.test(line)) {
      inDeps = true;
      continue;
    }
    if (inDeps) {
      if (line.startsWith('  ')) {
        lastEntryIdx = i;
      } else if (line.trim() && !line.startsWith(' ')) {
        break;
      }
    }
  }

  return lastEntryIdx;
}

// ──────────────────────────────────────────────
// Step functions
// ──────────────────────────────────────────────

function createFlutterPackage(projectRoot, packageName, dryRun) {
  const packagesDir = path.join(projectRoot, 'packages');
  const packageDir = path.join(packagesDir, packageName);

  if (fs.existsSync(packageDir)) {
    process.stdout.write(`  ⏭️  packages/${packageName}/ 이미 존재 (스킵)\n`);
    return false;
  }

  if (dryRun) {
    process.stdout.write(`  🔍 packages/${packageName}/ 생성 예정 (dry-run)\n`);
    return true;
  }

  fs.mkdirSync(packagesDir, { recursive: true });

  const result = spawnSync(
    'flutter',
    ['create', '--template=package', packageName],
    { cwd: packagesDir, encoding: 'utf-8' },
  );

  if (result.error) {
    if (result.error.code === 'ENOENT') {
      process.stderr.write('❌ flutter 명령을 찾을 수 없습니다.\n');
    } else {
      process.stderr.write(`❌ flutter create 실패: ${result.error.message}\n`);
    }
    process.exit(1);
  }

  if (result.status !== 0) {
    process.stderr.write(`❌ flutter create 실패:\n${result.stderr ?? ''}`);
    process.exit(1);
  }

  process.stdout.write(`  ✅ packages/${packageName}/ 생성 완료\n`);
  return true;
}

function setupPackagePubspec(projectRoot, packageName, dryRun) {
  const pubspecPath = path.join(
    projectRoot,
    'packages',
    packageName,
    'pubspec.yaml',
  );

  if (!fs.existsSync(pubspecPath)) {
    if (dryRun) {
      process.stdout.write(
        '  🔍 publish_to + resolution: workspace 추가 예정 (dry-run)\n',
      );
      return true;
    }
    process.stderr.write(`❌ ${pubspecPath} 파일을 찾을 수 없습니다.\n`);
    process.exit(1);
  }

  let content = fs.readFileSync(pubspecPath, 'utf-8');
  const hasPublishTo = /^publish_to:/m.test(content);
  const hasResolution = /^resolution:\s*workspace\s*$/m.test(content);

  if (hasPublishTo && hasResolution) {
    process.stdout.write(
      '  ⏭️  publish_to + resolution: workspace 이미 설정됨 (스킵)\n',
    );
    return false;
  }

  if (dryRun) {
    const missing = [];
    if (!hasPublishTo) missing.push("publish_to: 'none'");
    if (!hasResolution) missing.push('resolution: workspace');
    process.stdout.write(`  🔍 ${missing.join(' + ')} 추가 예정 (dry-run)\n`);
    return true;
  }

  // publish_to: 'none' 추가 (description: 뒤에 삽입)
  if (!hasPublishTo) {
    try {
      content = insertLineAfter(content, /^description:.*/, "publish_to: 'none'");
    } catch {
      content = content.replace('version:', "publish_to: 'none'\nversion:");
    }
  }

  // resolution: workspace 추가 (homepage: → publish_to: → version: 순으로 시도)
  if (!hasResolution) {
    let inserted = false;
    for (const anchor of [/^homepage:.*/, /^publish_to:.*/, /^version:.*/]) {
      try {
        content = insertLineAfter(content, anchor, 'resolution: workspace');
        inserted = true;
        break;
      } catch {
        // try next anchor
      }
    }
    if (!inserted) {
      content = content.replace(
        'environment:',
        'resolution: workspace\n\nenvironment:',
      );
    }
  }

  fs.writeFileSync(pubspecPath, content, 'utf-8');

  const added = [];
  if (!hasPublishTo) added.push("publish_to: 'none'");
  if (!hasResolution) added.push('resolution: workspace');
  process.stdout.write(`  ✅ ${added.join(' + ')} 추가\n`);
  return true;
}

function addToRootWorkspace(projectRoot, packageName, dryRun) {
  const rootPubspec = path.join(projectRoot, 'pubspec.yaml');
  const content = fs.readFileSync(rootPubspec, 'utf-8');
  const workspaceEntry = `packages/${packageName}`;

  if (content.includes(`  - ${workspaceEntry}`)) {
    process.stdout.write('  ⏭️  루트 workspace에 이미 등록됨 (스킵)\n');
    return false;
  }

  if (dryRun) {
    process.stdout.write(
      `  🔍 루트 workspace에 '${workspaceEntry}' 추가 예정 (dry-run)\n`,
    );
    return true;
  }

  const lastIdx = findLastWorkspaceEntry(content);
  if (lastIdx === -1) {
    process.stderr.write(
      '❌ 루트 pubspec.yaml에서 workspace 블록을 찾을 수 없습니다.\n',
    );
    process.exit(1);
  }

  const lines = content.split('\n');
  lines.splice(lastIdx + 1, 0, `  - ${workspaceEntry}`);
  fs.writeFileSync(rootPubspec, lines.join('\n'), 'utf-8');
  process.stdout.write('  ✅ 루트 workspace에 등록\n');
  return true;
}

function addToEntryDependencies(projectRoot, packageName, entry, dryRun) {
  const entryPubspec = path.join(projectRoot, entry, 'pubspec.yaml');

  if (!fs.existsSync(entryPubspec)) {
    process.stdout.write(`  ⚠️  ${entry}/pubspec.yaml을 찾을 수 없습니다 (스킵)\n`);
    return false;
  }

  const content = fs.readFileSync(entryPubspec, 'utf-8');

  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`^\\s+${escaped}:`, 'm').test(content)) {
    process.stdout.write(`  ⏭️  ${entry} dependencies에 이미 등록됨 (스킵)\n`);
    return false;
  }

  if (dryRun) {
    process.stdout.write(
      `  🔍 ${entry} dependencies에 '${packageName}: any' 추가 예정 (dry-run)\n`,
    );
    return true;
  }

  const lastIdx = findLastDependencyEntry(content);
  if (lastIdx === -1) {
    process.stderr.write(
      `❌ ${entry}/pubspec.yaml에서 dependencies 블록을 찾을 수 없습니다.\n`,
    );
    process.exit(1);
  }

  const lines = content.split('\n');
  lines.splice(lastIdx + 1, 0, '', `  ${packageName}: any`);
  fs.writeFileSync(entryPubspec, lines.join('\n'), 'utf-8');
  process.stdout.write(`  ✅ ${entry} dependencies에 등록\n`);
  return true;
}

function addLeafKitDependency(projectRoot, packageName, ref, dryRun) {
  const pubspecPath = path.join(
    projectRoot,
    'packages',
    packageName,
    'pubspec.yaml',
  );

  if (!fs.existsSync(pubspecPath)) {
    if (dryRun) {
      process.stdout.write('  🔍 flutter_leaf_kit 의존성 추가 예정 (dry-run)\n');
      return true;
    }
    process.stderr.write(`❌ ${pubspecPath} 파일을 찾을 수 없습니다.\n`);
    process.exit(1);
  }

  const content = fs.readFileSync(pubspecPath, 'utf-8');

  if (/^\s+flutter_leaf_kit:/m.test(content)) {
    process.stdout.write('  ⏭️  flutter_leaf_kit 의존성 이미 존재 (스킵)\n');
    return false;
  }

  if (dryRun) {
    process.stdout.write(
      `  🔍 flutter_leaf_kit (ref: '${ref}') 의존성 추가 예정 (dry-run)\n`,
    );
    return true;
  }

  const lastIdx = findLastDependencyEntry(content);
  if (lastIdx === -1) {
    process.stderr.write(
      '❌ 패키지 pubspec.yaml에서 dependencies 블록을 찾을 수 없습니다.\n',
    );
    process.exit(1);
  }

  const leafKitBlock = [
    '',
    '  # flutter_leaf_kit',
    '  flutter_leaf_kit:',
    '    git:',
    `      url: ${LEAF_KIT_GIT_URL}`,
    `      ref: '${ref}'`,
    `      path: ${LEAF_KIT_GIT_PATH}`,
  ];

  const lines = content.split('\n');
  lines.splice(lastIdx + 1, 0, ...leafKitBlock);
  fs.writeFileSync(pubspecPath, lines.join('\n'), 'utf-8');
  process.stdout.write(`  ✅ flutter_leaf_kit (ref: '${ref}') 의존성 추가\n`);
  return true;
}

function runPubGet(projectRoot, dryRun) {
  if (dryRun) {
    process.stdout.write('  🔍 flutter pub get 실행 예정 (dry-run)\n');
    return false;
  }

  const result = spawnSync('flutter', ['pub', 'get'], {
    cwd: projectRoot,
    encoding: 'utf-8',
  });

  if (result.error || result.status !== 0) {
    const msg = result.error ? result.error.message : result.stderr ?? '';
    process.stderr.write(`⚠️  flutter pub get 경고:\n${msg}`);
    return false;
  }

  process.stdout.write('  ✅ flutter pub get 완료\n');
  return true;
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────

function main() {
  const args = parseArgs(process.argv);
  const {
    packageName,
    entry,
    dryRun,
    noAppDep,
    withLeafKit,
    leafKitRef: leafKitRefArg,
  } = args;

  // 프로젝트 루트 경로 결정 (.claude/scripts/flutter/create/ → 4단계 상위)
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(scriptDir, '..', '..', '..', '..');

  validatePackageName(packageName);

  // leaf-kit ref 결정
  let leafKitRef = null;
  if (withLeafKit) {
    leafKitRef = leafKitRefArg
      ? normalizeRef(leafKitRefArg)
      : extractLeafKitRef(projectRoot, entry);
  }

  process.stdout.write(`📦 패키지: ${packageName}\n`);
  process.stdout.write(`   entry: ${entry}\n`);
  if (withLeafKit) {
    process.stdout.write(`   leaf-kit ref: ${leafKitRef}\n`);
  }
  if (dryRun) {
    process.stdout.write('   (dry-run 모드)\n\n');
  } else {
    process.stdout.write('\n');
  }

  const changes = [];

  // Step 1: 패키지 생성
  changes.push(createFlutterPackage(projectRoot, packageName, dryRun));

  // Step 2: publish_to + resolution: workspace 추가
  if (!dryRun && !fs.existsSync(path.join(projectRoot, 'packages', packageName))) {
    process.stderr.write('❌ 패키지 디렉토리가 없어 설정을 진행할 수 없습니다.\n');
    process.exit(1);
  }
  changes.push(setupPackagePubspec(projectRoot, packageName, dryRun));

  // Step 3: 루트 workspace 등록
  changes.push(addToRootWorkspace(projectRoot, packageName, dryRun));

  // Step 4: flutter_leaf_kit 의존성 추가
  if (withLeafKit) {
    changes.push(
      addLeafKitDependency(projectRoot, packageName, leafKitRef, dryRun),
    );
  } else {
    process.stdout.write('  ⏭️  flutter_leaf_kit 의존성 생략 (--with-leaf-kit 없음)\n');
  }

  // Step 5: 엔트리 dependencies 등록
  if (noAppDep) {
    process.stdout.write(`  ⏭️  ${entry} dependencies 등록 생략 (--no-app-dep)\n`);
  } else {
    changes.push(addToEntryDependencies(projectRoot, packageName, entry, dryRun));
  }

  // Step 6: flutter pub get (변경 사항이 있을 때만)
  process.stdout.write('\n');
  const hasChanges = changes.some(Boolean);

  if (hasChanges) {
    runPubGet(projectRoot, dryRun);
    const changeCount = changes.filter(Boolean).length;
    const action = dryRun ? '변경 예정' : '설정 완료';
    process.stdout.write(`\n${changeCount}개 ${action}\n`);
  } else {
    process.stdout.write('이미 설정 완료 상태입니다.\n');
  }

  process.exit(0);
}

main();
