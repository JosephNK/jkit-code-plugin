#!/usr/bin/env node
// =============================================================================
// Bumps the plugin version, commits, tags, and pushes in one shot.
//
// Usage:
//   deploy.mjs [<version>|patch|minor|major] [--yes]
// =============================================================================

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const HELP = `Usage: ./deploy.mjs [<version>|patch|minor|major] [--yes]

Bumps the plugin version, commits, tags, and pushes in one shot.

Updates:
  - .claude-plugin/plugin.json            (version)
  - .claude-plugin/marketplace.json       (version)
  - package.json                          (version)
  - rules/flutter/base/custom-lint/architecture_lint/pubspec.yaml
    (version)
  - rules/flutter/base/custom-lint/architecture_lint/tools/analyzer_plugin/pubspec.yaml
    (version + architecture_lint git ref → v<new-version>)

Then:
  - git add + commit "chore: 버전 <new> 범프"
  - git tag v<new>
  - git push origin <branch> --follow-tags

Arguments:
  <version>  Explicit version (e.g. 0.1.28)
  patch      Increment patch (0.1.27 → 0.1.28) [default]
  minor      Increment minor (0.1.27 → 0.2.0)
  major      Increment major (0.1.27 → 1.0.0)

Options:
  --yes, -y  Skip confirmation prompt
  -h, --help Show this help

Examples:
  ./deploy.mjs
  ./deploy.mjs patch
  ./deploy.mjs 0.1.28
  ./deploy.mjs minor --yes
`;

function usage(code = 1) {
  (code === 0 ? process.stdout : process.stderr).write(HELP);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { bump: 'patch', explicitVersion: '', yes: false };
  const rest = argv.slice(2);

  while (rest.length > 0) {
    const a = rest.shift();
    switch (a) {
      case 'patch':
      case 'minor':
      case 'major':
        args.bump = a;
        break;
      case '--yes':
      case '-y':
        args.yes = true;
        break;
      case '-h':
      case '--help':
        usage(0);
        break;
      default:
        if (/^\d+\.\d+\.\d+$/.test(a)) {
          args.explicitVersion = a;
        } else {
          process.stderr.write(`Unknown argument: ${a}\n`);
          usage();
        }
    }
  }

  return args;
}

function git(argsArray) {
  return execFileSync('git', argsArray, { encoding: 'utf-8' }).trim();
}

