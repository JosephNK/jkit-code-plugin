#!/usr/bin/env node
// =============================================================================
// Flutter 다국어 리소스 빈 JSON 파일 생성 및 pubspec.yaml assets 등록 스크립트.
//
// Usage:
//   flutter-assets-lang-setup.mjs [-entry <dir>]
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_LANGS = ['en-US', 'ja-JP', 'ko-KR'];
const DEFAULT_LANGS_DIR = 'assets/langs';
const DEFAULT_PUBSPEC_FILE = 'pubspec.yaml';
const ASSETS_ENTRY = 'assets/langs/';

const HELP = `Usage: flutter-assets-lang-setup.mjs [-entry <dir>]

다국어 리소스 빈 JSON 파일(en-US, ja-JP, ko-KR)을 생성하고
pubspec.yaml의 flutter 섹션에 assets 항목을 등록합니다.

Options:
  -entry <dir>   엔트리 디렉토리 (예: app). 생략 시 assets/langs/, pubspec.yaml
  -h, --help     Show this help
`;

function usage(code = 1) {
  (code === 0 ? process.stdout : process.stderr).write(HELP);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { entry: '' };
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
      case '-h':
      case '--help':
        usage(0);
        break;
      default:
        process.stderr.write(`Unknown option: ${a}\n`);
        usage();
    }
  }

  return args;
}

function generateLangFiles(outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });

  const created = [];
  for (const lang of DEFAULT_LANGS) {
    const filePath = path.join(outputDir, `${lang}.json`);
    fs.writeFileSync(filePath, '{}\n', 'utf-8');
    created.push(filePath);
  }
  return created;
}

function updatePubspecAssets(pubspecPath) {
  if (!fs.existsSync(pubspecPath)) {
    process.stderr.write(`Warning: ${pubspecPath} not found\n`);
    return false;
  }

  const content = fs.readFileSync(pubspecPath, 'utf-8');

  if (content.includes(ASSETS_ENTRY)) {
    return false;
  }

  const pattern = /(  uses-material-design: true)\n/;
  const replacement = `$1\n\n  assets:\n    - ${ASSETS_ENTRY}\n`;

  const updated = content.replace(pattern, replacement);
  if (updated === content) {
    process.stderr.write('Warning: could not find insertion point in pubspec.yaml\n');
    return false;
  }

  fs.writeFileSync(pubspecPath, updated, 'utf-8');
  return true;
}

function main() {
  const args = parseArgs(process.argv);

  const outputDir = args.entry
    ? `${args.entry}/${DEFAULT_LANGS_DIR}`
    : DEFAULT_LANGS_DIR;
  const pubspecPath = args.entry
    ? `${args.entry}/${DEFAULT_PUBSPEC_FILE}`
    : DEFAULT_PUBSPEC_FILE;

  const created = generateLangFiles(outputDir);
  for (const filePath of created) {
    process.stdout.write(`${filePath}\n`);
  }

  if (updatePubspecAssets(pubspecPath)) {
    process.stdout.write(`Updated ${pubspecPath}: added assets entry\n`);
  } else {
    process.stdout.write(`Skipped ${pubspecPath}: assets entry already exists\n`);
  }
}

main();
