#!/usr/bin/env node
// =============================================================================
// Adds BuiltValue dependencies to a package's pubspec.yaml.
//
// Dependencies:      built_value, built_collection
// Dev dependencies:  build_runner, built_value_generator
//
// Idempotent: skips entries that already exist.
//
// Usage:
//   update-pubspec.mjs <pubspec_path> [--dry-run]
// =============================================================================

import fs from 'node:fs';
import process from 'node:process';

const DEPENDENCIES = {
  built_value: '^8.12.3',
  built_collection: '^5.1.1',
};

const DEV_DEPENDENCIES = {
  build_runner: '^2.4.15',
  built_value_generator: '^8.12.3',
};

const HELP = `Usage: update-pubspec.mjs <pubspec_path> [--dry-run]

Adds BuiltValue dependencies to a package's pubspec.yaml (idempotent).

Arguments:
  <pubspec_path>   Path to pubspec.yaml

Options:
  --dry-run        Preview changes without writing
  -h, --help       Show this help
`;

function usage(code = 1) {
  (code === 0 ? process.stdout : process.stderr).write(HELP);
  process.exit(code);
}

function parseArgs(argv) {
  const rest = argv.slice(2);
  const args = { pubspecPath: '', dryRun: false };

  for (const a of rest) {
    if (a === '-h' || a === '--help') usage(0);
  }

  if (rest.length >= 1 && !rest[0].startsWith('-')) {
    args.pubspecPath = rest.shift();
  }

  while (rest.length > 0) {
    const a = rest.shift();
    switch (a) {
      case '--dry-run':
        args.dryRun = true;
        break;
      default:
        process.stderr.write(`Unknown option: ${a}\n`);
        usage();
    }
  }

  if (!args.pubspecPath) {
    process.stderr.write('Usage: update-pubspec.mjs <pubspec_path> [--dry-run]\n');
    process.exit(1);
  }

  return args;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findBlockLastEntry(content, blockName) {
  const lines = content.split('\n');
  let inBlock = false;
  let lastEntryIdx = -1;

  const headerRe = new RegExp(`^${escapeRegExp(blockName)}:`);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (headerRe.test(line)) {
      inBlock = true;
      continue;
    }
    if (inBlock) {
      if (line.startsWith('  ')) {
        lastEntryIdx = i;
      } else if (line.trim() && !line.startsWith(' ')) {
        break;
      }
    }
  }

  return lastEntryIdx;
}

function hasDependency(content, depName) {
  const re = new RegExp(`^\\s+${escapeRegExp(depName)}:`, 'm');
  return re.test(content);
}

function addDependency(content, blockName, depName, version) {
  const lastIdx = findBlockLastEntry(content, blockName);
  if (lastIdx === -1) return content;

  const lines = content.split('\n');
  lines.splice(lastIdx + 1, 0, `  ${depName}: ${version}`);
  return lines.join('\n');
}

function updatePubspec(pubspecPath, dryRun) {
  if (!fs.existsSync(pubspecPath)) {
    process.stderr.write(`Error: ${pubspecPath} not found\n`);
    return false;
  }

  let content = fs.readFileSync(pubspecPath, 'utf8');
  const original = content;
  const added = [];

  for (const [dep, version] of Object.entries(DEPENDENCIES)) {
    if (hasDependency(content, dep)) {
      process.stdout.write(`  Skip: ${dep} (already present)\n`);
      continue;
    }
    if (dryRun) {
      process.stdout.write(`  [dry-run] Would add ${dep}: ${version} to dependencies\n`);
      added.push(dep);
    } else {
      content = addDependency(content, 'dependencies', dep, version);
      added.push(dep);
    }
  }

  for (const [dep, version] of Object.entries(DEV_DEPENDENCIES)) {
    if (hasDependency(content, dep)) {
      process.stdout.write(`  Skip: ${dep} (already present)\n`);
      continue;
    }
    if (dryRun) {
      process.stdout.write(`  [dry-run] Would add ${dep}: ${version} to dev_dependencies\n`);
      added.push(dep);
    } else {
      content = addDependency(content, 'dev_dependencies', dep, version);
      added.push(dep);
    }
  }

  if (added.length === 0) {
    process.stdout.write('  All dependencies already present.\n');
    return false;
  }

  if (!dryRun && content !== original) {
    fs.writeFileSync(pubspecPath, content, 'utf8');
    process.stdout.write(`  Added ${added.length} dependencies: ${added.join(', ')}\n`);
  }

  return true;
}

function main() {
  const args = parseArgs(process.argv);
  updatePubspec(args.pubspecPath, args.dryRun);
  return 0;
}

process.exit(main());
