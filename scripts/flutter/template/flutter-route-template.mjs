#!/usr/bin/env node
// Flutter GoRoute 템플릿 생성 스크립트

import process from 'node:process';

function generateRoute(screenName, routePath = '/', noTransition = false) {
  if (noTransition) {
    return `GoRoute(
        path: '${routePath}',
        pageBuilder: (BuildContext context, GoRouterState state) {
          return NoTransitionPage<void>(
            child: MultiBlocProvider(
              providers: [
                BlocProvider(
                  create: (_) => sl<${screenName}Bloc>()..add(${screenName}LoadRequested()),
                ),
              ],
              child: const ${screenName}Screen(),
            ),
          );
        },
      ),`;
  }

  return `GoRoute(
        path: '${routePath}',
        builder: (BuildContext context, GoRouterState state) {
          return MultiBlocProvider(
            providers: [
              BlocProvider(
                create: (_) => sl<${screenName}Bloc>()..add(${screenName}LoadRequested()),
              ),
            ],
            child: ${screenName}Screen(),
          );
        },
      ),`;
}

function printUsage() {
  process.stderr.write('usage: flutter-route-template.mjs [-h] [-nt] screen_name [path]\n');
  process.stderr.write('\nFlutter GoRoute 템플릿 생성\n');
  process.stderr.write('\npositional arguments:\n');
  process.stderr.write('  screen_name  스크린 이름 (PascalCase, 예: Login)\n');
  process.stderr.write('  path         라우트 경로 (기본: /)\n');
  process.stderr.write('\noptions:\n');
  process.stderr.write('  -h, --help   show this help message and exit\n');
  process.stderr.write('  -nt          NoTransitionPage 래핑 (pageBuilder 사용)\n');
}

function main() {
  const argv = process.argv.slice(2);
  let noTransition = false;
  const positional = [];

  for (const arg of argv) {
    if (arg === '-h' || arg === '--help') {
      printUsage();
      process.exit(0);
    } else if (arg === '-nt') {
      noTransition = true;
    } else if (arg.startsWith('-')) {
      process.stderr.write(`error: unrecognized arguments: ${arg}\n`);
      process.exit(2);
    } else {
      positional.push(arg);
    }
  }

  if (positional.length < 1) {
    process.stderr.write('error: the following arguments are required: screen_name\n');
    process.exit(2);
  }
  if (positional.length > 2) {
    process.stderr.write(`error: unrecognized arguments: ${positional.slice(2).join(' ')}\n`);
    process.exit(2);
  }

  const screenName = positional[0];
  const routePath = positional[1] ?? '/';
  console.log(generateRoute(screenName, routePath, noTransition));
}

main();
