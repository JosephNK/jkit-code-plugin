#!/usr/bin/env node
// =============================================================================
// Flutter Packages - Dependencies Update Script
//
// 워크스페이스 pubspec.yaml 의 dependencies / dev_dependencies 버전을 pub.dev
// 최신 버전과 비교하여 업데이트한다.
//
// Usage:
//   update-dependencies.mjs --project-dir <dir>
//   update-dependencies.mjs --project-dir <dir> --report
//   update-dependencies.mjs --project-dir <dir> --package leaf_core
//   update-dependencies.mjs --project-dir <dir> --include-major
//   update-dependencies.mjs --project-dir <dir> --exclude flutter_leaf my_internal
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';

import YAML from 'yaml';

const HELP = `Usage: update-dependencies.mjs --project-dir <dir> [options]

Flutter 워크스페이스 dependencies 업데이트.

Options:
  --project-dir <dir>    프로젝트 루트 디렉토리 (required)
  --all                  모든 패키지 업데이트 (기본값)
  --package <name>       특정 패키지만 업데이트 (예: package_common)
  --report               리포트만 출력 (업데이트 안함)
  --include-major        Major 버전 업데이트 포함
  --exclude <p1> <p2>... 제외할 패키지 prefix 목록
  -h, --help             Show this help
`;

function usage(code = 1) {
  (code === 0 ? process.stdout : process.stderr).write(HELP);
  process.exit(code);
}

function parseArgs(argv) {
  const args = {
    projectDir: '',
    all: false,
    package: null,
    report: false,
    includeMajor: false,
    exclude: [],
  };
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
      case '--all':
        args.all = true;
        break;
      case '--package':
        if (!rest.length) {
          process.stderr.write('--package requires a value\n');
          usage();
        }
        args.package = rest.shift();
        break;
      case '--report':
        args.report = true;
        break;
      case '--include-major':
        args.includeMajor = true;
        break;
      case '--exclude': {
        if (!rest.length || rest[0].startsWith('-')) {
          process.stderr.write('--exclude requires at least one value\n');
          usage();
        }
        while (rest.length && !rest[0].startsWith('-')) {
          args.exclude.push(rest.shift());
        }
        break;
      }
      case '-h':
      case '--help':
        usage(0);
        break;
      default:
        process.stderr.write(`Unknown option: ${a}\n`);
        usage();
    }
  }

  if (!args.projectDir) {
    process.stderr.write('Error: --project-dir is required\n');
    usage();
  }

  return args;
}

