#!/usr/bin/env node
// =============================================================================
// Copies .husky hook templates from rules/<framework>/base/husky/ into
// <output-dir>/.husky/ and makes each hook executable.
//
// Optional -entry <dir> substitutes {{ENTRY}} placeholders in the copied
// hook files (used by flutter templates to bake the entry directory into
// the pre-commit script).
//
// Usage:
//   gen-husky.mjs <framework> -p <output-dir> [-entry <dir>]
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const HELP = `Usage: gen-husky.mjs <framework> -p <output-dir> [-entry <dir>]

Generates .husky hook files for the given framework.

Arguments:
  <framework>    Framework name (e.g. nextjs, nestjs, flutter)

Options:
  -p <dir>       Output directory (required)
  -entry <dir>   Substitute {{ENTRY}} in hook files (e.g. -entry app)
  -h, --help     Show this help

Examples:
  ./scripts/gen-husky.mjs nextjs -p ./my-project
  ./scripts/gen-husky.mjs nestjs -p ./my-project
  ./scripts/gen-husky.mjs flutter -p ./my-project -entry app
`;

function usage(code = 1) {
  (code === 0 ? process.stdout : process.stderr).write(HELP);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { framework: '', outputDir: '', entry: '' };
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
      case '-entry':
        if (!rest.length) {
          process.stderr.write('-entry requires a directory\n');
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
  const pluginRoot = path.resolve(scriptDir, '..');
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
    let content = fs.readFileSync(src, 'utf8');
    if (args.entry) {
      content = content.replaceAll('{{ENTRY}}', args.entry);
    }
    fs.writeFileSync(dest, content);
    fs.chmodSync(dest, 0o755);
    process.stdout.write(`Generated: ${dest}\n`);
  }
}

main();
