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

function generateDiRegistration(screenName, featureDir, pkg) {
  const snakeName = toSnakeCase(screenName);

  const importPath = pkg
    ? `package:${pkg}/features/${featureDir}/presentation/bloc/${snakeName}_bloc.dart`
    : `../features/${featureDir}/presentation/bloc/${snakeName}_bloc.dart`;
  const importLine = `import '${importPath}';`;
  const registrationLine = `  sl.registerFactory(${screenName}Bloc.new);`;

  return `${importLine}

// Add to setupDependencies() BLoCs section:
${registrationLine}`;
}

function parseArgs(argv) {
  const opts = { screenName: '', featureDir: '', pkg: '' };
  const rest = [...argv];
  const positional = [];
  while (rest.length > 0) {
    const a = rest.shift();
    if (a === '--package' || a === '-p') {
      opts.pkg = rest.shift() ?? '';
    } else if (a === '-h' || a === '--help') {
      printUsage();
      process.exit(0);
    } else if (a.startsWith('-')) {
      process.stderr.write(`Unknown option: ${a}\n`);
      process.exit(2);
    } else {
      positional.push(a);
    }
  }
  opts.screenName = positional[0] ?? '';
  opts.featureDir = positional[1] ?? '';
  return opts;
}

function printUsage() {
  process.stderr.write('Usage: flutter-di-template.mjs <ScreenName> [feature_dir] [--package <pkg>]\n');
  process.stderr.write('Example: flutter-di-template.mjs Login login --package vocabit_app\n');
  process.stderr.write('Example: flutter-di-template.mjs Settings user/settings --package vocabit_app\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.screenName) {
    printUsage();
    process.exit(1);
  }
  const featureDir = opts.featureDir || toSnakeCase(opts.screenName);
  console.log(generateDiRegistration(opts.screenName, featureDir, opts.pkg));
}

main();