async function getLatestVersion(pkgName) {
  const url = `https://pub.dev/api/packages/${pkgName}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.latest?.version ?? null;
  } catch {
    return null;
  }
}

function parseVersion(versionStr) {
  const m = versionStr.trim().match(/^[\^>=<~]*(.+)/);
  return m ? m[1] : versionStr;
}

function parseSemver(v) {
  const stripped = v.replace(/\+.*$/, '');
  const parts = stripped.split('.');
  const result = [];
  for (const p of parts) {
    const num = p.match(/^(\d+)/);
    result.push(num ? parseInt(num[1], 10) : 0);
  }
  while (result.length < 3) result.push(0);
  return result.slice(0, 3);
}

function cmpTuple(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x - y;
  }
  return 0;
}

function compareVersions(current, latest) {
  try {
    const curr = parseSemver(parseVersion(current));
    const lat = parseSemver(latest);
    return {
      needsUpdate: cmpTuple(lat, curr) > 0,
      isMajor: lat[0] > curr[0],
    };
  } catch {
    return { needsUpdate: false, isMajor: false };
  }
}

function getPackages(projectRoot, packageFilter) {
  const results = [];
  const rootPubspec = path.join(projectRoot, 'pubspec.yaml');
  if (fs.existsSync(rootPubspec)) {
    const raw = fs.readFileSync(rootPubspec, 'utf-8');
    const doc = YAML.parseDocument(raw);
    const ws = doc.get('workspace');
    if (YAML.isSeq(ws)) {
      for (const item of ws.items) {
        const entry = YAML.isScalar(item) ? String(item.value) : String(item);
        const entryPath = path.join(projectRoot, entry, 'pubspec.yaml');
        if (fs.existsSync(entryPath)) {
          results.push(entryPath);
        }
      }
    }
  }

  if (packageFilter) {
    const needleMid = `${path.sep}${packageFilter}${path.sep}`;
    const needleEnd = `${path.sep}${packageFilter}${path.sep}pubspec.yaml`;
    return results.filter(
      (r) => r.includes(needleMid) || r.endsWith(needleEnd),
    );
  }

  return results;
}

const SDK_PACKAGES = new Set(['flutter', 'flutter_test', 'flutter_web_plugins']);

async function analyzeDependencies(pubspecPath, excludePrefixes) {
  const raw = fs.readFileSync(pubspecPath, 'utf-8');
  const doc = YAML.parseDocument(raw);
  const data = doc.toJS() || {};

  const result = {
    path: pubspecPath,
    name: data.name ?? 'unknown',
    dependencies: [],
    dev_dependencies: [],
  };

  for (const section of ['dependencies', 'dev_dependencies']) {
    const deps = data[section] || {};
    const fetchTasks = [];

    for (const [pkgName, version] of Object.entries(deps)) {
      if (SDK_PACKAGES.has(pkgName)) continue;
      if (excludePrefixes.some((prefix) => pkgName.startsWith(prefix))) continue;
      // dict 형태 (git, path 등) 제외
      if (version && typeof version === 'object') continue;
      if (typeof version !== 'string') continue;

      fetchTasks.push(
        (async () => {
          const latest = await getLatestVersion(pkgName);
          if (!latest) return null;
          const { needsUpdate, isMajor } = compareVersions(version, latest);
          return {
            name: pkgName,
            current: version,
            latest,
            needsUpdate,
            isMajor,
          };
        })(),
      );
    }

    const resolved = await Promise.all(fetchTasks);
    for (const dep of resolved) {
      if (dep) result[section].push(dep);
    }
  }

  return result;
}

function printReport(analysisResults, includeMajor) {
  let totalUpdates = 0;

  for (const r of analysisResults) {
    process.stdout.write('\n');
    process.stdout.write(`${'='.repeat(60)}\n`);
    process.stdout.write(`📦 ${r.name}\n`);
    process.stdout.write(`${'='.repeat(60)}\n`);

    const allDeps = [...r.dependencies, ...r.dev_dependencies];
    if (allDeps.length === 0) {
      process.stdout.write('  📭 (외부 의존성 없음)\n');
      continue;
    }

    process.stdout.write(
      `  ${'Package'.padEnd(25)} ${'Current'.padEnd(12)} ${'Latest'.padEnd(12)} ${'Status'.padEnd(10)}\n`,
    );
    process.stdout.write(
      `  ${'-'.repeat(25)} ${'-'.repeat(12)} ${'-'.repeat(12)} ${'-'.repeat(10)}\n`,
    );

    let packageUpdates = 0;
    for (const dep of allDeps) {
      let status;
      if (dep.needsUpdate) {
        if (dep.isMajor) {
          status = '🔴 Major';
          if (includeMajor) packageUpdates += 1;
        } else {
          status = '🟡 Update';
          packageUpdates += 1;
        }
      } else {
        status = '🟢 Latest';
      }
      process.stdout.write(
        `  ${String(dep.name).padEnd(25)} ${String(dep.current).padEnd(12)} ${String(dep.latest).padEnd(12)} ${status.padEnd(10)}\n`,
      );
    }

    if (packageUpdates > 0) {
      process.stdout.write(`\n  ⬆️  업데이트 가능: ${packageUpdates}개\n`);
    }
    totalUpdates += packageUpdates;
  }

  process.stdout.write('\n');
  process.stdout.write(`${'='.repeat(60)}\n`);
  process.stdout.write(`📊 총 업데이트 가능 패키지: ${totalUpdates}개\n`);
  process.stdout.write(`${'='.repeat(60)}\n`);

  return totalUpdates;
}

function updatePubspec(pubspecPath, analysis, includeMajor) {
  const raw = fs.readFileSync(pubspecPath, 'utf-8');
  const doc = YAML.parseDocument(raw);

  let updatedCount = 0;

  for (const section of ['dependencies', 'dev_dependencies']) {
    const sectionNode = doc.get(section);
    if (!YAML.isMap(sectionNode)) continue;

    for (const dep of analysis[section]) {
      if (!dep.needsUpdate) continue;
      if (dep.isMajor && !includeMajor) continue;

      const pair = sectionNode.items.find(
        (p) => (YAML.isScalar(p.key) ? String(p.key.value) : String(p.key)) === dep.name,
      );
      if (!pair) continue;

      const newVersion = `^${dep.latest}`;
      if (YAML.isScalar(pair.value)) {
        pair.value.value = newVersion;
      } else {
        pair.value = doc.createNode(newVersion);
      }
      updatedCount += 1;
      process.stdout.write(`  ✨ ${dep.name}: ${dep.current} -> ${newVersion}\n`);
    }
  }

  if (updatedCount > 0) {
    fs.writeFileSync(pubspecPath, String(doc));
  }
  return updatedCount;
}

async function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const projectRoot = path.resolve(args.projectDir);

  const pubspecFiles = getPackages(projectRoot, args.package);
  if (pubspecFiles.length === 0) {
    process.stdout.write('❌ pubspec.yaml 파일을 찾을 수 없습니다.\n');
    return;
  }

  process.stdout.write('\n');
  process.stdout.write('🔍 Flutter Packages - Dependencies Update\n');
  process.stdout.write('\n');
  process.stdout.write(`📋 ${pubspecFiles.length}개의 패키지를 분석합니다...\n`);

  const analysisResults = [];
  for (const pubspecPath of pubspecFiles) {
    process.stdout.write(`  🔎 분석 중: ${pubspecPath}\n`);
    const analysis = await analyzeDependencies(pubspecPath, args.exclude);
    analysisResults.push(analysis);
  }

  const totalUpdates = printReport(analysisResults, args.includeMajor);

  if (args.report) return;
  if (totalUpdates === 0) {
    process.stdout.write('\n✅ 모든 패키지가 최신 버전입니다.\n');
    return;
  }

  process.stdout.write('\n');
  const answer = (await prompt('⚡ 업데이트를 진행하시겠습니까? [y/N]: ')).trim().toLowerCase();
  if (answer !== 'y') {
    process.stdout.write('\n⏭️  업데이트가 취소되었습니다.\n');
    return;
  }

  process.stdout.write('\n🔄 업데이트 중...\n');
  let totalUpdated = 0;
  for (const analysis of analysisResults) {
    process.stdout.write(`\n📦 [${analysis.name}]\n`);
    totalUpdated += updatePubspec(analysis.path, analysis, args.includeMajor);
  }

  process.stdout.write('\n');
  process.stdout.write(`${'='.repeat(60)}\n`);
  process.stdout.write(`🎉 총 ${totalUpdated}개의 의존성이 업데이트되었습니다.\n`);
  process.stdout.write(`${'='.repeat(60)}\n`);
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
