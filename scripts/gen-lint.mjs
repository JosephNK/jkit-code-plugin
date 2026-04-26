#!/usr/bin/env node
// =============================================================================
// Concatenates rules/<framework>/base/lint-rules-reference.md and
// lint-rules-structure-reference.md (and stylelint-rules-reference.md for
// Next.js) into <output-dir>/LINT.md.
//
// Usage:
//   gen-lint.mjs <framework> -p <output-dir>
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { ensureGitRepo, normalizePath } from './common.mjs';

const HELP = `Usage: gen-lint.mjs <framework> -p <output-dir>

Concatenates base/lint-rules-reference.md + lint-rules-structure-reference.md
(+ stylelint-rules-reference.md for nextjs) into <output-dir>/LINT.md.

Arguments:
  <framework>    Framework name (nextjs, nestjs, flutter)

Options:
  -p <dir>       Output directory (required)
  -h, --help     Show this help

Examples:
  ./scripts/gen-lint.mjs nextjs -p ./my-project/docs
  ./scripts/gen-lint.mjs nestjs -p ./my-project/docs
  ./scripts/gen-lint.mjs flutter -p ./my-project/docs
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
  const baseDir = path.join(pluginRoot, 'rules', args.framework, 'base');

  const sources = ['lint-rules-reference.md', 'lint-rules-structure-reference.md'];
  if (args.framework === 'nextjs') {
    sources.push('stylelint-rules-reference.md');
  }

  for (const name of sources) {
    const p = path.join(baseDir, name);
    if (!fs.existsSync(p)) {
      process.stderr.write(`Error: source not found: ${p}\n`);
      process.exit(1);
    }
  }

  const outputFile = path.join(outputDir, 'LINT.md');
  const [first, ...rest] = sources;
  fs.copyFileSync(path.join(baseDir, first), outputFile);

  for (const name of rest) {
    fs.appendFileSync(outputFile, '\n');
    fs.appendFileSync(outputFile, fs.readFileSync(path.join(baseDir, name)));
  }

  process.stdout.write(`Generated: ${outputFile}\n`);
  process.stdout.write(`Sources: ${sources.join(', ')}\n`);
}

main();
