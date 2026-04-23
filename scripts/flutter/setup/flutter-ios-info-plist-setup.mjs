#!/usr/bin/env node
// =============================================================================
// Flutter iOS Info.plist 패치 스크립트
//
// 기존 Info.plist를 읽어서 필요한 설정만 추가/변경합니다.
// Flutter 기본 템플릿이나 사용자 커스텀 설정을 보존합니다.
//
// 패치 항목:
//   1. CFBundleDisplayName: 하드코딩 값 → $(APP_DISPLAY_NAME) 빌드 변수
//   2. CFBundleURLTypes: Deep link URL scheme 블록 추가
//
// Usage:
//   flutter-ios-info-plist-setup.mjs <plist_path>
// =============================================================================

import fs from 'node:fs';
import process from 'node:process';

const HELP = `Usage: flutter-ios-info-plist-setup.mjs <plist_path>

기존 Info.plist를 읽어 필요한 설정을 패치한 결과를 stdout으로 출력합니다.

Arguments:
  <plist_path>   Info.plist 경로

Options:
  -h, --help     Show this help

Example:
  flutter-ios-info-plist-setup.mjs app/ios/Runner/Info.plist
`;

function usage(code = 1) {
  (code === 0 ? process.stdout : process.stderr).write(HELP);
  process.exit(code);
}

function parseArgs(argv) {
  const positional = [];
  const rest = argv.slice(2);

  while (rest.length > 0) {
    const a = rest.shift();
    switch (a) {
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
    process.stderr.write('Error: <plist_path> is required\n');
    usage();
  }
  if (positional.length > 1) {
    process.stderr.write(`Error: unexpected extra arguments: ${positional.slice(1).join(' ')}\n`);
    usage();
  }

  return { plistPath: positional[0] };
}

const URL_TYPES_BLOCK = `\t<key>CFBundleURLTypes</key>
\t<array>
\t\t<dict>
\t\t\t<key>CFBundleTypeRole</key>
\t\t\t<string>Editor</string>
\t\t\t<key>CFBundleURLSchemes</key>
\t\t\t<array>
\t\t\t\t<string>$(APP_URL_SCHEMES)</string>
\t\t\t</array>
\t\t</dict>
\t</array>`;

function patchInfoPlist(input) {
  let content = input;

  // 1. CFBundleDisplayName → $(APP_DISPLAY_NAME)
  if (!content.includes('$(APP_DISPLAY_NAME)')) {
    if (content.includes('<key>CFBundleDisplayName</key>')) {
      // 기존 키가 있으면 다음 줄의 <string> 값을 교체
      const lines = content.split('\n');
      const newLines = [];
      for (let i = 0; i < lines.length; i += 1) {
        newLines.push(lines[i]);
        if (lines[i].includes('<key>CFBundleDisplayName</key>')) {
          i += 1;
          if (i < lines.length) {
            const line = lines[i];
            const indent = line.slice(0, line.length - line.trimStart().length);
            newLines.push(`${indent}<string>$(APP_DISPLAY_NAME)</string>`);
          }
        }
      }
      content = newLines.join('\n');
    } else {
      // 키가 없으면 CFBundleExecutable 앞에 추가
      content = content.replace(
        '\t<key>CFBundleExecutable</key>',
        '\t<key>CFBundleDisplayName</key>\n' +
          '\t<string>$(APP_DISPLAY_NAME)</string>\n' +
          '\t<key>CFBundleExecutable</key>',
      );
    }
  }

  // 2. CFBundleURLTypes 블록 추가
  if (!content.includes('CFBundleURLTypes')) {
    const lastDictClose = content.lastIndexOf('</dict>');
    if (lastDictClose !== -1) {
      content =
        content.slice(0, lastDictClose) +
        URL_TYPES_BLOCK +
        '\n' +
        content.slice(lastDictClose);
    }
  }

  return content;
}

function main() {
  const args = parseArgs(process.argv);

  let content;
  try {
    content = fs.readFileSync(args.plistPath, 'utf-8');
  } catch (err) {
    process.stderr.write(`Error reading ${args.plistPath}: ${err.message}\n`);
    process.exit(1);
  }

  const patched = patchInfoPlist(content);
  process.stdout.write(patched.replace(/\n+$/, '') + '\n');
}

main();