function gitSafe(argsArray) {
  try {
    return execFileSync('git', argsArray, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function gitExists(argsArray) {
  const r = spawnSync('git', argsArray, { stdio: 'ignore' });
  return r.status === 0;
}

async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function computeNewVersion(current, bump) {
  const parts = current.split('.').map((x) => parseInt(x, 10));
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    process.stderr.write(`Error: unable to parse current version "${current}"\n`);
    process.exit(1);
  }
  let [maj, min, pat] = parts;
  switch (bump) {
    case 'patch':
      pat += 1;
      break;
    case 'minor':
      min += 1;
      pat = 0;
      break;
    case 'major':
      maj += 1;
      min = 0;
      pat = 0;
      break;
  }
  return `${maj}.${min}.${pat}`;
}

function updateJsonVersion(filePath, newVersion) {
  if (!fs.existsSync(filePath)) {
    process.stdout.write(`  Skipped ${filePath} (not found)\n`);
    return;
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  if ('version' in data) {
    data.version = newVersion;
  }
  if (Array.isArray(data.plugins)) {
    for (const plugin of data.plugins) {
      if (plugin && plugin.name === 'jkit') {
        plugin.version = newVersion;
      }
    }
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  process.stdout.write(`  Updated ${filePath}\n`);
}

function updatePubspecRef(filePath, newVersion) {
  const txt = fs.readFileSync(filePath, 'utf-8');
  const newTxt = txt.replace(/(ref:\s*)v\d+\.\d+\.\d+/, `$1v${newVersion}`);
  if (newTxt === txt) {
    process.stderr.write(`Failed to update ref in ${filePath}\n`);
    process.exit(1);
  }
  fs.writeFileSync(filePath, newTxt);
  process.stdout.write(`  Updated ${filePath} (ref → v${newVersion})\n`);
}

function updateYamlVersion(filePath, newVersion) {
  if (!fs.existsSync(filePath)) {
    process.stdout.write(`  Skipped ${filePath} (not found)\n`);
    return;
  }
  const txt = fs.readFileSync(filePath, 'utf-8');
  const re = /^(version:\s*)[\d.]+(?:[-+][\w.]+)?/m;
  if (!re.test(txt)) {
    process.stderr.write(`Failed to find version: field in ${filePath}\n`);
    process.exit(1);
  }
  const newTxt = txt.replace(re, `$1${newVersion}`);
  fs.writeFileSync(filePath, newTxt);
  process.stdout.write(`  Updated ${filePath} (version → ${newVersion})\n`);
}

async function main() {
  const args = parseArgs(process.argv);

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  process.chdir(scriptDir);

  // Safety checks
  const status = gitSafe(['status', '--porcelain']);
  if (status) {
    process.stderr.write(
      'Error: working tree has uncommitted changes. Commit or stash first.\n',
    );
    spawnSync('git', ['status', '--short'], { stdio: 'inherit' });
    process.exit(1);
  }

  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (branch !== 'main') {
    process.stdout.write(`Warning: current branch is '${branch}', not 'main'.\n`);
    if (!args.yes) {
      const ans = await prompt('Continue anyway? [y/N] ');
      if (!/^[Yy]$/.test(ans)) process.exit(1);
    }
  }

  const pluginJsonPath = '.claude-plugin/plugin.json';
  const marketplaceJsonPath = '.claude-plugin/marketplace.json';
  const rootPackageJsonPath = 'package.json';
  const architectureLintPubspecPath =
    'rules/flutter/base/custom-lint/architecture_lint/pubspec.yaml';
  const analyzerPluginPubspecPath =
    'rules/flutter/base/custom-lint/architecture_lint/tools/analyzer_plugin/pubspec.yaml';

  const current = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf-8')).version;
  process.stdout.write(`Current version: ${current}\n`);

  const newVersion = args.explicitVersion || computeNewVersion(current, args.bump);
  const tag = `v${newVersion}`;

  if (newVersion === current) {
    process.stderr.write(`Error: new version equals current version (${current})\n`);
    process.exit(1);
  }

  if (gitExists(['rev-parse', '--verify', '--quiet', tag])) {
    process.stderr.write(`Error: tag ${tag} already exists\n`);
    process.exit(1);
  }

  process.stdout.write(`New version:     ${newVersion}\n`);
  process.stdout.write(`New tag:         ${tag}\n`);

  // Show changes since last release
  const tagsOutput = gitSafe(['tag', '--list', 'v*', '--sort=-v:refname']);
  const lastTag = tagsOutput ? tagsOutput.split('\n')[0] : '';

  process.stdout.write('\n');
  let range;
  if (lastTag) {
    range = `${lastTag}..HEAD`;
    process.stdout.write(`─── Commits since ${lastTag} ───\n`);
  } else {
    range = 'HEAD';
    process.stdout.write('─── All commits (no previous tag) ───\n');
  }

  const commits = gitSafe(['log', '--pretty=format:  %h %s', range]);
  process.stdout.write(commits ? `${commits}\n` : '  (no new commits)\n');

  process.stdout.write('\n─── Files changed ───\n');
  const files = gitSafe(['diff', '--stat', range]);
  if (!files) {
    process.stdout.write('  (no file changes)\n');
  } else {
    process.stdout.write(
      files
        .split('\n')
        .map((l) => `  ${l}`)
        .join('\n') + '\n',
    );
  }

  process.stdout.write('\n─── Release actions ───\n');
  process.stdout.write(`  1. Update ${pluginJsonPath}            → ${newVersion}\n`);
  process.stdout.write(`  2. Update ${marketplaceJsonPath}       → ${newVersion}\n`);
  process.stdout.write(
    `  3. Update ${rootPackageJsonPath}                          → ${newVersion}\n`,
  );
  process.stdout.write(
    `  4. Update architecture_lint/pubspec.yaml          → version: ${newVersion}\n`,
  );
  process.stdout.write(
    `  5. Update analyzer_plugin/pubspec.yaml            → version: ${newVersion}, ref: ${tag}\n`,
  );
  process.stdout.write(`  6. git commit -m "chore: 버전 ${newVersion} 범프"\n`);
  process.stdout.write(`  7. git tag ${tag}\n`);
  process.stdout.write(`  8. git push origin ${branch} --follow-tags\n\n`);

  if (!args.yes) {
    const ans = await prompt('Proceed with release? [y/N] ');
    if (!/^[Yy]$/.test(ans)) {
      process.stdout.write('Aborted.\n');
      process.exit(1);
    }
  }

  // Update version files
  updateJsonVersion(pluginJsonPath, newVersion);
  updateJsonVersion(marketplaceJsonPath, newVersion);
  updateJsonVersion(rootPackageJsonPath, newVersion);
  updateYamlVersion(architectureLintPubspecPath, newVersion);
  updateYamlVersion(analyzerPluginPubspecPath, newVersion);
  updatePubspecRef(analyzerPluginPubspecPath, newVersion);

  // Commit + tag + push
  const addFiles = [
    pluginJsonPath,
    marketplaceJsonPath,
    architectureLintPubspecPath,
    analyzerPluginPubspecPath,
  ];
  if (fs.existsSync(rootPackageJsonPath)) addFiles.push(rootPackageJsonPath);
  spawnSync('git', ['add', ...addFiles], { stdio: 'inherit' });
  spawnSync('git', ['commit', '-m', `chore: 버전 ${newVersion} 범프`], { stdio: 'inherit' });
  spawnSync('git', ['tag', '-a', tag, '-m', `Release ${tag}`], { stdio: 'inherit' });

  process.stdout.write('\nPushing commit and tag...\n');
  const pushResult = spawnSync('git', ['push', 'origin', branch, '--follow-tags'], {
    stdio: 'inherit',
  });
  if (pushResult.status !== 0) process.exit(pushResult.status ?? 1);

  process.stdout.write(`\n✓ Released ${tag}\n`);
}

main();
