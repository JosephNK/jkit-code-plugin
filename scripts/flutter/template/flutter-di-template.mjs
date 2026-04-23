#!/usr/bin/env node
// Flutter DI 등록 템플릿 생성 스크립트
// injection_container.dart에 추가할 BLoC 등록 코드를 생성합니다.

import process from 'node:process';

function toSnakeCase(name) {
  let out = '';
  for (let i = 0; i < name.length; i++) {
    const ch = name[i];
    if (ch >= 'A' && ch <= 'Z' && i > 0) {
      out += '_';
    }
    out += ch.toLowerCase();
  }
  return out;
}

function generateDiRegistration(screenName, featureDir) {
  const snakeName = toSnakeCase(screenName);

  const importLine = `import '../features/${featureDir}/presentation/bloc/${snakeName}_bloc.dart';`;
  const registrationLine = `  sl.registerFactory(() => ${screenName}Bloc());`;

  return `${importLine}

// Add to setupDependencies() BLoCs section:
${registrationLine}`;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 1) {
    process.stderr.write('Usage: flutter-di-template.mjs <ScreenName> [feature_dir]\n');
    process.stderr.write('Example: flutter-di-template.mjs Login login\n');
    process.stderr.write('Example: flutter-di-template.mjs Settings user/settings\n');
    process.exit(1);
  }

  const screenName = argv[0];
  const snakeName = toSnakeCase(screenName);
  const featureDir = argv[1] ?? snakeName;

  console.log(generateDiRegistration(screenName, featureDir));
}

main();
