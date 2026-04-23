#!/usr/bin/env node
// =============================================================================
// Copies .husky hook templates from rules/<framework>/base/husky/ into
// <output-dir>/.husky/ and makes each hook executable.
//
// Usage:
//   gen-husky.mjs <framework> -p <output-dir>
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const HELP = `Usage: gen-husky.mjs <framework> -p <output-dir>

Generates .husky hook files for the given framework.

Arguments:
  <framework>    Framework name (e.g. nextjs, nestjs)

Options:
  -p <dir>       Output directory (required)
  -h, --help     Show this help

Examples:
  ./scripts/typescript/gen-husky.mjs nextjs -p ./my-project
  ./scripts/typescript/gen-husky.mjs nestjs -p ./my-project
`;

function usage(code = 1) {
  (code === 0 ? process.stdout : process.stderr).write(HELP);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { framework: '', outputDir: '' };
  const rest = argv.slice(2);

  if (rest.length >= 1 && !rest[0].startsWith('-')) {
    args.framework = rest.shift();
  }

  while (rest.length > 0) {
    const a = rest.shift();
    switch (a) {
      case '-p':
        if (!rest.length) {
          process.stderr.write('-p requires a directory\n');
          usage();
        }
        args.outputDir = rest.shift();
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

  if (!args.framework) {
    process.stderr.write('Error: framework is required\n');
    usage();
  }
  if (!args.outputDir) {
    process.stderr.write('Error: -p <output-dir> is required\n');
    usage();
  }

  return args;
}

function main() {
  const args = parseArgs(process.argv);

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const pluginRoot = path.resolve(scriptDir, '..', '..');
  const huskySrc = path.join(
    pluginRoot,
    'rules',
    args.framework,
    'base',
    'husky',
  );

  if (!fs.existsSync(huskySrc) || !fs.statSync(huskySrc).isDirectory()) {
    process.stderr.write(`Error: Husky templates not found: ${huskySrc}\n`);
    process.exit(1);
  }

  const huskyDest = path.join(args.outputDir, '.husky');
  fs.mkdirSync(huskyDest, { recursive: true });

  // Sort for stable, bash-glob-like iteration.
  const entries = fs.readdirSync(huskySrc).sort();

  for (const hookName of entries) {
    const src = path.join(huskySrc, hookName);
    if (!fs.statSync(src).isFile()) continue;

    const dest = path.join(huskyDest, hookName);
    fs.copyFileSync(src, dest);
    fs.chmodSync(dest, 0o755);
    process.stdout.write(`Generated: ${dest}\n`);
  }
}

main();
