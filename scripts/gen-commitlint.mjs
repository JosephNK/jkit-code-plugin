#!/usr/bin/env node
// =============================================================================
// Copies rules/common/commitlint.config.mjs to <output-dir>/commitlint.config.mjs.
//
// Usage:
//   gen-commitlint.mjs -p <output-dir>
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { ensureGitRepo, normalizePath } from './common.mjs';

const HELP = `Usage: gen-commitlint.mjs -p <output-dir>

Copies common/commitlint.config.mjs to output directory as commitlint.config.mjs.

Options:
  -p <dir>       Output directory (required)
  -h, --help     Show this help

Examples:
  ./scripts/gen-commitlint.mjs -p ./my-project
`;

function usage(code = 1) {
  (code === 0 ? process.stdout : process.stderr).write(HELP);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { outputDir: '' };
  const rest = argv.slice(2);
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
  const source = path.join(
    pluginRoot,
    'rules',
    'common',
    'commitlint.config.mjs',
  );

  if (!fs.existsSync(source)) {
    process.stderr.write(`Error: commitlint.config.mjs not found: ${source}\n`);
    process.exit(1);
  }

  const outputFile = path.join(outputDir, 'commitlint.config.mjs');
  fs.copyFileSync(source, outputFile);

  process.stdout.write(`Generated: ${outputFile}\n`);
}

main();
