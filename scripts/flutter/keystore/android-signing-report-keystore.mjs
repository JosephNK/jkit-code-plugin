#!/usr/bin/env node
// =============================================================================
// Android keystore signing report 조회 스크립트.
//
// Usage:
//   android-signing-report-keystore.mjs <keystore> <alias>
//                                       -s|--storepass <pw> -p|--keypass <pw>
//                                       --project-dir <dir>
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const HELP = `Usage: android-signing-report-keystore.mjs <keystore> <alias> [options] --project-dir <dir>

Android keystore signing report를 조회합니다 (keytool -list -v -alias).

Arguments:
  <keystore>                키스토어 파일 경로 (예: my-release-key.keystore)
  <alias>                   키스토어 별칭 (예: my-key-alias)

Options:
  -s, --storepass <pw>      키스토어 비밀번호 (required)
  -p, --keypass <pw>        키 비밀번호 (required)
  --project-dir <dir>       프로젝트 루트 디렉토리 (required)
  -h, --help                Show this help
`;

function usage(code = 1) {
  (code === 0 ? process.stdout : process.stderr).write(HELP);
  process.exit(code);
}

function parseArgs(argv) {
  const args = {
    keystore: '',
    alias: '',
    storepass: '',
    keypass: '',
    projectDir: '',
  };
  const positional = [];
  const rest = argv.slice(2);

  while (rest.length > 0) {
    const a = rest.shift();
    switch (a) {
      case '-s':
      case '--storepass':
        if (!rest.length) {
          process.stderr.write(`${a} requires a value\n`);
          usage();
        }
        args.storepass = rest.shift();
        break;
      case '-p':
      case '--keypass':
        if (!rest.length) {
          process.stderr.write(`${a} requires a value\n`);
          usage();
        }
        args.keypass = rest.shift();
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
    process.stderr.write('Error: <keystore> and <alias> are required\n');
    usage();
  }
  args.keystore = positional[0];
  args.alias = positional[1];

  if (!args.storepass) {
    process.stderr.write('Error: -s/--storepass is required\n');
    usage();
  }
  if (!args.keypass) {
    process.stderr.write('Error: -p/--keypass is required\n');
    usage();
  }
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

  const cmd = [
    'keytool',
    '-list',
    '-v',
    '-keystore',
    keystorePath,
    '-alias',
    args.alias,
    '-storepass',
    args.storepass,
    '-keypass',
    args.keypass,
  ];
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
