#!/usr/bin/env node
// =============================================================================
// Concatenates rules/<framework>/base/conventions.md with the conventions.md of
// each `--with` stack and writes the result to <output-dir>/CONVENTIONS.md.
//
// Missing stack files produce a warning; the run does not fail.
//
// Usage:
//   gen-conventions.mjs <framework> -p <output-dir> [--with stack1,stack2,...]
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { ensureGitRepo, normalizePath } from './common.mjs';

const HELP = `Usage: gen-conventions.mjs <framework> -p <output-dir> [--with stack1,stack2,...]

Concatenates base/conventions.md + selected stack conventions.md files.

Arguments:
  <framework>    Framework name (e.g. nextjs, nestjs, flutter)

Options:
  -p <dir>       Output directory (required)
  --with <list>  Comma-separated stacks (e.g. mantine,tanstack-query)
  -h, --help     Show this help

Examples:
  ./scripts/gen-conventions.mjs nextjs -p ./my-project --with mantine,tanstack-query,next-proxy
  ./scripts/gen-conventions.mjs nestjs -p ./my-project --with typeorm
`;

function usage(code = 1) {
  (code === 0 ? process.stdout : process.stderr).write(HELP);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { framework: '', outputDir: '', stacks: '' };
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
      case '--with':
        if (!rest.length) {
          process.stderr.write('--with requires a stack list\n');
          usage();
        }
        args.stacks = rest.shift();
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

function splitStacks(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function main() {
  const args = parseArgs(process.argv);

  try {
    ensureGitRepo('.');
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  }

  fs.mkdirSync(args.outputDir, { recursive: true });

  let outputDir;
  try {
    outputDir = normalizePath(args.outputDir);
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const pluginRoot = path.resolve(scriptDir, '..');
  const rulesDir = path.join(pluginRoot, 'rules', args.framework);
  const baseConv = path.join(rulesDir, 'base', 'conventions.md');

  if (!fs.existsSync(baseConv)) {
    process.stderr.write(`Error: Base conventions not found: ${baseConv}\n`);
    process.exit(1);
  }

  const outputFile = path.join(outputDir, 'CONVENTIONS.md');
  fs.copyFileSync(baseConv, outputFile);

  for (const stack of splitStacks(args.stacks)) {
    const stackConv = path.join(rulesDir, stack, 'conventions.md');
    if (!fs.existsSync(stackConv)) {
      process.stderr.write(
        `Warning: conventions.md not found for stack '${stack}': ${stackConv}\n`,
      );
      continue;
    }
    fs.appendFileSync(outputFile, '\n');
    fs.appendFileSync(outputFile, fs.readFileSync(stackConv));
  }

  process.stdout.write(`Generated: ${outputFile}\n`);
  if (args.stacks) {
    process.stdout.write(`Stacks: ${args.stacks}\n`);
  }
}

main();
