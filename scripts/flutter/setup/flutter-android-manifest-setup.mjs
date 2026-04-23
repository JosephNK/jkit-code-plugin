#!/usr/bin/env node
// =============================================================================
// Flutter Android AndroidManifest.xml 패치 스크립트
//
// 기존 AndroidManifest.xml을 읽어서 필요한 설정만 추가/변경합니다.
// Flutter 기본 템플릿이나 사용자 커스텀 설정을 보존합니다.
//
// 패치 항목:
//   1. xmlns:tools 네임스페이스 추가
//   2. INTERNET 퍼미션 추가
//   3. android:label → @string/app_name 변경
//   4. application 속성 추가 (requestLegacyExternalStorage, usesCleartextTraffic, allowBackup)
//   5. launchMode singleTop → singleTask 변경
//   6. Deep link intent-filter 추가
//
// Usage:
//   flutter-android-manifest-setup.mjs <manifest_path>
// =============================================================================

import fs from 'node:fs';
import process from 'node:process';

const HELP = `Usage: flutter-android-manifest-setup.mjs <manifest_path>

기존 AndroidManifest.xml을 읽어 필요한 설정을 패치한 결과를 stdout으로 출력합니다.

Arguments:
  <manifest_path>   AndroidManifest.xml 경로

Options:
  -h, --help        Show this help

Example:
  flutter-android-manifest-setup.mjs app/android/app/src/main/AndroidManifest.xml
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
    process.stderr.write('Error: <manifest_path> is required\n');
    usage();
  }
  if (positional.length > 1) {
    process.stderr.write(`Error: unexpected extra arguments: ${positional.slice(1).join(' ')}\n`);
    usage();
  }

  return { manifestPath: positional[0] };
}

const DEEP_LINK_INTENT_FILTER = `
            <!-- Scheme -->
            <intent-filter>
                <action android:name="android.intent.action.VIEW"/>
                <category android:name="android.intent.category.DEFAULT"/>
                <category android:name="android.intent.category.BROWSABLE"/>
                <data android:scheme="\${scheme}"/>
            </intent-filter>`;

const APP_ATTRIBUTES =
  'android:requestLegacyExternalStorage="true"\n' +
  '        android:usesCleartextTraffic="true"\n' +
  '        android:allowBackup="false"\n' +
  '        tools:replace="android:allowBackup"';

function replaceOnce(content, pattern, replacement) {
  const idx = content.indexOf(pattern);
  if (idx === -1) return content;
  return content.slice(0, idx) + replacement + content.slice(idx + pattern.length);
}

function patchManifest(input) {
  let content = input;

  // 1. xmlns:tools 네임스페이스 추가
  if (!content.includes('xmlns:tools')) {
    content = replaceOnce(
      content,
      'xmlns:android="http://schemas.android.com/apk/res/android"',
      'xmlns:android="http://schemas.android.com/apk/res/android"\n' +
        '    xmlns:tools="http://schemas.android.com/tools"',
    );
  }

  // 2. INTERNET 퍼미션 추가
  if (!content.includes('android.permission.INTERNET')) {
    content = replaceOnce(
      content,
      '\n    <application',
      '\n    <uses-permission android:name="android.permission.INTERNET"/>\n\n    <application',
    );
  }

  // 3. android:label → @string/app_name
  if (!content.includes('@string/app_name')) {
    content = content.replace(/android:label="[^"]*"/, 'android:label="@string/app_name"');
  }

  // 4. application 속성 추가 (icon 다음에 삽입)
  if (!content.includes('requestLegacyExternalStorage')) {
    content = replaceOnce(
      content,
      'android:icon="@mipmap/ic_launcher">',
      `android:icon="@mipmap/ic_launcher"\n        ${APP_ATTRIBUTES}>`,
    );
  }

  // 5. launchMode → singleTask
  if (content.includes('singleTop')) {
    content = content.replace(
      'android:launchMode="singleTop"',
      'android:launchMode="singleTask"',
    );
  }

  // 6. Deep link intent-filter 추가
  if (!content.includes('android.intent.action.VIEW')) {
    const launcherEnd = 'android.intent.category.LAUNCHER';
    const pos = content.indexOf(launcherEnd);
    if (pos !== -1) {
      const filterClose = '</intent-filter>';
      const closePos = content.indexOf(filterClose, pos);
      if (closePos !== -1) {
        const insertPos = closePos + filterClose.length;
        content = content.slice(0, insertPos) + DEEP_LINK_INTENT_FILTER + content.slice(insertPos);
      }
    }
  }

  return content;
}

function main() {
  const args = parseArgs(process.argv);

  let content;
  try {
    content = fs.readFileSync(args.manifestPath, 'utf-8');
  } catch (err) {
    process.stderr.write(`Error reading ${args.manifestPath}: ${err.message}\n`);
    process.exit(1);
  }

  const patched = patchManifest(content);
  process.stdout.write(patched.replace(/\n+$/, '') + '\n');
}

main();
