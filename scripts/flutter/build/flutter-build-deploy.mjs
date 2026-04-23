#!/usr/bin/env node
// =============================================================================
// Flutter 앱 빌드 스크립트.
//
// Usage:
//   flutter-build-deploy.mjs <os> <flavor> [--no-tree-shake-icons]
//                            [--export-options-plist <path>]
//                            --project-dir <dir>
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const SUPPORTED_OS = ['aos', 'ios'];
const SUPPORTED_FLAVORS = [
  'appbundle',
  'production',
  'staging',
  'development',
  'qa',
];

const HELP = `Usage: flutter-build-deploy.mjs <os> <flavor> [options] --project-dir <dir>

Flutter 앱 빌드 (Android APK/AppBundle, iOS IPA).

Arguments:
  <os>      타겟 OS: ${SUPPORTED_OS.join(' | ')}
  <flavor>  빌드 flavor (예: ${SUPPORTED_FLAVORS.join(', ')})

Options:
  --no-tree-shake-icons          아이콘 tree-shake 비활성화 (기본값: 활성)
  --export-options-plist <path>  iOS export-options-plist 파일 경로
  --project-dir <dir>            프로젝트 루트 디렉토리 (required)
  -h, --help                     Show this help
`;

function usage(code = 1) {
  (code === 0 ? process.stdout : process.stderr).write(HELP);
  process.exit(code);
}

function parseArgs(argv) {
  const args = {
    os: '',
    flavor: '',
    noTreeShakeIcons: true,
    exportOptionsPlist: null,
    projectDir: '',
  };
  const positional = [];
  const rest = argv.slice(2);

  while (rest.length > 0) {
    const a = rest.shift();
    switch (a) {
      case '--no-tree-shake-icons':
        args.noTreeShakeIcons = true;
        break;
      case '--export-options-plist':
        if (!rest.length) {
          process.stderr.write('--export-options-plist requires a value\n');
          usage();
        }
        args.exportOptionsPlist = rest.shift();
        break;
      case '--project-dir':
        if (!rest.length) {
          process.stderr.write('--project-dir requires a value\n');
          usage();
        }
        args.projectDir = rest.shift();
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

  if (positional.length < 2) {
    process.stderr.write('Error: <os> and <flavor> are required\n');
    usage();
  }
  args.os = positional[0];
  args.flavor = positional[1];

  if (!SUPPORTED_OS.includes(args.os)) {
    process.stderr.write(
      `Error: invalid os '${args.os}' (expected: ${SUPPORTED_OS.join(', ')})\n`,
    );
    usage();
  }
  if (!args.projectDir) {
    process.stderr.write('Error: --project-dir is required\n');
    usage();
  }

  return args;
}

function findFlutterProjectDir(projectRoot) {
  const directPubspec = path.join(projectRoot, 'pubspec.yaml');
  const directLib = path.join(projectRoot, 'lib');
  if (
    fs.existsSync(directPubspec) &&
    fs.statSync(directPubspec).isFile() &&
    fs.existsSync(directLib) &&
    fs.statSync(directLib).isDirectory()
  ) {
    return projectRoot;
  }

  let entries;
  try {
    entries = fs.readdirSync(projectRoot, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const child = path.join(projectRoot, entry.name);
    const pubspec = path.join(child, 'pubspec.yaml');
    const lib = path.join(child, 'lib');
    if (
      fs.existsSync(pubspec) &&
      fs.statSync(pubspec).isFile() &&
      fs.existsSync(lib) &&
      fs.statSync(lib).isDirectory()
    ) {
      return child;
    }
  }

  return null;
}

function runCommand(cmd, cwd) {
  const result = spawnSync(cmd[0], cmd.slice(1), { cwd, stdio: 'inherit' });
  if (result.error) {
    if (result.error.code === 'ENOENT') {
      process.stderr.write('Error: flutter command not found.\n');
      return 1;
    }
    process.stderr.write(`Error: ${result.error.message}\n`);
    return 1;
  }
  return result.status ?? 1;
}

function buildAndroid(flavor, treeShakeIcons, cwd) {
  const treeShakeFlag = treeShakeIcons ? [] : ['--no-tree-shake-icons'];
  let cmd;
  if (flavor === 'appbundle') {
    process.stdout.write('Android AppBundle Production Building..\n');
    cmd = [
      'flutter',
      'build',
      'appbundle',
      ...treeShakeFlag,
      '--flavor',
      'production',
    ];
  } else {
    const pretty = flavor.charAt(0).toUpperCase() + flavor.slice(1);
    process.stdout.write(`Android ${pretty} Building..\n`);
    cmd = ['flutter', 'build', 'apk', ...treeShakeFlag, '--flavor', flavor];
  }
  return runCommand(cmd, cwd);
}

function buildIos(flavor, treeShakeIcons, cwd, exportOptionsPlist) {
  const treeShakeFlag = treeShakeIcons ? [] : ['--no-tree-shake-icons'];

  if (flavor === 'appbundle') {
    process.stdout.write('iOS AppBundle Production Not Support..\n');
    return 1;
  }

  const pretty = flavor.charAt(0).toUpperCase() + flavor.slice(1);
  process.stdout.write(`iOS ${pretty} Building..\n`);
  const cmd = ['flutter', 'build', 'ipa', ...treeShakeFlag, '--flavor', flavor];

  if (exportOptionsPlist) {
    cmd.push('--export-options-plist', exportOptionsPlist);
  }

  return runCommand(cmd, cwd);
}

function main() {
  const args = parseArgs(process.argv);

  const projectRoot = path.resolve(args.projectDir);
  const flutterDir = findFlutterProjectDir(projectRoot);

  if (flutterDir === null) {
    process.stderr.write('Error: Flutter project not found\n');
    process.exit(1);
  }

  // NOTE: Python 원본의 argparse default=True + store_true 동작을 그대로
  // 유지 — --no-tree-shake-icons 플래그는 항상 True이며 treeShakeIcons는
  // 항상 false. flutter에는 항상 --no-tree-shake-icons가 전달된다.
  const treeShakeIcons = !args.noTreeShakeIcons;

  let result;
  if (args.os === 'aos') {
    result = buildAndroid(args.flavor, treeShakeIcons, flutterDir);
  } else {
    result = buildIos(
      args.flavor,
      treeShakeIcons,
      flutterDir,
      args.exportOptionsPlist,
    );
  }

  if (result === 0) {
    process.stdout.write('Build Done\n');
  }

  process.exit(result);
}

main();
