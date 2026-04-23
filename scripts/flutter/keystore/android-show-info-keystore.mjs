#!/usr/bin/env node
// =============================================================================
// Keystore 정보 조회 스크립트.
//
// Usage:
//   android-show-info-keystore.mjs <keystore> --project-dir <dir>
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const HELP = `Usage: android-show-info-keystore.mjs <keystore> --project-dir <dir>

Keystore 정보를 조회합니다 (keytool -list -v).

Arguments:
  <keystore>           키스토어 파일 경로 (예: my-release-key.keystore)

Options:
  --project-dir <dir>  프로젝트 루트 디렉토리 (required)
  -h, --help           Show this help
`;

function usage(code = 1) {
  (code === 0 ? process.stdout : process.stderr).write(HELP);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { keystore: '', projectDir: '' };
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

  if (positional.length < 1) {
    process.stderr.write('Error: <keystore> is required\n');
    usage();
  }
  args.keystore = positional[0];

  if (!args.projectDir) {
    process.stderr.write('Error: --project-dir is required\n');
    usage();
  }

  return args;
}

function findAndroidDir(projectRoot) {
  const directAndroid = path.join(projectRoot, 'android');
  if (fs.existsSync(directAndroid) && fs.statSync(directAndroid).isDirectory()) {
    return directAndroid;
  }

  let entries;
  try {
    entries = fs.readdirSync(projectRoot, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(projectRoot, entry.name, 'android');
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }

  return null;
}

function main() {
  const args = parseArgs(process.argv);

  let keystorePath = args.keystore;
  if (!path.isAbsolute(keystorePath)) {
    const projectRoot = path.resolve(args.projectDir);
    const androidDir = findAndroidDir(projectRoot);
    if (androidDir === null) {
      process.stderr.write('Error: android directory not found in project\n');
      process.exit(1);
    }
    keystorePath = path.join(androidDir, args.keystore);
  }

  if (!fs.existsSync(keystorePath)) {
    process.stderr.write(`Error: Keystore not found at ${keystorePath}\n`);
    process.exit(1);
  }

  const cmd = ['keytool', '-list', '-keystore', keystorePath, '-v'];
  const result = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit' });

  if (result.error) {
    if (result.error.code === 'ENOENT') {
      process.stderr.write(
        'Error: keytool command not found. Please ensure JDK is installed.\n',
      );
      process.exit(1);
    }
    process.stderr.write(`Error: ${result.error.message}\n`);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

main();
