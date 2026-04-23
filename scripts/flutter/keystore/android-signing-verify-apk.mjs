#!/usr/bin/env node
// =============================================================================
// APK 서명 검증 스크립트.
//
// Usage:
//   android-signing-verify-apk.mjs [apk] --project-dir <dir>
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const DEFAULT_APK = 'build/app/outputs/flutter-apk/app.apk';

const HELP = `Usage: android-signing-verify-apk.mjs [apk] --project-dir <dir>

APK 서명을 검증합니다 (apksigner verify --print-certs).

Arguments:
  [apk]                APK 파일 경로 (기본값: ${DEFAULT_APK})

Options:
  --project-dir <dir>  프로젝트 루트 디렉토리 (required)
  -h, --help           Show this help
`;

function usage(code = 1) {
  (code === 0 ? process.stdout : process.stderr).write(HELP);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { apk: DEFAULT_APK, projectDir: '' };
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

  if (positional.length >= 1) {
    args.apk = positional[0];
  }

  if (!args.projectDir) {
    process.stderr.write('Error: --project-dir is required\n');
    usage();
  }

  return args;
}

function findFlutterProjectDir(projectRoot) {
  const directPubspec = path.join(projectRoot, 'pubspec.yaml');
  if (fs.existsSync(directPubspec) && fs.statSync(directPubspec).isFile()) {
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
    const pubspec = path.join(projectRoot, entry.name, 'pubspec.yaml');
    if (fs.existsSync(pubspec) && fs.statSync(pubspec).isFile()) {
      return path.join(projectRoot, entry.name);
    }
  }

  return null;
}

function main() {
  const args = parseArgs(process.argv);

  let apkPath = args.apk;
  if (!path.isAbsolute(apkPath)) {
    const projectRoot = path.resolve(args.projectDir);
    const flutterDir = findFlutterProjectDir(projectRoot);
    if (flutterDir === null) {
      process.stderr.write('Error: Flutter project not found\n');
      process.exit(1);
    }
    apkPath = path.join(flutterDir, args.apk);
  }

  if (!fs.existsSync(apkPath)) {
    process.stderr.write(`Error: APK not found at ${apkPath}\n`);
    process.exit(1);
  }

  const cmd = ['apksigner', 'verify', '--print-certs', apkPath];
  const result = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit' });

  if (result.error) {
    if (result.error.code === 'ENOENT') {
      process.stderr.write(
        'Error: apksigner command not found. Please ensure Android SDK build-tools is installed.\n',
      );
      process.exit(1);
    }
    process.stderr.write(`Error: ${result.error.message}\n`);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

main();
