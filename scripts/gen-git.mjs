#!/usr/bin/env node
// =============================================================================
// Copies rules/common/git.md to <output-dir>/GIT.md.
//
// Usage:
//   gen-git.mjs -p <output-dir>
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { ensureGitRepo, normalizePath } from './common.mjs';

const HELP = `Usage: gen-git.mjs -p <output-dir>

Copies common/git.md to output directory as GIT.md.

Options:
  -p <dir>       Output directory (required)
  -h, --help     Show this help

Examples:
  ./scripts/gen-git.mjs -p ./my-project
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
  const source = path.join(pluginRoot, 'rules', 'common', 'git.md');

  if (!fs.existsSync(source)) {
    process.stderr.write(`Error: git.md not found: ${source}\n`);
    process.exit(1);
  }

  const outputFile = path.join(outputDir, 'GIT.md');
  fs.copyFileSync(source, outputFile);

  process.stdout.write(`Generated: ${outputFile}\n`);
}

main();
